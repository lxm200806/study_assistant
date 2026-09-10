import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'

import authRoutes from './routes/auth.routes'
import vocabRoutes from './routes/vocab.routes'
import trainingRoutes from './routes/training.routes'
import chatRoutes from './routes/chat.routes'
import bookRoutes from './routes/book.routes'
import statsRoutes from './routes/stats.routes'
import adminRoutes from './routes/admin.routes'
import ttsRoutes from './routes/tts.routes'
import speechRoutes from './routes/speech.routes'
import chineseRoutes from './chinese/chinese.routes'
import { errorMiddleware } from './middleware/error'
import prisma from './prisma/client'

export function createApp() {
  const app = express()
  const PORT = process.env.PORT || 3000

  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: '学习助手 API',
        version: '1.0.0',
        description: '学习助手服务端 API 文档'
      },
      servers: [
        {
          url: `http://localhost:${PORT}`
        }
      ]
    },
    apis: ['./src/routes/*.ts']
  }

  const swaggerSpec = swaggerJsdoc(swaggerOptions)

  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  const healthHandler: express.RequestHandler = async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({ ok: true })
    } catch {
      res.status(503).json({ ok: false, error: 'database_unavailable' })
    }
  }

  app.get('/health', healthHandler)
  app.get('/api/health', healthHandler)

  app.use('/api/auth', authRoutes)
  // Frontend and docs use /api/vocabulary; keep /api/vocab as a compatibility alias.
  app.use('/api/vocab', vocabRoutes)
  app.use('/api/vocabulary', vocabRoutes)
  app.use('/api/training', trainingRoutes)
  app.use('/api/chat', chatRoutes)
  app.use('/api/books', bookRoutes)
  app.use('/api/stats', statsRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/tts', ttsRoutes)
  app.use('/api/speech', speechRoutes)
  app.use('/api/chinese', chineseRoutes)
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  app.get('/', (_req, res) => {
    res.send('学习助手服务端 API')
  })

  app.use(errorMiddleware)
  return app
}
