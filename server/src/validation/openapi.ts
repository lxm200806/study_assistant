import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import {
  bookMapQuerySchema,
  bookSessionQuerySchema,
  chatHistoryQuerySchema,
  chatSendBodySchema,
  chineseReviewBodySchema,
  chineseTodayQuerySchema,
  completeSessionBodySchema,
  credentialsBodySchema,
  dueCountQuerySchema,
  globalMapQuerySchema,
  historyQuerySchema,
  idParamsSchema,
  onboardBodySchema,
  practiceBodySchema,
  quizSubmitBodySchema,
  quizWordsQuerySchema,
  randomCountQuerySchema,
  refreshBodySchema,
  reviewQuerySchema,
  roleBodySchema,
  setActiveStudentBodySchema,
  studentNameBodySchema,
  subjectBodySchema,
  typingActivityBodySchema,
  typingAnswerBodySchema,
  typingArticleAnswerBodySchema,
  typingArticleCreateBodySchema,
  typingArticleUpdateBodySchema,
  typingDueQuerySchema,
  typingHistoryQuerySchema,
  typingListBodySchema,
  typingMarkBodySchema,
  typingQueueQuerySchema,
  typingSessionBodySchema,
  typingSummaryQuerySchema,
  vocabListQuerySchema
} from './schemas'
import {
  bookDetailResponseSchema,
  bookListResponseSchema,
  bookMapResponseSchema,
  bookProgressResponseSchema,
  bookRandomResponseSchema,
  bookSessionResponseSchema,
  chatHistoryResponseSchema,
  chatQuotaResponseSchema,
  chatSendResponseSchema,
  chineseReviewResponseSchema,
  chineseTodayResponseSchema,
  completeSessionResponseSchema,
  dueCountResponseSchema,
  globalMapResponseSchema,
  historyResponseSchema,
  practiceResponseSchema,
  profileResponseSchema,
  quizSubmitResponseSchema,
  quizWordsResponseSchema,
  refreshResponseSchema,
  reviewResponseSchema,
  setActiveStudentResponseSchema,
  studentMutationResponseSchema,
  studentsResponseSchema,
  tokenResponseSchema,
  userMutationResponseSchema,
  vocabDetailResponseSchema,
  vocabListResponseSchema,
  vocabStatsResponseSchema,
  typingActivityResponseSchema,
  typingAnswerResponseSchema,
  typingArticleAnswerResponseSchema,
  typingArticleResponseSchema,
  typingArticlesResponseSchema,
  typingCreateListResponseSchema,
  typingDeleteListResponseSchema,
  typingDeleteResponseSchema,
  typingDueArticlesResponseSchema,
  typingHistoryResponseSchema,
  typingListsResponseSchema,
  typingMarkResponseSchema,
  typingQueueResponseSchema,
  typingSessionResponseSchema,
  typingSummaryResponseSchema
} from './responses'

extendZodWithOpenApi(z)

const registry = new OpenAPIRegistry()

