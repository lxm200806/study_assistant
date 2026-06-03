import { Router } from 'express'
import { getVocabularyListHandler, getVocabularyDetailHandler, getRandomWordsHandler, getStatsHandler } from '../controllers/vocabulary.controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.get('/', getVocabularyListHandler)
router.get('/random', getRandomWordsHandler)
router.get('/stats', authMiddleware, getStatsHandler)
router.get('/:id', getVocabularyDetailHandler)

export default router