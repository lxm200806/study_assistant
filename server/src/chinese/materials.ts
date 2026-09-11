import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import prisma from '../prisma/client'
import { fillGroupFields, parseImport } from './cards'
import { DEFAULT_COURSE_NAME } from './constants'
import { GRADE_ORDER, LEVEL_ORDER, joinLabels, maybeExpandPackCards, mergeLabels, parseOptions } from './entries'
import type { PointLike } from './constants'
import { HttpError } from './http'

export interface PackSpec {
  slug: string
  title: string
  jsonName: string
  mdName: string
  sourceJson?: string
  attachToExistingDefault?: boolean
}

export const GRADE_PACKS: PackSpec[] = [
  { slug: 'grade1-shang', title: '部编版一年级上册｜必背古诗 + 日积月累 + 课文优美句子', jsonName: '部编一年级上册.json', mdName: '部编一年级上册.md' },
  { slug: 'grade1-xia', title: '部编版一年级下册｜必背古诗 + 日积月累 + 课文优美句子', jsonName: '部编一年级下册.json', mdName: '部编一年级下册.md' },
  { slug: 'grade2-shang', title: '部编版二年级上册｜必背古诗 + 日积月累 + 课文优美句子', jsonName: '部编二年级上册.json', mdName: '部编二年级上册.md' },
  { slug: 'grade2-xia', title: '部编版二年级下册｜必背古诗 + 日积月累 + 课文优美句子', jsonName: '部编二年级下册.json', mdName: '部编二年级下册.md' },
  { slug: 'grade3-shang', title: '部编版三年级上册｜必背古诗 + 日积月累 + 课文优美句子', jsonName: '部编三年级上册.json', mdName: '部编三年级上册.md' },
  { slug: 'grade3-xia', title: '部编版三年级下册｜必背古诗 + 日积月累 + 课文优美句子', jsonName: '部编三年级下册.json', mdName: '部编三年级下册.md' },
  { slug: 'grade4-shang', title: '部编版四年级上册｜必背古诗 + 日积月累 + 课文优美句子', jsonName: '部编四年级上册.json', mdName: '部编四年级上册.md' },
  { slug: 'grade4-xia', title: '部编版四年级下册｜必背古诗 + 日积月累 + 课文优美句子', jsonName: '部编四年级下册.json', mdName: '部编四年级下册.md' },
  { slug: 'grade5-shang', title: '部编版五年级上册｜必背古诗 + 日积月累 + 课文优美句子', jsonName: '部编五年级上册.json', mdName: '部编五年级上册.md' },
  { slug: 'grade5-xia', title: '部编版五年级下册｜必背古诗 + 日积月累 + 课文优美句子', jsonName: '部编五年级下册.json', mdName: '部编五年级下册.md' },
  { slug: 'grade6-shang', title: '部编版六年级上册｜必背古诗 + 日积月累 + 课文优美句子', jsonName: '部编六年级上册.json', mdName: '部编六年级上册.md' },
  { slug: 'grade6-xia', title: '部编版六年级下册｜必背古诗 + 日积月累 + 课文优美句子', jsonName: '部编六年级下册.json', mdName: '部编六年级下册.md' }
]

export const IDIOM_PACK: PackSpec = {
  slug: 'elementary-idioms',
  title: '小学成语',
  jsonName: '小学成语_发布包.json',
  mdName: '小学成语.md',
  sourceJson: path.join('idioms', 'generated', '小学成语_发布包.json'),
  attachToExistingDefault: false
}

export const PACKS = [...GRADE_PACKS, IDIOM_PACK]

export function chineseDataRoot(): string {
  return process.env.CHINESE_DATA_ROOT || path.resolve(__dirname, '../../data/chinese')
}

export function chineseRawRoot(): string {
  const configured = (process.env.CHINESE_RAW_ROOT || '').trim()
  if (configured) return configured
  return path.join(chineseDataRoot(), 'raw')
}

export function findPack(slug: unknown): PackSpec | null {
  let text = String(slug || '').trim()
  if (text.endsWith('-original')) text = text.slice(0, -'-original'.length)
  return PACKS.find(pack => pack.slug === text) || null
}

function packJsonPath(spec: PackSpec): string {
  if (spec.sourceJson) {
    const fallback = path.join(chineseRawRoot(), spec.sourceJson)
    if (fs.existsSync(fallback)) return fallback
  }
  return path.join(chineseRawRoot(), spec.jsonName)
}

