import type { components } from './api-generated'

type Schemas = components['schemas']

/** 核心接口请求 DTO；由 server/src/validation/schemas.ts 生成，勿手改。 */
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
