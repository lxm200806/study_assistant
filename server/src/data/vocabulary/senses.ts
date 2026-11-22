import fs from 'fs'
import path from 'path'
import type { CefrLevel, ContentType, TopicCategory } from './types'

/** pending = 待校验；llm = 大模型已校验；verified = 人工已校验 */
export type LexiconStatus = 'pending' | 'llm' | 'verified'
export type SentenceRole = 'basic' | 'ext'

export function normalizeLexiconStatus(raw: unknown): LexiconStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (s === 'verified' || s === 'v' || s === 'human') return 'verified'
  if (s === 'llm' || s === 'ai') return 'llm'
  return 'pending'
}

export interface BilingualText {
  zh?: string
  en?: string
}

/** uk/us 分写；不分时用 g（通用） */
export interface PhoneticSet {
  uk?: string
  us?: string
  g?: string
}

export interface LexiconSentence {
  en: string
  zh?: string
  role: SentenceRole
  /** 这句按哪个级别写的；默认同词的 level */
  level?: string
}

export interface LexiconMeaning {
  pos?: string
  meaning: BilingualText
  sentences: LexiconSentence[]
}

/** 全局词典条目（磁盘存储形态） */
export interface GlobalSense {
  meanings: LexiconMeaning[]
  phonetic?: PhoneticSet
  topic?: TopicCategory | string
  /** 词的级别 A1–C2（原 cefr） */
  level?: CefrLevel | string
  contentType?: ContentType | string
  status: LexiconStatus
  origin?: string
}

/** 已通过校验（LLM 或人工），导入/重建时勿覆盖 */
export function isLexiconSettled(entry: GlobalSense | undefined): boolean {
  return entry?.status === 'verified' || entry?.status === 'llm'
}

/** 给建书/同步用的扁平视图（兼容旧调用） */
export interface FlatSenseView {
  meaning: string
  englishMeaning: string
  phonetic: string
  phoneticUk?: string
  phoneticUs?: string
  exampleSentence: string
  exampleSentenceZh?: string
  examExample?: string
  examExampleZh?: string
  topic?: string
  cefr?: string
  contentType?: string
  pos?: string
  status: LexiconStatus
  origin?: string
}

/** 旧单文件（迁移后可删） */
const LEGACY_SENSES_PATH = path.join(__dirname, '../../../data/sources/senses.json')
/** 字母分片目录：a.json … z.json + _.json（非字母开头） */
const SENSES_DIR = path.join(__dirname, '../../../data/sources/senses')

let cached: Record<string, GlobalSense> | null = null

export function sensesFilePath(): string {
  return fs.existsSync(SENSES_DIR) ? SENSES_DIR : LEGACY_SENSES_PATH
}

export function sensesDirPath(): string {
  return SENSES_DIR
}

export function clearSensesCache() {
  cached = null
}

/** 词 → 分片键：a–z，其它归 _ */
export function senseShardKey(word: string): string {
  const ch = word.trim().toLowerCase().charAt(0)
  if (ch >= 'a' && ch <= 'z') return ch
  return '_'
}

export function senseShardPath(shard: string): string {
  return path.join(SENSES_DIR, `${shard}.json`)
}

function listShardFiles(): string[] {
  if (!fs.existsSync(SENSES_DIR)) return []
  return fs
    .readdirSync(SENSES_DIR)
    .filter(name => /^[a-z_]\.json$/i.test(name))
    .map(name => path.join(SENSES_DIR, name))
}

function readShardFile(file: string): Record<string, GlobalSense> {
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>
  const out: Record<string, GlobalSense> = {}
  for (const [key, value] of Object.entries(raw)) {
    const word = key.trim().toLowerCase()
    if (!word) continue
    out[word] = normalizeSenseEntry(value)
  }
  return out
}

function writeShardFile(shard: string, entries: Record<string, GlobalSense>) {
  fs.mkdirSync(SENSES_DIR, { recursive: true })
  const sorted: Record<string, GlobalSense> = {}
  for (const key of Object.keys(entries).sort()) {
    sorted[key] = normalizeSenseEntry(entries[key])
  }
  fs.writeFileSync(senseShardPath(shard), `${JSON.stringify(sorted, null, 2)}\n`)
}

