import { Router } from 'express'
import { getTtsHandler } from '../controllers/tts.controller'

const router = Router()

router.get('/', getTtsHandler)

export default router
