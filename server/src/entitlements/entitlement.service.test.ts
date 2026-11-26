import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  membershipPlan: { findUnique: vi.fn() },
  entitlementGrant: { findMany: vi.fn(), findFirst: vi.fn() },
  subscription: { findMany: vi.fn() },
  creditWallet: { findUnique: vi.fn() },
  usageCounter: { findMany: vi.fn() }
}))

vi.mock('../prisma/client', () => ({ default: prismaMock }))

import {
  clearEntitlementCaches,
  getEntitlements,
  hasPermission,
  periodKeyFor
} from './entitlement.service'
import { PERMISSIONS, PERMISSIONS_CATALOG } from './permissions'

function freePlan() {
  return {
    code: 'free',
    permissions: [
      {
        permissionKey: PERMISSIONS.ENGLISH_RECOGNITION,
        limitValue: null,
        period: null,
        permission: {
          key: PERMISSIONS.ENGLISH_RECOGNITION,
          kind: 'access',
          unit: null,
          active: true
        }
      },
      {
        permissionKey: PERMISSIONS.AI_CHAT_TEXT,
        limitValue: 5,
        period: 'day',
        permission: {
          key: PERMISSIONS.AI_CHAT_TEXT,
          kind: 'quota',
          unit: 'message',
          active: true
        }
      }
    ]
  }
}

function freeUser(overrides: Record<string, unknown> = {}) {
  return { isAdmin: false, plan: 'free', planExpiresAt: null, ...overrides }
}

function paidGrant(overrides: Record<string, unknown> = {}) {
  return {
    permissionKey: PERMISSIONS.ENGLISH_BOOKS_ALL,
    sourceType: 'subscription',
    endsAt: new Date(Date.now() + 86_400_000),
    limitValue: null,
    period: null,
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  clearEntitlementCaches()
  prismaMock.membershipPlan.findUnique.mockResolvedValue(freePlan())
  prismaMock.user.findUnique.mockResolvedValue(freeUser())
  prismaMock.entitlementGrant.findMany.mockResolvedValue([])
  prismaMock.entitlementGrant.findFirst.mockResolvedValue(null)
  prismaMock.subscription.findMany.mockResolvedValue([])
  prismaMock.creditWallet.findUnique.mockResolvedValue(null)
  prismaMock.usageCounter.findMany.mockResolvedValue([])
})

describe('entitlement resolution', () => {
  it('applies the free plan baseline and usage counters', async () => {
    const today = periodKeyFor('day')
    prismaMock.usageCounter.findMany.mockResolvedValue([
      { permissionKey: PERMISSIONS.AI_CHAT_TEXT, periodKey: today, used: 2 }
    ])

    const snapshot = await getEntitlements('acc-1')

    expect(snapshot.permissions[PERMISSIONS.ENGLISH_RECOGNITION]?.active).toBe(true)
    expect(snapshot.permissions[PERMISSIONS.AI_CHAT_TEXT]).toMatchObject({
      active: true,
      limitValue: 5,
      used: 2,
      remaining: 3,
      sources: ['free']
    })
    expect(snapshot.credits.balance).toBe(0)
  })

  it('lets paid grants add permissions and override free limits', async () => {
    const month = periodKeyFor('month')
    prismaMock.entitlementGrant.findMany.mockResolvedValue([
      paidGrant(),
      paidGrant({
        permissionKey: PERMISSIONS.AI_CHAT_TEXT,
        sourceType: 'subscription',
        limitValue: 300,
        period: 'month'
      })
    ])
    prismaMock.usageCounter.findMany.mockResolvedValue([
      { permissionKey: PERMISSIONS.AI_CHAT_TEXT, periodKey: month, used: 10 }
    ])

    const snapshot = await getEntitlements('acc-1')

    expect(snapshot.permissions[PERMISSIONS.ENGLISH_BOOKS_ALL]?.active).toBe(true)
    expect(snapshot.permissions[PERMISSIONS.AI_CHAT_TEXT]).toMatchObject({
      limitValue: 300,
      period: 'month',
      used: 10,
      remaining: 290,
      sources: ['subscription']
    })
  })

  it('treats admins as having every permission', async () => {
    prismaMock.user.findUnique.mockResolvedValue(freeUser({ isAdmin: true }))

    const snapshot = await getEntitlements('admin-1')

    expect(snapshot.isAdmin).toBe(true)
    expect(Object.keys(snapshot.permissions)).toHaveLength(PERMISSIONS_CATALOG.length)
    expect(snapshot.permissions[PERMISSIONS.ENGLISH_GAMES]?.sources).toEqual(['admin'])
  })

  it('does not include expired grants returned by a stale query', async () => {
    prismaMock.entitlementGrant.findMany.mockResolvedValue([
      paidGrant({ endsAt: new Date(Date.now() - 1_000) })
    ])

    const snapshot = await getEntitlements('acc-1')

    expect(snapshot.permissions[PERMISSIONS.ENGLISH_BOOKS_ALL]).toBeUndefined()
  })
})

describe('hasPermission', () => {
  it('accepts free plan permissions', async () => {
    await expect(hasPermission('acc-1', PERMISSIONS.ENGLISH_RECOGNITION)).resolves.toBe(true)
    await expect(hasPermission('acc-1', PERMISSIONS.ENGLISH_BOOKS_ALL)).resolves.toBe(false)
  })

  it('accepts explicit grants', async () => {
    prismaMock.entitlementGrant.findFirst.mockResolvedValue({ id: 'grant-1' })

    await expect(hasPermission('acc-1', PERMISSIONS.ENGLISH_BOOKS_ALL)).resolves.toBe(true)
  })

  it('accepts every permission for admins', async () => {
    prismaMock.user.findUnique.mockResolvedValue(freeUser({ isAdmin: true }))

    await expect(hasPermission('acc-1', PERMISSIONS.MATH_AI_TUTOR)).resolves.toBe(true)
    expect(prismaMock.entitlementGrant.findFirst).not.toHaveBeenCalled()
  })
})

describe('periodKeyFor', () => {
  it('builds day/month/total keys', () => {
    const now = new Date(2026, 10, 26, 12, 0, 0)

    expect(periodKeyFor('day', now)).toBe('2026-11-26')
    expect(periodKeyFor('month', now)).toBe('2026-11')
    expect(periodKeyFor('total', now)).toBe('total')
  })
})
