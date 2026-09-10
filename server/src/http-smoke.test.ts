import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Server } from 'http'
import { createApp } from './create-app'
import prisma from './prisma/client'
import { generateAccessToken, generateRefreshToken } from './utils/jwt'

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

async function json(res: Response) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

describe('api smoke', () => {
  let server: Server
  let base = ''
  let accessToken = ''
  let refreshToken = ''
  let learnerId = ''
  let wordId = ''
  let freeBookCode = 'ket'
  let lockedBookCode = ''

  beforeAll(async () => {
    const app = createApp()
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', () => resolve())
      server.on('error', reject)
    })
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind smoke-test server')
    }
    base = `http://127.0.0.1:${address.port}`

    const word = await prisma.vocabulary.create({
      data: {
        word: `smoke_${suffix}`,
        meaning: '冒烟测试词',
        phonetic: '/smoʊk/',
        exampleSentence: 'This is a smoke test.'
      }
    })
    wordId = word.id

    const freeBook = await prisma.book.upsert({
      where: { code: 'ket' },
      create: {
        name: 'KET词汇',
        code: 'ket',
        description: 'smoke',
        level: 'A2',
        wordCount: 1,
        isFree: true
      },
      update: { isFree: true }
    })
    freeBookCode = freeBook.code
    await prisma.bookVocabulary.upsert({
      where: { bookId_wordId: { bookId: freeBook.id, wordId: word.id } },
      create: { bookId: freeBook.id, wordId: word.id, sortOrder: 0 },
      update: {}
    })

    const locked = await prisma.book.upsert({
      where: { code: `smoke_locked_${suffix}` },
      create: {
        name: 'Locked Smoke Book',
        code: `smoke_locked_${suffix}`,
        description: 'premium only',
        level: 'C1',
        wordCount: 1,
        isFree: false
      },
      update: { isFree: false }
    })
    lockedBookCode = locked.code
    await prisma.bookVocabulary.upsert({
      where: { bookId_wordId: { bookId: locked.id, wordId: word.id } },
      create: { bookId: locked.id, wordId: word.id, sortOrder: 0 },
      update: {}
    })
  })

  afterAll(async () => {
    await new Promise<void>(resolve => {
      if (!server) return resolve()
      server.close(() => resolve())
    })
  })

  it('reports healthy database', async () => {
    const res = await fetch(`${base}/health`)
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('serves public book list and vocabulary alias', async () => {
    const books = await fetch(`${base}/api/books`)
    const vocab = await fetch(`${base}/api/vocabulary?page=1&limit=5`)
    const alias = await fetch(`${base}/api/vocab?page=1&limit=5`)
    expect(books.status).toBe(200)
    expect(vocab.status).toBe(200)
    expect(alias.status).toBe(200)
    const booksBody = await json(books)
    expect(Array.isArray(booksBody.data)).toBe(true)
  })

  it('registers, logs in, and returns a family profile', async () => {
    const username = `smoke_${suffix}`
    const registerRes = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'secret12' })
    })
    expect(registerRes.status).toBe(201)
    const registered = await json(registerRes)
    expect(registered.accessToken).toBeTruthy()

    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'secret12' })
    })
    expect(loginRes.status).toBe(200)
    const loggedIn = await json(loginRes)
    accessToken = loggedIn.accessToken
    refreshToken = loggedIn.refreshToken
    expect(accessToken).toBeTruthy()

    const studentRes = await fetch(`${base}/api/auth/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name: 'Smoke Kid' })
    })
    expect(studentRes.status).toBe(201)
    const studentBody = await json(studentRes)
    learnerId = studentBody.learner?.id
    expect(learnerId).toBeTruthy()

    const profileRes = await fetch(`${base}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    expect(profileRes.status).toBe(200)
    const profile = await json(profileRes)
    expect(profile.data.username).toBe(username)
  })

  it('rejects short passwords and access tokens as refresh tokens', async () => {
    const short = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: `short_${suffix}`, password: '123' })
    })
    expect(short.status).toBe(400)

    const refreshWithAccess = await fetch(`${base}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: accessToken })
    })
    expect(refreshWithAccess.status).toBe(400)

    const refreshOk = await fetch(`${base}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    })
    expect(refreshOk.status).toBe(200)
    expect((await json(refreshOk)).accessToken).toBeTruthy()
  })

  it('records FSRS practice and returns due/review data', async () => {
    const auth = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    const practiceRes = await fetch(`${base}/api/training/practice`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ wordId, type: 'reading', isCorrect: true })
    })
    expect(practiceRes.status).toBe(200)
    const practice = await json(practiceRes)
    expect(practice.data.practiceCount).toBe(1)
    expect(practice.data.fsrsState).toBeTruthy()

    const missingWord = await fetch(`${base}/api/training/practice`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ wordId: 'missing-word', type: 'reading', isCorrect: true })
    })
    expect(missingWord.status).toBe(404)

    const badType = await fetch(`${base}/api/training/practice`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ wordId, type: 'dance', isCorrect: true })
    })
    expect(badType.status).toBe(400)

    const statsRes = await fetch(`${base}/api/vocabulary/stats`, { headers: auth })
    expect(statsRes.status).toBe(200)
    const stats = await json(statsRes)
    expect(stats.data.reading.total).toBeGreaterThanOrEqual(1)

    const mapRes = await fetch(`${base}/api/stats/book/${freeBookCode}/map`, { headers: auth })
    expect(mapRes.status).toBe(200)
  })

  it('locks paid books and allows free book sessions', async () => {
    const auth = { Authorization: `Bearer ${accessToken}` }
    const locked = await fetch(`${base}/api/books/${lockedBookCode}/session?count=1`, { headers: auth })
    expect(locked.status).toBe(403)

    const session = await fetch(`${base}/api/books/${freeBookCode}/session?count=1`, { headers: auth })
    expect(session.status).toBe(200)
    const body = await json(session)
    expect(Array.isArray(body.data?.words || body.data)).toBe(true)
  })

  it('falls back for AI chat and stubs speech/TTS without paid keys', async () => {
    const auth = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    const quota = await fetch(`${base}/api/chat/quota`, { headers: auth })
    expect(quota.status).toBe(200)

    const chat = await fetch(`${base}/api/chat/send`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ content: 'Hello smoke test', mode: 'free' })
    })
    expect(chat.status).toBe(200)
    const chatBody = await json(chat)
    expect(chatBody.data.aiResponse).toBeTruthy()

    const asr = await fetch(`${base}/api/speech/asr/config`, { headers: auth })
    expect(asr.status).toBe(200)
    expect((await json(asr)).data.provider).toMatch(/whisper|xfyun/)

    const transcribe = await fetch(`${base}/api/speech/transcribe`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ audioBase64: 'AAAA', mimeType: 'audio/mp3' })
    })
    expect([503, 400, 500]).toContain(transcribe.status)

    const tts = await fetch(`${base}/api/tts?word=x`)
    expect(tts.status).toBe(400)
  })

  it('protects admin routes', async () => {
    const res = await fetch(`${base}/api/admin/vocabulary/missing/summary`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    expect(res.status).toBe(403)

    const untypedAccess = generateAccessToken('nope', 'nope')
    const refresh = generateRefreshToken('nope')
    expect(untypedAccess).toBeTruthy()
    expect(refresh).toBeTruthy()
  })
})
