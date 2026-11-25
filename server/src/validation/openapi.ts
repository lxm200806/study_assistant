import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import {
  adminMissingWordsQuerySchema,
  asrChunkBodySchema,
  asrEndBodySchema,
  asrStartBodySchema,
  assessBodySchema,
  bookMapQuerySchema,
  bookSessionQuerySchema,
  chatHistoryQuerySchema,
  chatSendBodySchema,
  chineseAdminPatchBodySchema,
  chineseCourseBodySchema,
  chineseCoursePatchBodySchema,
  chineseCoursePreviewBodySchema,
  chineseDraftImportBodySchema,
  chineseDraftListQuerySchema,
  chineseDraftPatchBodySchema,
  chineseLibraryQuerySchema,
  chinesePublishBatchBodySchema,
  chineseReviewBodySchema,
  chineseTodayQuerySchema,
  completeSessionBodySchema,
  courseIdParamsSchema,
  credentialsBodySchema,
  draftIdParamsSchema,
  dueCountQuerySchema,
  globalMapQuerySchema,
  historyQuerySchema,
  idParamsSchema,
  onboardBodySchema,
  pointIdParamsSchema,
  practiceBodySchema,
  quizSubmitBodySchema,
  quizWordsQuerySchema,
  randomCountQuerySchema,
  refreshBodySchema,
  resourceIdParamsSchema,
  reviewQuerySchema,
  roleBodySchema,
  setActiveStudentBodySchema,
  studentNameBodySchema,
  subjectBodySchema,
  transcribeBodySchema,
  ttsQuerySchema,
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
  adminResponseSchema,
  bookDetailResponseSchema,
  bookListResponseSchema,
  chineseArrayResponseSchema,
  chineseObjectResponseSchema,
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
  sessionsResponseSchema,
  setActiveStudentResponseSchema,
  simpleSuccessResponseSchema,
  speechResponseSchema,
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
const pointIdParams = registry.register('PointIdParams', pointIdParamsSchema)
const courseIdParams = registry.register('CourseIdParams', courseIdParamsSchema)
const resourceIdParams = registry.register('ResourceIdParams', resourceIdParamsSchema)
const draftIdParams = registry.register('DraftIdParams', draftIdParamsSchema)
const chineseCourseBody = registry.register('ChineseCourseBody', chineseCourseBodySchema)
const chineseCoursePreviewBody = registry.register(
  'ChineseCoursePreviewBody',
  chineseCoursePreviewBodySchema
)
const chineseCoursePatchBody = registry.register(
  'ChineseCoursePatchBody',
  chineseCoursePatchBodySchema
)
const chineseLibraryQuery = registry.register('ChineseLibraryQuery', chineseLibraryQuerySchema)
const chineseAdminPatchBody = registry.register(
  'ChineseAdminPatchBody',
  chineseAdminPatchBodySchema
)
const chineseDraftImportBody = registry.register(
  'ChineseDraftImportBody',
  chineseDraftImportBodySchema
)
const chineseDraftListQuery = registry.register(
  'ChineseDraftListQuery',
  chineseDraftListQuerySchema
)
const chineseDraftPatchBody = registry.register(
  'ChineseDraftPatchBody',
  chineseDraftPatchBodySchema
)
const chinesePublishBatchBody = registry.register(
  'ChinesePublishBatchBody',
  chinesePublishBatchBodySchema
)
const adminMissingWordsQuery = registry.register(
  'AdminMissingWordsQuery',
  adminMissingWordsQuerySchema
)
const asrStartBody = registry.register('AsrStartBody', asrStartBodySchema)
const asrChunkBody = registry.register('AsrChunkBody', asrChunkBodySchema)
const asrEndBody = registry.register('AsrEndBody', asrEndBodySchema)
const transcribeBody = registry.register('TranscribeBody', transcribeBodySchema)
const assessBody = registry.register('AssessBody', assessBodySchema)
const ttsQuery = registry.register('TtsQuery', ttsQuerySchema)
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
const simpleSuccessResponse = registry.register(
  'SimpleSuccessResponse',
  simpleSuccessResponseSchema
)
const sessionsResponse = registry.register('SessionsResponse', sessionsResponseSchema)
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
const chineseObjectResponse = registry.register(
  'ChineseObjectResponse',
  chineseObjectResponseSchema
)
const chineseArrayResponse = registry.register('ChineseArrayResponse', chineseArrayResponseSchema)
const adminResponse = registry.register('AdminResponse', adminResponseSchema)
const speechResponse = registry.register('SpeechResponse', speechResponseSchema)

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
  path: '/api/auth/logout',
  tags: ['auth'],
  summary: '退出当前设备',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(simpleSuccessResponse) }
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout-all',
  tags: ['auth'],
  summary: '退出全部设备',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(simpleSuccessResponse) }
})

registry.registerPath({
  method: 'get',
  path: '/api/auth/sessions',
  tags: ['auth'],
  summary: '当前账号设备会话',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(sessionsResponse) }
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

registry.registerPath({
  method: 'get',
  path: '/api/chinese/meta',
  tags: ['chinese'],
  summary: '语文元数据',
  responses: { 200: success(chineseObjectResponse) }
})

registry.registerPath({
  method: 'get',
  path: '/api/chinese/library',
  tags: ['chinese'],
  summary: '语文题库',
  security: [{ bearerAuth: [] }],
  request: { query: chineseLibraryQuery },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'patch',
  path: '/api/chinese/library/{pointId}',
  tags: ['chinese'],
  summary: '编辑知识点卡',
  security: [{ bearerAuth: [] }],
  request: {
    params: pointIdParams,
    body: { content: { 'application/json': { schema: chineseAdminPatchBody } } }
  },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/chinese/library/coverage',
  tags: ['chinese'],
  summary: '语文题库覆盖度',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(chineseObjectResponse) }
})

