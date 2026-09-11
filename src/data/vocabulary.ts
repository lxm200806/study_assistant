import type { Vocabulary } from '@/types'

export interface BookMeta {
  id: string
  code: string
  name: string
  description: string
  level: string
  wordCount: number
}

/** 词书元数据（不含词条，词条一律从 API 获取） */
const BOOKS: BookMeta[] = [
  {
    id: 'ket',
    code: 'ket',
    name: 'KET词汇',
    description: '剑桥 A2 Key 官方词表（2025）',
    level: 'A2',
    wordCount: 1571
  },
  {
    id: 'pet',
    code: 'pet',
    name: 'PET词汇',
    description: '剑桥 B1 Preliminary 官方词表（2025）',
    level: 'B1',
    wordCount: 2834
  },
  {
    id: 'zhongkao',
    code: 'zhongkao',
    name: '初中词汇',
    description: '新课标中考英语核心词汇',
    level: '初中',
    wordCount: 1960
  },
  {
    id: 'gaokao',
    code: 'gaokao',
    name: '高中词汇',
    description: '高考英语考纲词汇',
    level: '高中',
    wordCount: 3690
  },
  {
    id: 'kew1',
    code: 'kew1',
    name: '1200高频词 1',
    description: 'Seed Learning 单元主题词（New Words）',
    level: 'A1',
    wordCount: 400
  },
  {
    id: 'kew2',
    code: 'kew2',
    name: '1200高频词 2',
    description: 'Seed Learning 单元主题词（New Words）',
    level: 'A1+',
    wordCount: 400
  },
  {
    id: 'kew3',
    code: 'kew3',
    name: '1200高频词 3',
    description: 'Seed Learning 单元主题词（New Words）',
    level: 'A2',
    wordCount: 400
  }
]

export const getBookList = (): BookMeta[] => [...BOOKS]

export const getBookByCode = (code: string): BookMeta | undefined =>
  BOOKS.find(b => b.code === code)

/** 离线兜底：不再内置词表，避免打包服务端 fs/path 模块 */
export const getRandomWords = (_count: number): Vocabulary[] => []

export const getRandomWordsFromBook = (_bookCode: string, _count: number): Vocabulary[] => []

export const getAllWords = (): Vocabulary[] => []

export const getWordById = (_id: string): Vocabulary | undefined => undefined

export const getWordByWord = (_word: string): Vocabulary | undefined => undefined
