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
    id: 'mse-ket',
    code: 'mse-ket',
    name: 'MSE KET',
    description: '剑桥通用英语 A2 Key 官方词表（2025年8月）',
    level: 'A2',
    wordCount: 1746
  },
  {
    id: 'mse-pet',
    code: 'mse-pet',
    name: 'MSE PET',
    description: '剑桥通用英语 B1 Preliminary 官方词表（2025年8月）',
    level: 'B1',
    wordCount: 3142
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
    wordCount: 3685
  },
  {
    id: 'cet4',
    code: 'cet4',
    name: '大学英语四级',
    description: '大学英语四级词汇',
    level: 'CET-4',
    wordCount: 4543
  },
  {
    id: 'cet6',
    code: 'cet6',
    name: '大学英语六级',
    description: '大学英语六级词汇',
    level: 'CET-6',
    wordCount: 3991
  },
  {
    id: 'kew1200',
    code: 'kew1200',
    name: '1200高频词',
    description: 'Seed Learning 1200 高频词（全套）',
    level: 'A1',
    wordCount: 1198
  },
  {
    id: 'kew4500',
    code: 'kew4500',
    name: '4500高频词',
    description: 'Seed Learning 4500 高频词（全套）',
    level: 'A2',
    wordCount: 3198
  },
  {
    id: 'kew7200',
    code: 'kew7200',
    name: '7200高频词',
    description: 'Seed Learning 7200 高频词（全套）',
    level: 'B1',
    wordCount: 2398
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
