import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  get: vi.fn()
}))

vi.mock('@/api/entitlements', () => ({ entitlementsAPI: apiMock }))

import { useEntitlementsStore } from './entitlements'
import { PERMISSIONS } from '@/utils/permissions'

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    accountId: 'acc-1',
    isAdmin: false,
    permissions: {
      [PERMISSIONS.ENGLISH_BOOKS_ALL]: {
        key: PERMISSIONS.ENGLISH_BOOKS_ALL,
        kind: 'access',
        unit: null,
        limitValue: null,
        period: null,
        active: true,
        expiresAt: null,
        used: 0,
        remaining: null,
        sources: ['subscription']
      },
      [PERMISSIONS.AI_CHAT_TEXT]: {
        key: PERMISSIONS.AI_CHAT_TEXT,
        kind: 'quota',
        unit: 'message',
        limitValue: 300,
        period: 'month',
        active: true,
        expiresAt: null,
        used: 10,
        remaining: 290,
        sources: ['subscription']
      }
    },
    subscriptions: [
      {
        id: 'sub-1',
        planCode: 'english_core_month',
        planName: '英语全科会员',
        subject: 'english',
        kind: 'subscription',
        endsAt: new Date(Date.now() + 86_400_000).toISOString(),
        autoRenew: false
      }
    ],
    credits: { balance: 60 },
    legacyPlan: { plan: 'premium', expiresAt: null },
    ...overrides
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('entitlements store', () => {
  it('loads permissions, subscriptions and credits', async () => {
    apiMock.get.mockResolvedValue({ success: true, data: snapshot() })
    const store = useEntitlementsStore()

    await store.load()

    expect(store.has(PERMISSIONS.ENGLISH_BOOKS_ALL)).toBe(true)
    expect(store.remaining(PERMISSIONS.AI_CHAT_TEXT)).toBe(290)
    expect(store.limit(PERMISSIONS.AI_CHAT_TEXT)).toBe(300)
    expect(store.subscriptions).toHaveLength(1)
    expect(store.credits).toBe(60)
  })

  it('does not reload unless forced', async () => {
    apiMock.get.mockResolvedValue({ success: true, data: snapshot() })
    const store = useEntitlementsStore()

    await store.load()
    await store.load()
    expect(apiMock.get).toHaveBeenCalledTimes(1)

    await store.load(true)
    expect(apiMock.get).toHaveBeenCalledTimes(2)
  })

  it('treats admins as having every permission', async () => {
    apiMock.get.mockResolvedValue({
      success: true,
      data: snapshot({ isAdmin: true, permissions: {} })
    })
    const store = useEntitlementsStore()

    await store.load()

    expect(store.has('math.ai.tutor')).toBe(true)
    expect(store.isAdmin).toBe(true)
  })

  it('keeps the previous snapshot when loading fails', async () => {
    apiMock.get.mockResolvedValueOnce({ success: true, data: snapshot() })
    const store = useEntitlementsStore()
    await store.load()

    apiMock.get.mockRejectedValueOnce(new Error('network'))
    await store.load(true)

    expect(store.has(PERMISSIONS.ENGLISH_BOOKS_ALL)).toBe(true)
  })

  it('resets on logout', async () => {
    apiMock.get.mockResolvedValue({ success: true, data: snapshot() })
    const store = useEntitlementsStore()
    await store.load()

    store.reset()

    expect(store.snapshot).toBeNull()
    expect(store.has(PERMISSIONS.ENGLISH_BOOKS_ALL)).toBe(false)
  })
})
