import { randomUUID } from 'crypto'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { getJwtAccessSecret, getJwtRefreshSecret } from '../config/env'

const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '2h'
const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

export interface AuthTokenPayload extends JwtPayload {
  userId: string
  username?: string
  typ: 'access' | 'refresh'
  /** User.tokenVersion，用于一键撤销全部会话。 */
  ver?: number
  /** AuthSession.id，用于按设备撤销。 */
  sid?: string
}

function verifyTypedToken(token: string, expectedType: AuthTokenPayload['typ']): AuthTokenPayload | null {
  try {
    const secret = expectedType === 'access' ? getJwtAccessSecret() : getJwtRefreshSecret()
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] })
    if (typeof decoded !== 'object' || !decoded || typeof decoded.userId !== 'string') return null
    if (decoded.typ !== expectedType) return null
    return decoded as AuthTokenPayload
  } catch {
    return null
  }
}

export function generateAccessToken(
  userId: string,
  username: string,
  tokenVersion = 0,
  sessionId?: string
): string {
  return jwt.sign(
    { userId, username, typ: 'access', ver: tokenVersion, ...(sessionId ? { sid: sessionId } : {}) },
    getJwtAccessSecret(),
    { expiresIn: accessExpiresIn, algorithm: 'HS256' }
  )
}

export function generateRefreshToken(
  userId: string,
  tokenVersion = 0,
  sessionId?: string
): string {
  return jwt.sign(
    {
      userId,
      typ: 'refresh',
      ver: tokenVersion,
      ...(sessionId ? { sid: sessionId } : {}),
      // 轮换可能发生在同一秒；jti 保证新旧 refresh token 不重复。
      jti: randomUUID()
    },
    getJwtRefreshSecret(),
    { expiresIn: refreshExpiresIn, algorithm: 'HS256' }
  )
}

export function verifyAccessToken(token: string): AuthTokenPayload | null {
  return verifyTypedToken(token, 'access')
}

export function verifyRefreshToken(token: string): AuthTokenPayload | null {
  return verifyTypedToken(token, 'refresh')
}
