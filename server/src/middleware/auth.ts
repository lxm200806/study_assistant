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

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const token = authHeader.split(' ')[1]
  const decoded = verifyToken(token, 'access')
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' })
  }
  
  req.userId = decoded.userId
  req.username = decoded.username

  void (async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          accountType: true,
          activeLearnerId: true,
          parentId: true,
          archivedAt: true
        }
      })
      if (!user || user.archivedAt) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      req.accountType = user.parentId ? 'student' : 'parent'
      if (req.accountType === 'parent') {
        if (user.activeLearnerId) {
          const child = await prisma.user.findFirst({
            where: { id: user.activeLearnerId, parentId: user.id, archivedAt: null },
            select: { id: true }
          })
          if (child) req.learnerId = child.id
        }
        if (!req.learnerId) {
          const first = await prisma.user.findFirst({
            where: { parentId: user.id, archivedAt: null },
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
      } else {
        req.learnerId = user.id
      }
      next()
    } catch (error) {
      next(error)
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
