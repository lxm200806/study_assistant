import prisma from '../prisma/client'
import { hashPassword } from '../utils/password'

export async function ensureAdminUser() {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin1234'
  const passwordHash = await hashPassword(password)

  await prisma.user.upsert({
    where: { username },
    create: { username, passwordHash, isAdmin: true },
    update: { passwordHash, isAdmin: true }
  })
}
