import { Request, Response, NextFunction } from 'express'
import prisma from '../prisma/client'

declare global {
  namespace Express {
    interface Request {
      isAdmin?: boolean
    }
  }
}

export async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { isAdmin: true }
  })

  if (!user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  req.isAdmin = true
  next()
}
