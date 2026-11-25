import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'
import { assertAuthConfig } from '../config/env'
import prisma from '../prisma/client'
import { todayKey } from '../utils/date-key'
import { apiErrorBody } from '../utils/api-response'

assertAuthConfig()

declare global {
  namespace Express {
    interface Request {
      userId?: string
      username?: string
      learnerId?: string
      accountType?: string
      sessionId?: string
    }
  }
}

async function recordAccountActive(userId: string) {
  const date = todayKey()
  await prisma.accountDailyActive.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: { lastSeenAt: new Date() }
  })
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(apiErrorBody('Unauthorized', 'UNAUTHORIZED'))
  }
  
  const token = authHeader.split(' ')[1]
  const decoded = verifyAccessToken(token)
  
  if (!decoded) {
    return res.status(401).json(apiErrorBody('Invalid token', 'INVALID_TOKEN'))
  }
  
  req.userId = decoded.userId
  req.username = decoded.username
  req.accountType = 'parent'

  void (async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          activeLearnerId: true,
          tokenVersion: true
        }
      })
      if (!user) {
        return res.status(401).json(apiErrorBody('Unauthorized', 'UNAUTHORIZED'))
      }
      if (user.tokenVersion !== (decoded.ver ?? 0)) {
        return res.status(401).json(apiErrorBody('Session revoked', 'SESSION_REVOKED'))
      }
      if (decoded.sid) {
        const session = await prisma.authSession.findFirst({
          where: { id: decoded.sid, userId: user.id, revokedAt: null },
          select: { id: true }
        })
        if (!session) {
          return res.status(401).json(apiErrorBody('Session revoked', 'SESSION_REVOKED'))
        }
        req.sessionId = decoded.sid
      }
      if (user.activeLearnerId) {
        const child = await prisma.learner.findFirst({
          where: { id: user.activeLearnerId, accountId: user.id, archivedAt: null },
          select: { id: true }
        })
        if (child) req.learnerId = child.id
      }
      if (!req.learnerId) {
        const first = await prisma.learner.findFirst({
          where: { accountId: user.id, archivedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true }
        })
        if (first) {
          req.learnerId = first.id
          await prisma.user.update({
            where: { id: user.id },
            data: { activeLearnerId: first.id }
          })
        }
      }
      await recordAccountActive(user.id)
      next()
    } catch {
      res.status(401).json(apiErrorBody('Unauthorized', 'UNAUTHORIZED'))
    }
  })()
}

export function studyUserId(req: Request): string {
  if (!req.learnerId) {
    const err = new Error('请先添加学生') as Error & { status: number }
    err.status = 409
    throw err
  }
  return req.learnerId
}
