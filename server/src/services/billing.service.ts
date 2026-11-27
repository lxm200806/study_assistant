import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import prisma from '../prisma/client'
import { isProduction } from '../config/env'
import { seedEntitlementCatalogOnce } from '../entitlements/seed'
import { activatePlanInTx, type PlanActivation } from '../entitlements/entitlement.service'
import {
  getWechatPayClient,
  isWechatPayConfigured,
  type WechatPayChannel,
  type WechatPaymentResult
} from './wechat-pay.service'

type PlanWithPermissions = Prisma.MembershipPlanGetPayload<{
  include: { permissions: true }
}>

type OrderWithPlan = Prisma.PaymentOrderGetPayload<{
  include: { plan: { include: { permissions: true } } }
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
 * 支持 mock（本地/演示）与 wechat（网页版微信支付）。
 * 生产环境默认禁用 mock；微信支付必须配置完整商户参数。
 */
export function resolvePaymentProvider(): string {
  const provider = (process.env.PAYMENT_PROVIDER || 'mock').trim().toLowerCase()
  if (provider === 'wechat') {
    if (!isWechatPayConfigured()) {
      throw new Error('WECHAT_PAY_NOT_CONFIGURED')
    }
    return provider
  }
  if (provider !== 'mock') {
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
      // 微信 out_trade_no 最多 32 位；UUID 去掉连字符刚好 32 位
      outTradeNo: provider === 'wechat' ? randomUUID().replace(/-/g, '') : null,
      planSnapshot: planToActivation(plan) as unknown as Prisma.InputJsonValue
    }
  })
}

/**
 * 网页版微信支付：创建 Native（PC 扫码）或 H5（手机跳转）预支付单。
 */
export async function createWechatPayment(
  userId: string,
  orderId: string,
  channel: WechatPayChannel,
  clientIp?: string
): Promise<WechatPaymentResult> {
  if (resolvePaymentProvider() !== 'wechat') {
    throw new Error('WECHAT_PAY_NOT_ENABLED')
  }
  const order = await findOrderWithPlan(orderId, userId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (order.status === 'paid') throw new Error('ORDER_ALREADY_PAID')
  if (order.provider !== 'wechat') throw new Error('ORDER_NOT_WECHAT_PAY')

  const outTradeNo = order.outTradeNo || order.id.replace(/-/g, '')
  const client = getWechatPayClient()
  const result = await client.createPayment({
    outTradeNo,
    amountCents: order.amountCents,
    channel,
    clientIp,
    description: `学习助手-${order.plan.name}`.slice(0, 100)
  })

  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: {
      outTradeNo,
      channel: result.channel,
      payAppId: result.appid,
      prepayId: result.prepayId || null
    }
  })

  return result
}

/**
 * 查询订单。微信 pending 订单会同步查询微信支付状态，成功后落库并授权。
 */
