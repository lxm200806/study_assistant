import type { Request, Response } from 'express'
import { registerPushToken, removePushToken } from '../services/push.service'

export async function registerTokenHandler(req: Request, res: Response) {
  const token = String(req.body?.token || '').trim()
  const platform = String(req.body?.platform || 'unknown')
  const provider = String(req.body?.provider || 'unknown')
  const row = await registerPushToken(req.userId!, token, platform, provider)
  res.status(201).json({ success: true, data: { id: row.id } })
}

export async function removeTokenHandler(req: Request, res: Response) {
  await removePushToken(req.userId!, String(req.body?.token || ''))
  res.json({ success: true, data: { removed: true } })
}
