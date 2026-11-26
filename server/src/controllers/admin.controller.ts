import { Request, Response } from 'express'
import { getMissingMeaningSummary, getMissingMeaningWords } from '../services/admin.service'
import { auditAdminAction, listAdminAudit } from '../services/audit.service'
import { addCredits, getEntitlements, grantPermissions, revokePermissions } from '../entitlements/entitlement.service'
import { PERMISSIONS_CATALOG } from '../entitlements/permissions'
import prisma from '../prisma/client'
import { internalError } from '../utils/http-errors'
import { validatedParams, validatedQuery } from '../validation/validate'
import type {
  AdminAccountQuery,
  AdminAuditQuery,
  AdminGrantCreditsBody,
  AdminGrantEntitlementBody,
  AdminMissingWordsQuery,
  AdminPlanPatchBody,
  AdminRevokeEntitlementBody,
  PlanCodeParams
} from '../validation/schemas'

const PERMISSION_KEYS = new Set<string>(
  PERMISSIONS_CATALOG.map(permission => permission.key)
)

async function resolveAccount(input: { accountId?: string; username?: string }) {
  if (input.accountId) {
    return prisma.user.findUnique({
      where: { id: input.accountId },
      select: { id: true, username: true }
    })
  }
  return prisma.user.findUnique({
    where: { username: String(input.username || '') },
    select: { id: true, username: true }
  })
}

export async function getMissingSummaryHandler(req: Request, res: Response) {
  try {
    const data = await getMissingMeaningSummary()
    res.status(200).json({ success: true, data })
  } catch (error) {
    internalError(res, error)
  }
}

export async function getAuditHandler(req: Request, res: Response) {
  try {
    const { page, limit } = validatedQuery<AdminAuditQuery>(res)
    const data = await listAdminAudit(page, limit)
    res.status(200).json({ success: true, data })
  } catch (error) {
    internalError(res, error)
  }
}

export async function getMissingWordsHandler(req: Request, res: Response) {
  try {
    const { bookCode, page, limit, issueType } =
      validatedQuery<AdminMissingWordsQuery>(res)

    const data = await getMissingMeaningWords(bookCode, page, limit, issueType)
    res.status(200).json({ success: true, data })
  } catch (error) {
    const message = (error as Error).message
    if (message === 'Book not found') {
      return res.status(404).json({ success: false, error: message })
    }
    internalError(res, error)
  }
}

export async function getAccountEntitlementsHandler(req: Request, res: Response) {
  try {
    const query = validatedQuery<AdminAccountQuery>(res)
    const account = await resolveAccount(query)
    if (!account) {
      return res.status(404).json({ success: false, error: 'ACCOUNT_NOT_FOUND' })
    }
    const data = await getEntitlements(account.id)
    res.status(200).json({ success: true, data })
  } catch (error) {
    internalError(res, error)
  }
}

export async function grantEntitlementsHandler(req: Request, res: Response) {
  try {
    const body = req.body as AdminGrantEntitlementBody
    const account = await resolveAccount(body)
    if (!account) {
      return res.status(404).json({ success: false, error: 'ACCOUNT_NOT_FOUND' })
    }

    const permissionKeys = [...new Set(body.permissionKeys.map(key => key.trim()))]
    const invalid = permissionKeys.filter(key => !PERMISSION_KEYS.has(key))
    if (invalid.length) {
      return res
        .status(400)
        .json({ success: false, error: 'UNKNOWN_PERMISSION', details: invalid })
    }

    const endsAt = body.endsAt ? new Date(body.endsAt) : null
    await grantPermissions(
      account.id,
      permissionKeys.map(permissionKey => ({
        permissionKey,
        endsAt,
        limitValue: body.limitValue ?? null,
        period: body.period ?? null
      })),
      { sourceType: 'admin', sourceId: req.userId }
    )
    await auditAdminAction({
      actorId: req.userId,
      action: 'admin.entitlements.grant',
      target: account.id,
      detail: { permissionKeys, endsAt: body.endsAt || null },
      ip: req.ip
    })

    const data = await getEntitlements(account.id)
    res.status(200).json({ success: true, data })
  } catch (error) {
    internalError(res, error)
  }
}

export async function revokeEntitlementsHandler(req: Request, res: Response) {
  try {
    const body = req.body as AdminRevokeEntitlementBody
    const account = await resolveAccount(body)
    if (!account) {
      return res.status(404).json({ success: false, error: 'ACCOUNT_NOT_FOUND' })
    }

    const removed = await revokePermissions(account.id, {
      permissionKey: body.permissionKey,
      sourceType: body.sourceType,
      sourceId: body.sourceId
    })
    await auditAdminAction({
      actorId: req.userId,
      action: 'admin.entitlements.revoke',
      target: account.id,
      detail: {
        permissionKey: body.permissionKey || null,
        sourceType: body.sourceType || null,
        sourceId: body.sourceId || null,
        removed
      },
      ip: req.ip
    })

    res.status(200).json({ success: true, data: { removed } })
  } catch (error) {
    internalError(res, error)
  }
}

export async function grantCreditsHandler(req: Request, res: Response) {
  try {
    const body = req.body as AdminGrantCreditsBody
    const account = await resolveAccount(body)
    if (!account) {
      return res.status(404).json({ success: false, error: 'ACCOUNT_NOT_FOUND' })
    }

    const balance = await addCredits(
      account.id,
      body.amount,
      'admin_grant',
      req.userId,
      { reason: body.reason || null }
    )
    await auditAdminAction({
      actorId: req.userId,
      action: 'admin.credits.grant',
      target: account.id,
      detail: { amount: body.amount, reason: body.reason || null, balance },
      ip: req.ip
    })

    res.status(200).json({ success: true, data: { balance } })
  } catch (error) {
    internalError(res, error)
  }
}

export async function listPlansAdminHandler(_req: Request, res: Response) {
  try {
    const plans = await prisma.membershipPlan.findMany({
      orderBy: [{ subject: 'asc' }, { sortOrder: 'asc' }, { priceCents: 'asc' }],
      include: { permissions: { orderBy: { permissionKey: 'asc' } } }
    })
    res.status(200).json({ success: true, data: plans })
  } catch (error) {
    internalError(res, error)
  }
}

export async function patchPlanHandler(req: Request, res: Response) {
  try {
    const { code } = validatedParams<PlanCodeParams>(res)
    const body = req.body as AdminPlanPatchBody
    const existing = await prisma.membershipPlan.findUnique({ where: { code } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'PLAN_NOT_FOUND' })
    }

    const plan = await prisma.membershipPlan.update({
      where: { code },
      data: body,
      include: { permissions: { orderBy: { permissionKey: 'asc' } } }
    })
    await auditAdminAction({
      actorId: req.userId,
      action: 'admin.plan.patch',
      target: code,
      detail: body,
      ip: req.ip
    })

    res.status(200).json({ success: true, data: plan })
  } catch (error) {
    internalError(res, error)
  }
}