registry.registerPath({
  method: 'post',
  path: '/api/chinese/courses',
  tags: ['chinese'],
  summary: '创建语文课程',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: chineseCourseBody } } } },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/chinese/courses',
  tags: ['chinese'],
  summary: '语文课程列表',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(chineseArrayResponse) }
})

registry.registerPath({
  method: 'post',
  path: '/api/chinese/courses/preview',
  tags: ['chinese'],
  summary: '预览语文课程',
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: chineseCoursePreviewBody } } }
  },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'patch',
  path: '/api/chinese/courses/{courseId}',
  tags: ['chinese'],
  summary: '修改语文课程',
  security: [{ bearerAuth: [] }],
  request: {
    params: courseIdParams,
    body: { content: { 'application/json': { schema: chineseCoursePatchBody } } }
  },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'delete',
  path: '/api/chinese/courses/{courseId}',
  tags: ['chinese'],
  summary: '删除语文课程',
  security: [{ bearerAuth: [] }],
  request: { params: courseIdParams },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/chinese/courses/{courseId}/sync',
  tags: ['chinese'],
  summary: '同步课程题卡',
  security: [{ bearerAuth: [] }],
  request: { params: courseIdParams },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/chinese/courses/{courseId}/plan',
  tags: ['chinese'],
  summary: '语文课程计划',
  security: [{ bearerAuth: [] }],
  request: { params: courseIdParams },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/chinese/courses/{courseId}/stats',
  tags: ['chinese'],
  summary: '语文课程统计',
  security: [{ bearerAuth: [] }],
  request: { params: courseIdParams },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/chinese/resources',
  tags: ['chinese'],
  summary: '语文资源列表',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(chineseArrayResponse) }
})

registry.registerPath({
  method: 'post',
  path: '/api/chinese/resources/sync-incremental',
  tags: ['chinese'],
  summary: '增量同步官方资源',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(chineseObjectResponse) }
})

registry.registerPath({
  method: 'post',
  path: '/api/chinese/resources/sync-all',
  tags: ['chinese'],
  summary: '全量同步官方资源',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(chineseObjectResponse) }
})

registry.registerPath({
  method: 'post',
  path: '/api/chinese/resources/seed',
  tags: ['chinese'],
  summary: '初始化语文资源',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(chineseObjectResponse) }
})

registry.registerPath({
  method: 'get',
  path: '/api/chinese/resources/{resourceId}',
  tags: ['chinese'],
  summary: '语文资源详情',
  security: [{ bearerAuth: [] }],
  request: { params: resourceIdParams },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/chinese/resources/{resourceId}/sync',
  tags: ['chinese'],
  summary: '同步单个语文资源',
  security: [{ bearerAuth: [] }],
  request: { params: resourceIdParams },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/chinese/drafts/import',
  tags: ['chinese'],
  summary: '导入题卡草稿',
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: chineseDraftImportBody } } }
  },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/chinese/drafts',
  tags: ['chinese'],
  summary: '草稿列表',
  security: [{ bearerAuth: [] }],
  request: { query: chineseDraftListQuery },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/chinese/drafts/publish-batch',
  tags: ['chinese'],
  summary: '批量发布草稿',
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: chinesePublishBatchBody } } }
  },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'patch',
  path: '/api/chinese/drafts/{draftId}',
  tags: ['chinese'],
  summary: '编辑草稿',
  security: [{ bearerAuth: [] }],
  request: {
    params: draftIdParams,
    body: { content: { 'application/json': { schema: chineseDraftPatchBody } } }
  },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/chinese/drafts/{draftId}/publish',
  tags: ['chinese'],
  summary: '发布草稿',
  security: [{ bearerAuth: [] }],
  request: { params: draftIdParams },
  responses: { 200: success(chineseObjectResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/admin/vocabulary/missing/summary',
  tags: ['admin'],
  summary: '缺词摘要',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(adminResponse) }
})

registry.registerPath({
  method: 'get',
  path: '/api/admin/vocabulary/missing',
  tags: ['admin'],
  summary: '缺词列表',
  security: [{ bearerAuth: [] }],
  request: { query: adminMissingWordsQuery },
  responses: { 200: success(adminResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/speech/asr/config',
  tags: ['speech'],
  summary: 'ASR 配置',
  security: [{ bearerAuth: [] }],
  responses: { 200: success(speechResponse) }
})

registry.registerPath({
  method: 'post',
  path: '/api/speech/asr/session/start',
  tags: ['speech'],
  summary: '开始 ASR 会话',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: asrStartBody } } } },
  responses: { 200: success(speechResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/speech/asr/session/chunk',
  tags: ['speech'],
  summary: '推送 ASR 音频分片',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: asrChunkBody } } } },
  responses: { 200: success(speechResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/speech/asr/session/end',
  tags: ['speech'],
  summary: '结束 ASR 会话',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: asrEndBody } } } },
  responses: { 200: success(speechResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/speech/transcribe',
  tags: ['speech'],
  summary: '整段语音转写',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: transcribeBody } } } },
  responses: { 200: success(speechResponse), 400: badRequest }
})

registry.registerPath({
  method: 'post',
  path: '/api/speech/assess',
  tags: ['speech'],
  summary: '口语评分',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: assessBody } } } },
  responses: { 200: success(speechResponse), 400: badRequest }
})

registry.registerPath({
  method: 'get',
  path: '/api/tts',
  tags: ['tts'],
  summary: '文本转语音',
  request: { query: ttsQuery },
  responses: {
    200: {
      description: 'MP3 音频',
      content: { 'audio/mpeg': { schema: z.string().openapi({ format: 'binary' }) } }
    },
    400: badRequest
  }
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