export async function getPaymentOrder(userId: string, orderId: string): Promise<OrderWithPlan> {
  let order = await findOrderWithPlan(orderId, userId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (order.status !== 'pending') return order
  if (order.provider !== 'wechat' || !order.channel) return order

  try {
    const client = getWechatPayClient()
    const outTradeNo = order.outTradeNo || order.id.replace(/-/g, '')
    const result = await client.queryOrder(outTradeNo)
    if (result.tradeState === 'SUCCESS') {
      if (!result.mchid || result.mchid !== client.mchid) {
        throw new Error('WECHAT_PAY_MCHID_MISMATCH')
      }
      if (!result.appid || result.appid !== client.appid) {
        throw new Error('WECHAT_PAY_APPID_MISMATCH')
      }
      if (result.outTradeNo && result.outTradeNo !== outTradeNo) {
        throw new Error('WECHAT_PAY_OUT_TRADE_NO_MISMATCH')
      }
      if (result.amountCents == null || result.amountCents !== order.amountCents) {
        throw new Error('WECHAT_PAY_AMOUNT_MISMATCH')
      }
      const paidAt = result.successTime ? new Date(result.successTime) : new Date()
      order = await fulfillPaymentOrder(order.id, {
        provider: 'wechat',
        providerOrderId: result.transactionId || order.id,
        amountCents: result.amountCents,
        paidAt,
        userId
      })
    }
  } catch (error) {
    console.error('[billing] wechat order query failed:', (error as Error).message)
  }

  return order
}

/**
 * 微信支付回调：验签、解密、校验金额/商户号/appid，然后幂等授权。
 */
export async function handleWechatNotification(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string
): Promise<{ handled: boolean; orderId?: string }> {
  const client = getWechatPayClient()
  const notification = client.verifyNotification(headers, rawBody)
  if (notification.eventType !== 'TRANSACTION.SUCCESS') {
    return { handled: false }
  }

  const resource = notification.resource
  if (resource.tradeState && resource.tradeState !== 'SUCCESS') {
    return { handled: false }
  }
  if (!resource.mchid || resource.mchid !== client.mchid) {
    throw new Error('WECHAT_PAY_MCHID_MISMATCH')
  }
  if (!resource.appid || resource.appid !== client.appid) {
    throw new Error('WECHAT_PAY_APPID_MISMATCH')
  }

  const outTradeNo = String(resource.outTradeNo || '')
  if (!outTradeNo) throw new Error('WECHAT_PAY_OUT_TRADE_NO_MISSING')
  const order = await prisma.paymentOrder.findFirst({
    where: {
      OR: [{ outTradeNo }, { id: outTradeNo }]
    },
    include: { plan: { include: { permissions: true } } }
  })
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (order.provider !== 'wechat') throw new Error('ORDER_NOT_WECHAT_PAY')
  if (!Number.isFinite(resource.amountCents) || resource.amountCents !== order.amountCents) {
    throw new Error('WECHAT_PAY_AMOUNT_MISMATCH')
  }

  const paidAt = resource.successTime ? new Date(resource.successTime) : new Date()
  await fulfillPaymentOrder(order.id, {
    provider: 'wechat',
    providerOrderId: String(resource.transactionId || notification.id || order.id),
    amountCents: resource.amountCents,
    paidAt
  })

  return { handled: true, orderId: order.id }
}

/**
 * 幂等地把订单置为 paid 并激活套餐授权。
 * 可被 mock 支付、微信回调、微信订单查询共用。
 */
export async function fulfillPaymentOrder(
  orderId: string,
  options: {
    provider: string
    providerOrderId: string
    userId?: string
    amountCents?: number
    paidAt?: Date
  }
): Promise<OrderWithPlan> {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
    include: { plan: { include: { permissions: true } } }
  })
  if (!order || (options.userId && order.userId !== options.userId)) {
    throw new Error('ORDER_NOT_FOUND')
  }
  if (order.status === 'paid') return order
  if (options.amountCents != null && options.amountCents !== order.amountCents) {
    throw new Error('PAYMENT_AMOUNT_MISMATCH')
  }

  const now = options.paidAt || new Date()
  return prisma.$transaction(async tx => {
    const updated = await tx.paymentOrder.updateMany({
      where: { id: orderId, status: 'pending' },
      data: {
        status: 'paid',
        paidAt: now,
        provider: options.provider,
        providerOrderId: options.providerOrderId
      }
    })
    if (updated.count === 0) {
      return tx.paymentOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: { plan: { include: { permissions: true } } }
      })
    }

    await activatePlanInTx(tx, order.userId, activationForOrder(order), {
      source: 'order',
      orderId,
      now
    })
    return tx.paymentOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { plan: { include: { permissions: true } } }
    })
  })
}

/**
 * 仅用于 mock 渠道：生产/微信支付下会拒绝，必须走微信回调或状态查询。
 */
export async function payPaymentOrder(userId: string, orderId: string) {
  const existing = await findOrderWithPlan(orderId, userId)
  if (!existing) throw new Error('ORDER_NOT_FOUND')
  // 已支付订单保持幂等，即使当前渠道已经切换
  if (existing.status === 'paid') return existing
  if (resolvePaymentProvider() !== 'mock') {
    throw new Error('MOCK_PAYMENT_DISABLED')
  }
  return fulfillPaymentOrder(orderId, {
    provider: 'mock',
    providerOrderId: `mock_${orderId}`,
    userId
  })
}

export async function listPaymentOrders(userId: string) {
  return prisma.paymentOrder.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50
  })
}

async function findOrderWithPlan(orderId: string, userId: string): Promise<OrderWithPlan | null> {
  return prisma.paymentOrder.findFirst({
    where: { id: orderId, userId },
    include: { plan: { include: { permissions: true } } }
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

function activationForOrder(order: OrderWithPlan): PlanActivation {
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
