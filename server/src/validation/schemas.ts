import { z } from 'zod'

export const wordTypeSchema = z.enum(['listening', 'speaking', 'reading', 'writing'])
export const sessionModeSchema = z.enum(['coverage', 'smart', 'weak', 'review', 'unit', 'recheck'])
export const typingModeSchema = z.enum(['follow', 'dictation', 'self', 'recall'])
export const typingSourceSchema = z.enum(['smart', 'wrong', 'favorite', 'random', 'list'])

export const credentialsBodySchema = z.object({
  username: z.string().trim().min(1, '用户名不能为空').max(64, '用户名过长'),
  password: z.string().min(1, '密码不能为空').max(200, '密码过长')
})

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1, '缺少 refreshToken')
})

export const setActiveStudentBodySchema = z
  .object({
    studentId: z.string().trim().min(1).optional(),
    id: z.string().trim().min(1).optional()
  })
  .refine(value => Boolean(value.studentId || value.id), {
    message: 'studentId is required',
    path: ['studentId']
  })

export const bookSessionQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(10_000).default(10),
  mode: sessionModeSchema.default('coverage'),
  type: wordTypeSchema.optional(),
  topic: z.string().trim().max(80).optional(),
  unit: z.string().trim().max(80).optional(),
  exclude: z.string().max(200_000).optional()
})

export const bookMapQuerySchema = z.object({
  type: wordTypeSchema.optional()
})

export const typingQueueQuerySchema = z.object({
  source: typingSourceSchema.default('smart'),
  mode: typingModeSchema.default('follow'),
  count: z.coerce.number().int().min(1).max(50).default(20),
  bookCode: z.string().trim().min(1).max(64).optional(),
  listId: z.string().trim().min(1).max(64).optional(),
  includeMastered: z.enum(['0', '1', 'true', 'false']).optional(),
  allBooks: z.enum(['0', '1', 'true', 'false']).optional()
})

export const chineseTodayQuerySchema = z.object({
  mode: z.string().trim().max(20).optional(),
  extraMinutes: z.coerce.number().int().min(0).max(600).default(0),
  reciteOffset: z.coerce.number().int().min(0).max(10_000).default(0)
})

export const bookCodeParamsSchema = z.object({
  code: z.string().trim().min(1, '缺少词书编码').max(64)
})

export const reviewQuerySchema = z.object({
  type: wordTypeSchema.optional(),
  bookCode: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50)
})

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export const quizWordsQuerySchema = z.object({
  bookCode: z.string().trim().min(1, '缺少 bookCode').max(64),
  count: z.coerce.number().int().min(1).max(200).default(30)
})

export const quizSubmitBodySchema = z.object({
  bookCode: z.string().trim().min(1, '缺少 bookCode').max(64),
  items: z
    .array(
      z.object({
        wordId: z.string().min(1),
        isCorrect: z.boolean()
      })
    )
    .min(1, 'items 不能为空')
    .max(200)
})

export const practiceBodySchema = z.object({
  wordId: z.string().min(1, '缺少 wordId'),
  type: wordTypeSchema,
  isCorrect: z.boolean()
})

export const completeSessionBodySchema = z
  .object({
    bookCode: z.string().trim().min(1, '缺少 bookCode').max(64),
    wordIds: z.array(z.string().trim().min(1)).min(1, 'wordIds 不能为空').max(200),
    sessionToken: z.string().min(1).optional(),
    sessionTokens: z.array(z.string().min(1)).max(50).optional()
  })
  .refine(value => Boolean(value.sessionToken) || Boolean(value.sessionTokens?.length), {
    message: 'sessionToken is required',
    path: ['sessionToken']
  })

export const typingAnswerBodySchema = z.object({
  wordId: z.string().min(1, '缺少 wordId'),
  isCorrect: z.boolean(),
  mode: typingModeSchema.optional()
})

export const chineseReviewBodySchema = z.object({
  pointId: z.string().min(1, '缺少 pointId'),
  answer: z.string().max(5_000).optional(),
  reveal: z.boolean().optional(),
  mode: z.string().trim().max(20).optional(),
  selfRating: z.enum(['', 'known', 'again']).optional()
})

export const idParamsSchema = z.object({
  id: z.string().trim().min(1, '缺少 id').max(64)
})

export const studentNameBodySchema = z.object({
  name: z.string().trim().min(1, '请填写学生姓名').max(20, '姓名过长')
})

export const onboardBodySchema = z.object({
  subject: z.enum(['english', 'chinese']).optional()
})

export const subjectBodySchema = z.object({
  subject: z.enum(['english', 'chinese'])
})

export const roleBodySchema = z.object({
  role: z.enum(['parent', 'student']),
  studentId: z.string().trim().min(1).optional(),
  id: z.string().trim().min(1).optional()
})

export const vocabListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
})

export const randomCountQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(50).default(10)
})

export const globalMapQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12_000).default(8000)
})

export const dueCountQuerySchema = z.object({
  type: wordTypeSchema.optional()
})

