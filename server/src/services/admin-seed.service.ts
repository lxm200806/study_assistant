import prisma from '../prisma/client'
import { hashPassword } from '../utils/password'
import { assertAdminConfig, isProduction } from '../config/env'

assertAdminConfig()

export type AdminSeedResult = 'created' | 'updated' | 'existing' | 'skipped'

export async function ensureAdminUser(options: { resetPassword?: boolean } = {}): Promise<AdminSeedResult> {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD

  if (!password) {
    if (isProduction()) {
      throw new Error('ADMIN_PASSWORD is required in production')
    }
    console.warn('[admin] ADMIN_PASSWORD is not set; skipping admin bootstrap')
    return 'skipped'
  }

  const passwordHash = await hashPassword(password)
  const existing = await prisma.user.findUnique({ where: { username } })

  if (!existing) {
    await prisma.user.create({
      data: { username, passwordHash, isAdmin: true }
    })
    return 'created'
  }

  if (options.resetPassword) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, isAdmin: true }
    })
    return 'updated'
  }

  if (!existing.isAdmin) {
    console.warn(`[admin] user "${username}" exists but is not an admin; use the seed:admin script to promote it explicitly`)
  }
  return 'existing'
}
