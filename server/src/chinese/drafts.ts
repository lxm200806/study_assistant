import prisma from '../prisma/client'
import { fillGroupFields, pageArgs, parseImport, validateCard, normalizeGrade } from './cards'
import { isKind, isLevel } from './constants'
import { HttpError } from './http'
import { attachDefaultCourse, upsertPublished } from './materials'

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
  pointKey: string
  groupKey: string
  subGroupKey: string
  entryKey: string
  lemma: string
  questionType: string
  audience: string
  options: string
  status: string
  createdAt: Date
}) {
  return {
    ...row,
    point_key: row.pointKey,
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
    const row = await prisma.chineseDraft.create({
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
        pointKey: String(point.key || ''),
        groupKey: String(point.group_key || ''),
        subGroupKey: String(point.sub_group_key || ''),
        entryKey: String(point.entry_key || ''),
        lemma: String(point.lemma || ''),
        questionType: String(point.question_type || 'dictation'),
        audience: String(point.audience || 'all'),
        options: String(point.options || ''),
        status: 'draft'
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
    prisma.chineseDraft.count({ where }),
    prisma.chineseDraft.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      skip: safeOffset
    })
  ])
  return { items: rows.map(serializeDraft), total, limit: safeLimit, offset: safeOffset }
}

export async function patchDraft(draftId: string, body: Record<string, unknown>) {
  const row = await prisma.chineseDraft.findUnique({ where: { id: draftId } })
  if (!row) throw new HttpError(404, '草稿不存在')
  const kind = String(body.kind ?? row.kind)
  const level = String(body.level ?? row.level)
  const prompt = String(body.prompt ?? row.prompt)
  const answer = String(body.answer ?? row.answer)
  if (!isKind(kind) || !isLevel(level)) throw new HttpError(400, '类型或级别无效')
  const error = validateCard(kind, prompt, answer)
  if (error) throw new HttpError(400, error)
  const updated = await prisma.chineseDraft.update({
    where: { id: draftId },
    data: {
      kind,
      level,
      grade: normalizeGrade(body.grade ?? row.grade),
      prompt,
      answer,
      tags: String(body.tags ?? row.tags ?? ''),
      source: String(body.source ?? row.source ?? ''),
      status: String(body.status ?? row.status)
    }
  })
  return serializeDraft(updated)
}

export async function publishDraft(draftId: string) {
  const draft = await prisma.chineseDraft.findUnique({ where: { id: draftId } })
  if (!draft || draft.status === 'discarded') throw new HttpError(404, '草稿不可发布')
  if (draft.status === 'published') {
    const existing = await prisma.chinesePublished.findFirst({ where: { draftId } })
    if (existing) return existing
    throw new HttpError(404, '草稿不可发布')
  }
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
    options: draft.options || ''
  })
  const error = validateCard(
    String(grouped.kind),
    grouped.prompt,
    grouped.answer,
    String(grouped.question_type),
    String(grouped.lemma || '')
  )
  if (error) throw new HttpError(400, error)
  const [publishedId] = await upsertPublished(grouped, draft.sourceResourceId, true)
  await prisma.chinesePublished.update({ where: { id: publishedId }, data: { draftId } })
  await prisma.chineseDraft.update({ where: { id: draftId }, data: { status: 'published' } })
  await attachDefaultCourse([publishedId])
  return prisma.chinesePublished.findUnique({ where: { id: publishedId } })
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
