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

const router = Router()

router.get('/asr/config', authMiddleware, getAsrConfigHandler)
router.post('/asr/session/start', authMiddleware, startAsrSessionHandler)
router.post('/asr/session/chunk', authMiddleware, pushAsrChunkHandler)
router.post('/asr/session/end', authMiddleware, endAsrSessionHandler)
router.post('/transcribe', authMiddleware, transcribeHandler)
router.post('/assess', authMiddleware, assessHandler)

export default router
