import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'
import { assertAuthConfig } from '../config/env'
import prisma from '../prisma/client'
import { todayKey } from '../utils/date-key'
import { apiErrorBody } from '../utils/api-response'
import { kvIncrWindow } from '../services/kv.service'
import { log } from '../utils/logger'

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

type ActiveLearner = {
  id: string
  accountId: string
  archivedAt: Date | null
}

/** 每个账号每天最多写一次 DAU，避免鉴权请求每次都 upsert。 */
async function recordAccountActiveThrottled(userId: string): Promise<void> {
  const date = todayKey()
  const { count } = await kvIncrWindow(`dau:${userId}:${date}`, 24 * 60 * 60 * 1000)
  if (count !== 1) return
  await prisma.accountDailyActive.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: { lastSeenAt: new Date() }
  })
}

async function resolveActiveLearner(
  userId: string,
  activeLearner: ActiveLearner | null
): Promise<string | undefined> {
  if (activeLearner && activeLearner.accountId === userId && !activeLearner.archivedAt) {
    return activeLearner.id
  }

  const first = await prisma.learner.findFirst({
    where: { accountId: userId, archivedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  })
  if (!first) return undefined

  await prisma.user.update({
    where: { id: userId },
    data: { activeLearnerId: first.id }
  })
  return first.id
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
      // 常见路径：一次查询同时拿到会话、账号版本和当前学生，避免 3 次串行查询。
      if (decoded.sid) {
        const session = await prisma.authSession.findFirst({
          where: { id: decoded.sid, userId: decoded.userId, revokedAt: null },
          select: {
            id: true,
            user: {
              select: {
                id: true,
                tokenVersion: true,
                activeLearner: {
                  select: { id: true, accountId: true, archivedAt: true }
                }
              }
            }
          }
        })

        if (!session) {
          return res.status(401).json(apiErrorBody('Session revoked', 'SESSION_REVOKED'))
        }
        if (session.user.tokenVersion !== (decoded.ver ?? 0)) {
          return res.status(401).json(apiErrorBody('Session revoked', 'SESSION_REVOKED'))
        }

        req.userId = session.user.id
        req.sessionId = session.id
        req.learnerId = await resolveActiveLearner(session.user.id, session.user.activeLearner)
        void recordAccountActiveThrottled(session.user.id).catch(error =>
          log('warn', 'account_active_failed', {
            userId: session.user.id,
            error: (error as Error).message
          })
        )
        next()
        return
      }

      // 兼容没有 sid 的旧 token：不再做设备会话校验，只校验账号级 tokenVersion。
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          tokenVersion: true,
          activeLearner: {
            select: { id: true, accountId: true, archivedAt: true }
          }
        }
      })
      if (!user) {
        return res.status(401).json(apiErrorBody('Unauthorized', 'UNAUTHORIZED'))
      }
      if (user.tokenVersion !== (decoded.ver ?? 0)) {
        return res.status(401).json(apiErrorBody('Session revoked', 'SESSION_REVOKED'))
      }

      req.learnerId = await resolveActiveLearner(user.id, user.activeLearner)
      void recordAccountActiveThrottled(user.id).catch(error =>
        log('warn', 'account_active_failed', {
          userId: user.id,
          error: (error as Error).message
        })
      )
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