const credentials = registry.register('CredentialsBody', credentialsBodySchema)
const refresh = registry.register('RefreshBody', refreshBodySchema)
const activeStudent = registry.register('SetActiveStudentBody', setActiveStudentBodySchema)
const onboardBody = registry.register('OnboardBody', onboardBodySchema)
const subjectBody = registry.register('SubjectBody', subjectBodySchema)
const studentNameBody = registry.register('StudentNameBody', studentNameBodySchema)
const roleBody = registry.register('RoleBody', roleBodySchema)
const vocabListQuery = registry.register('VocabListQuery', vocabListQuerySchema)
const randomCountQuery = registry.register('RandomCountQuery', randomCountQuerySchema)
const globalMapQuery = registry.register('GlobalMapQuery', globalMapQuerySchema)
const dueCountQuery = registry.register('DueCountQuery', dueCountQuerySchema)
const bookSessionQuery = registry.register('BookSessionQuery', bookSessionQuerySchema)
const bookMapQuery = registry.register('BookMapQuery', bookMapQuerySchema)
const typingQueueQuery = registry.register('TypingQueueQuery', typingQueueQuerySchema)
const chineseTodayQuery = registry.register('ChineseTodayQuery', chineseTodayQuerySchema)
const reviewQuery = registry.register('ReviewQuery', reviewQuerySchema)
const historyQuery = registry.register('HistoryQuery', historyQuerySchema)
const quizWordsQuery = registry.register('QuizWordsQuery', quizWordsQuerySchema)
const quizSubmitBody = registry.register('QuizSubmitBody', quizSubmitBodySchema)
const typingSummaryQuery = registry.register('TypingSummaryQuery', typingSummaryQuerySchema)
const typingListBody = registry.register('TypingListBody', typingListBodySchema)
const typingMarkBody = registry.register('TypingMarkBody', typingMarkBodySchema)
const typingActivityBody = registry.register('TypingActivityBody', typingActivityBodySchema)
const typingHistoryQuery = registry.register('TypingHistoryQuery', typingHistoryQuerySchema)
const typingSessionBody = registry.register('TypingSessionBody', typingSessionBodySchema)
const typingArticleCreateBody = registry.register(
  'TypingArticleCreateBody',
  typingArticleCreateBodySchema
)
const typingArticleUpdateBody = registry.register(
  'TypingArticleUpdateBody',
  typingArticleUpdateBodySchema
)
const typingArticleAnswerBody = registry.register(
  'TypingArticleAnswerBody',
  typingArticleAnswerBodySchema
)
const typingDueQuery = registry.register('TypingDueQuery', typingDueQuerySchema)
const idParams = registry.register('IdParams', idParamsSchema)
const chatSendBody = registry.register('ChatSendBody', chatSendBodySchema)
const chatHistoryQuery = registry.register('ChatHistoryQuery', chatHistoryQuerySchema)
const practiceBody = registry.register('PracticeBody', practiceBodySchema)
const completeSessionBody = registry.register('CompleteSessionBody', completeSessionBodySchema)
const typingAnswerBody = registry.register('TypingAnswerBody', typingAnswerBodySchema)
const chineseReviewBody = registry.register('ChineseReviewBody', chineseReviewBodySchema)
const bookParams = registry.register('BookCodeParams', z.object({ code: z.string().min(1) }))
const courseParams = registry.register('CourseIdParams', z.object({ courseId: z.string().min(1) }))

const tokenResponse = registry.register('TokenResponse', tokenResponseSchema)
const refreshResponse = registry.register('RefreshResponse', refreshResponseSchema)
const activeStudentResponse = registry.register(
  'SetActiveStudentResponse',
  setActiveStudentResponseSchema
)
const profileResponse = registry.register('ProfileResponse', profileResponseSchema)
const studentsResponse = registry.register('StudentsResponse', studentsResponseSchema)
const studentMutationResponse = registry.register(
  'StudentMutationResponse',
  studentMutationResponseSchema
)
const userMutationResponse = registry.register('UserMutationResponse', userMutationResponseSchema)
const vocabListResponse = registry.register('VocabListResponse', vocabListResponseSchema)
const vocabDetailResponse = registry.register('VocabDetailResponse', vocabDetailResponseSchema)
const vocabStatsResponse = registry.register('VocabStatsResponse', vocabStatsResponseSchema)
const globalMapResponse = registry.register('GlobalMapResponse', globalMapResponseSchema)
const bookProgressResponse = registry.register('BookProgressResponse', bookProgressResponseSchema)
const dueCountResponse = registry.register('DueCountResponse', dueCountResponseSchema)
const bookRandomResponse = registry.register('BookRandomResponse', bookRandomResponseSchema)
const bookSessionResponse = registry.register('BookSessionResponse', bookSessionResponseSchema)
const bookMapResponse = registry.register('BookMapResponse', bookMapResponseSchema)
const practiceResponse = registry.register('PracticeResponse', practiceResponseSchema)
const completeSessionResponse = registry.register(
  'CompleteSessionResponse',
  completeSessionResponseSchema
)
const typingQueueResponse = registry.register('TypingQueueResponse', typingQueueResponseSchema)
const typingAnswerResponse = registry.register('TypingAnswerResponse', typingAnswerResponseSchema)
const chineseTodayResponse = registry.register('ChineseTodayResponse', chineseTodayResponseSchema)
const chineseReviewResponse = registry.register('ChineseReviewResponse', chineseReviewResponseSchema)
const bookListResponse = registry.register('BookListResponse', bookListResponseSchema)
const bookDetailResponse = registry.register('BookDetailResponse', bookDetailResponseSchema)
const reviewResponse = registry.register('ReviewResponse', reviewResponseSchema)
const historyResponse = registry.register('HistoryResponse', historyResponseSchema)
const quizWordsResponse = registry.register('QuizWordsResponse', quizWordsResponseSchema)
const quizSubmitResponse = registry.register('QuizSubmitResponse', quizSubmitResponseSchema)
const typingSummaryResponse = registry.register('TypingSummaryResponse', typingSummaryResponseSchema)
const typingListsResponse = registry.register('TypingListsResponse', typingListsResponseSchema)
const typingCreateListResponse = registry.register(
  'TypingCreateListResponse',
  typingCreateListResponseSchema
)
const typingDeleteListResponse = registry.register(
  'TypingDeleteListResponse',
  typingDeleteListResponseSchema
)
const chatSendResponse = registry.register('ChatSendResponse', chatSendResponseSchema)
const chatHistoryResponse = registry.register('ChatHistoryResponse', chatHistoryResponseSchema)
const chatQuotaResponse = registry.register('ChatQuotaResponse', chatQuotaResponseSchema)
const typingMarkResponse = registry.register('TypingMarkResponse', typingMarkResponseSchema)
const typingActivityResponse = registry.register(
  'TypingActivityResponse',
  typingActivityResponseSchema
)
const typingHistoryResponse = registry.register('TypingHistoryResponse', typingHistoryResponseSchema)
const typingSessionResponse = registry.register('TypingSessionResponse', typingSessionResponseSchema)
const typingArticlesResponse = registry.register(
  'TypingArticlesResponse',
  typingArticlesResponseSchema
)
const typingArticleResponse = registry.register('TypingArticleResponse', typingArticleResponseSchema)
const typingDueArticlesResponse = registry.register(
  'TypingDueArticlesResponse',
  typingDueArticlesResponseSchema
)
const typingArticleAnswerResponse = registry.register(
  'TypingArticleAnswerResponse',
  typingArticleAnswerResponseSchema
)
const typingDeleteResponse = registry.register('TypingDeleteResponse', typingDeleteResponseSchema)

