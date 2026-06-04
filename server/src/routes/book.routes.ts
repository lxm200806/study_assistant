import express from 'express'
import { getBooksHandler, getBookDetailHandler, getRandomWordsFromBookHandler, getBookSessionHandler, getBookProgressHandler, getBookDueCountHandler } from '../controllers/book.controller'
import { authMiddleware } from '../middleware/auth'

const router = express.Router()

router.get('/', getBooksHandler)
router.get('/:code/due-count', authMiddleware, getBookDueCountHandler)
router.get('/:code/progress', authMiddleware, getBookProgressHandler)
router.get('/:code/session', authMiddleware, getBookSessionHandler)
router.get('/:code/random', authMiddleware, getRandomWordsFromBookHandler)
router.get('/:code', getBookDetailHandler)

export default router
