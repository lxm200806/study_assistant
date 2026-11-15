export type ContentType = 'fiction' | 'non-fiction' | 'function'

/** 词光对齐的主主题；legacy id 经 normalizeTopic 映射到此。 */
export type TopicCategory =
  | 'daily'
  | 'society'
  | 'thinking'
  | 'nature'
  | 'work'
  | 'health'
  | 'education'
  | 'emotion'
  | 'science'
  | 'travel'
  | 'economy'
  | 'arts'
  | 'technology'
  | 'government'
  | 'city'
  | 'environment'
  | 'history'
  | 'sport'
  | 'media'
  | 'uncategorized'
  /** @deprecated 旧版主题，读写时会 normalize */
  | 'daily-life'
  | 'school'
  | 'entertainment'
  | 'abstract'
  | 'business'

export type ExampleRole = 'basic' | 'exam' | 'sense'

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export interface WordExample {
  en: string
  zh?: string
  role: ExampleRole
  /** 挂到哪个义项；空=主义项 */
  senseKey?: string
  /** kew | word-atlas | generated | … */
  source?: string
}

export interface WordSources {
  /** 词条名单来源，如 kew-toc */
  list: string
  meaning: string
  phonetic: string
  englishMeaning: string
  /** 简单句（basic）来源 */
  example: string
  /** 进阶句（exam）来源 */
  examExample?: string
  topic?: string
  cefr?: string
}

/** 每本成品词书都必须有中文意思、音标、英文释义、例句（与 KEW 一致）。 */
export interface WordData {
  word: string
  meaning: string
  phonetic: string
  englishMeaning: string
  /** 例句。JSON 成品必填；仅内置 fallback 可缺。与 examples[basic] 同步。 */
  exampleSentence?: string
  /** 同一拼写的其它例句（同书多用法时轮换）；优先用 examples。 */
  exampleSentences?: string[]
  /** 带角色的例句：basic 必有；exam/sense 可选 */
  examples?: WordExample[]
  /** 简单词可配图（emoji），复杂词留空则显示文字释义 */
  emoji?: string
  contentType?: ContentType
  /** 主主题（与 topics[0] 同步） */
  topic?: TopicCategory
  /** 可多主题；一期通常 1 个 */
  topics?: TopicCategory[]
  /** CEFR，词光回填时写入 */
  cefr?: CefrLevel
  tags?: string[]
  /** 同形词义项键，空为默认义项 */
  senseKey?: string
  /** 界面展示用短义项，如「飞」「苍蝇」 */
  senseLabel?: string
  /** 各字段最终校验来源 */
  sources?: WordSources
}

export interface BookData {
  code: string
  name: string
  description: string
  level: string
  /** 官方词表规模，便于展示；实际收录词数以 words.length 为准 */
  targetWordCount: number
  words: WordData[]
}
