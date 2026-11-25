import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'

import authRoutes from './routes/auth.routes'
import vocabRoutes from './routes/vocab.routes'
import trainingRoutes from './routes/training.routes'
import chatRoutes from './routes/chat.routes'
import bookRoutes from './routes/book.routes'
import statsRoutes from './routes/stats.routes'
import adminRoutes from './routes/admin.routes'
import ttsRoutes from './routes/tts.routes'
import speechRoutes from './routes/speech.routes'
import typingRoutes from './routes/typing.routes'
import chineseRoutes from './chinese/chinese.routes'
import { errorMiddleware } from './middleware/error'
import { requestContext } from './middleware/request-context'
import { accessLog } from './middleware/access-log'
import { securityHeaders } from './middleware/security-headers'
import { getBootState } from './bootstrap'
import { isProduction } from './config/env'
import { openApiDocument } from './validation/openapi'
import prisma from './prisma/client'

function resolveCorsOrigin(): cors.CorsOptions['origin'] {
  const configured = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  if (configured.length > 0) {
    return (origin, callback) => callback(null, !origin || configured.includes(origin))
  }
  // 生产默认只允许同源（不返回 CORS 头）；开发放行任意来源，便于手机调试
  return isProduction() ? false : true
}

export function createApp() {
  const app = express()

  app.use(requestContext())
  app.use(accessLog())
  app.use(securityHeaders())
  app.use(cors({ origin: resolveCorsOrigin(), credentials: true }))
  // 语音接口需要上传 base64 音频分片；其余接口限制为 2MB，避免大包拖垮进程
  app.use('/api/speech', express.json({ limit: '15mb' }))
  app.use(express.json({ limit: '2mb' }))

  app.use('/api/auth', authRoutes)
  app.use('/api/vocab', vocabRoutes)
  app.use('/api/training', trainingRoutes)
  app.use('/api/chat', chatRoutes)
  app.use('/api/books', bookRoutes)
  app.use('/api/stats', statsRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/tts', ttsRoutes)
  app.use('/api/speech', speechRoutes)
  app.use('/api/typing', typingRoutes)
  app.use('/api/chinese', chineseRoutes)

  if (!isProduction()) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument))
  }

  app.get('/', (_req, res) => {
    res.json({ success: true, data: { name: '学习助手 API', version: '1.0.0' } })
  })

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' } })
  })

  app.get('/ready', async (_req, res) => {
    const state = getBootState()
    if (!state.ready) {
      return res.status(503).json({ success: false, data: state, error: 'starting' })
    }
    try {
      await prisma.$queryRaw`SELECT 1`
      return res.json({ success: true, data: state })
    } catch {
      return res.status(503).json({ success: false, data: state, error: 'database unavailable' })
    }
  })

  app.use(errorMiddleware)

  return app
}