export const typingSummaryQuerySchema = z.object({
  bookCode: z.string().trim().min(1, '缺少 bookCode').max(64),
  mode: typingModeSchema.default('follow')
})

export const typingListBodySchema = z.object({
  name: z.string().trim().max(40).optional(),
  text: z.string().trim().min(1, '词表内容不能为空').max(20_000)
})

export const chatSendBodySchema = z.object({
  content: z.string().trim().min(1, '消息不能为空').max(2_000),
  bookCode: z.string().trim().min(1).max(64).optional(),
  mode: z.enum(['free', 'challenge', 'roleplay']).optional(),
  scenario: z.string().trim().max(200).optional()
})

export const chatHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export const typingMarkBodySchema = z.object({
  wordId: z.string().min(1, '缺少 wordId'),
  favorite: z.boolean().optional(),
  skipMastered: z.boolean().optional()
})

export const typingActivityBodySchema = z.object({
  count: z.coerce.number().int().min(0).max(10_000)
})

export const typingHistoryQuerySchema = z.object({
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
  days: z.coerce.number().int().min(7).max(140).default(112)
})

export const typingSessionBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
  durationMs: z.coerce.number().int().min(0).max(2 * 60 * 60 * 1000),
  typedChars: z.coerce.number().int().min(0).max(20_000),
  correctChars: z.coerce.number().int().min(0).max(20_000),
  itemCount: z.coerce.number().int().min(1).max(200),
  correctCount: z.coerce.number().int().min(0).max(200),
  kind: z.enum(['words', 'article'])
})

export const typingArticleCreateBodySchema = z.object({
  title: z.string().trim().max(40).optional(),
  body: z.string().trim().min(1, '短文内容不能为空').max(20_000),
  translation: z.string().max(20_000).optional()
})

export const typingArticleUpdateBodySchema = z.object({
  title: z.string().trim().max(40).optional(),
  body: z.string().trim().min(1).max(20_000).optional(),
  translation: z.string().max(20_000).optional()
})

export const typingArticleAnswerBodySchema = z.object({
  articleKey: z.string().min(1),
  sentenceIndex: z.coerce.number().int().min(0),
  isCorrect: z.boolean(),
  linear: z.boolean().optional()
})

export const typingDueQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(50).default(20)
})

export type CredentialsBody = z.infer<typeof credentialsBodySchema>
export type RefreshBody = z.infer<typeof refreshBodySchema>
export type SetActiveStudentBody = z.infer<typeof setActiveStudentBodySchema>
export type BookSessionQuery = z.infer<typeof bookSessionQuerySchema>
export type BookMapQuery = z.infer<typeof bookMapQuerySchema>
export type TypingQueueQuery = z.infer<typeof typingQueueQuerySchema>
export type ChineseTodayQuery = z.infer<typeof chineseTodayQuerySchema>
export type BookCodeParams = z.infer<typeof bookCodeParamsSchema>
export type ReviewQuery = z.infer<typeof reviewQuerySchema>
export type HistoryQuery = z.infer<typeof historyQuerySchema>
export type QuizWordsQuery = z.infer<typeof quizWordsQuerySchema>
export type QuizSubmitBody = z.infer<typeof quizSubmitBodySchema>
export type PracticeBody = z.infer<typeof practiceBodySchema>
export type CompleteSessionBody = z.infer<typeof completeSessionBodySchema>
export type TypingAnswerBody = z.infer<typeof typingAnswerBodySchema>
export type ChineseReviewBody = z.infer<typeof chineseReviewBodySchema>
export type IdParams = z.infer<typeof idParamsSchema>
export type StudentNameBody = z.infer<typeof studentNameBodySchema>
export type OnboardBody = z.infer<typeof onboardBodySchema>
export type SubjectBody = z.infer<typeof subjectBodySchema>
export type RoleBody = z.infer<typeof roleBodySchema>
export type VocabListQuery = z.infer<typeof vocabListQuerySchema>
export type RandomCountQuery = z.infer<typeof randomCountQuerySchema>
export type GlobalMapQuery = z.infer<typeof globalMapQuerySchema>
export type DueCountQuery = z.infer<typeof dueCountQuerySchema>
export type TypingSummaryQuery = z.infer<typeof typingSummaryQuerySchema>
export type TypingListBody = z.infer<typeof typingListBodySchema>
export type ChatSendBody = z.infer<typeof chatSendBodySchema>
export type ChatHistoryQuery = z.infer<typeof chatHistoryQuerySchema>
export type TypingMarkBody = z.infer<typeof typingMarkBodySchema>
export type TypingActivityBody = z.infer<typeof typingActivityBodySchema>
export type TypingHistoryQuery = z.infer<typeof typingHistoryQuerySchema>
export type TypingSessionBody = z.infer<typeof typingSessionBodySchema>
export type TypingArticleCreateBody = z.infer<typeof typingArticleCreateBodySchema>
export type TypingArticleUpdateBody = z.infer<typeof typingArticleUpdateBodySchema>
export type TypingArticleAnswerBody = z.infer<typeof typingArticleAnswerBodySchema>
export type TypingDueQuery = z.infer<typeof typingDueQuerySchema>
