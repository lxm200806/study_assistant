import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'
import prisma from '../prisma/client'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      username?: string
      learnerId?: string
      accountType?: string
    }
  }
}

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
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
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const token = authHeader.split(' ')[1]
  const decoded = verifyToken(token)
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' })
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
          activeLearnerId: true
        }
      })
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' })
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
      res.status(401).json({ error: 'Unauthorized' })
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