/** 把旧 senses.json 拆进 senses/*.json；若目录已有分片则跳过 */
export function migrateSensesToShards(opts: { force?: boolean } = {}): {
  shards: number
  words: number
  from: string
} {
  const existing = listShardFiles()
  if (existing.length && !opts.force) {
    let words = 0
    for (const file of existing) {
      words += Object.keys(JSON.parse(fs.readFileSync(file, 'utf-8'))).length
    }
    return { shards: existing.length, words, from: SENSES_DIR }
  }
  if (!fs.existsSync(LEGACY_SENSES_PATH)) {
    fs.mkdirSync(SENSES_DIR, { recursive: true })
    return { shards: 0, words: 0, from: 'empty' }
  }
  const raw = JSON.parse(fs.readFileSync(LEGACY_SENSES_PATH, 'utf-8')) as Record<string, unknown>
  const buckets: Record<string, Record<string, GlobalSense>> = {}
  for (const [key, value] of Object.entries(raw)) {
    const word = key.trim().toLowerCase()
    if (!word) continue
    const shard = senseShardKey(word)
    if (!buckets[shard]) buckets[shard] = {}
    buckets[shard][word] = normalizeSenseEntry(value)
  }
  fs.mkdirSync(SENSES_DIR, { recursive: true })
  for (const [shard, entries] of Object.entries(buckets)) {
    writeShardFile(shard, entries)
  }
  clearSensesCache()
  return {
    shards: Object.keys(buckets).length,
    words: Object.keys(raw).length,
    from: LEGACY_SENSES_PATH
  }
}

function trimStr(v: unknown): string {
  return String(v ?? '').trim()
}

function bilingual(zh?: string, en?: string): BilingualText {
  const out: BilingualText = {}
  if (trimStr(zh)) out.zh = trimStr(zh)
  if (trimStr(en)) out.en = trimStr(en)
  return out
}

function normalizeSentence(raw: any): LexiconSentence | null {
  const en = trimStr(raw?.en || raw?.exampleSentence || '')
  if (!en) return null
  const role: SentenceRole = raw?.role === 'ext' || raw?.role === 'exam' ? 'ext' : 'basic'
  const s: LexiconSentence = { en, role }
  const zh = trimStr(raw?.zh || raw?.exampleSentenceZh || '')
  if (zh) s.zh = zh
  if (trimStr(raw?.level)) s.level = trimStr(raw.level)
  return s
}

function normalizeMeaningBlock(raw: any): LexiconMeaning | null {
  if (!raw || typeof raw !== 'object') return null
  const meaningObj =
    raw.meaning && typeof raw.meaning === 'object' && !Array.isArray(raw.meaning)
      ? bilingual(raw.meaning.zh, raw.meaning.en)
      : bilingual(raw.zh || raw.meaning, raw.en || raw.englishMeaning)
  if (!meaningObj.zh && !meaningObj.en) return null

  const sentences: LexiconSentence[] = []
  if (Array.isArray(raw.sentences)) {
    for (const item of raw.sentences) {
      const s = normalizeSentence(item)
      if (s) sentences.push(s)
    }
  }
  const block: LexiconMeaning = { meaning: meaningObj, sentences }
  if (trimStr(raw.pos)) block.pos = trimStr(raw.pos)
  return block
}

/** 旧扁平 → 新结构；也接受已是新结构的对象 */
export function normalizeSenseEntry(raw: any): GlobalSense {
  if (!raw || typeof raw !== 'object') {
    return { meanings: [], status: 'pending' }
  }

  // 已是新结构
  if (Array.isArray(raw.meanings)) {
    const meanings: LexiconMeaning[] = []
    for (const m of raw.meanings) {
      const block = normalizeMeaningBlock(m)
      if (block) meanings.push(block)
    }
    const phonetic = normalizePhonetic(raw.phonetic)
    const status = normalizeLexiconStatus(raw.status)
    const out: GlobalSense = { meanings, status }
    if (phonetic) out.phonetic = phonetic
    if (trimStr(raw.topic)) out.topic = trimStr(raw.topic)
    if (trimStr(raw.level || raw.cefr)) out.level = trimStr(raw.level || raw.cefr)
    if (trimStr(raw.contentType)) out.contentType = trimStr(raw.contentType)
    if (trimStr(raw.origin)) out.origin = trimStr(raw.origin)
    return out
  }

  // 旧扁平
  const meaning = bilingual(raw.meaning, raw.englishMeaning)
  const sentences: LexiconSentence[] = []
  const basic = normalizeSentence({
    en: raw.exampleSentence,
    zh: raw.exampleSentenceZh,
    role: 'basic'
  })
  if (basic) sentences.push(basic)
  if (Array.isArray(raw.exampleSentences)) {
    for (const en of raw.exampleSentences) {
      const s = normalizeSentence({ en, role: 'basic' })
      if (s && !sentences.some(x => x.en === s.en)) sentences.push(s)
    }
  }
  const ext = normalizeSentence({
    en: raw.examExample,
    zh: raw.examExampleZh,
    role: 'ext'
  })
  if (ext) sentences.push(ext)

  const meanings: LexiconMeaning[] = []
  if (meaning.zh || meaning.en || sentences.length) {
    const block: LexiconMeaning = { meaning, sentences }
    if (trimStr(raw.pos)) block.pos = trimStr(raw.pos)
    meanings.push(block)
  }

  const phonetic =
    normalizePhonetic(raw.phonetic) ||
    (trimStr(raw.phonetic) ? { g: trimStr(raw.phonetic) } : undefined)

  const status = normalizeLexiconStatus(raw.status)
  const out: GlobalSense = { meanings, status }
  if (phonetic) out.phonetic = phonetic
  if (trimStr(raw.topic)) out.topic = trimStr(raw.topic)
  if (trimStr(raw.level || raw.cefr)) out.level = trimStr(raw.level || raw.cefr)
  if (trimStr(raw.contentType)) out.contentType = trimStr(raw.contentType)
  if (trimStr(raw.origin)) out.origin = trimStr(raw.origin)
  return out
}

