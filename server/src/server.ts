import 'dotenv/config'
import { createApp } from './app'
import { bootstrap } from './bootstrap'
import { isProduction } from './config/env'
import prisma from './prisma/client'

const PORT = Number(process.env.PORT) || 3000
const app = createApp()

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
  if (!isProduction()) {
    console.log(`API 文档: http://localhost:${PORT}/api-docs`)
  }
  void bootstrap()
})

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[server] received ${signal}, shutting down`)
  const forceExit = setTimeout(() => {
    console.error('[server] graceful shutdown timed out')
    process.exit(1)
  }, 10_000)
  forceExit.unref()
  server.close(() => {
    void prisma
      .$disconnect()
      .catch(error => console.error('[server] prisma disconnect failed:', error))
      .finally(() => process.exit(0))
  })
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
