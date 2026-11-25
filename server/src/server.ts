import 'dotenv/config'
import { createApp } from './app'
import { bootstrap } from './bootstrap'
import { isProduction } from './config/env'

const PORT = Number(process.env.PORT) || 3000
const app = createApp()

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
  if (!isProduction()) {
    console.log(`API 文档: http://localhost:${PORT}/api-docs`)
  }
  void bootstrap()
})
