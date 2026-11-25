import { Router } from 'express'
import { getTtsHandler } from '../controllers/tts.controller'
import { rateLimit } from '../middleware/rate-limit'
import { ttsAuth } from '../middleware/tts-auth'
import { validateQuery } from '../validation/validate'
import { ttsQuerySchema } from '../validation/schemas'

const router = Router()

router.get(
  '/',
  ttsAuth,
  rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'tts-minute' }),
  rateLimit({ windowMs: 60 * 60 * 1000, max: 600, keyPrefix: 'tts-hour' }),
  validateQuery(ttsQuerySchema),
  getTtsHandler
)

export default router
