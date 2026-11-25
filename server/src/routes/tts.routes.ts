import { Router } from 'express'
import { getTtsHandler } from '../controllers/tts.controller'
import { rateLimit } from '../middleware/rate-limit'

const router = Router()

router.get(
  '/',
  rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'tts-minute' }),
  rateLimit({ windowMs: 60 * 60 * 1000, max: 600, keyPrefix: 'tts-hour' }),
  getTtsHandler
)

export default router