function normalizeOriginal(text: string): string {
  return (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

function packFingerprint(pack: { original?: string; points?: PointLike[] }): string {
  const payload = {
    original: normalizeOriginal(pack.original || ''),
    points: (pack.points || []).map(item => ({
      key: String(item.key || ''),
      kind: String(item.kind || ''),
      level: String(item.level || ''),
      grade: String(item.grade || ''),
      prompt: String(item.prompt || ''),
      answer: String(item.answer || ''),
      tags: String(item.tags || ''),
      source: String(item.source || ''),
      entry_key: String(item.entry_key || ''),
      lemma: String(item.lemma || ''),
      question_type: String(item.question_type || ''),
      audience: String(item.audience || ''),
      difficulty: String(item.difficulty || ''),
      active: item.active !== false && item.isActive !== false,
      options: String(item.options || '')
    }))
  }
  const raw = JSON.stringify(payload)
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

function parseVersion(value: unknown): number {
  const version = Number(value || 0)
  return Number.isFinite(version) && version > 0 ? version : 1
}

function nextVersion(oldVersion: number, oldHash: string, newHash: string): number {
  const version = parseVersion(oldVersion)
  if (oldHash && newHash && oldHash !== newHash) return version + 1
  return version
}

export function syncState(fileHash: string, syncedHash: string): 'pending' | 'synced' | 'outdated' {
  if (!syncedHash) return 'pending'
  if (syncedHash === fileHash) return 'synced'
  return 'outdated'
}

export function loadPack(spec: PackSpec) {
  const jsonPath = packJsonPath(spec)
  if (!fs.existsSync(jsonPath)) {
    return {
      slug: spec.slug,
      title: spec.title,
      original: '',
      points: [] as PointLike[],
      skip: 0,
      contentHash: '',
      version: 1,
      missing: true
    }
  }
  const raw = fs.readFileSync(jsonPath, 'utf8')
  const data = JSON.parse(raw)
  const parsed = parseImport(raw)
  const original = String(data.original || '')
  const loaded = {
    slug: String(data.slug || spec.slug),
    title: spec.title,
    original,
    points: maybeExpandPackCards(parsed.ok.map(item => fillGroupFields(item))),
    skip: parsed.skip,
    version: parseVersion(data.version),
    contentHash: '',
    missing: false
  }
  loaded.contentHash = String(data.contentHash || '') || packFingerprint(loaded)
  loaded.contentHash = packFingerprint(loaded)
  loaded.version = nextVersion(parseVersion(data.version), String(data.contentHash || ''), loaded.contentHash)
  return loaded
}

function dumpPack(pack: ReturnType<typeof loadPack>): string {
  return JSON.stringify(
    {
      slug: pack.slug,
      title: pack.title,
      version: parseVersion(pack.version),
      contentHash: pack.contentHash,
      original: pack.original || '',
      points: pack.points
    },
    null,
    2
  )
}

function writeOfficialFiles(pack: ReturnType<typeof loadPack>, spec: PackSpec): [string, string] {
  const folder = path.join(chineseDataRoot(), 'official', 'bundled')
  fs.mkdirSync(folder, { recursive: true })
  const jsonRel = path.posix.join('official', 'bundled', spec.jsonName)
  const mdRel = path.posix.join('official', 'bundled', spec.mdName)
  fs.writeFileSync(path.join(chineseDataRoot(), jsonRel), dumpPack(pack), 'utf8')
  fs.writeFileSync(path.join(chineseDataRoot(), mdRel), pack.original || '', 'utf8')
  return [jsonRel, mdRel]
}

async function ensureResource(relPath: string, filename: string, slug: string, mime: string, version = 0, contentHash = '') {
  const existing = await prisma.chineseResource.findFirst({
    where: { ownerType: 'official', slug }
  })
  if (existing) {
    return prisma.chineseResource.update({
      where: { id: existing.id },
      data: { path: relPath, filename, mime, status: 'extracted' }
    })
  }
  const admin = await prisma.user.findFirst({ where: { isAdmin: true }, orderBy: { createdAt: 'asc' } })
  return prisma.chineseResource.create({
    data: {
      ownerType: 'official',
      path: relPath,
      filename,
      mime,
      status: 'extracted',
      uploadedBy: admin?.id,
      slug,
      syncedVersion: version,
      syncedHash: contentHash
    }
  })
}

export async function upsertEntry(point: PointLike) {
  const key = String(point.entry_key || '').trim()
  if (!key) return
  const existing = await prisma.chineseEntry.findUnique({
    where: { entryKey: key },
    include: { gradeLinks: true, levelLinks: true }
  })
  const kind = String(point.kind || existing?.kind || '')
  const idiom = kind === 'idiom'
  const grades = idiom ? [] : mergeLabels(joinLabels(existing?.gradeLinks.map(item => item.grade) || []), point.grade, GRADE_ORDER)
  const levels = idiom ? [] : mergeLabels(joinLabels(existing?.levelLinks.map(item => item.level) || []), point.level, LEVEL_ORDER)
  const sources = mergeLabels(existing?.source, point.source)
  const tags = mergeLabels(existing?.tags, point.tags)
  const lemma = String(point.lemma || existing?.lemma || '').trim()
  await prisma.chineseEntry.upsert({
    where: { entryKey: key },
    create: {
      entryKey: key,
      kind,
      lemma,
      tags: joinLabels(tags),
      source: joinLabels(sources)
    },
    update: {
      kind,
      lemma: lemma || undefined,
      tags: joinLabels(tags),
      source: joinLabels(sources)
    }
  })
  if (idiom) {
    await prisma.chineseEntryGrade.deleteMany({ where: { entryKey: key } })
    await prisma.chineseEntryLevel.deleteMany({ where: { entryKey: key } })
    return
  }
  for (const grade of grades) {
    await prisma.chineseEntryGrade.upsert({
      where: { entryKey_grade: { entryKey: key, grade } },
      create: { entryKey: key, grade },
      update: {}
    })
  }
  for (const level of levels) {
    await prisma.chineseEntryLevel.upsert({
      where: { entryKey_level: { entryKey: key, level } },
      create: { entryKey: key, level },
      update: {}
    })
  }
}

function pointUnchanged(row: { kind: string; level: string; grade: string; prompt: string; answer: string; tags: string; source: string; pointKey: string | null; groupKey: string; subGroupKey: string; entryKey: string; lemma: string; questionType: string; audience: string; difficulty: string; isActive: boolean; options: unknown; sourceResourceId: string | null; status?: string }, point: PointLike, resourceId: string | null, key: string) {
  return (
    row.kind === point.kind &&
    row.level === point.level &&
    (row.grade || '') === (point.grade || '') &&
    row.prompt === point.prompt &&
    row.answer === point.answer &&
    (row.tags || '') === (point.tags || '') &&
    (row.source || '') === (point.source || '') &&
    (row.pointKey || '') === key &&
    (row.groupKey || '') === (point.group_key || '') &&
    (row.subGroupKey || '') === (point.sub_group_key || '') &&
    (row.entryKey || '') === (point.entry_key || '') &&
    (row.lemma || '') === (point.lemma || '') &&
    (row.questionType || 'dictation') === (point.question_type || 'dictation') &&
    (row.audience || 'all') === (point.audience || 'all') &&
    (row.difficulty || '') === (point.difficulty || '') &&
    row.isActive === (point.active !== false && point.isActive !== false) &&
    JSON.stringify(parseOptions(row.options)) === JSON.stringify(parseOptions(point.options)) &&
    (row.sourceResourceId === resourceId || resourceId == null) &&
    (row.status || 'published') === 'published'
  )
}

export async function upsertPublished(pointInput: PointLike, resourceId: string | null = null, force = false): Promise<[string, 'unchanged' | 'updated' | 'inserted']> {
  const point = fillGroupFields({ ...pointInput })
  if (point.kind === 'idiom') {
    point.grade = ''
    point.audience = 'all'
  }
  await upsertEntry(point)
  const key = String(point.key || '').trim() || null
  let existing = key
    ? await prisma.chinesePublished.findUnique({ where: { pointKey: key } })
    : null
  if (!existing) {
    existing = await prisma.chinesePublished.findFirst({
      where: {
        prompt: String(point.prompt),
        answer: String(point.answer),
        questionType: String(point.question_type || 'dictation')
      }
    })
    if (existing && key && existing.pointKey && existing.pointKey !== key) existing = null
  }
  const data = {
    kind: String(point.kind),
    level: String(point.level),
    grade: String(point.grade || ''),
    prompt: String(point.prompt),
    answer: String(point.answer),
    tags: String(point.tags || ''),
    source: String(point.source || ''),
    sourceResourceId: resourceId,
    pointKey: key,
    groupKey: String(point.group_key || ''),
    subGroupKey: String(point.sub_group_key || ''),
    entryKey: String(point.entry_key || ''),
    lemma: String(point.lemma || ''),
    questionType: String(point.question_type || 'dictation'),
    audience: String(point.audience || 'all'),
    difficulty: String(point.difficulty || ''),
    isActive: point.active !== false && point.isActive !== false,
    options: parseOptions(point.options) as object,
    status: 'published',
    publishedAt: new Date()
  }
  if (existing) {
    if (!force && pointUnchanged(existing, point, resourceId, key || '')) return [existing.id, 'unchanged']
    const updated = await prisma.chinesePublished.update({
      where: { id: existing.id },
      data: { ...data, publishedAt: new Date() }
    })
    return [updated.id, 'updated']
  }
  const created = await prisma.chinesePublished.create({ data })
  return [created.id, 'inserted']
}

export async function attachDefaultCourse(pointIds: string[]) {
  const courses = await prisma.chineseCourse.findMany({ where: { name: DEFAULT_COURSE_NAME } })
  for (const course of courses) {
    const existing = await prisma.chineseCourseItem.findMany({
      where: { courseId: course.id },
      select: { pointId: true, sort: true }
    })
    const have = new Set(existing.map(item => item.pointId))
    let maxSort = existing.reduce((max, item) => Math.max(max, item.sort), -1)
    for (const pointId of pointIds) {
      if (have.has(pointId)) continue
      maxSort += 1
      await prisma.chineseCourseItem.create({ data: { courseId: course.id, pointId, sort: maxSort } })
    }
  }
}

export async function syncPack(spec: PackSpec, force = true) {
  const pack = loadPack(spec)
  if (pack.missing) {
    return {
      resourceId: null,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      skip: 0,
      total: 0,
      title: spec.title,
      version: 1,
      contentHash: '',
      syncState: 'pending',
      skipped: true,
      missing: true
    }
  }
  const [jsonRel, mdRel] = writeOfficialFiles(pack, spec)
  const jsonResource = await ensureResource(
    jsonRel,
    spec.jsonName,
    spec.slug,
    'application/json',
    pack.version || 1,
    pack.contentHash || ''
  )
  await ensureResource(mdRel, spec.mdName, `${spec.slug}-original`, 'text/markdown')
  let inserted = 0
  let updated = 0
  let unchanged = 0
  const ids: string[] = []
  for (const point of pack.points) {
    const [pointId, status] = await upsertPublished(point, jsonResource.id, force)
    ids.push(pointId)
    if (status === 'inserted') inserted += 1
    else if (status === 'updated') updated += 1
    else unchanged += 1
  }
  if (spec.attachToExistingDefault !== false) await attachDefaultCourse(ids)
  await prisma.chineseResource.update({
    where: { id: jsonResource.id },
    data: { status: 'extracted', syncedVersion: parseVersion(pack.version), syncedHash: pack.contentHash || '' }
  })
  return {
    resourceId: jsonResource.id,
    inserted,
    updated,
    unchanged,
    skip: pack.skip || 0,
    total: pack.points.length,
    title: pack.title || spec.title,
    version: pack.version || 1,
    contentHash: pack.contentHash || '',
    syncState: 'synced'
  }
}

export async function packStatus(spec: PackSpec) {
  const pack = loadPack(spec)
  const resource = await prisma.chineseResource.findFirst({
    where: { ownerType: 'official', slug: spec.slug }
  })
  const syncedHash = resource?.syncedHash || ''
  const syncedVersion = resource?.syncedVersion || 0
  return {
    slug: spec.slug,
    title: pack.title || spec.title,
    version: pack.version || 1,
    contentHash: pack.contentHash || '',
    syncedVersion,
    syncedHash,
    syncState: pack.missing ? 'pending' : syncState(pack.contentHash || '', syncedHash),
    pointCount: pack.points.length,
    missing: Boolean(pack.missing)
  }
}

export function decorateResource(row: { slug: string; filename: string; syncedVersion: number; path?: string }, statusBySlug?: Record<string, Awaited<ReturnType<typeof packStatus>>>) {
  const slug = row.slug || ''
  const spec = findPack(slug)
  const isPack = Boolean(spec) && !slug.endsWith('-original')
  const isOriginal = slug.endsWith('-original')
  const info = statusBySlug?.[(spec && spec.slug) || '']
  const base = {
    ...row,
    isPack,
    isOriginal,
    version: info?.version ?? row.syncedVersion,
    syncedVersion: info?.syncedVersion ?? row.syncedVersion,
    syncState: info?.syncState ?? '',
    pointCount: info?.pointCount ?? 0,
    title: info?.title || spec?.title || row.filename
  }
  return base
}

export function summarizeSync(results: Array<Record<string, unknown>>, mode: string) {
  return {
    mode,
    packs: results.length,
    synced: results.filter(item => !item.skipped).length,
    skipped: results.filter(item => item.skipped).length,
    inserted: results.reduce((sum, item) => sum + Number(item.inserted || 0), 0),
    updated: results.reduce((sum, item) => sum + Number(item.updated || 0), 0),
    unchanged: results.reduce((sum, item) => sum + Number(item.unchanged || 0), 0),
    items: results
  }
}

export async function syncAllOfficial(force = false) {
  const results = []
  for (const spec of PACKS) {
    if (!force) {
      const info = await packStatus(spec)
      if (info.syncState === 'synced') {
        results.push({
          resourceId: null,
          inserted: 0,
          updated: 0,
          unchanged: info.pointCount,
          skip: 0,
          total: info.pointCount,
          title: info.title,
          version: info.version,
          contentHash: info.contentHash,
          syncState: 'synced',
          skipped: true
        })
        continue
      }
    }
    results.push(await syncPack(spec, force))
  }
  return results
}

export async function getResource(resourceId: string) {
  const row = await prisma.chineseResource.findUnique({ where: { id: resourceId } })
  if (!row) throw new HttpError(404, '资源不存在')
  const linked = await prisma.chinesePublished.count({ where: { sourceResourceId: resourceId } })
  let original = ''
  const dest = path.join(chineseDataRoot(), row.path)
  if (fs.existsSync(dest) && fs.statSync(dest).isFile()) {
    const text = fs.readFileSync(dest, 'utf8')
    if (row.filename.endsWith('.json')) {
      try {
        const data = JSON.parse(text)
        original = String(data.original || '') || text
      } catch {
        original = text
      }
    } else {
      original = text
    }
  }
  return { ...row, linkedPoints: linked, original }
}

export async function syncResourceById(resourceId: string, force = true) {
  const resource = await prisma.chineseResource.findUnique({ where: { id: resourceId } })
  if (!resource) throw new HttpError(404, '资源不存在')
  const spec = findPack(resource.slug)
  if (spec) {
    const result = await syncPack(spec, force)
    return { ...result, ok: Number(result.inserted || 0) + Number(result.updated || 0) + Number(result.unchanged || 0), filename: resource.filename }
  }
  const dest = path.join(chineseDataRoot(), resource.path)
  if (!fs.existsSync(dest)) throw new HttpError(404, '资源文件不存在')
  const parsed = parseImport(fs.readFileSync(dest, 'utf8'))
  let inserted = 0
  let updated = 0
  const ids: string[] = []
  for (const point of parsed.ok) {
    const [pointId, status] = await upsertPublished(point, resourceId, true)
    ids.push(pointId)
    if (status === 'inserted') inserted += 1
    else if (status === 'updated') updated += 1
  }
  await attachDefaultCourse(ids)
  await prisma.chineseResource.update({ where: { id: resourceId }, data: { status: 'extracted' } })
  return {
    resourceId,
    inserted,
    updated,
    skip: parsed.skip,
    total: parsed.ok.length,
    title: resource.filename,
    filename: resource.filename,
    ok: inserted + updated
  }
}

export async function seedChineseIfEmpty() {
  const count = await prisma.chinesePublished.count()
  if (count > 0) {
    console.log(`Chinese library already has ${count} points`)
    return { skipped: true, count }
  }
  const results = await syncAllOfficial(true)
  const summary = summarizeSync(results, 'seed')
  console.log(`Chinese library seeded: inserted ${summary.inserted}, updated ${summary.updated}`)
  return summary
}