function normalizePhonetic(raw: unknown): PhoneticSet | undefined {
  if (!raw) return undefined
  if (typeof raw === 'string') {
    const g = trimStr(raw)
    return g ? { g } : undefined
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    const ph: PhoneticSet = {}
    if (trimStr(o.uk)) ph.uk = trimStr(o.uk)
    if (trimStr(o.us)) ph.us = trimStr(o.us)
    if (trimStr(o.g)) ph.g = trimStr(o.g)
    return ph.uk || ph.us || ph.g ? ph : undefined
  }
  return undefined
}

export function primaryPhonetic(ph?: PhoneticSet): string {
  if (!ph) return ''
  return trimStr(ph.g || ph.uk || ph.us)
}

export function asFlatSense(entry: GlobalSense | undefined): FlatSenseView {
  if (!entry) {
    return {
      meaning: '',
      englishMeaning: '',
      phonetic: '',
      exampleSentence: '',
      status: 'pending'
    }
  }
  const m0 = entry.meanings[0]
  const basic = m0?.sentences.find(s => s.role === 'basic') || m0?.sentences[0]
  const ext = m0?.sentences.find(s => s.role === 'ext')
  const flat: FlatSenseView = {
    meaning: trimStr(m0?.meaning?.zh),
    englishMeaning: trimStr(m0?.meaning?.en),
    phonetic: primaryPhonetic(entry.phonetic),
    exampleSentence: trimStr(basic?.en),
    status: normalizeLexiconStatus(entry.status)
  }
  if (entry.phonetic?.uk) flat.phoneticUk = entry.phonetic.uk
  if (entry.phonetic?.us) flat.phoneticUs = entry.phonetic.us
  if (basic?.zh) flat.exampleSentenceZh = basic.zh
  if (ext?.en) flat.examExample = ext.en
  if (ext?.zh) flat.examExampleZh = ext.zh
  if (entry.topic) flat.topic = String(entry.topic)
  if (entry.level) flat.cefr = String(entry.level)
  if (entry.contentType) flat.contentType = String(entry.contentType)
  if (m0?.pos) flat.pos = m0.pos
  if (entry.origin) flat.origin = entry.origin
  return flat
}

/** 从扁平字段拼一条全局词条（导入/缺词写入用） */
export function buildSenseFromFlat(partial: Partial<FlatSenseView> & { pos?: string }): GlobalSense {
  return normalizeSenseEntry({
    meaning: partial.meaning,
    englishMeaning: partial.englishMeaning,
    phonetic: partial.phoneticUk || partial.phoneticUs
      ? { uk: partial.phoneticUk, us: partial.phoneticUs, g: partial.phonetic }
      : partial.phonetic,
    exampleSentence: partial.exampleSentence,
    exampleSentenceZh: partial.exampleSentenceZh,
    examExample: partial.examExample,
    examExampleZh: partial.examExampleZh,
    topic: partial.topic,
    cefr: partial.cefr,
    contentType: partial.contentType,
    pos: partial.pos,
    status: partial.status || 'pending',
    origin: partial.origin
  })
}

/** @deprecated 兼容旧名；内部转成新结构 */
export function senseWithExamples(
  sense: Partial<FlatSenseView> & { examples?: string[]; exampleSentences?: string[] }
): GlobalSense {
  const examples = [
    ...(sense.exampleSentence ? [sense.exampleSentence] : []),
    ...(sense.exampleSentences || []),
    ...(sense.examples || [])
  ]
    .map(s => s.trim())
    .filter(Boolean)
  return buildSenseFromFlat({
    ...sense,
    exampleSentence: examples[0] || sense.exampleSentence,
    examExample: sense.examExample || (examples.length > 1 ? examples[1] : undefined)
  })
}

