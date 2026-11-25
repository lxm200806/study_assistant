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

export type CredentialsBody = z.infer<typeof credentialsBodySchema>
export type RefreshBody = z.infer<typeof refreshBodySchema>
export type SetActiveStudentBody = z.infer<typeof setActiveStudentBodySchema>
export type BookSessionQuery = z.infer<typeof bookSessionQuerySchema>
export type BookMapQuery = z.infer<typeof bookMapQuerySchema>
export type TypingQueueQuery = z.infer<typeof typingQueueQuerySchema>
export type ChineseTodayQuery = z.infer<typeof chineseTodayQuerySchema>
export type PracticeBody = z.infer<typeof practiceBodySchema>
export type CompleteSessionBody = z.infer<typeof completeSessionBodySchema>
export type TypingAnswerBody = z.infer<typeof typingAnswerBodySchema>
export type ChineseReviewBody = z.infer<typeof chineseReviewBodySchema>
