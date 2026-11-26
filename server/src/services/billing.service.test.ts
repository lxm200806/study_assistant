import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  membershipPlan: { findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
  paymentOrder: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn()
  },
  user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  $transaction: vi.fn()
}))

const seedMock = vi.hoisted(() => ({
  seedEntitlementCatalogOnce: vi.fn()
}))

const activationMock = vi.hoisted(() => ({
  activatePlanInTx: vi.fn()
}))

vi.mock('../prisma/client', () => ({ default: prismaMock }))
vi.mock('../entitlements/seed', () => seedMock)
vi.mock('../entitlements/entitlement.service', () => activationMock)

import {
  createPaymentOrder,
  listBillingPlans,
  payPaymentOrder,
  resolvePaymentProvider
} from './billing.service'

function plan(overrides: Record<string, unknown> = {}) {
  return {
    code: 'english_core_month',
    name: '英语全科会员',
    kind: 'subscription',
    subject: 'english',
    groupKey: 'english.plan',
    days: 30,
    priceCents: 2_990,
    creditAmount: 0,
    permissions: [
      { permissionKey: 'english.books.all', limitValue: null, period: null }
    ],
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('PAYMENT_PROVIDER', 'mock')
  vi.stubEnv('ALLOW_MOCK_PAYMENT', 'false')
  seedMock.seedEntitlementCatalogOnce.mockResolvedValue(undefined)
  activationMock.activatePlanInTx.mockResolvedValue('sub-1')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('resolvePaymentProvider', () => {
  it('allows mock outside production', () => {
    expect(resolvePaymentProvider()).toBe('mock')
  })

  it('rejects mock in production unless explicitly allowed', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => resolvePaymentProvider()).toThrow('PAYMENT_PROVIDER_NOT_CONFIGURED')
  })

  it('allows mock in production when ALLOW_MOCK_PAYMENT=true', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_MOCK_PAYMENT', 'true')
    expect(resolvePaymentProvider()).toBe('mock')
  })

  it('rejects non-mock providers until a real provider is implemented', () => {
    vi.stubEnv('PAYMENT_PROVIDER', 'wechat')
    expect(() => resolvePaymentProvider()).toThrow('PAYMENT_PROVIDER_NOT_CONFIGURED')
  })
})

describe('payment orders', () => {
  it('refuses to create orders in production when mock is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    await expect(createPaymentOrder('u1', 'premium_month')).rejects.toThrow(
      'PAYMENT_PROVIDER_NOT_CONFIGURED'
    )
    expect(prismaMock.membershipPlan.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.paymentOrder.create).not.toHaveBeenCalled()
  })

  it('creates mock orders with a plan snapshot', async () => {
    prismaMock.membershipPlan.findFirst.mockResolvedValue(plan())
    prismaMock.paymentOrder.create.mockResolvedValue({ id: 'order-1' })

    const order = await createPaymentOrder('u1', 'english_core_month')

    expect(order).toEqual({ id: 'order-1' })
    expect(prismaMock.paymentOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          planCode: 'english_core_month',
          amountCents: 2_990,
          provider: 'mock',
          planSnapshot: expect.objectContaining({ code: 'english_core_month' })
        })
      })
    )
  })

  it('rejects free or zero-price plans as unpurchasable', async () => {
    prismaMock.membershipPlan.findFirst.mockResolvedValue(
      plan({ code: 'free', kind: 'free', priceCents: 0 })
    )

    await expect(createPaymentOrder('u1', 'free')).rejects.toThrow('PLAN_NOT_PURCHASABLE')
  })

  it('refuses to pay a pending order in production when mock is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    prismaMock.paymentOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'pending',
      plan: plan(),
      planSnapshot: null
    })

    await expect(payPaymentOrder('u1', 'order-1')).rejects.toThrow(
      'PAYMENT_PROVIDER_NOT_CONFIGURED'
    )
    expect(prismaMock.paymentOrder.updateMany).not.toHaveBeenCalled()
  })

  it('returns an already paid order even when mock is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    prismaMock.paymentOrder.findFirst.mockResolvedValue({ id: 'order-1', status: 'paid' })

    await expect(payPaymentOrder('u1', 'order-1')).resolves.toEqual({
      id: 'order-1',
      status: 'paid'
    })
    expect(prismaMock.paymentOrder.updateMany).not.toHaveBeenCalled()
  })

  it('pays a pending mock order and activates the plan entitlements', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    prismaMock.paymentOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'pending',
      plan: plan(),
      planSnapshot: null
    })
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(prismaMock)
    )
    prismaMock.paymentOrder.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      status: 'paid'
    })

    const result = await payPaymentOrder('u1', 'order-1')

    expect(result).toEqual({ id: 'order-1', status: 'paid' })
    expect(activationMock.activatePlanInTx).toHaveBeenCalledWith(
      prismaMock,
      'u1',
      expect.objectContaining({
        code: 'english_core_month',
        subject: 'english',
        kind: 'subscription'
      }),
      expect.objectContaining({ orderId: 'order-1', source: 'order' })
    )
  })
})

describe('billing plans', () => {
  it('seeds the catalog and lists active purchasable plans', async () => {
    prismaMock.membershipPlan.findMany.mockResolvedValue([])

    await listBillingPlans()
    await listBillingPlans()

    expect(seedMock.seedEntitlementCatalogOnce).toHaveBeenCalled()
    expect(prismaMock.membershipPlan.findMany).toHaveBeenCalledTimes(2)
  })
})
