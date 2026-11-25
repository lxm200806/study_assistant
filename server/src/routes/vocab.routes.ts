import { Router } from 'express'
import { getVocabularyListHandler, getVocabularyDetailHandler, getRandomWordsHandler, getStatsHandler } from '../controllers/vocabulary.controller'
import { getBookMapHandler, getGlobalMapHandler } from '../controllers/stats.controller'
import { authMiddleware } from '../middleware/auth'
import { validateQuery } from '../validation/validate'
import { bookMapQuerySchema } from '../validation/schemas'

const router = Router()

// ── Fixed routes (must come before catch-all /:id) ──
router.get('/', authMiddleware, getVocabularyListHandler)
router.get('/random', authMiddleware, getRandomWordsHandler)
router.get('/stats', authMiddleware, getStatsHandler)
router.get('/maps/book/:code', authMiddleware, validateQuery(bookMapQuerySchema), getBookMapHandler)
router.get('/maps/global', authMiddleware, getGlobalMapHandler)

// ── Catch-all: vocabulary detail by ID (must be LAST) ──
router.get('/:id', authMiddleware, getVocabularyDetailHandler)

export default router
