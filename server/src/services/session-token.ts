import { createHmac, timingSafeEqual } from 'crypto'
import { getJwtAccessSecret } from '../config/env'

/**
 * 词汇练习会话凭证。
 *
 * 目的：`POST /api/training/session/complete` 不能再相信客户端上报的 wordIds，
 * 否则任何登录用户都能直接把整本书标记为“已学完”。取词接口签发一个带签名的
 * 词表凭证，完成会话时只接受凭证内的词。
 *
 * 选择无状态的 HMAC 凭证而不是数据库表：会话时长有限、词表最多 200 个，
 * 不需要额外的清理任务和迁移。凭证与 JWT 使用不同的域前缀，不能互换。
 */

export interface SessionSetPayload {
  learnerId: string
  bookCode: string
  wordIds: string[]
  exp: number
}

export const SESSION_TOKEN_TTL_MS = 12 * 60 * 60 * 1000
const SESSION_TOKEN_VERSION = 'v1'
const SESSION_TOKEN_DOMAIN = 'study-assistant:session-set:v1'
const MAX_WORD_IDS = 200
const MAX_TOKEN_LENGTH = 16 * 1024

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url')
}

function signature(body: string): string {
  return toBase64Url(
    createHmac('sha256', `${SESSION_TOKEN_DOMAIN}:${getJwtAccessSecret()}`)
      .update(body)
      .digest()
  )
}

export function signSessionToken(
  learnerId: string,
  bookCode: string,
  wordIds: string[],
  now: number = Date.now()
): string {
  const payload: SessionSetPayload = {
    learnerId,
    bookCode: bookCode.trim(),
    wordIds: [...new Set(wordIds.filter(id => typeof id === 'string' && id.length > 0))].slice(
      0,
      MAX_WORD_IDS
    ),
    exp: now + SESSION_TOKEN_TTL_MS
  }
  const body = toBase64Url(JSON.stringify(payload))
  return `${SESSION_TOKEN_VERSION}.${body}.${signature(`${SESSION_TOKEN_VERSION}.${body}`)}`
}

export function verifySessionToken(token: string, now: number = Date.now()): SessionSetPayload {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    throw new Error('SESSION_TOKEN_INVALID')
  }
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== SESSION_TOKEN_VERSION) {
    throw new Error('SESSION_TOKEN_INVALID')
  }
  const body = `${parts[0]}.${parts[1]}`
  const expected = signature(body)
  const actual = parts[2]
  if (
    actual.length !== expected.length ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  ) {
    throw new Error('SESSION_TOKEN_INVALID')
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    throw new Error('SESSION_TOKEN_INVALID')
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('SESSION_TOKEN_INVALID')
  }
  const typed = payload as Partial<SessionSetPayload>
  if (
    typeof typed.learnerId !== 'string' ||
    typeof typed.bookCode !== 'string' ||
    typeof typed.exp !== 'number' ||
    !Array.isArray(typed.wordIds) ||
    typed.wordIds.length > MAX_WORD_IDS ||
    typed.wordIds.some(id => typeof id !== 'string' || id.length === 0)
  ) {
    throw new Error('SESSION_TOKEN_INVALID')
  }
  if (typed.exp <= now) {
    throw new Error('SESSION_TOKEN_EXPIRED')
  }
  return {
    learnerId: typed.learnerId,
    bookCode: typed.bookCode,
    wordIds: typed.wordIds as string[],
    exp: typed.exp
  }
}
