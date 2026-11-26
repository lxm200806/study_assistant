export const PERMISSIONS = {
  ENGLISH_BOOKS_ALL: 'english.books.all',
  ENGLISH_LISTENING: 'english.listening',
  ENGLISH_SPEAKING: 'english.speaking',
  ENGLISH_RECOGNITION: 'english.recognition',
  ENGLISH_WRITING: 'english.writing',
  ENGLISH_TYPING: 'english.typing',
  ENGLISH_ARTICLE: 'english.article',
  ENGLISH_QUIZ: 'english.quiz',
  ENGLISH_GAMES: 'english.games',
  CHINESE_COURSES: 'chinese.courses',
  CHINESE_DICTATION: 'chinese.dictation',
  CHINESE_RECITE: 'chinese.recite',
  CHINESE_GAMES: 'chinese.games',
  MATH_COURSES: 'math.courses',
  MATH_PRACTICE: 'math.practice',
  MATH_AI_TUTOR: 'math.ai.tutor',
  AI_CHAT_TEXT: 'ai.chat.text',
  AI_CHAT_VOICE: 'ai.chat.voice',
  AI_SPEECH_ASSESS: 'ai.speech.assess',
  FAMILY_SEATS: 'family.seats',
  STATS_WEEKLY: 'stats.weekly',
  STATS_ADVANCED: 'stats.advanced'
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export interface PermissionDefinition {
  key: PermissionKey
  name: string
  subject: string
  groupKey: string
  kind: 'access' | 'quota'
  unit?: string
  description: string
}

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  {
    key: PERMISSIONS.ENGLISH_BOOKS_ALL,
    name: '全部英语词书',
    subject: 'english',
    groupKey: 'english.books',
    kind: 'access',
    description: '解锁全部英语词书；免费词书不受影响'
  },
  {
    key: PERMISSIONS.ENGLISH_LISTENING,
    name: '英语听力练习',
    subject: 'english',
    groupKey: 'english.skills',
    kind: 'access',
    description: '英语听力训练'
  },
  {
    key: PERMISSIONS.ENGLISH_SPEAKING,
    name: '英语口语练习',
    subject: 'english',
    groupKey: 'english.skills',
    kind: 'access',
    description: '英语口语训练'
  },
  {
    key: PERMISSIONS.ENGLISH_RECOGNITION,
    name: '英语认读练习',
    subject: 'english',
    groupKey: 'english.skills',
    kind: 'access',
    description: '英语认读/阅读训练'
  },
  {
    key: PERMISSIONS.ENGLISH_WRITING,
    name: '英语拼写练习',
    subject: 'english',
    groupKey: 'english.skills',
    kind: 'access',
    description: '英语拼写/书写训练'
  },
  {
    key: PERMISSIONS.ENGLISH_TYPING,
    name: '词汇拼读练习',
    subject: 'english',
    groupKey: 'english.features',
    kind: 'access',
    description: '键盘拼读、短文拼写'
  },
  {
    key: PERMISSIONS.ENGLISH_ARTICLE,
    name: '文章练习',
    subject: 'english',
    groupKey: 'english.features',
    kind: 'access',
    description: '短文/文章逐句练习'
  },
  {
    key: PERMISSIONS.ENGLISH_QUIZ,
    name: '英语阶段小测',
    subject: 'english',
    groupKey: 'english.features',
    kind: 'access',
    description: '阶段测验与结果'
  },
  {
    key: PERMISSIONS.ENGLISH_GAMES,
    name: '英语游戏练习',
    subject: 'english',
    groupKey: 'english.games',
    kind: 'access',
    description: '游戏化练习（后续功能）'
  },
  {
    key: PERMISSIONS.CHINESE_COURSES,
    name: '语文课程',
    subject: 'chinese',
    groupKey: 'chinese.content',
    kind: 'access',
    description: '语文课程创建与学习'
  },
  {
    key: PERMISSIONS.CHINESE_DICTATION,
    name: '语文听写',
    subject: 'chinese',
    groupKey: 'chinese.content',
    kind: 'access',
    description: '语文听写题卡'
  },
  {
    key: PERMISSIONS.CHINESE_RECITE,
    name: '语文背诵',
    subject: 'chinese',
    groupKey: 'chinese.content',
    kind: 'access',
    description: '语文背诵/默写题卡'
  },
  {
    key: PERMISSIONS.CHINESE_GAMES,
    name: '语文游戏练习',
    subject: 'chinese',
    groupKey: 'chinese.games',
    kind: 'access',
    description: '语文游戏化练习（后续功能）'
  },
  {
    key: PERMISSIONS.MATH_COURSES,
    name: '数学课程',
    subject: 'math',
    groupKey: 'math.content',
    kind: 'access',
    description: '数学课程与题库'
  },
  {
    key: PERMISSIONS.MATH_PRACTICE,
    name: '数学练习',
    subject: 'math',
    groupKey: 'math.content',
    kind: 'access',
    description: '数学练习与错题'
  },
  {
    key: PERMISSIONS.MATH_AI_TUTOR,
    name: '数学 AI 讲解',
    subject: 'math',
    groupKey: 'math.ai',
    kind: 'access',
    description: '数学逐步讲解/拍照解题（走 AI 点数）'
  },
  {
    key: PERMISSIONS.AI_CHAT_TEXT,
    name: 'AI 文字陪聊',
    subject: 'ai',
    groupKey: 'ai.chat',
    kind: 'quota',
    unit: 'message',
    description: 'AI 文字对话次数'
  },
  {
    key: PERMISSIONS.AI_CHAT_VOICE,
    name: 'AI 语音陪聊',
    subject: 'ai',
    groupKey: 'ai.chat',
    kind: 'quota',
    unit: 'minute',
    description: 'AI 语音对话时长'
  },
  {
    key: PERMISSIONS.AI_SPEECH_ASSESS,
    name: '口语评测',
    subject: 'ai',
    groupKey: 'ai.speech',
    kind: 'quota',
    unit: 'call',
    description: '语音识别与口语评分次数'
  },
  {
    key: PERMISSIONS.FAMILY_SEATS,
    name: '孩子名额',
    subject: 'family',
    groupKey: 'family',
    kind: 'quota',
    unit: 'seat',
    description: '账号可添加的孩子数量'
  },
  {
    key: PERMISSIONS.STATS_WEEKLY,
    name: '学习周报',
    subject: 'stats',
    groupKey: 'stats',
    kind: 'access',
    description: '每周学习报告'
  },
  {
    key: PERMISSIONS.STATS_ADVANCED,
    name: '高级统计',
    subject: 'stats',
    groupKey: 'stats',
    kind: 'access',
    description: '长期趋势、薄弱项和导出'
  }
]

