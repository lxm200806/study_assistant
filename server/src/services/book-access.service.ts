import prisma from '../prisma/client'
import { getBillingUser } from './billing-user'

export async function canAccessBook(userId: string, bookCode: string): Promise<boolean> {
  const user = await getBillingUser(userId)
  if (!user) return false
  if (user.isAdmin) return true
  if (user.plan === 'premium' && (!user.planExpiresAt || user.planExpiresAt > new Date())) {
    return true
  }

  const book = await prisma.book.findUnique({ where: { code: bookCode } })
  if (!book) return false
  if (book.isFree) return true

  const unlock = await prisma.userBookUnlock.findUnique({
    where: { userId_bookId: { userId: user.id, bookId: book.id } }
  })
  return !!unlock
}

export async function assertBookAccess(userId: string, bookCode: string) {
  const ok = await canAccessBook(userId, bookCode)
  if (!ok) {
    throw new Error('BOOK_LOCKED')
  }
}