export function loadGlobalSenses(): Record<string, GlobalSense> {
  if (cached) return cached

  let files = listShardFiles()
  if (!files.length && fs.existsSync(LEGACY_SENSES_PATH)) {
    migrateSensesToShards()
    files = listShardFiles()
  }

  const normalized: Record<string, GlobalSense> = {}
  if (files.length) {
    for (const file of files) {
      Object.assign(normalized, readShardFile(file))
    }
  } else if (fs.existsSync(LEGACY_SENSES_PATH)) {
    const raw = JSON.parse(fs.readFileSync(LEGACY_SENSES_PATH, 'utf-8')) as Record<string, unknown>
    for (const [key, value] of Object.entries(raw)) {
      const word = key.trim().toLowerCase()
      if (!word) continue
      normalized[word] = normalizeSenseEntry(value)
    }
  }

  cached = normalized
  return cached
}

function bucketByShard(map: Record<string, GlobalSense>): Record<string, Record<string, GlobalSense>> {
  const buckets: Record<string, Record<string, GlobalSense>> = {}
  for (const [key, value] of Object.entries(map)) {
    const word = key.trim().toLowerCase()
    if (!word) continue
    const shard = senseShardKey(word)
    if (!buckets[shard]) buckets[shard] = {}
    buckets[shard][word] = value
  }
  return buckets
}

function refreshCache(map: Record<string, GlobalSense>) {
  const next: Record<string, GlobalSense> = {}
  for (const [key, value] of Object.entries(map)) {
    const word = key.trim().toLowerCase()
    if (!word) continue
    next[word] = normalizeSenseEntry(value)
  }
  cached = next
}

/** 整库落盘到字母分片；可选只写部分片（传入片键 a–z/_ 或单词） */
export function saveGlobalSenses(map: Record<string, GlobalSense>, onlyShardsOrWords?: Iterable<string>) {
  const buckets = bucketByShard(map)
  const shardSet = new Set<string>()
  if (onlyShardsOrWords) {
    for (const item of onlyShardsOrWords) {
      const s = String(item).trim().toLowerCase()
      if (!s) continue
      if ((s.length === 1 && s >= 'a' && s <= 'z') || s === '_') shardSet.add(s)
      else shardSet.add(senseShardKey(s))
    }
  } else {
    for (const shard of Object.keys(buckets)) shardSet.add(shard)
  }
  for (const shard of shardSet) {
    writeShardFile(shard, buckets[shard] || {})
  }
  refreshCache(map)
}

/** 只重写变更过的字母分片（LLM 校验落盘用） */
export function saveGlobalSenseShards(map: Record<string, GlobalSense>, changedWords: Iterable<string>) {
  saveGlobalSenses(map, changedWords)
}

export function lookupSense(word: string): GlobalSense | undefined {
  return loadGlobalSenses()[word.trim().toLowerCase()]
}

export function lookupSenseFlat(word: string): FlatSenseView | undefined {
  const hit = lookupSense(word)
  return hit ? asFlatSense(hit) : undefined
}

export function resolveSense(
  word: string,
  fallback: Partial<FlatSenseView> & { examples?: string[] } = {}
): FlatSenseView {
  const hit = asFlatSense(lookupSense(word))
  const fromFallback = asFlatSense(buildSenseFromFlat(fallback))
  return {
    meaning: hit.meaning || fromFallback.meaning || word,
    englishMeaning: hit.englishMeaning || fromFallback.englishMeaning || '',
    phonetic: hit.phonetic || fromFallback.phonetic || '',
    phoneticUk: hit.phoneticUk || fromFallback.phoneticUk,
    phoneticUs: hit.phoneticUs || fromFallback.phoneticUs,
    exampleSentence: hit.exampleSentence || fromFallback.exampleSentence || '',
    exampleSentenceZh: hit.exampleSentenceZh || fromFallback.exampleSentenceZh,
    examExample: hit.examExample || fromFallback.examExample,
    examExampleZh: hit.examExampleZh || fromFallback.examExampleZh,
    topic: hit.topic || fromFallback.topic,
    cefr: hit.cefr || fromFallback.cefr,
    contentType: hit.contentType || fromFallback.contentType,
    pos: hit.pos || fromFallback.pos,
    status: hit.meaning || hit.englishMeaning ? hit.status : fromFallback.status || 'pending',
    origin: hit.origin || fromFallback.origin
  }
}

export function missingLexiconFields(entry: GlobalSense | undefined): string[] {
  const flat = asFlatSense(entry)
  const missing: string[] = []
  if (!flat.meaning) missing.push('meaning.zh')
  if (!flat.englishMeaning) missing.push('meaning.en')
  if (!flat.phonetic) missing.push('phonetic')
  if (!flat.exampleSentence) missing.push('sentence.basic.en')
  if (!flat.exampleSentenceZh) missing.push('sentence.basic.zh')
  if (!flat.topic) missing.push('topic')
  return missing
}

export function isVerified(entry: GlobalSense | undefined): boolean {
  return isLexiconSettled(entry)
}
