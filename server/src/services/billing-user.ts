import prisma from '../prisma/client'

export async function getBillingUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return null
  if (!user.parentId) return user
  const parent = await prisma.user.findUnique({ where: { id: user.parentId } })
  return parent || user
}