export interface PlanPermissionSeed {
  key: PermissionKey
  limitValue?: number
  period?: 'day' | 'month' | 'period' | 'total'
}

export interface PlanSeed {
  code: string
  name: string
  kind: 'free' | 'subscription' | 'addon' | 'credit' | 'beta'
  subject: 'english' | 'chinese' | 'math' | 'ai' | 'bundle' | 'family'
  groupKey?: string
  description?: string
  days: number
  priceCents: number
  creditAmount?: number
  active: boolean
  sortOrder: number
  permissions: PlanPermissionSeed[]
}

const FREE_ENGLISH_PERMISSIONS: PlanPermissionSeed[] = [
  { key: PERMISSIONS.ENGLISH_LISTENING },
  { key: PERMISSIONS.ENGLISH_SPEAKING },
  { key: PERMISSIONS.ENGLISH_RECOGNITION },
  { key: PERMISSIONS.ENGLISH_WRITING },
  { key: PERMISSIONS.ENGLISH_TYPING },
  { key: PERMISSIONS.ENGLISH_ARTICLE },
  { key: PERMISSIONS.ENGLISH_QUIZ }
]

const CHINESE_PERMISSIONS: PlanPermissionSeed[] = [
  { key: PERMISSIONS.CHINESE_COURSES },
  { key: PERMISSIONS.CHINESE_DICTATION },
  { key: PERMISSIONS.CHINESE_RECITE }
]

const MATH_PERMISSIONS: PlanPermissionSeed[] = [
  { key: PERMISSIONS.MATH_COURSES },
  { key: PERMISSIONS.MATH_PRACTICE }
]

const CORE_FAMILY_PERMISSIONS: PlanPermissionSeed[] = [
  { key: PERMISSIONS.STATS_WEEKLY },
  { key: PERMISSIONS.FAMILY_SEATS, limitValue: 8, period: 'total' }
]

