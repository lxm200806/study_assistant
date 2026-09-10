import prisma from '../prisma/client'
import { hashPassword } from '../utils/password'

export async function ensureAdminUser() {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const envPassword = process.env.ADMIN_PASSWORD
  const existing = await prisma.user.findUnique({ where: { username } })

  if (!existing) {
    const passwordHash = await hashPassword(envPassword || 'admin1234')
    await prisma.user.create({
      data: {
        username,
        passwordHash,
        isAdmin: true,
        accountType: 'parent',
        activeRole: 'parent'
      }
    })
    if (!envPassword) {
      console.warn('Admin user created with default password. Set ADMIN_PASSWORD in server/.env')
    }
    return
  }

  const data: { isAdmin: boolean; passwordHash?: string } = { isAdmin: true }
  if (envPassword) {
    data.passwordHash = await hashPassword(envPassword)
  }
  await prisma.user.update({
    where: { id: existing.id },
    data
  })
}
