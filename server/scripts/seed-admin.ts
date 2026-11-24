import dotenv from 'dotenv'
import path from 'path'
import prisma from '../src/prisma/client'
import { ensureAdminUser } from '../src/services/admin-seed.service'

dotenv.config({ path: path.join(__dirname, '../.env') })

async function main() {
  const result = await ensureAdminUser({ resetPassword: true })
  if (result === 'skipped') {
    console.error('ADMIN_PASSWORD is required for the seed:admin script')
    process.exitCode = 1
    return
  }
  console.log(`Admin user ${result}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
