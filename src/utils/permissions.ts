/** 与 server/src/entitlements/permissions.ts 保持一致的权限 key。 */
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
