import prisma from '../prisma/client'
import { isProduction } from '../config/env'

const DEFAULT_PLANS = [
  { code: 'premium_month', name: 'Premium 月卡', days: 30, priceCents: 2_990 },
  { code: 'premium_year', name: 'Premium 年卡', days: 365, priceCents: 19_900 }
]

export async function ensureBillingPlans(): Promise<void> {
  for (const plan of DEFAULT_PLANS) {
    await prisma.membershipPlan.upsert({
      where: { code: plan.code },
      create: plan,
      update: { name: plan.name, days: plan.days, priceCents: plan.priceCents }
    })
  }
}

export async function listBillingPlans() {
  await ensureBillingPlans()
  return prisma.membershipPlan.findMany({
    where: { active: true },
    orderBy: { priceCents: 'asc' }
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
    where: { code: planCode, active: true }
  })
  if (!plan) throw new Error('PLAN_NOT_FOUND')
  return prisma.paymentOrder.create({
    data: {
      userId,
      planCode: plan.code,
      amountCents: plan.priceCents,
      provider
    }
  })
}

export async function payPaymentOrder(userId: string, orderId: string) {
  const order = await prisma.paymentOrder.findFirst({
    where: { id: orderId, userId },
    include: { plan: true }
  })
  if (!order) throw new Error('ORDER_NOT_FOUND')
  // 已支付订单保持幂等，不再依赖当前支付渠道配置
  if (order.status === 'paid') return order

  const provider = resolvePaymentProvider()
  const now = new Date()
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

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
    const base = user.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now
    const planExpiresAt = new Date(base.getTime() + order.plan.days * 86_400_000)
    await tx.user.update({
      where: { id: userId },
      data: { plan: 'premium', planExpiresAt }
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
