import dotenv from 'dotenv'

dotenv.config()

import { createApp } from './create-app'
import { initVocabulary } from './utils/seed'
import { initBooks } from './services/book.service'
import { ensureAdminUser } from './services/admin-seed.service'
import { seedChineseIfEmpty } from './chinese/materials'

const app = createApp()
const PORT = process.env.PORT || 3000

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set; using the insecure development default')
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
  console.log(`API docs: http://localhost:${PORT}/api-docs`)

  void initVocabulary()
    .then(() => initBooks())
    .then(() => ensureAdminUser())
    .then(() => seedChineseIfEmpty())
    .catch(err => console.error('Background book/chinese sync failed:', err))
})

export { app }
