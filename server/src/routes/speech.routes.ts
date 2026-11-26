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
import { requirePermission } from '../middleware/entitlement'
import { rateLimit } from '../middleware/rate-limit'
import { PERMISSIONS } from '../entitlements/permissions'
import { asyncHandler } from '../utils/async-handler'
import { validateBody } from '../validation/validate'
import {
  asrChunkBodySchema,
  asrEndBodySchema,
  asrStartBodySchema,
  assessBodySchema,
  transcribeBodySchema
} from '../validation/schemas'

const router = Router()

router.get('/asr/config', authMiddleware, asyncHandler(getAsrConfigHandler))
router.post(
  '/asr/session/start',
  authMiddleware,
  requirePermission(PERMISSIONS.AI_SPEECH_ASSESS),
  rateLimit({ windowMs: 60 * 1000, max: 10, keyPrefix: 'asr-start' }),
  validateBody(asrStartBodySchema),
  startAsrSessionHandler
)
router.post(
  '/asr/session/chunk',
  authMiddleware,
  rateLimit({ windowMs: 60 * 1000, max: 600, keyPrefix: 'asr-chunk' }),
  validateBody(asrChunkBodySchema),
  pushAsrChunkHandler
)
router.post(
  '/asr/session/end',
  authMiddleware,
  rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'asr-end' }),
  validateBody(asrEndBodySchema),
  endAsrSessionHandler
)
router.post(
  '/transcribe',
  authMiddleware,
  requirePermission(PERMISSIONS.AI_SPEECH_ASSESS),
  rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: 'speech-transcribe' }),
  validateBody(transcribeBodySchema),
  transcribeHandler
)
router.post(
  '/assess',
  authMiddleware,
  requirePermission(PERMISSIONS.AI_SPEECH_ASSESS),
  rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: 'speech-assess' }),
  validateBody(assessBodySchema),
  assessHandler
)

export default router
