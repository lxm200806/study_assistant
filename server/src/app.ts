import dotenv from 'dotenv'
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
import { initVocabulary } from './utils/seed'
import { initBooks } from './services/book.service'
import { ensureAdminUser } from './services/admin-seed.service'
import { seedChineseIfEmpty } from './chinese/materials'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '????API',
      version: '1.0.0',
      description: '???????API??'
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

app.use('/api/auth', authRoutes)
app.use('/api/vocab', vocabRoutes)
app.use('/api/training', trainingRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/books', bookRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/tts', ttsRoutes)
app.use('/api/speech', speechRoutes)
app.use('/api/chinese', chineseRoutes)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use(errorMiddleware)

app.get('/', (req, res) => {
  res.send('???????API')
})

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
  console.log(`API??: http://localhost:${PORT}/api-docs`)

  // ???????????HTTP ??
  void initVocabulary()
    .then(() => initBooks())
    .then(() => ensureAdminUser())
    .then(() => seedChineseIfEmpty())
    .catch(err => console.error('Background book/chinese sync failed:', err))
})

