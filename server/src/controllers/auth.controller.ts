import { Request, Response } from 'express'
import { register, login, refreshToken, getProfile } from '../services/auth.service'

export async function registerHandler(req: Request, res: Response) {
  try {
    const { username, password } = req.body
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }
    
    const result = await register({ username, password })
    res.status(201).json(result)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function loginHandler(req: Request, res: Response) {
  try {
    const { username, password } = req.body
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }
    
    const result = await login({ username, password })
    res.status(200).json(result)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function refreshHandler(req: Request, res: Response) {
  try {
    const { refreshToken: token } = req.body
    
    if (!token) {
      return res.status(400).json({ error: 'Refresh token is required' })
    }
    
    const result = await refreshToken(token)
    res.status(200).json(result)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function profileHandler(req: Request, res: Response) {
  try {
    const user = await getProfile(req.userId!)
    res.status(200).json({ success: true, data: user })
  } catch (error) {
    res.status(404).json({ error: (error as Error).message })
  }
}