import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'

import authRoutes from './routes/auth.routes'
import vocabularyRoutes from './routes/vocabulary.routes'
import trainingRoutes from './routes/training.routes'
import chatRoutes from './routes/chat.routes'
import bookRoutes from './routes/book.routes'
import statsRoutes from './routes/stats.routes'
import { errorMiddleware } from './middleware/error'
import { initVocabulary } from './utils/seed'
import { initBooks } from './services/book.service'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '学习助手API',
      version: '1.0.0',
      description: '学习助手服务端API文档'
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
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/vocabulary', vocabularyRoutes)
app.use('/api/training', trainingRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/books', bookRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use(errorMiddleware)

app.get('/', (req, res) => {
  res.send('学习助手服务端 API')
})

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
  console.log(`API文档: http://localhost:${PORT}/api-docs`)

  // 后台同步词库，避免阻塞 HTTP 请求
  void initVocabulary()
    .then(() => initBooks())
    .catch(err => console.error('Background book sync failed:', err))
})