export const PLAN_SEEDS: PlanSeed[] = [
  {
    code: 'free',
    name: '免费版',
    kind: 'free',
    subject: 'bundle',
    groupKey: 'base',
    description: '基础英语/语文学习、免费词书、有限 AI 试用',
    days: 0,
    priceCents: 0,
    active: true,
    sortOrder: 0,
    permissions: [
      ...FREE_ENGLISH_PERMISSIONS,
      ...CHINESE_PERMISSIONS,
      ...CORE_FAMILY_PERMISSIONS,
      { key: PERMISSIONS.AI_CHAT_TEXT, limitValue: 5, period: 'day' },
      { key: PERMISSIONS.AI_SPEECH_ASSESS, limitValue: 10, period: 'day' }
    ]
  },
  {
    code: 'english_core_month',
    name: '英语全科会员',
    kind: 'subscription',
    subject: 'english',
    groupKey: 'english.plan',
    description: '全部英语词书 + 认读/拼读/文章/测验 + 高级统计',
    days: 30,
    priceCents: 2_990,
    active: true,
    sortOrder: 10,
    permissions: [
      { key: PERMISSIONS.ENGLISH_BOOKS_ALL },
      ...FREE_ENGLISH_PERMISSIONS,
      { key: PERMISSIONS.STATS_WEEKLY },
      { key: PERMISSIONS.STATS_ADVANCED },
      { key: PERMISSIONS.FAMILY_SEATS, limitValue: 8, period: 'total' },
      { key: PERMISSIONS.AI_CHAT_TEXT, limitValue: 300, period: 'month' },
      { key: PERMISSIONS.AI_SPEECH_ASSESS, limitValue: 300, period: 'month' }
    ]
  },
  {
    code: 'english_core_year',
    name: '英语全科会员（年卡）',
    kind: 'subscription',
    subject: 'english',
    groupKey: 'english.plan',
    description: '英语全科会员年卡',
    days: 365,
    priceCents: 19_900,
    active: true,
    sortOrder: 11,
    permissions: [
      { key: PERMISSIONS.ENGLISH_BOOKS_ALL },
      ...FREE_ENGLISH_PERMISSIONS,
      { key: PERMISSIONS.STATS_WEEKLY },
      { key: PERMISSIONS.STATS_ADVANCED },
      { key: PERMISSIONS.FAMILY_SEATS, limitValue: 8, period: 'total' },
      { key: PERMISSIONS.AI_CHAT_TEXT, limitValue: 300, period: 'month' },
      { key: PERMISSIONS.AI_SPEECH_ASSESS, limitValue: 300, period: 'month' }
    ]
  },
  {
    code: 'english_svip_month',
    name: '英语 SVIP',
    kind: 'subscription',
    subject: 'english',
    groupKey: 'english.plan',
    description: '英语全科 + 游戏练习 + 更高 AI 语音/文字额度',
    days: 30,
    priceCents: 4_990,
    active: false,
    sortOrder: 20,
    permissions: [
      { key: PERMISSIONS.ENGLISH_BOOKS_ALL },
      ...FREE_ENGLISH_PERMISSIONS,
      { key: PERMISSIONS.ENGLISH_GAMES },
      { key: PERMISSIONS.STATS_WEEKLY },
      { key: PERMISSIONS.STATS_ADVANCED },
      { key: PERMISSIONS.FAMILY_SEATS, limitValue: 8, period: 'total' },
      { key: PERMISSIONS.AI_CHAT_TEXT, limitValue: 1_000, period: 'month' },
      { key: PERMISSIONS.AI_CHAT_VOICE, limitValue: 60, period: 'month' },
      { key: PERMISSIONS.AI_SPEECH_ASSESS, limitValue: 1_000, period: 'month' }
    ]
  },
  {
    code: 'english_svip_year',
    name: '英语 SVIP（年卡）',
    kind: 'subscription',
    subject: 'english',
    groupKey: 'english.plan',
    description: '英语 SVIP 年卡',
    days: 365,
    priceCents: 34_900,
    active: false,
    sortOrder: 21,
    permissions: [
      { key: PERMISSIONS.ENGLISH_BOOKS_ALL },
      ...FREE_ENGLISH_PERMISSIONS,
      { key: PERMISSIONS.ENGLISH_GAMES },
      { key: PERMISSIONS.STATS_WEEKLY },
      { key: PERMISSIONS.STATS_ADVANCED },
      { key: PERMISSIONS.FAMILY_SEATS, limitValue: 8, period: 'total' },
      { key: PERMISSIONS.AI_CHAT_TEXT, limitValue: 1_000, period: 'month' },
      { key: PERMISSIONS.AI_CHAT_VOICE, limitValue: 60, period: 'month' },
      { key: PERMISSIONS.AI_SPEECH_ASSESS, limitValue: 1_000, period: 'month' }
    ]
  },
  {
    code: 'chinese_core_month',
    name: '语文会员',
    kind: 'subscription',
    subject: 'chinese',
    groupKey: 'chinese.plan',
    description: '语文课程、听写与背诵',
    days: 30,
    priceCents: 1_990,
    active: false,
    sortOrder: 30,
    permissions: [
      ...CHINESE_PERMISSIONS,
      { key: PERMISSIONS.STATS_WEEKLY },
      { key: PERMISSIONS.FAMILY_SEATS, limitValue: 8, period: 'total' },
      { key: PERMISSIONS.AI_CHAT_TEXT, limitValue: 200, period: 'month' }
    ]
  },
  {
    code: 'chinese_core_year',
    name: '语文会员（年卡）',
    kind: 'subscription',
    subject: 'chinese',
    groupKey: 'chinese.plan',
    description: '语文会员年卡',
    days: 365,
    priceCents: 12_900,
    active: false,
    sortOrder: 31,
    permissions: [
      ...CHINESE_PERMISSIONS,
      { key: PERMISSIONS.STATS_WEEKLY },
      { key: PERMISSIONS.FAMILY_SEATS, limitValue: 8, period: 'total' },
      { key: PERMISSIONS.AI_CHAT_TEXT, limitValue: 200, period: 'month' }
    ]
  },
  {
    code: 'math_beta',
    name: '数学体验版',
    kind: 'beta',
    subject: 'math',
    groupKey: 'math.plan',
    description: '数学上线初期限时免费',
    days: 90,
    priceCents: 0,
    active: false,
    sortOrder: 40,
    permissions: [...MATH_PERMISSIONS, { key: PERMISSIONS.AI_CHAT_TEXT, limitValue: 100, period: 'month' }]
  },
  {
    code: 'math_core_month',
    name: '数学会员',
    kind: 'subscription',
    subject: 'math',
    groupKey: 'math.plan',
    description: '数学课程与练习',
    days: 30,
    priceCents: 1_990,
    active: false,
    sortOrder: 41,
    permissions: [...MATH_PERMISSIONS, { key: PERMISSIONS.AI_CHAT_TEXT, limitValue: 300, period: 'month' }]
  },
  {
    code: 'math_core_year',
    name: '数学会员（年卡）',
    kind: 'subscription',
    subject: 'math',
    groupKey: 'math.plan',
    description: '数学会员年卡',
    days: 365,
    priceCents: 12_900,
    active: false,
    sortOrder: 42,
    permissions: [...MATH_PERMISSIONS, { key: PERMISSIONS.AI_CHAT_TEXT, limitValue: 300, period: 'month' }]
  },
  {
    code: 'english_games_addon',
    name: '英语游戏加购包',
    kind: 'addon',
    subject: 'english',
    groupKey: 'english.games',
    description: '单独解锁英语游戏练习',
    days: 30,
    priceCents: 990,
    active: false,
    sortOrder: 50,
    permissions: [{ key: PERMISSIONS.ENGLISH_GAMES }]
  },
  {
    code: 'ai_text_pack_small',
    name: 'AI 文字点数包',
    kind: 'credit',
    subject: 'ai',
    groupKey: 'ai.pack',
    description: '300 AI 文字点数',
    days: 0,
    priceCents: 600,
    creditAmount: 300,
    active: false,
    sortOrder: 60,
    permissions: [{ key: PERMISSIONS.AI_CHAT_TEXT }]
  },
  {
    code: 'ai_voice_pack_small',
    name: 'AI 语音包（小）',
    kind: 'credit',
    subject: 'ai',
    groupKey: 'ai.pack',
    description: '60 分钟 AI 语音',
    days: 0,
    priceCents: 1_900,
    creditAmount: 60,
    active: false,
    sortOrder: 61,
    permissions: [{ key: PERMISSIONS.AI_CHAT_VOICE }]
  },
  {
    code: 'ai_voice_pack_large',
    name: 'AI 语音包（大）',
    kind: 'credit',
    subject: 'ai',
    groupKey: 'ai.pack',
    description: '200 分钟 AI 语音',
    days: 0,
    priceCents: 5_400,
    creditAmount: 200,
    active: false,
    sortOrder: 62,
    permissions: [{ key: PERMISSIONS.AI_CHAT_VOICE }]
  }
]
