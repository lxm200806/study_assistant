import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { validateBody } from '../validation/validate'
import { asyncHandler } from '../utils/async-handler'
import { createPaymentOrderBodySchema, payOrderBodySchema } from '../validation/schemas'
import {
  createOrderHandler,
  listOrdersHandler,
  listPlansHandler,
  payOrderHandler
} from '../controllers/billing.controller'

const router = Router()

router.get('/plans', asyncHandler(listPlansHandler))
router.use(authMiddleware)
router.get('/orders', asyncHandler(listOrdersHandler))
router.post('/orders', validateBody(createPaymentOrderBodySchema), asyncHandler(createOrderHandler))
router.post('/orders/:id/pay', validateBody(payOrderBodySchema), asyncHandler(payOrderHandler))

export default router
