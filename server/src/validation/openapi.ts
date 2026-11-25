import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import {
  bookMapQuerySchema,
  bookSessionQuerySchema,
  chineseReviewBodySchema,
  chineseTodayQuerySchema,
  completeSessionBodySchema,
  credentialsBodySchema,
  practiceBodySchema,
  refreshBodySchema,
  setActiveStudentBodySchema,
  typingAnswerBodySchema,
  typingQueueQuerySchema
} from './schemas'
import {
  bookMapResponseSchema,
  bookSessionResponseSchema,
  chineseReviewResponseSchema,
  chineseTodayResponseSchema,
  completeSessionResponseSchema,
  practiceResponseSchema,
  refreshResponseSchema,
  setActiveStudentResponseSchema,
  tokenResponseSchema,
  typingAnswerResponseSchema,
  typingQueueResponseSchema
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
