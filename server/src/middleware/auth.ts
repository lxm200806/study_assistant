import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      username?: string
    }
  }
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
  next()
}