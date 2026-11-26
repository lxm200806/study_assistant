import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { generateTotp } from '../utils/totp'
import { hashPassword } from '../utils/password'

const TEST_BASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
const DB_TESTS_ENABLED =
  Boolean(process.env.TEST_DATABASE_URL) || process.env.RUN_DB_TESTS === '1'

function findServerRoot(): string {
  let dir = process.cwd()
  for (let depth = 0; depth < 4; depth += 1) {
    if (fs.existsSync(path.join(dir, 'prisma', 'schema.prisma'))) return dir
    const nested = path.join(dir, 'server')
    if (fs.existsSync(path.join(nested, 'prisma', 'schema.prisma'))) return nested
    dir = path.dirname(dir)
  }
  throw new Error('找不到 server 目录（prisma/schema.prisma）')
}

function schemaName(): string {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const name = `it_${suffix}`
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error('非法测试 schema 名称')
  return name
}

function testUrl(baseUrl: string, schema: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set('schema', schema)
  return url.toString()
}

describe.skipIf(!DB_TESTS_ENABLED || !TEST_BASE_URL)('critical API flows', () => {
  let api: ReturnType<typeof request>
  let prisma: PrismaClient
  let admin: PrismaClient
  let schema = ''
  let bookId = ''
  let bookCode = ''
  let pointId = ''
  let pointAnswer = ''
  let accessToken = ''
  let refreshToken = ''
  let accountUserId = ''
  let accountUsername = ''
  let learnerId = ''
  let sessionToken = ''
  let sessionWordIds: string[] = []

  beforeAll(async () => {
    if (!TEST_BASE_URL) throw new Error('缺少 TEST_DATABASE_URL 或 DATABASE_URL')

    schema = schemaName()
    const url = testUrl(TEST_BASE_URL, schema)

    admin = new PrismaClient({ datasources: { db: { url: TEST_BASE_URL } } })
    await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)

    const serverRoot = findServerRoot()
    execFileSync(
      process.execPath,
      [path.join(serverRoot, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
      {
        cwd: serverRoot,
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'pipe'
      }
    )

    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = url
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration_test_access_secret_at_least_32_chars'
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'integration_test_refresh_secret_at_least_32_chars'
    // 强制聊天走确定性 fallback，避免测试环境误连真实 LLM。
    delete process.env.OPENAI_API_KEY
    delete process.env.DEEPSEEK_API_KEY

    const { createApp } = await import('../app')
    prisma = (await import('../prisma/client')).default
    api = request(createApp())

    const stamp = Date.now()
    bookCode = `it-book-${stamp}`
    const book = await prisma.book.create({
      data: {
        name: `集成测试词书 ${stamp}`,
        code: bookCode,
        level: 'test',
        wordCount: 3,
        isFree: true
      }
    })
    bookId = book.id

    const words = await Promise.all(
      ['apple', 'banana', 'cherry'].map((word, index) =>
        prisma.vocabulary.create({
          data: {
            word: `${word}-${stamp}`,
            meaning: `${word} 的测试释义 ${index + 1}`
          }
        })
      )
    )
    await prisma.bookVocabulary.createMany({
      data: words.map((word, index) => ({
        bookId: book.id,
        wordId: word.id,
        sortOrder: index,
        meaning: word.meaning,
        exampleSentences: []
      }))
    })

    pointAnswer = '疑是地上霜'
    const point = await prisma.chinesePublished.create({
      data: {
        kind: 'poem',
        level: 'L1',
        grade: '三年级上',
        prompt: '床前明月光',
        answer: pointAnswer,
        questionType: 'dictation',
        status: 'published',
        isActive: true,
        difficulty: 'primary',
        entryKey: `it-entry-${stamp}`,
        lemma: '静夜思'
      }
    })
    pointId = point.id
  }, 120_000)

  afterAll(async () => {
    if (prisma) await prisma.$disconnect()
    if (admin && schema) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await admin.$disconnect()
    }
  }, 60_000)

  function authed(req: request.Test) {
    return req.set('Authorization', `Bearer ${accessToken}`)
  }

  it('registers, logs in and refreshes tokens', async () => {
    const username = `it_user_${Date.now()}`
    const registered = await api
      .post('/api/auth/register')
      .send({ username, password: 'TestPass123!' })
    expect(registered.status).toBe(201)
    expect(registered.body.accessToken).toBeTruthy()
    expect(registered.body.refreshToken).toBeTruthy()

    accessToken = registered.body.accessToken
    refreshToken = registered.body.refreshToken
    accountUserId = registered.body.user.id
    accountUsername = username

    const login = await api
      .post('/api/auth/login')
      .send({ username, password: 'TestPass123!' })
    expect(login.status).toBe(200)
    expect(login.body.accessToken).toBeTruthy()

    const refreshed = await api.post('/api/auth/refresh').send({ refreshToken })
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.accessToken).toBeTruthy()
  })

  it('creates the learner and loads a signed training session', async () => {
    const student = await authed(api.post('/api/auth/students')).send({ name: '集成测试学生' })
    expect(student.status).toBe(201)
    learnerId = student.body.learner.id
    expect(learnerId).toBeTruthy()

    const active = await authed(api.put('/api/auth/students/active')).send({
      studentId: learnerId
    })
    expect(active.status).toBe(200)

    const session = await authed(
      api.get(`/api/books/${bookCode}/session`).query({ count: 2, mode: 'coverage' })
    )
    expect(session.status).toBe(200)
    expect(session.body.data.words.length).toBeGreaterThan(0)
    expect(session.body.data.sessionToken).toBeTruthy()

    sessionWordIds = session.body.data.words.map((word: { id: string }) => word.id)
    sessionToken = session.body.data.sessionToken
  })

  it('rejects an invalid word type with a 400 envelope', async () => {
    const invalid = await authed(api.post('/api/training/practice')).send({
      wordId: sessionWordIds[0],
      type: 'invalid-type',
      isCorrect: true
    })
    expect(invalid.status).toBe(400)
    expect(invalid.body.code).toBe('INVALID_REQUEST')
    expect(invalid.body.details?.length).toBeGreaterThan(0)
  })

  it('practices a word and completes the session', async () => {
    const practiced = await authed(api.post('/api/training/practice')).send({
      wordId: sessionWordIds[0],
      type: 'reading',
      isCorrect: true
    })
    expect(practiced.status).toBe(200)

    const stat = await prisma.vocabularyStat.findUnique({
      where: {
        learnerId_wordId_type: {
          learnerId,
          wordId: sessionWordIds[0],
          type: 'reading'
        }
      }
    })
    expect(stat).not.toBeNull()

    const completed = await authed(api.post('/api/training/session/complete')).send({
      bookCode,
      wordIds: sessionWordIds,
      sessionTokens: [sessionToken]
    })
    expect(completed.status).toBe(200)

    const progress = await prisma.bookStudyProgress.findUnique({
      where: { learnerId_bookId: { learnerId, bookId } }
    })
    expect(progress?.practicedWordIds).toEqual(expect.arrayContaining(sessionWordIds))
  })

  it('runs the quiz flow', async () => {
    const quiz = await authed(api.get('/api/training/quiz/words')).query({
      bookCode,
      count: 2
    })
    expect(quiz.status).toBe(200)
    const words = quiz.body.data as Array<{ id: string }>
    expect(words.length).toBeGreaterThan(0)

    const answers = words.map((word, index) => ({
      wordId: word.id,
      isCorrect: index === 0
    }))
    const submitted = await authed(api.post('/api/training/quiz/submit')).send({
      bookCode,
      items: answers
    })
    expect(submitted.status).toBe(200)
    expect(submitted.body.data.total).toBe(words.length)
    expect(submitted.body.data.correct).toBe(1)
    expect(submitted.body.data.accuracy).toBe(Math.round((1 / words.length) * 100))
  })

  it('creates a Chinese course through the API and runs today/review', async () => {
    const created = await authed(api.post('/api/chinese/courses')).send({
      name: '集成测试语文课',
      kinds: ['poem'],
      levels: ['L1'],
      difficulties: ['primary'],
      dailyMinutes: 15
    })
    expect(created.status).toBe(200)
    const courseId = String(created.body.id || '')
    expect(courseId).toBeTruthy()

    const today = await authed(
      api.get(`/api/chinese/courses/${courseId}/today`).query({ mode: 'learn' })
    )
    expect(today.status).toBe(200)
    const items = today.body.items as Array<{ id: string }>
    expect(items.length).toBeGreaterThan(0)
    expect(items.some(item => item.id === pointId)).toBe(true)

    const reviewed = await authed(
      api.post(`/api/chinese/courses/${courseId}/review`)
    ).send({ pointId, answer: pointAnswer, mode: 'learn' })
    expect(reviewed.status).toBe(200)

    const state = await prisma.chineseReviewState.findUnique({
      where: {
        learnerId_courseId_pointId: { learnerId, courseId, pointId }
      }
    })
    expect(state).not.toBeNull()
  })

  it('runs the typing queue, answer, mark and list flow', async () => {
    const queue = await authed(api.get('/api/typing/queue')).query({
      bookCode,
      source: 'smart',
      mode: 'follow',
      count: 2
    })
    expect(queue.status).toBe(200)
    const words = queue.body.data.words as Array<{ id: string }>
    expect(words.length).toBeGreaterThan(0)

    const wordId = words[0].id
    const answered = await authed(api.post('/api/typing/answer')).send({
      wordId,
      isCorrect: true,
      mode: 'follow'
    })
    expect(answered.status).toBe(200)

    const stat = await prisma.typingModeStat.findUnique({
      where: { learnerId_wordId_mode: { learnerId, wordId, mode: 'follow' } }
    })
    expect(stat).not.toBeNull()

    const marked = await authed(api.put('/api/typing/marks')).send({
      wordId,
      favorite: true
    })
    expect(marked.status).toBe(200)
    const mark = await prisma.learnerWordMark.findUnique({
      where: { learnerId_wordId: { learnerId, wordId } }
    })
    expect(mark?.favorite).toBe(true)

    const created = await authed(api.post('/api/typing/lists')).send({
      name: '集成测试词表',
      text: 'zebra yellow'
    })
    expect(created.status).toBe(201)
    const listId = created.body.data.id

    const lists = await authed(api.get('/api/typing/lists'))
    expect(lists.status).toBe(200)
    expect(lists.body.data.some((item: { id: string }) => item.id === listId)).toBe(true)

    const deleted = await authed(api.delete(`/api/typing/lists/${listId}`))
    expect(deleted.status).toBe(200)
  })

  it('runs the typing activity, history, session and article flow', async () => {
    const today = new Date().toISOString().slice(0, 10)

    const activity = await authed(api.post('/api/typing/activity')).send({ count: 1 })
    expect(activity.status).toBe(200)
    expect(activity.body.data.recorded).toBe(1)

    const session = await authed(api.post('/api/typing/sessions')).send({
      date: today,
      durationMs: 1000,
      typedChars: 10,
      correctChars: 9,
      itemCount: 1,
      correctCount: 1,
      kind: 'words'
    })
    expect(session.status).toBe(201)

    const history = await authed(api.get('/api/typing/history')).query({
      end: today,
      days: 7
    })
    expect(history.status).toBe(200)

    const created = await authed(api.post('/api/typing/articles')).send({
      title: '集成测试短文',
      body: 'This is a test sentence.',
      translation: ''
    })
    expect(created.status).toBe(201)
    const articleId = String(created.body.data.id)

    const articles = await authed(api.get('/api/typing/articles'))
    expect(articles.status).toBe(200)
    expect(articles.body.data.some((item: { id: string }) => item.id === articleId)).toBe(true)

    const due = await authed(api.get('/api/typing/articles/due')).query({ count: 10 })
    expect(due.status).toBe(200)

    const article = await authed(api.get(`/api/typing/articles/${articleId}`))
    expect(article.status).toBe(200)
    expect(article.body.data.body).toContain('test sentence')

    const preview = await authed(api.post(`/api/typing/articles/${articleId}/preview`)).send({
      body: 'This is a test sentence.',
      translation: ''
    })
    expect(preview.status).toBe(200)

    const removed = await authed(api.delete(`/api/typing/articles/${articleId}`))
    expect(removed.status).toBe(200)
  })

  it('runs the chat send, history, quota and SSE stream flow', async () => {
    const sent = await authed(api.post('/api/chat/send')).send({
      content: 'hello',
      bookCode,
      mode: 'free'
    })
    expect(sent.status).toBe(200)
    expect(sent.body.success).toBe(true)
    expect(typeof sent.body.data.aiResponse).toBe('string')
    expect(sent.body.data.aiResponse.length).toBeGreaterThan(0)

    const history = await authed(api.get('/api/chat/history')).query({ page: 1, limit: 10 })
    expect(history.status).toBe(200)
    expect(history.body.data.length).toBeGreaterThanOrEqual(2)

    const quota = await authed(api.get('/api/chat/quota'))
    expect(quota.status).toBe(200)
    expect(typeof quota.body.data.remaining).toBe('number')

    const streamed = await authed(api.post('/api/chat/stream')).send({
      content: 'hello again',
      bookCode,
      mode: 'free'
    })
    expect(streamed.status).toBe(200)
    expect(String(streamed.headers['content-type'])).toContain('text/event-stream')
    expect(streamed.text).toContain('event: token')
    expect(streamed.text).toContain('event: done')

    const doneMatch = streamed.text.match(/event: done\ndata: (.*)\n\n/)
    expect(doneMatch).not.toBeNull()
    const done = JSON.parse(doneMatch![1]) as {
      fullText: string
      usedFallback: boolean
    }
    expect(done.fullText.length).toBeGreaterThan(0)
    expect(done.usedFallback).toBe(true)
  })

  it('serves profile, vocab and book helper endpoints', async () => {
    const profile = await authed(api.get('/api/auth/profile'))
    expect(profile.status).toBe(200)
    expect(profile.body.data.username).toBeTruthy()

    const vocab = await authed(api.get('/api/vocab')).query({ page: 1, limit: 2 })
    expect(vocab.status).toBe(200)
    expect(Array.isArray(vocab.body.data)).toBe(true)

    const randomWords = await authed(api.get('/api/vocab/random')).query({ count: 2 })
    expect(randomWords.status).toBe(200)
    expect(Array.isArray(randomWords.body.data)).toBe(true)

    const stats = await authed(api.get('/api/vocab/stats'))
    expect(stats.status).toBe(200)

    const randomBookWords = await authed(
      api.get(`/api/books/${bookCode}/random`).query({ count: 2 })
    )
    expect(randomBookWords.status).toBe(200)
    expect(randomBookWords.body.data.length).toBeGreaterThan(0)

    const due = await authed(api.get(`/api/books/${bookCode}/due-count`))
    expect(due.status).toBe(200)
    expect(typeof due.body.data.dueCount).toBe('number')

    const progress = await authed(api.get(`/api/books/${bookCode}/progress`))
    expect(progress.status).toBe(200)
  })

  it('creates, renames and archives a student', async () => {
    const created = await authed(api.post('/api/auth/students')).send({ name: '第二个学生' })
    expect(created.status).toBe(201)
    const studentId = String(created.body.learner.id)

    const renamed = await authed(api.put(`/api/auth/students/${studentId}`)).send({
      name: '改名学生'
    })
    expect(renamed.status).toBe(200)
    expect(renamed.body.learner.name).toBe('改名学生')

    const archived = await authed(api.delete(`/api/auth/students/${studentId}`))
    expect(archived.status).toBe(200)
  })

  it('serves Chinese/library endpoints and enforces admin/speech/tts boundaries', async () => {
    const meta = await api.get('/api/chinese/meta')
    expect(meta.status).toBe(200)

    const library = await authed(api.get('/api/chinese/library')).query({ limit: 5 })
    expect(library.status).toBe(200)

    const courses = await authed(api.get('/api/chinese/courses'))
    expect(courses.status).toBe(200)
    expect(Array.isArray(courses.body)).toBe(true)

    const resources = await authed(api.get('/api/chinese/resources'))
    expect(resources.status).toBe(200)

    const drafts = await authed(api.get('/api/chinese/drafts'))
    expect(drafts.status).toBe(403)

    const admin = await authed(api.get('/api/admin/vocabulary/missing/summary'))
    expect(admin.status).toBe(403)

    const asrConfig = await authed(api.get('/api/speech/asr/config'))
    expect(asrConfig.status).toBe(200)

    const ttsNoAuth = await api.get('/api/tts')
    expect(ttsNoAuth.status).toBe(401)

    const ttsMissing = await authed(api.get('/api/tts'))
    expect(ttsMissing.status).toBe(400)

    const transcribeInvalid = await authed(api.post('/api/speech/transcribe')).send({})
    expect(transcribeInvalid.status).toBe(400)
  })

  it('returns 401/403/404/409 on the expected boundaries', async () => {
    const noAuth = await api.get(`/api/books/${bookCode}/session`)
    expect(noAuth.status).toBe(401)
    expect(noAuth.body.success).toBe(false)
    expect(noAuth.body.code).toBe('UNAUTHORIZED')

    const badToken = await api
      .get(`/api/books/${bookCode}/session`)
      .set('Authorization', 'Bearer invalid-token')
    expect(badToken.status).toBe(401)
    expect(badToken.body.code).toBe('INVALID_TOKEN')

    const missingBook = await authed(api.get('/api/books/not-a-real-book'))
    expect(missingBook.status).toBe(404)

    const locked = await prisma.book.create({
      data: {
        name: `锁定测试书 ${Date.now()}`,
        code: `locked-${Date.now()}`,
        level: 'test',
        wordCount: 1,
        isFree: false
      }
    })
    const lockedSession = await authed(api.get(`/api/books/${locked.code}/session`))
    expect(lockedSession.status).toBe(403)

    const username = `no_learner_${Date.now()}`
    const registered = await api
      .post('/api/auth/register')
      .send({ username, password: 'TestPass123!' })
    const noLearner = await api
      .get(`/api/books/${bookCode}/session`)
      .set('Authorization', `Bearer ${registered.body.accessToken}`)
    expect(noLearner.status).toBe(409)

    const recheck = await authed(api.post('/api/training/recheck')).send({
      bookCode,
      wordId: sessionWordIds[0],
      type: 'reading',
      isCorrect: true
    })
    expect(recheck.status).toBe(200)

    const draftImport = await authed(api.post('/api/chinese/drafts/import')).send({
      text: '测试导入'
    })
    expect(draftImport.status).toBe(403)

    const resourceSync = await authed(api.post('/api/chinese/resources/sync-all'))
    expect(resourceSync.status).toBe(403)
  })

  it('supports the /api/v1 alias and idempotency keys', async () => {
    const v1Books = await api.get('/api/v1/books')
    expect(v1Books.status).toBe(200)
    expect(v1Books.body.success).toBe(true)

    const word = await prisma.vocabulary.create({
      data: { word: `idem-${Date.now()}`, meaning: '幂等测试' }
    })
    const key = `idem-${Date.now()}`
    const body = { wordId: word.id, type: 'reading', isCorrect: true }

    const first = await authed(api.post('/api/training/practice'))
      .set('Idempotency-Key', key)
      .send(body)
    const second = await authed(api.post('/api/training/practice'))
      .set('Idempotency-Key', key)
      .send(body)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.headers['idempotency-replayed']).toBe('true')
    expect(second.body).toEqual(first.body)

    const stat = await prisma.vocabularyStat.findUnique({
      where: { learnerId_wordId_type: { learnerId, wordId: word.id, type: 'reading' } }
    })
    expect(stat?.practiceCount).toBe(1)
  })

  it('rotates refresh tokens and revokes device sessions', async () => {
    const username = `session_${Date.now()}`
    const registered = await api
      .post('/api/auth/register')
      .send({ username, password: 'TestPass123!' })
    expect(registered.status).toBe(201)

    const rotated = await api.post('/api/auth/refresh').send({
      refreshToken: registered.body.refreshToken
    })
    expect(rotated.status).toBe(200)
    expect(rotated.body.refreshToken).toBeTruthy()

    const reused = await api.post('/api/auth/refresh').send({
      refreshToken: registered.body.refreshToken
    })
    expect(reused.status).toBe(400)

    const sessions = await api
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${rotated.body.accessToken}`)
    expect(sessions.status).toBe(200)
    expect(sessions.body.data).toHaveLength(1)
    expect(sessions.body.data[0].current).toBe(true)

    const logout = await api
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${rotated.body.accessToken}`)
    expect(logout.status).toBe(200)

    const revoked = await api
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${rotated.body.accessToken}`)
    expect(revoked.status).toBe(401)
    expect(revoked.body.code).toBe('SESSION_REVOKED')

    const loggedIn = await api
      .post('/api/auth/login')
      .send({ username, password: 'TestPass123!' })
    expect(loggedIn.status).toBe(200)
    const logoutAll = await api
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${loggedIn.body.accessToken}`)
    expect(logoutAll.status).toBe(200)
    const afterAll = await api
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${loggedIn.body.accessToken}`)
    expect(afterAll.status).toBe(401)
    expect(afterAll.body.code).toBe('SESSION_REVOKED')
  })

  it('records admin audit logs for Chinese writes', async () => {
    await prisma.user.update({ where: { id: accountUserId }, data: { isAdmin: true } })
    const patched = await authed(api.put(`/api/chinese/library/${pointId}`)).send({
      prompt: '床前明月光'
    })
    expect(patched.status).toBe(200)

    const audit = await authed(api.get('/api/admin/audit')).query({ page: 1, limit: 20 })
    expect(audit.status).toBe(200)
    expect(
      audit.body.data.items.some(
        (item: { action: string }) => item.action === 'chinese.library.patch'
      )
    ).toBe(true)
  })

  it('supports admin TOTP two-factor login', async () => {
    await prisma.user.update({
      where: { id: accountUserId },
      data: { isAdmin: true, twoFactorEnabled: false, twoFactorSecret: null }
    })

    const setup = await authed(api.post('/api/auth/2fa/setup'))
    expect(setup.status).toBe(200)
    const secret = String(setup.body.data.secret)
    expect(secret).toBeTruthy()

    const enabled = await authed(api.post('/api/auth/2fa/enable')).send({
      code: generateTotp(secret)
    })
    expect(enabled.status).toBe(200)

    const missing = await api.post('/api/auth/login').send({
      username: accountUsername,
      password: 'TestPass123!'
    })
    expect(missing.status).toBe(400)

    const loggedIn = await api.post('/api/auth/login').send({
      username: accountUsername,
      password: 'TestPass123!',
      code: generateTotp(secret)
    })
    expect(loggedIn.status).toBe(200)
    expect(loggedIn.body.accessToken).toBeTruthy()

    const disabled = await authed(api.post('/api/auth/2fa/disable')).send({
      password: 'TestPass123!'
    })
    expect(disabled.status).toBe(200)

    const afterDisable = await api.post('/api/auth/login').send({
      username: accountUsername,
      password: 'TestPass123!'
    })
    expect(afterDisable.status).toBe(200)
  })

  it('exports and deletes an account', async () => {
    const username = `delete_${Date.now()}`
    const registered = await api
      .post('/api/auth/register')
      .send({ username, password: 'TestPass123!' })
    expect(registered.status).toBe(201)
    const token = registered.body.accessToken as string

    const exported = await api
      .get('/api/auth/account/export')
      .set('Authorization', `Bearer ${token}`)
    expect(exported.status).toBe(200)
    expect(exported.body.data.user.username).toBe(username)

    const deleted = await api
      .post('/api/auth/account/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'TestPass123!' })
    expect(deleted.status).toBe(200)

    const afterDelete = await api
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
    expect(afterDelete.status).toBe(401)
  })

  it('creates and pays a mock membership order', async () => {
    const plans = await api.get('/api/billing/plans')
    expect(plans.status).toBe(200)
    const planCode = plans.body.data[0]?.code
    expect(planCode).toBeTruthy()

    const created = await authed(api.post('/api/billing/orders')).send({ planCode })
    expect(created.status).toBe(201)
    const orderId = created.body.data.id as string
    expect(created.body.data.status).toBe('pending')

    const paid = await authed(api.post(`/api/billing/orders/${orderId}/pay`)).send({
      provider: 'mock'
    })
    expect(paid.status).toBe(200)
    expect(paid.body.data.status).toBe('paid')

    const profile = await authed(api.get('/api/auth/profile'))
    expect(profile.body.data.plan).toBe('premium')
  })

  it('registers and removes a push token', async () => {
    const token = `push_${Date.now()}`
    const registered = await authed(api.post('/api/push/register')).send({
      token,
      platform: 'app',
      provider: 'apns'
    })
    expect(registered.status).toBe(201)

    const removed = await authed(api.delete('/api/push/register')).send({ token })
    expect(removed.status).toBe(200)
    expect(removed.body.data.removed).toBe(true)
  })

  it('changes password, revokes old tokens and requires new credentials', async () => {
    const username = `pwd_${Date.now()}_${Math.floor(Math.random() * 10_000)}`
    const oldPassword = 'OldPass123!'
    const newPassword = 'NewPass456!'
    await prisma.user.create({
      data: { username, passwordHash: await hashPassword(oldPassword) }
    })

    const login = await api.post('/api/auth/login').send({ username, password: oldPassword })
    expect(login.status).toBe(200)
    const token = login.body.accessToken as string

    const wrongCurrent = await api
      .post('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPass', newPassword })
    expect(wrongCurrent.status).toBe(400)

    const tooShort = await api
      .post('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: oldPassword, newPassword: 'short' })
    expect(tooShort.status).toBe(400)

    const changed = await api
      .post('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: oldPassword, newPassword })
    expect(changed.status).toBe(200)
    expect(changed.body).toMatchObject({ success: true, data: { reloginRequired: true } })

    const oldTokenProfile = await api
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
    expect(oldTokenProfile.status).toBe(401)

    const oldLogin = await api.post('/api/auth/login').send({ username, password: oldPassword })
    expect(oldLogin.status).toBe(400)
    const newLogin = await api.post('/api/auth/login').send({ username, password: newPassword })
    expect(newLogin.status).toBe(200)
  })
})
