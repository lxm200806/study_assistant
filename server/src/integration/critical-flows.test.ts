import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'

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

  it('runs the Chinese today queue and review flow', async () => {
    const course = await prisma.chineseCourse.create({
      data: {
        learnerId,
        name: '集成测试语文课',
        dailyMinutes: 15
      }
    })
    await prisma.chineseCourseItem.create({
      data: { courseId: course.id, pointId, sort: 0 }
    })

    const today = await authed(
      api.get(`/api/chinese/courses/${course.id}/today`).query({ mode: 'learn' })
    )
    expect(today.status).toBe(200)
    const items = today.body.items as Array<{ id: string }>
    expect(items.length).toBeGreaterThan(0)
    expect(items.some(item => item.id === pointId)).toBe(true)

    const reviewed = await authed(
      api.post(`/api/chinese/courses/${course.id}/review`)
    ).send({ pointId, answer: pointAnswer, mode: 'learn' })
    expect(reviewed.status).toBe(200)

    const state = await prisma.chineseReviewState.findUnique({
      where: {
        learnerId_courseId_pointId: { learnerId, courseId: course.id, pointId }
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
})
