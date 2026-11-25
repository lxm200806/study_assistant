import type { components } from './api-generated'

type Schemas = components['schemas']

/** 核心接口请求/响应 DTO；由 server/src/validation/{schemas,responses}.ts 生成，勿手改。 */
export type CredentialsBody = Schemas['CredentialsBody']
export type RefreshBody = Schemas['RefreshBody']
export type SetActiveStudentBody = Schemas['SetActiveStudentBody']
export type PracticeBody = Schemas['PracticeBody']
export type CompleteSessionBody = Schemas['CompleteSessionBody']
export type TypingAnswerBody = Schemas['TypingAnswerBody']
export type ChineseReviewBody = Schemas['ChineseReviewBody']

export type BookSessionQuery = Schemas['BookSessionQuery']
export type TypingQueueQuery = Schemas['TypingQueueQuery']
export type ChineseTodayQuery = Schemas['ChineseTodayQuery']

/** 核心接口响应类型。 */
export type TokenResponse = Schemas['TokenResponse']
export type RefreshResponse = Schemas['RefreshResponse']
export type SetActiveStudentResponse = Schemas['SetActiveStudentResponse']
export type BookSessionResponse = Schemas['BookSessionResponse']
export type BookSessionData = BookSessionResponse['data']
export type BookMapResponse = Schemas['BookMapResponse']
export type BookMapData = BookMapResponse['data']
export type PracticeResponse = Schemas['PracticeResponse']
export type PracticeData = PracticeResponse['data']
export type CompleteSessionResponse = Schemas['CompleteSessionResponse']
export type CompleteSessionData = CompleteSessionResponse['data']
export type TypingQueueResponse = Schemas['TypingQueueResponse']
export type TypingQueueData = TypingQueueResponse['data']
export type TypingAnswerResponse = Schemas['TypingAnswerResponse']
export type TypingAnswerData = TypingAnswerResponse['data']
export type ChineseTodayResponse = Schemas['ChineseTodayResponse']
export type ChineseReviewResponse = Schemas['ChineseReviewResponse']
