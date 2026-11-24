import prisma from '../prisma/client'

type BillingAccount = {
  id: string
  isAdmin: boolean
  plan: string
  planExpiresAt: Date | null
}

async function resolveBillingAccount(userId: string): Promise<BillingAccount | null> {
  const learner = await prisma.learner.findUnique({
    where: { id: userId },
    include: { account: true }
  })
  if (learner) return learner.account
  return prisma.user.findUnique({ where: { id: userId } })
}

function hasFullBookAccess(user: BillingAccount): boolean {
  if (user.isAdmin) return true
  return user.plan === 'premium' && (!user.planExpiresAt || user.planExpiresAt > new Date())
}

export async function canAccessBook(userId: string, bookCode: string): Promise<boolean> {
  const user = await resolveBillingAccount(userId)
  if (!user) return false
  if (hasFullBookAccess(user)) return true

  const book = await prisma.book.findUnique({ where: { code: bookCode } })
  if (!book) return false
  if (book.isFree) return true

  const unlock = await prisma.userBookUnlock.findUnique({
    where: { userId_bookId: { userId: user.id, bookId: book.id } }
  })
  return !!unlock
}

export interface BookAccessScope {
  /** true means the account can access every book (admin / active premium) */
  all: boolean
  /** book codes accessible to a free or partially unlocked account */
  codes: Set<string>
}

export async function getBookAccessScope(userId: string): Promise<BookAccessScope> {
  const user = await resolveBillingAccount(userId)
  if (!user) return { all: false, codes: new Set() }
  if (hasFullBookAccess(user)) return { all: true, codes: new Set() }

  const [books, unlocks] = await Promise.all([
    prisma.book.findMany({ select: { id: true, code: true, isFree: true } }),
    prisma.userBookUnlock.findMany({
      where: { userId: user.id },
      select: { bookId: true }
    })
  ])
  const unlockedIds = new Set(unlocks.map(row => row.bookId))

  return {
    all: false,
    codes: new Set(
      books.filter(book => book.isFree || unlockedIds.has(book.id)).map(book => book.code)
    )
  }
}

export async function assertBookAccess(userId: string, bookCode: string) {
  const ok = await canAccessBook(userId, bookCode)
  if (!ok) {
    throw new Error('BOOK_LOCKED')
  }
}
