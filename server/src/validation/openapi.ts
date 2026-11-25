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
  historyQuerySchema,
  idParamsSchema,
  practiceBodySchema,
  quizSubmitBodySchema,
  quizWordsQuerySchema,
  refreshBodySchema,
  reviewQuerySchema,
  setActiveStudentBodySchema,
  typingAnswerBodySchema,
  typingListBodySchema,
  typingQueueQuerySchema,
  typingSummaryQuerySchema
} from './schemas'
import {
  bookDetailResponseSchema,
  bookListResponseSchema,
  bookMapResponseSchema,
  bookSessionResponseSchema,
  chatHistoryResponseSchema,
  chatQuotaResponseSchema,
  chatSendResponseSchema,
  chineseReviewResponseSchema,
  chineseTodayResponseSchema,
  completeSessionResponseSchema,
  historyResponseSchema,
  practiceResponseSchema,
  quizSubmitResponseSchema,
  quizWordsResponseSchema,
  refreshResponseSchema,
  reviewResponseSchema,
  setActiveStudentResponseSchema,
  tokenResponseSchema,
  typingAnswerResponseSchema,
  typingCreateListResponseSchema,
  typingDeleteListResponseSchema,
  typingListsResponseSchema,
  typingQueueResponseSchema,
  typingSummaryResponseSchema
} from './responses'

extendZodWithOpenApi(z)

const registry = new OpenAPIRegistry()

const credentials = registry.register('CredentialsBody', credentialsBodySchema)
const refresh = registry.register('RefreshBody', refreshBodySchema)
const activeStudent = registry.register('SetActiveStudentBody', setActiveStudentBodySchema)
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
  path: '/api/books/{code}/session',
  tags: ['books'],
  summary: '取训练会话',
  security: [{ bearerAuth: [] }],
  request: { params: bookParams, query: bookSessionQuery },
  responses: { 200: success(bookSessionResponse), 400: badRequest }
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
