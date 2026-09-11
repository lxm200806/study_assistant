import prisma from '../prisma/client'
import { Prisma } from '@prisma/client'
import { fillGroupFields, pageArgs, parseImport, validateCard, normalizeGrade } from './cards'
import { isKind, isLevel } from './constants'
import { parseOptions } from './entries'
import { HttpError } from './http'
import { attachDefaultCourse, upsertEntry } from './materials'

function optionsJson(value: unknown): Prisma.InputJsonValue {
  return parseOptions(value) as Prisma.InputJsonValue
}

function serializeDraft(row: {
  id: string
  kind: string
  level: string
  grade: string
  prompt: string
  answer: string
  tags: string
  source: string
  sourceResourceId: string | null
  pointKey: string | null
  groupKey: string
  subGroupKey: string
  entryKey: string
  lemma: string
  questionType: string
  audience: string
  options: Prisma.JsonValue
  status: string
  createdAt: Date
}) {
  return {
    ...row,
    pointKey: row.pointKey || '',
    options: parseOptions(row.options),
    point_key: row.pointKey || '',
    group_key: row.groupKey,
    sub_group_key: row.subGroupKey,
    entry_key: row.entryKey,
    question_type: row.questionType,
    source_resource_id: row.sourceResourceId
  }
}

export async function importDrafts(userId: string, text: string, resourceId?: string) {
  const parsed = parseImport(text)
  if (resourceId) {
    const resource = await prisma.chineseResource.findUnique({ where: { id: resourceId } })
    if (!resource) throw new HttpError(404, '资源不存在')
  }
  const items = []
  for (const point of parsed.ok) {
    const row = await prisma.chinesePublished.create({
      data: {
        kind: String(point.kind),
        level: String(point.level),
        grade: String(point.grade || ''),
        prompt: String(point.prompt),
        answer: String(point.answer),
        tags: String(point.tags || ''),
        source: String(point.source || ''),
        sourceResourceId: resourceId || null,
        createdBy: userId,
        pointKey: String(point.key || '').trim() || null,
        groupKey: String(point.group_key || ''),
        subGroupKey: String(point.sub_group_key || ''),
        entryKey: String(point.entry_key || ''),
        lemma: String(point.lemma || ''),
        questionType: String(point.question_type || 'dictation'),
        audience: String(point.audience || 'all'),
        options: optionsJson(point.options),
        status: 'draft',
        isActive: false,
        publishedAt: null
      }
    })
    items.push(serializeDraft(row))
  }
  if (resourceId && items.length) {
    await prisma.chineseResource.update({ where: { id: resourceId }, data: { status: 'extracted' } })
  }
  return { ok: items.length, skip: parsed.skip, items }
}

export async function listDrafts(status = 'draft', limit?: unknown, offset?: unknown) {
  const [safeLimit, safeOffset] = pageArgs(limit, offset)
  const where = { status }
  const [total, rows] = await Promise.all([
    prisma.chinesePublished.count({ where }),
    prisma.chinesePublished.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      skip: safeOffset
    })
  ])
  return { items: rows.map(serializeDraft), total, limit: safeLimit, offset: safeOffset }
}

export async function patchDraft(draftId: string, body: Record<string, unknown>) {
  const row = await prisma.chinesePublished.findUnique({ where: { id: draftId } })
  if (!row || row.status === 'published') throw new HttpError(404, '草稿不存在')
  const kind = String(body.kind ?? row.kind)
  const level = String(body.level ?? row.level)
  const prompt = String(body.prompt ?? row.prompt)
  const answer = String(body.answer ?? row.answer)
  if (!isKind(kind) || !isLevel(level)) throw new HttpError(400, '类型或级别无效')
  const error = validateCard(kind, prompt, answer)
  if (error) throw new HttpError(400, error)
  const updated = await prisma.chinesePublished.update({
    where: { id: draftId },
    data: {
      kind,
      level,
      grade: normalizeGrade(body.grade ?? row.grade),
      prompt,
      answer,
      tags: String(body.tags ?? row.tags ?? ''),
      source: String(body.source ?? row.source ?? ''),
      status: String(body.status ?? row.status),
      options: body.options === undefined ? undefined : optionsJson(body.options)
    }
  })
  return serializeDraft(updated)
}

export async function publishDraft(draftId: string) {
  const draft = await prisma.chinesePublished.findUnique({ where: { id: draftId } })
  if (!draft || draft.status === 'discarded') throw new HttpError(404, '草稿不可发布')
  if (draft.status === 'published') return draft
  const grouped = fillGroupFields({
    key: draft.pointKey || '',
    kind: draft.kind,
    level: draft.level,
    grade: normalizeGrade(draft.grade),
    prompt: draft.prompt,
    answer: draft.answer,
    tags: draft.tags || '',
    source: draft.source || '',
    entry_key: draft.entryKey || '',
    lemma: draft.lemma || '',
    question_type: draft.questionType || 'dictation',
    audience: draft.audience || 'all',
    options: parseOptions(draft.options)
  })
  const error = validateCard(
    String(grouped.kind),
    grouped.prompt,
    grouped.answer,
    String(grouped.question_type),
    String(grouped.lemma || '')
  )
  if (error) throw new HttpError(400, error)
  await upsertEntry(grouped)
  const published = await prisma.chinesePublished.update({
    where: { id: draftId },
    data: {
      kind: String(grouped.kind),
      level: String(grouped.level),
      grade: String(grouped.grade || ''),
      prompt: String(grouped.prompt),
      answer: String(grouped.answer),
      tags: String(grouped.tags || ''),
      source: String(grouped.source || ''),
      pointKey: String(grouped.key || '').trim() || draft.pointKey || null,
      groupKey: String(grouped.group_key || ''),
      subGroupKey: String(grouped.sub_group_key || ''),
      entryKey: String(grouped.entry_key || ''),
      lemma: String(grouped.lemma || ''),
      questionType: String(grouped.question_type || 'dictation'),
      audience: String(grouped.audience || 'all'),
      options: optionsJson(grouped.options),
      draftId,
      status: 'published',
      isActive: true,
      publishedAt: new Date()
    }
  })
  await attachDefaultCourse([published.id])
  return published
}

export async function publishDraftsBatch(ids: string[]) {
  const unique = Array.from(new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean)))
  if (!unique.length) throw new HttpError(400, '请选择要发布的草稿')
  const published = []
  const errors = []
  for (const id of unique) {
    try {
      published.push(await publishDraft(id))
    } catch (error) {
      errors.push({ id, detail: error instanceof Error ? error.message : '发布失败' })
    }
  }
  return { ok: published.length, fail: errors.length, items: published, errors }
}
