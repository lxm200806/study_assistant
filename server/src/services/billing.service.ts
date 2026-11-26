import { Prisma } from '@prisma/client'
import prisma from '../prisma/client'
import { isProduction } from '../config/env'
import { seedEntitlementCatalogOnce } from '../entitlements/seed'
import { activatePlanInTx, type PlanActivation } from '../entitlements/entitlement.service'

type PlanWithPermissions = Prisma.MembershipPlanGetPayload<{
  include: { permissions: true }
}>

export async function ensureBillingPlans(): Promise<void> {
  await seedEntitlementCatalogOnce()
}

export function ensureBillingPlansOnce(): Promise<void> {
  return seedEntitlementCatalogOnce()
}

export async function listBillingPlans() {
  await ensureBillingPlansOnce()
  return prisma.membershipPlan.findMany({
    where: { active: true, kind: { not: 'free' } },
    orderBy: [{ subject: 'asc' }, { sortOrder: 'asc' }, { priceCents: 'asc' }],
    include: { permissions: { orderBy: { permissionKey: 'asc' } } }
  })
}

/**
 * 当前只有 mock 渠道可用。生产环境默认禁用 mock，避免用户不付款直接开通会员；
 * 如确需在生产做演示，必须显式设置 ALLOW_MOCK_PAYMENT=true。
 */
export function resolvePaymentProvider(): string {
  const provider = (process.env.PAYMENT_PROVIDER || 'mock').trim().toLowerCase()
  if (provider !== 'mock') {
    // 真实微信/支付宝/IAP 渠道尚未实现，接入前一律视为未配置
    throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED')
  }
  const allowMockInProduction = (process.env.ALLOW_MOCK_PAYMENT || '').trim().toLowerCase() === 'true'
  if (isProduction() && !allowMockInProduction) {
    throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED')
  }
  return provider
}

export async function createPaymentOrder(userId: string, planCode: string) {
  const provider = resolvePaymentProvider()
  const plan = await prisma.membershipPlan.findFirst({
    where: { code: planCode, active: true },
    include: { permissions: true }
  })
  if (!plan) throw new Error('PLAN_NOT_FOUND')
  if (plan.kind === 'free' || plan.priceCents <= 0) {
    throw new Error('PLAN_NOT_PURCHASABLE')
  }

  return prisma.paymentOrder.create({
    data: {
      userId,
      planCode: plan.code,
      amountCents: plan.priceCents,
      provider,
      planSnapshot: planToActivation(plan) as unknown as Prisma.InputJsonValue
    }
  })
}

export async function payPaymentOrder(userId: string, orderId: string) {
  const order = await prisma.paymentOrder.findFirst({
    where: { id: orderId, userId },
    include: { plan: { include: { permissions: true } } }
  })
  if (!order) throw new Error('ORDER_NOT_FOUND')
  // 已支付订单保持幂等，不再依赖当前支付渠道配置
  if (order.status === 'paid') return order

  const provider = resolvePaymentProvider()
  const now = new Date()
  const activation = activationForOrder(order)

  return prisma.$transaction(async tx => {
    const updated = await tx.paymentOrder.updateMany({
      where: { id: orderId, userId, status: 'pending' },
      data: {
        status: 'paid',
        paidAt: now,
        provider,
        providerOrderId: `${provider}_${orderId}`
      }
    })
    if (updated.count === 0) {
      return tx.paymentOrder.findUniqueOrThrow({ where: { id: orderId } })
    }

    await activatePlanInTx(tx, userId, activation, {
      source: 'order',
      orderId,
      now
    })
    return tx.paymentOrder.findUniqueOrThrow({ where: { id: orderId } })
  })
}

export async function listPaymentOrders(userId: string) {
  return prisma.paymentOrder.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50
  })
}

function planToActivation(plan: PlanWithPermissions): PlanActivation {
  return {
    code: plan.code,
    name: plan.name,
    kind: plan.kind,
    subject: plan.subject,
    groupKey: plan.groupKey,
    days: plan.days,
    priceCents: plan.priceCents,
    creditAmount: plan.creditAmount,
    permissions: plan.permissions.map(permission => ({
      permissionKey: permission.permissionKey,
      limitValue: permission.limitValue,
      period: permission.period
    }))
  }
}

function activationForOrder(
  order: Prisma.PaymentOrderGetPayload<{
    include: { plan: { include: { permissions: true } } }
  }>
): PlanActivation {
  const fallback = planToActivation(order.plan)
  const snapshot = order.planSnapshot as unknown
  if (!snapshot || typeof snapshot !== 'object') return fallback

  const data = snapshot as Record<string, unknown>
  if (typeof data.code !== 'string' || !Array.isArray(data.permissions)) return fallback

  const permissions = data.permissions
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(item => ({
      permissionKey: String(item.permissionKey || ''),
      limitValue: typeof item.limitValue === 'number' ? item.limitValue : null,
      period: typeof item.period === 'string' ? item.period : null
    }))
    .filter(item => item.permissionKey)

  if (!permissions.length) return fallback

  return {
    code: String(data.code),
    name: typeof data.name === 'string' ? data.name : fallback.name,
    kind: typeof data.kind === 'string' ? data.kind : fallback.kind,
    subject: typeof data.subject === 'string' ? data.subject : fallback.subject,
    groupKey: typeof data.groupKey === 'string' ? data.groupKey : null,
    days: typeof data.days === 'number' ? data.days : fallback.days,
    priceCents: typeof data.priceCents === 'number' ? data.priceCents : fallback.priceCents,
    creditAmount:
      typeof data.creditAmount === 'number' ? data.creditAmount : fallback.creditAmount,
    permissions
  }
}
