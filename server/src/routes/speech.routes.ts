import { Router } from 'express'
import {
  transcribeHandler,
  assessHandler,
  getAsrConfigHandler,
  startAsrSessionHandler,
  pushAsrChunkHandler,
  endAsrSessionHandler
} from '../controllers/speech.controller'
import { authMiddleware } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'

const router = Router()

router.get('/asr/config', authMiddleware, getAsrConfigHandler)
router.post(
  '/asr/session/start',
  authMiddleware,
  rateLimit({ windowMs: 60 * 1000, max: 10, keyPrefix: 'asr-start' }),
  startAsrSessionHandler
)
router.post(
  '/asr/session/chunk',
  authMiddleware,
  rateLimit({ windowMs: 60 * 1000, max: 600, keyPrefix: 'asr-chunk' }),
  pushAsrChunkHandler
)
router.post(
  '/asr/session/end',
  authMiddleware,
  rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'asr-end' }),
  endAsrSessionHandler
)
router.post(
  '/transcribe',
  authMiddleware,
  rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: 'speech-transcribe' }),
  transcribeHandler
)
router.post(
  '/assess',
  authMiddleware,
  rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: 'speech-assess' }),
  assessHandler
)

export default router
