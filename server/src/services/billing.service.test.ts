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

vi.mock('../prisma/client', () => ({ default: prismaMock }))

import {
  createPaymentOrder,
  payPaymentOrder,
  resolvePaymentProvider
} from './billing.service'

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('PAYMENT_PROVIDER', 'mock')
  vi.stubEnv('ALLOW_MOCK_PAYMENT', 'false')
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

  it('creates mock orders with the resolved provider', async () => {
    prismaMock.membershipPlan.findFirst.mockResolvedValue({
      code: 'premium_month',
      priceCents: 2_990
    })
    prismaMock.paymentOrder.create.mockResolvedValue({ id: 'order-1' })

    const order = await createPaymentOrder('u1', 'premium_month')

    expect(order).toEqual({ id: 'order-1' })
    expect(prismaMock.paymentOrder.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        planCode: 'premium_month',
        amountCents: 2_990,
        provider: 'mock'
      }
    })
  })

  it('refuses to pay a pending order in production when mock is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    prismaMock.paymentOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'pending',
      plan: { days: 30 }
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

  it('pays a pending mock order and extends membership', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    prismaMock.paymentOrder.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'pending',
      plan: { days: 30 }
    })
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(prismaMock)
    )
    prismaMock.paymentOrder.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', planExpiresAt: null })
    prismaMock.user.update.mockResolvedValue({})
    prismaMock.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      status: 'paid'
    })

    const result = await payPaymentOrder('u1', 'order-1')

    expect(result).toEqual({ id: 'order-1', status: 'paid' })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        plan: 'premium',
        planExpiresAt: new Date(now.getTime() + 30 * 86_400_000)
      }
    })
  })
})
