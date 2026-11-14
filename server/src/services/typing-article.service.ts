import prisma from '../prisma/client'
import { builtinArticles, findBuiltinArticle } from '../data/practice-articles'
import { splitPieces, splitSentences, articleKeyFor, pickDueSentences, sentenceIsDue } from './typing-logic'
import { cardInputFrom, scheduleCard } from './typing-schedule'

const ARTICLE_TEXT_LIMIT = 8000
const NAME_LIMIT = 40

export interface ArticleSentenceView {
  index: number
  text: string
  translation: string
  articleKey: string
  title: string
  practiceCount: number
  due: string | null
  fsrsState: string
  recentLapse: boolean
}

interface SentenceDraft {
  text: string
  translation: string
}

function cleanName(value: unknown, fallback: string): string {
  const name = String(value || '').trim().slice(0, NAME_LIMIT)
  return name || fallback
}

export function pairArticleSentences(body: string, translation: string): SentenceDraft[] {
  const sentences = splitSentences(body)
  const translated = translation ? splitPieces(translation) : []
  const paired = translated.length === sentences.length ? translated : []
  return sentences.map((text, index) => ({
    text,
    translation: paired[index] || ''
  }))
}

async function ensureSentenceCards(learnerId: string, articleKey: string, sentences: SentenceDraft[]) {
  const existing = await prisma.articleSentenceCard.findMany({
    where: { learnerId, articleKey }
  })
  const byIndex = new Map(existing.map(row => [row.sentenceIndex, row]))
  for (let index = 0; index < sentences.length; index++) {
    const sentence = sentences[index]
    const row = byIndex.get(index)
    if (!row) {
      await prisma.articleSentenceCard.create({
        data: {
          learnerId,
          articleKey,
          sentenceIndex: index,
          text: sentence.text,
          translation: sentence.translation
        }
      })
      continue
    }
    if (row.text !== sentence.text) {
      await prisma.articleSentenceCard.update({
        where: {
          learnerId_articleKey_sentenceIndex: { learnerId, articleKey, sentenceIndex: index }
        },
        data: {
          text: sentence.text,
          translation: sentence.translation,
          practiceCount: 0,
          correctCount: 0,
          lastPractice: null,
          mastery: 0,
          due: null,
          stability: 0,
          difficulty: 0,
          reps: 0,
          lapses: 0,
          fsrsState: 'New',
          lastReview: null,
          retrievability: 0,
          recentLapse: false
        }
      })
    } else if (row.translation !== sentence.translation) {
      await prisma.articleSentenceCard.update({
        where: {
          learnerId_articleKey_sentenceIndex: { learnerId, articleKey, sentenceIndex: index }
        },
        data: { translation: sentence.translation }
      })
    }
  }
  if (existing.some(row => row.sentenceIndex >= sentences.length)) {
    await prisma.articleSentenceCard.deleteMany({
      where: { learnerId, articleKey, sentenceIndex: { gte: sentences.length } }
    })
  }
}

function viewSentence(
  articleKey: string,
  title: string,
  index: number,
  text: string,
  translation: string,
  card?: {
    practiceCount: number
    due: Date | null
    fsrsState: string
    recentLapse: boolean
  } | null
): ArticleSentenceView {
  return {
    index,
    text,
    translation,
    articleKey,
    title,
    practiceCount: card?.practiceCount ?? 0,
    due: card?.due ? card.due.toISOString() : null,
    fsrsState: card?.fsrsState ?? 'New',
    recentLapse: card?.recentLapse ?? false
  }
}

async function loadArticleBody(learnerId: string, id: string): Promise<{
  key: string
  id: string
  title: string
  source: string
  builtin: boolean
  body: string
  translation: string
} | null> {
  const parsed = articleKeyFor(id)
  if (parsed.builtinKey) {
    const article = findBuiltinArticle(parsed.builtinKey)
    if (!article) return null
    return {
      key: parsed.key,
      id: parsed.key,
      title: article.title,
      source: article.source,
      builtin: true,
      body: article.body,
      translation: article.translation
    }
  }
  const row = await prisma.practiceArticle.findFirst({
    where: { id: parsed.userId || '', learnerId }
  })
  if (!row) return null
  return {
    key: parsed.key,
    id: row.id,
    title: row.title,
    source: '',
    builtin: false,
    body: row.body,
    translation: row.translation
  }
}

