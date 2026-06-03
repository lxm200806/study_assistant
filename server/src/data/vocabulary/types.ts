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

export interface WordData {
  word: string
  meaning: string
  phonetic: string
  englishMeaning?: string
  exampleSentence?: string
  /** 简单词可配图（emoji），复杂词留空则显示文字释义 */
  emoji?: string
  contentType?: ContentType
  topic?: TopicCategory
  tags?: string[]
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
