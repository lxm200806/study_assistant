import dotenv from 'dotenv'
import path from 'path'
import prisma from '../src/prisma/client'
import { ensureAdminUser } from '../src/services/admin-seed.service'

dotenv.config({ path: path.join(__dirname, '../.env') })

async function main() {
  await ensureAdminUser()
  console.log('Admin user ready')
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
