import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { adminMiddleware } from '../middleware/admin'
import {
  getAccountEntitlementsHandler,
  getAuditHandler,
  getMissingSummaryHandler,
  getMissingWordsHandler,
  grantCreditsHandler,
  grantEntitlementsHandler,
  listPlansAdminHandler,
  patchPlanHandler,
  revokeEntitlementsHandler
} from '../controllers/admin.controller'
import { validateBody, validateParams, validateQuery } from '../validation/validate'
import {
  adminAccountQuerySchema,
  adminAuditQuerySchema,
  adminGrantCreditsBodySchema,
  adminGrantEntitlementBodySchema,
  adminMissingWordsQuerySchema,
  adminPlanPatchBodySchema,
  adminRevokeEntitlementBodySchema,
  planCodeParamsSchema
} from '../validation/schemas'

const router = Router()

router.use(authMiddleware, adminMiddleware)

router.get('/vocabulary/missing/summary', getMissingSummaryHandler)
router.get('/vocabulary/missing', validateQuery(adminMissingWordsQuerySchema), getMissingWordsHandler)
router.get('/audit', validateQuery(adminAuditQuerySchema), getAuditHandler)
router.get('/entitlements', validateQuery(adminAccountQuerySchema), getAccountEntitlementsHandler)
router.post(
  '/entitlements/grant',
  validateBody(adminGrantEntitlementBodySchema),
  grantEntitlementsHandler
)
router.post(
  '/entitlements/revoke',
  validateBody(adminRevokeEntitlementBodySchema),
  revokeEntitlementsHandler
)
router.get('/plans', listPlansAdminHandler)
router.patch(
  '/plans/:code',
  validateParams(planCodeParamsSchema),
  validateBody(adminPlanPatchBodySchema),
  patchPlanHandler
)
router.post(
  '/credits/grant',
  validateBody(adminGrantCreditsBodySchema),
  grantCreditsHandler
)

export default router
