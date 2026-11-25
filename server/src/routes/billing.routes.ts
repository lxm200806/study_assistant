import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { validateBody } from '../validation/validate'
import { createPaymentOrderBodySchema, payOrderBodySchema } from '../validation/schemas'
import {
  createOrderHandler,
  listOrdersHandler,
  listPlansHandler,
  payOrderHandler
} from '../controllers/billing.controller'

const router = Router()

router.get('/plans', listPlansHandler)
router.use(authMiddleware)
router.get('/orders', listOrdersHandler)
router.post('/orders', validateBody(createPaymentOrderBodySchema), createOrderHandler)
router.post('/orders/:id/pay', validateBody(payOrderBodySchema), payOrderHandler)

export default router
