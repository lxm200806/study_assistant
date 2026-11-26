import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  learner: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  book: { findUnique: vi.fn(), findMany: vi.fn() },
  userBookUnlock: { findUnique: vi.fn(), findMany: vi.fn() }
}))

const entitlementMock = vi.hoisted(() => ({
  hasPermission: vi.fn()
}))

vi.mock('../prisma/client', () => ({ default: prismaMock }))
vi.mock('../entitlements/entitlement.service', () => entitlementMock)

import { canAccessBook, getBookAccessScope } from './book-access.service'

type AccountOverrides = {
  id: string
  isAdmin: boolean
}

function account(overrides: Partial<AccountOverrides> = {}) {
  return {
    id: 'acc-1',
    isAdmin: false,
    ...overrides
  }
}

describe('book access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.learner.findUnique.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue(account())
    prismaMock.book.findUnique.mockResolvedValue(null)
    prismaMock.book.findMany.mockResolvedValue([])
    prismaMock.userBookUnlock.findUnique.mockResolvedValue(null)
    prismaMock.userBookUnlock.findMany.mockResolvedValue([])
    entitlementMock.hasPermission.mockResolvedValue(false)
  })

  it('grants full scope to admins without checking entitlements', async () => {
    prismaMock.user.findUnique.mockResolvedValue(account({ isAdmin: true }))

    const scope = await getBookAccessScope('acc-1')

    expect(scope.all).toBe(true)
    expect(prismaMock.book.findMany).not.toHaveBeenCalled()
    expect(entitlementMock.hasPermission).not.toHaveBeenCalled()
  })

  it('grants full scope when the account has english.books.all', async () => {
    entitlementMock.hasPermission.mockResolvedValue(true)

    const scope = await getBookAccessScope('acc-1')

    expect(scope.all).toBe(true)
    expect(entitlementMock.hasPermission).toHaveBeenCalledWith('acc-1', 'english.books.all')
  })

  it('limits an account without english.books.all to free and unlocked books', async () => {
    prismaMock.book.findMany.mockResolvedValue([
      { id: 'b1', code: 'free-book', isFree: true },
      { id: 'b2', code: 'paid-book', isFree: false },
      { id: 'b3', code: 'unlocked-book', isFree: false }
    ])
    prismaMock.userBookUnlock.findMany.mockResolvedValue([{ bookId: 'b3' }])

    const scope = await getBookAccessScope('acc-1')

    expect(scope.all).toBe(false)
    expect([...scope.codes].sort()).toEqual(['free-book', 'unlocked-book'])
  })

  it('resolves a learner id to its owning account', async () => {
    prismaMock.learner.findUnique.mockResolvedValue({
      account: account({ isAdmin: true })
    })

    const scope = await getBookAccessScope('learner-1')

    expect(scope.all).toBe(true)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns an empty scope for unknown ids', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const scope = await getBookAccessScope('missing')

    expect(scope.all).toBe(false)
    expect(scope.codes.size).toBe(0)
  })

  it('allows free books without checking unlocks', async () => {
    prismaMock.book.findUnique.mockResolvedValue({ id: 'b1', isFree: true })

    await expect(canAccessBook('acc-1', 'free-book')).resolves.toBe(true)
    expect(prismaMock.userBookUnlock.findUnique).not.toHaveBeenCalled()
  })

  it('rejects paid books that are not unlocked', async () => {
    prismaMock.book.findUnique.mockResolvedValue({ id: 'b2', isFree: false })

    await expect(canAccessBook('acc-1', 'paid-book')).resolves.toBe(false)
  })

  it('allows paid books that were unlocked', async () => {
    prismaMock.book.findUnique.mockResolvedValue({ id: 'b2', isFree: false })
    prismaMock.userBookUnlock.findUnique.mockResolvedValue({ id: 'unlock-1' })

    await expect(canAccessBook('acc-1', 'paid-book')).resolves.toBe(true)
  })

  it('lets admins access any book without a book lookup', async () => {
    prismaMock.user.findUnique.mockResolvedValue(account({ isAdmin: true }))

    await expect(canAccessBook('acc-1', 'anything')).resolves.toBe(true)
    expect(prismaMock.book.findUnique).not.toHaveBeenCalled()
  })
})
