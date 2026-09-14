export type ContentType = 'fiction' | 'non-fiction' | 'function'

export type TopicCategory =
  | 'daily-life'
  | 'school'
  | 'nature'
  | 'science'
  | 'travel'
  | 'health'
  | 'entertainment'
  | 'abstract'
  | 'society'
  | 'business'

export interface WordSources {
  /** 词条名单来源，如 kew-toc */
  list: string
  meaning: string
  phonetic: string
  englishMeaning: string
  example: string
}

/** 每本成品词书都必须有中文意思、音标、英文释义、例句（与 KEW 一致）。 */
export interface WordData {
  word: string
  meaning: string
  phonetic: string
  englishMeaning: string
  /** 例句。JSON 成品必填；仅内置 fallback 可缺。 */
  exampleSentence?: string
  /** 同一拼写的其它例句（同书多用法时轮换） */
  exampleSentences?: string[]
  /** 简单词可配图（emoji），复杂词留空则显示文字释义 */
  emoji?: string
  contentType?: ContentType
  topic?: TopicCategory
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