const badRequest = { description: '请求参数不正确' }
const success = (schema: z.ZodTypeAny) => ({
  description: '成功',
  content: { 'application/json': { schema } }
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/register',
  tags: ['auth'],
  summary: '注册账号',
  request: { body: { content: { 'application/json': { schema: credentials } } } },
  responses: { 201: success(tokenResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  tags: ['auth'],
  summary: '登录',
  request: { body: { content: { 'application/json': { schema: credentials } } } },
  responses: { 200: success(tokenResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/refresh',
  tags: ['auth'],
  summary: '刷新 access token',
  request: { body: { content: { 'application/json': { schema: refresh } } } },
  responses: { 200: success(refreshResponse), 400: badRequest }
})

registry.registerPath({
  method: 'put',
  path: '/api/auth/students/active',
  tags: ['auth'],
  summary: '切换当前学生',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: activeStudent } } } },
  responses: { 200: success(activeStudentResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/auth/profile',
  tags: ['auth'],
  summary: '当前账号资料',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(profileResponse) }
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/onboard',
  tags: ['auth'],
  summary: '完成首次引导',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: onboardBody } } } },
  responses: { 200: success(userMutationResponse), 400: badRequest }
})

registry.registerPath({
  method: 'put',
  path: '/api/auth/subject',
  tags: ['auth'],
  summary: '切换学科',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: subjectBody } } } },
  responses: { 200: success(userMutationResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/auth/students',
  tags: ['auth'],
  summary: '学生列表',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(studentsResponse) }
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/students',
  tags: ['auth'],
  summary: '创建学生',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: studentNameBody } } } },
  responses: { 201: success(studentMutationResponse), 400: badRequest }
})

registry.registerPath({
  method: 'put',
  path: '/api/auth/role',
  tags: ['auth'],
  summary: '切换家长/学生角色',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: roleBody } } } },
  responses: { 200: success(userMutationResponse), 400: badRequest }
})

registry.registerPath({
  method: 'put',
  path: '/api/auth/students/{id}',
  tags: ['auth'],
  summary: '修改学生姓名',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: studentNameBody } } }
  },
  responses: { 200: success(studentMutationResponse), 400: badRequest }
})

