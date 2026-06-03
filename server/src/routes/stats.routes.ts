import express from 'express'
import { getBookMapHandler, getGlobalMapHandler } from '../controllers/stats.controller'
import { authMiddleware } from '../middleware/auth'

const router = express.Router()

router.get('/book/:code/map', authMiddleware, getBookMapHandler)
router.get('/global/map', authMiddleware, getGlobalMapHandler)

export default router