export async function listPracticeArticles(learnerId: string) {
  const [rows, cards] = await Promise.all([
    prisma.practiceArticle.findMany({
      where: { learnerId },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.articleSentenceCard.findMany({
      where: { learnerId, practiceCount: { gt: 0 } },
      select: { articleKey: true, sentenceIndex: true, practiceCount: true, due: true, recentLapse: true }
    })
  ])
  const now = Date.now()
  const dueByKey = new Map<string, number>()
  for (const card of cards) {
    if (!sentenceIsDue(card, now)) continue
    dueByKey.set(card.articleKey, (dueByKey.get(card.articleKey) || 0) + 1)
  }

  const samples = builtinArticles.map(article => {
    const key = `builtin:${article.key}`
    return {
      id: key,
      title: article.title,
      sentenceCount: splitSentences(article.body).length,
      createdAt: null as string | null,
      builtin: true,
      source: article.source,
      dueCount: dueByKey.get(key) || 0
    }
  })
  const mine = rows.map(row => ({
    id: row.id,
    title: row.title,
    sentenceCount: splitSentences(row.body).length,
    createdAt: row.createdAt,
    builtin: false,
    source: '',
    dueCount: dueByKey.get(`user:${row.id}`) || 0
  }))
  return [...samples, ...mine]
}

export async function createPracticeArticle(
  learnerId: string,
  input: { title?: unknown; body?: unknown; translation?: unknown }
) {
  const body = String(input.body || '').trim()
  const translation = String(input.translation || '').trim()
  if (!body || body.length > ARTICLE_TEXT_LIMIT || translation.length > ARTICLE_TEXT_LIMIT) {
    throw new Error('BAD_INPUT')
  }
  const sentences = pairArticleSentences(body, translation)
  if (!sentences.length) throw new Error('BAD_INPUT')
  const row = await prisma.practiceArticle.create({
    data: {
      learnerId,
      title: cleanName(input.title, sentences[0].text.slice(0, NAME_LIMIT)),
      body,
      translation
    }
  })
  await ensureSentenceCards(learnerId, `user:${row.id}`, sentences)
  return { id: row.id, title: row.title, sentenceCount: sentences.length }
}

export async function getPracticeArticle(learnerId: string, id: string) {
  const article = await loadArticleBody(learnerId, id)
  if (!article) throw new Error('NOT_FOUND')
  const sentences = pairArticleSentences(article.body, article.translation)
  if (!sentences.length) throw new Error('BAD_INPUT')
  await ensureSentenceCards(learnerId, article.key, sentences)
  const cards = await prisma.articleSentenceCard.findMany({
    where: { learnerId, articleKey: article.key }
  })
  const byIndex = new Map(cards.map(card => [card.sentenceIndex, card]))
  const paired = sentences.some(sentence => sentence.translation)
  return {
    id: article.id,
    title: article.title,
    source: article.source,
    builtin: article.builtin,
    body: article.body,
    translation: paired ? '' : article.translation,
    sentences: sentences.map((sentence, index) =>
      viewSentence(article.key, article.title, index, sentence.text, sentence.translation, byIndex.get(index))
    )
  }
}

export async function deletePracticeArticle(learnerId: string, id: string) {
  const parsed = articleKeyFor(id)
  if (parsed.builtinKey) throw new Error('BAD_INPUT')
  const row = await prisma.practiceArticle.findFirst({ where: { id: parsed.userId || '', learnerId } })
  if (!row) throw new Error('NOT_FOUND')
  await prisma.articleSentenceCard.deleteMany({
    where: { learnerId, articleKey: `user:${row.id}` }
  })
  await prisma.practiceArticle.delete({ where: { id: row.id } })
}

export async function getDueArticleSentences(learnerId: string, count: number) {
  const cards = await prisma.articleSentenceCard.findMany({
    where: { learnerId, practiceCount: { gt: 0 } }
  })
  const now = Date.now()
  const due = pickDueSentences(cards, now, cards.length)
  const userIds = [...new Set(
    due
      .map(card => card.articleKey)
      .filter(key => key.startsWith('user:'))
      .map(key => key.slice('user:'.length))
  )]
  const articles = userIds.length
    ? await prisma.practiceArticle.findMany({
        where: { learnerId, id: { in: userIds } },
        select: { id: true, title: true }
      })
    : []
  const titles = new Map(articles.map(article => [`user:${article.id}`, article.title]))
  for (const article of builtinArticles) titles.set(`builtin:${article.key}`, article.title)

  const visible = due.filter(card => titles.has(card.articleKey))
  const sentences = visible.slice(0, count).map(card => viewSentence(
    card.articleKey,
    titles.get(card.articleKey) || '短文',
    card.sentenceIndex,
    card.text,
    card.translation,
    card
  ))
  return { total: visible.length, sentences }
}

export async function submitSentenceAnswer(
  learnerId: string,
  articleKey: string,
  sentenceIndex: number,
  isCorrect: boolean
) {
  if (!articleKey || !Number.isInteger(sentenceIndex) || sentenceIndex < 0) throw new Error('BAD_INPUT')
  const parsed = articleKeyFor(articleKey)
  if (parsed.builtinKey && !findBuiltinArticle(parsed.builtinKey)) throw new Error('NOT_FOUND')
  if (parsed.userId) {
    const article = await prisma.practiceArticle.findFirst({
      where: { id: parsed.userId, learnerId },
      select: { id: true }
    })
    if (!article) throw new Error('NOT_FOUND')
  }
  const row = await prisma.articleSentenceCard.findUnique({
    where: {
      learnerId_articleKey_sentenceIndex: {
        learnerId,
        articleKey: parsed.key,
        sentenceIndex
      }
    }
  })
  if (!row) throw new Error('NOT_FOUND')
  const fields = scheduleCard(cardInputFrom(row), isCorrect)
  const updated = await prisma.articleSentenceCard.update({
    where: {
      learnerId_articleKey_sentenceIndex: {
        learnerId,
        articleKey: parsed.key,
        sentenceIndex
      }
    },
    data: fields
  })
  return {
    articleKey: updated.articleKey,
    sentenceIndex: updated.sentenceIndex,
    due: updated.due,
    fsrsState: updated.fsrsState,
    practiceCount: updated.practiceCount,
    recentLapse: updated.recentLapse
  }
}
