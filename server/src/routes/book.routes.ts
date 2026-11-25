import express from 'express'
import { getBooksHandler, getBookDetailHandler, getRandomWordsFromBookHandler, getBookSessionHandler, getBookProgressHandler, getBookDueCountHandler } from '../controllers/book.controller'
import { authMiddleware } from '../middleware/auth'
import { validateParams, validateQuery } from '../validation/validate'
import {
  bookCodeParamsSchema,
  bookSessionQuerySchema,
  dueCountQuerySchema,
  randomCountQuerySchema
} from '../validation/schemas'

const router = express.Router()

router.get('/', getBooksHandler)
router.get('/:code/due-count', authMiddleware, validateParams(bookCodeParamsSchema), validateQuery(dueCountQuerySchema), getBookDueCountHandler)
router.get('/:code/progress', authMiddleware, validateParams(bookCodeParamsSchema), getBookProgressHandler)
router.get('/:code/session', authMiddleware, validateParams(bookCodeParamsSchema), validateQuery(bookSessionQuerySchema), getBookSessionHandler)
router.get('/:code/random', authMiddleware, validateParams(bookCodeParamsSchema), validateQuery(randomCountQuerySchema), getRandomWordsFromBookHandler)
router.get('/:code', authMiddleware, validateParams(bookCodeParamsSchema), getBookDetailHandler)

export default router
