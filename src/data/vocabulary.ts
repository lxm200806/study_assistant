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
    id: 'pep-g3a-2024',
    code: 'pep-g3a-2024',
    name: '人教 PEP 三上（2024）',
    description: '义务教育教科书《英语（PEP）》三年级上册单元词表；课文练习为自编口语短文',
    level: '小学三上',
    wordCount: 120
  },
  {
    id: 'pep-g3b-2025',
    code: 'pep-g3b-2025',
    name: '人教 PEP 三下（2025）',
    description: '义务教育教科书《英语（PEP）》三年级下册单元词表；课文练习为自编口语短文',
    level: '小学三下',
    wordCount: 114
  },
  {
    id: 'pep-g4a-2025',
    code: 'pep-g4a-2025',
    name: '人教 PEP 四上（2025）',
    description: '义务教育教科书《英语（PEP）》四年级上册单元词表；课文练习为自编口语短文',
    level: '小学四上',
    wordCount: 110
  },
  {
    id: 'pep-g4b-2026',
    code: 'pep-g4b-2026',
    name: '人教 PEP 四下（2026）',
    description: '义务教育教科书《英语（PEP）》四年级下册单元词表；课文练习为自编口语短文',
    level: '小学四下',
    wordCount: 110
  },
  {
    id: 'pep-g5a-2026',
    code: 'pep-g5a-2026',
    name: '人教 PEP 五上（2026）',
    description: '义务教育教科书《英语（PEP）》五年级上册单元词表；课文练习为自编口语短文',
    level: '小学五上',
    wordCount: 111
  },
  {
    id: 'pep-g4b-legacy',
    code: 'pep-g4b-legacy',
    name: '人教 PEP 四下（旧版）',
    description: '人教 PEP 旧版四下；词表/课文来自个人课本库',
    level: '小学四下',
    wordCount: 0
  },
  {
    id: 'pep-g5a-legacy',
    code: 'pep-g5a-legacy',
    name: '人教 PEP 五上（旧版）',
    description: '人教 PEP 旧版五上；词表/课文来自个人课本库',
    level: '小学五上',
    wordCount: 0
  },
  {
    id: 'pep-g5b-legacy',
    code: 'pep-g5b-legacy',
    name: '人教 PEP 五下（旧版）',
    description: '人教 PEP 旧版五下；词表/课文来自个人课本库',
    level: '小学五下',
    wordCount: 0
  },
  {
    id: 'pep-g6a-legacy',
    code: 'pep-g6a-legacy',
    name: '人教 PEP 六上（旧版）',
    description: '人教 PEP 旧版六上；词表/课文来自个人课本库',
    level: '小学六上',
    wordCount: 0
  },
  {
    id: 'pep-g6b-legacy',
    code: 'pep-g6b-legacy',
    name: '人教 PEP 六下（旧版）',
    description: '人教 PEP 旧版六下；词表/课文来自个人课本库',
    level: '小学六下',
    wordCount: 0
  },
  {
    id: 'jt-g3a-2024',
    code: 'jt-g3a-2024',
    name: '人教精通 三上（2024）',
    description: '人教精通三年级上册；词表/课文来自个人课本库',
    level: '小学三上',
    wordCount: 0
  },
  {
    id: 'jt-g3b-2025',
    code: 'jt-g3b-2025',
    name: '人教精通 三下（2025）',
    description: '人教精通三年级下册；词表/课文来自个人课本库',
    level: '小学三下',
    wordCount: 0
  },
  {
    id: 'jt-g4a-2025',
    code: 'jt-g4a-2025',
    name: '人教精通 四上（2025）',
    description: '人教精通四年级上册；词表/课文来自个人课本库',
    level: '小学四上',
    wordCount: 0
  },
  {
    id: 'jt-g4b',
    code: 'jt-g4b',
    name: '人教精通 四下',
    description: '人教精通四年级下册；词表/课文来自个人课本库',
    level: '小学四下',
    wordCount: 0
  },
  {
    id: 'jt-g5a',
    code: 'jt-g5a',
    name: '人教精通 五上',
    description: '人教精通五年级上册；词表/课文来自个人课本库',
    level: '小学五上',
    wordCount: 0
  },
  {
    id: 'jt-g5b',
    code: 'jt-g5b',
    name: '人教精通 五下',
    description: '人教精通五年级下册；词表/课文来自个人课本库',
    level: '小学五下',
    wordCount: 0
  },
  {
    id: 'jt-g6a',
    code: 'jt-g6a',
    name: '人教精通 六上',
    description: '人教精通六年级上册；词表/课文来自个人课本库',
    level: '小学六上',
    wordCount: 0
  },
  {
    id: 'jt-g6b',
    code: 'jt-g6b',
    name: '人教精通 六下',
    description: '人教精通六年级下册；词表/课文来自个人课本库',
    level: '小学六下',
    wordCount: 0
  },
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