registry.registerPath({
  method: 'delete',
  path: '/api/auth/students/{id}',
  tags: ['auth'],
  summary: '归档学生',
  security: [{ bearerAuth: [] }],
  request: { params: idParams },
  responses: { 200: success(userMutationResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/books',
  tags: ['books'],
  summary: '词书列表',
  responses: { 200: success(bookListResponse) }
})

registry.registerPath({
  method: 'get',
  path: '/api/books/{code}',
  tags: ['books'],
  summary: '词书详情',
  security: [{ bearerAuth: [] }],
  request: { params: bookParams },
  responses: { 200: success(bookDetailResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/books/{code}/due-count',
  tags: ['books'],
  summary: '词书待复习数量',
  security: [{ bearerAuth: [] }],
  request: { params: bookParams, query: dueCountQuery },
  responses: { 200: success(dueCountResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/books/{code}/progress',
  tags: ['books'],
  summary: '词书进度',
  security: [{ bearerAuth: [] }],
  request: { params: bookParams },
  responses: { 200: success(bookProgressResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/books/{code}/random',
  tags: ['books'],
  summary: '词书随机词',
  security: [{ bearerAuth: [] }],
  request: { params: bookParams, query: randomCountQuery },
  responses: { 200: success(bookRandomResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/books/{code}/session',
  tags: ['books'],
  summary: '取训练会话',
  security: [{ bearerAuth: [] }],
  request: { params: bookParams, query: bookSessionQuery },
  responses: { 200: success(bookSessionResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/vocab',
  tags: ['vocab'],
  summary: '词汇列表',
  security: [{ bearerAuth: [] }],
  request: { query: vocabListQuery },
  responses: { 200: success(vocabListResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/vocab/random',
  tags: ['vocab'],
  summary: '随机词汇',
  security: [{ bearerAuth: [] }],
  request: { query: randomCountQuery },
  responses: { 200: success(vocabListResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/vocab/stats',
  tags: ['vocab'],
  summary: '词汇统计',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(vocabStatsResponse) }
})

registry.registerPath({
  method: 'get',
  path: '/api/vocab/maps/global',
  tags: ['vocab'],
  summary: '全局词汇图谱',
  security: [{ bearerAuth: [] }],
  request: { query: globalMapQuery },
  responses: { 200: success(globalMapResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/vocab/maps/book/{code}',
  tags: ['vocab'],
  summary: '词书掌握图谱',
  security: [{ bearerAuth: [] }],
  request: { params: bookParams, query: bookMapQuery },
  responses: { 200: success(bookMapResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/vocab/{id}',
  tags: ['vocab'],
  summary: '词汇详情',
  security: [{ bearerAuth: [] }],
  request: { params: idParams },
  responses: { 200: success(vocabDetailResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/training/practice',
  tags: ['training'],
  summary: '提交一次练习',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: practiceBody } } } },
  responses: { 200: success(practiceResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/training/session/complete',
  tags: ['training'],
  summary: '结算训练会话',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: completeSessionBody } } } },
  responses: { 200: success(completeSessionResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/training/review',
  tags: ['training'],
  summary: '待复习队列',
  security: [{ bearerAuth: [] }],
  request: { query: reviewQuery },
  responses: { 200: success(reviewResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/training/history',
  tags: ['training'],
  summary: '训练历史',
  security: [{ bearerAuth: [] }],
  request: { query: historyQuery },
  responses: { 200: success(historyResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/training/quiz/words',
  tags: ['training'],
  summary: '测验题目',
  security: [{ bearerAuth: [] }],
  request: { query: quizWordsQuery },
  responses: { 200: success(quizWordsResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/training/quiz/submit',
  tags: ['training'],
  summary: '提交测验',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: quizSubmitBody } } } },
  responses: { 200: success(quizSubmitResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/typing/summary',
  tags: ['typing'],
  summary: '拼读统计',
  security: [{ bearerAuth: [] }],
  request: { query: typingSummaryQuery },
  responses: { 200: success(typingSummaryResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/typing/lists',
  tags: ['typing'],
  summary: '练习词表列表',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(typingListsResponse) }
})

registry.registerPath({
  method: 'post',
  path: '/api/typing/lists',
  tags: ['typing'],
  summary: '创建练习词表',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: typingListBody } } } },
  responses: { 201: success(typingCreateListResponse), 400: badRequest }
})

registry.registerPath({
  method: 'delete',
  path: '/api/typing/lists/{id}',
  tags: ['typing'],
  summary: '删除练习词表',
  security: [{ bearerAuth: [] }],
  request: { params: idParams },
  responses: { 200: success(typingDeleteListResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/typing/queue',
  tags: ['typing'],
  summary: '取拼读队列',
  security: [{ bearerAuth: [] }],
  request: { query: typingQueueQuery },
  responses: { 200: success(typingQueueResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/typing/answer',
  tags: ['typing'],
  summary: '提交拼读答案',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: typingAnswerBody } } } },
  responses: { 200: success(typingAnswerResponse), 400: badRequest }
})

registry.registerPath({
  method: 'put',
  path: '/api/typing/marks',
  tags: ['typing'],
  summary: '收藏/跳过标记',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: typingMarkBody } } } },
  responses: { 200: success(typingMarkResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/typing/activity',
  tags: ['typing'],
  summary: '记录拼读活动',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: typingActivityBody } } } },
  responses: { 200: success(typingActivityResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/typing/history',
  tags: ['typing'],
  summary: '拼读历史',
  security: [{ bearerAuth: [] }],
  request: { query: typingHistoryQuery },
  responses: { 200: success(typingHistoryResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/typing/sessions',
  tags: ['typing'],
  summary: '记录拼读会话',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: typingSessionBody } } } },
  responses: { 201: success(typingSessionResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/typing/articles',
  tags: ['typing'],
  summary: '短文列表',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(typingArticlesResponse) }
})

registry.registerPath({
  method: 'post',
  path: '/api/typing/articles',
  tags: ['typing'],
  summary: '创建短文',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: typingArticleCreateBody } } } },
  responses: { 201: success(typingArticleResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/typing/articles/due',
  tags: ['typing'],
  summary: '到期短文句子',
  security: [{ bearerAuth: [] }],
  request: { query: typingDueQuery },
  responses: { 200: success(typingDueArticlesResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/typing/articles/answer',
  tags: ['typing'],
  summary: '提交短文句子答案',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: typingArticleAnswerBody } } } },
  responses: { 200: success(typingArticleAnswerResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/typing/articles/{id}/preview',
  tags: ['typing'],
  summary: '预览短文编辑影响',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: typingArticleUpdateBody } } }
  },
  responses: { 200: success(typingArticleResponse), 400: badRequest }
})

registry.registerPath({
  method: 'put',
  path: '/api/typing/articles/{id}',
  tags: ['typing'],
  summary: '更新短文',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: typingArticleUpdateBody } } }
  },
  responses: { 200: success(typingArticleResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/typing/articles/{id}',
  tags: ['typing'],
  summary: '短文详情',
  security: [{ bearerAuth: [] }],
  request: { params: idParams },
  responses: { 200: success(typingArticleResponse), 400: badRequest }
})

registry.registerPath({
  method: 'delete',
  path: '/api/typing/articles/{id}',
  tags: ['typing'],
  summary: '删除短文',
  security: [{ bearerAuth: [] }],
  request: { params: idParams },
  responses: { 200: success(typingDeleteResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/chinese/courses/{courseId}/today',
  tags: ['chinese'],
  summary: '语文今日队列',
  security: [{ bearerAuth: [] }],
  request: { params: courseParams, query: chineseTodayQuery },
  responses: { 200: success(chineseTodayResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/chinese/courses/{courseId}/review',
  tags: ['chinese'],
  summary: '提交语文复习',
  security: [{ bearerAuth: [] }],
  request: {
    params: courseParams,
    body: { content: { 'application/json': { schema: chineseReviewBody } } }
  },
  responses: { 200: success(chineseReviewResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/chat/send',
  tags: ['chat'],
  summary: '发送聊天消息',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: chatSendBody } } } },
  responses: { 200: success(chatSendResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/chat/stream',
  tags: ['chat'],
  summary: 'SSE 流式聊天',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: chatSendBody } } } },
  responses: {
    200: {
      description: 'SSE 事件流（event: token / done / error）',
      content: { 'text/event-stream': { schema: z.string() } }
    },
    400: badRequest
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/chat/history',
  tags: ['chat'],
  summary: '聊天历史',
  security: [{ bearerAuth: [] }],
  request: { query: chatHistoryQuery },
  responses: { 200: success(chatHistoryResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/chat/quota',
  tags: ['chat'],
  summary: '聊天剩余额度',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(chatQuotaResponse) }
})

const generator = new OpenApiGeneratorV3(registry.definitions)

export const openApiDocument = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: '学习助手 API',
    version: '1.0.0',
    description: '核心接口的 Zod schema 与 OpenAPI 文档。当前覆盖登录、词书会话、训练、拼读、语文核心链路。'
  },
  servers: [{ url: `http://localhost:${process.env.PORT || 3005}` }]
})

openApiDocument.components = openApiDocument.components || {}
openApiDocument.components.securitySchemes = {
  bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
}
