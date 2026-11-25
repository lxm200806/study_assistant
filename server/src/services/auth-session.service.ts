import { createHash, randomUUID } from 'crypto'
import prisma from '../prisma/client'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt'

export interface SessionContext {
  userAgent?: string
  ip?: string
}

interface SessionUser {
  id: string
  username: string
  tokenVersion: number
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function contextFields(context?: SessionContext) {
  return {
    userAgent: String(context?.userAgent || '').slice(0, 300),
    ip: String(context?.ip || '').slice(0, 80)
  }
}

/** 登录/注册成功后创建一台设备会话，并签发 access/refresh。 */
export async function issueSessionTokens(user: SessionUser, context?: SessionContext) {
  const sessionId = randomUUID()
  const accessToken = generateAccessToken(user.id, user.username, user.tokenVersion, sessionId)
  const refreshToken = generateRefreshToken(user.id, user.tokenVersion, sessionId)
  await prisma.authSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      ...contextFields(context)
    }
  })
  return { accessToken, refreshToken }
}

/** 刷新时轮换 refresh token；旧 token 立即失效。 */
export async function rotateSessionTokens(
  refreshToken: string,
  context?: SessionContext
): Promise<{ accessToken: string; refreshToken: string }> {
  const decoded = verifyRefreshToken(refreshToken)
  if (!decoded || !decoded.sid) throw new Error('Invalid refresh token')

  const session = await prisma.authSession.findUnique({
    where: { id: decoded.sid },
    include: { user: true }
  })
  if (!session || session.revokedAt || session.userId !== decoded.userId) {
    throw new Error('Invalid refresh token')
  }
  if (session.tokenHash !== hashToken(refreshToken)) {
    throw new Error('Invalid refresh token')
  }
  if (session.user.tokenVersion !== (decoded.ver ?? 0)) {
    throw new Error('Invalid refresh token')
  }

  const accessToken = generateAccessToken(
    session.user.id,
    session.user.username,
    session.user.tokenVersion,
    session.id
  )
  const nextRefreshToken = generateRefreshToken(
    session.user.id,
    session.user.tokenVersion,
    session.id
  )
  await prisma.authSession.update({
    where: { id: session.id },
    data: {
      tokenHash: hashToken(nextRefreshToken),
      lastUsedAt: new Date(),
      ...contextFields(context)
    }
  })
  return { accessToken, refreshToken: nextRefreshToken }
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() }
  })
}

/** 撤销该账号全部设备会话，并让所有旧 access/refresh token 失效。 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } }
    })
  ])
}

export async function listSessions(userId: string, currentSessionId?: string) {
  const rows = await prisma.authSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastUsedAt: 'desc' }
  })
  return rows.map(row => ({
    id: row.id,
    userAgent: row.userAgent,
    ip: row.ip,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    current: row.id === currentSessionId
  }))
}
