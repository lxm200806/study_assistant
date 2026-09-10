import prisma from '../prisma/client'
import { vocabularyBooks } from '../data/vocabulary'
import { resolveWordTaxonomy } from '../data/taxonomy/word-tags'
import type { WordData } from '../data/vocabulary/types'

const WRITE_CHUNK = 200

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function sameTags(a: string[] | null | undefined, b: string[] | null | undefined) {
  const left = a || []
  const right = b || []
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

export async function initBooks() {
  try {
    for (const bookData of vocabularyBooks) {
      const started = Date.now()
      const book = await prisma.book.upsert({
        where: { code: bookData.code },
        create: {
          name: bookData.name,
          code: bookData.code,
          description: bookData.description,
          level: bookData.level,
          wordCount: bookData.words.length,
          isFree: bookData.code === 'ket'
        },
        update: {
          name: bookData.name,
          description: bookData.description,
          level: bookData.level,
          wordCount: bookData.words.length,
          ...(bookData.code === 'ket' ? { isFree: true } : {})
        }
      })

      const desired = new Map<string, { sortOrder: number; payload: ReturnType<typeof buildWordPayload> }>()
      bookData.words.forEach((wordData, index) => {
        const key = wordData.word
        const existing = desired.get(key)
        if (existing) {
          existing.sortOrder = index
          return
        }
        desired.set(key, { sortOrder: index, payload: buildWordPayload(wordData) })
      })

      const uniqueWords = [...desired.keys()]
      const existingRows = uniqueWords.length
        ? await prisma.vocabulary.findMany({
            where: { word: { in: uniqueWords } },
            orderBy: { createdAt: 'asc' }
          })
        : []

      const byWord = new Map<string, (typeof existingRows)[number]>()
      for (const row of existingRows) {
        if (!byWord.has(row.word)) byWord.set(row.word, row)
      }

      const toCreate = uniqueWords
        .filter(word => !byWord.has(word))
        .map(word => desired.get(word)!.payload)

      for (const group of chunk(toCreate, WRITE_CHUNK)) {
        await prisma.vocabulary.createMany({ data: group })
      }

      if (toCreate.length > 0) {
        const created = await prisma.vocabulary.findMany({
          where: { word: { in: toCreate.map(item => item.word) } },
          orderBy: { createdAt: 'asc' }
        })
        for (const row of created) {
          if (!byWord.has(row.word)) byWord.set(row.word, row)
        }
      }

      const updates = uniqueWords.flatMap(word => {
        const row = byWord.get(word)
        const next = desired.get(word)!.payload
        if (!row) return []
        const unchanged =
          row.meaning === next.meaning &&
          (row.phonetic || '') === (next.phonetic || '') &&
          (row.englishMeaning || '') === (next.englishMeaning || '') &&
          (row.exampleSentence || '') === (next.exampleSentence || '') &&
          (row.contentType || '') === (next.contentType || '') &&
          (row.topic || '') === (next.topic || '') &&
          sameTags(row.tags, next.tags)
        if (unchanged) return []
        return [prisma.vocabulary.update({
          where: { id: row.id },
          data: {
            meaning: next.meaning,
            phonetic: next.phonetic,
            englishMeaning: next.englishMeaning,
            exampleSentence: next.exampleSentence,
            imageUrl: next.imageUrl || row.imageUrl,
            contentType: next.contentType,
            topic: next.topic,
            tags: next.tags
          }
        })]
      })

      for (const group of chunk(updates, WRITE_CHUNK)) {
        await prisma.$transaction(group)
      }

      const linkedWordIds = uniqueWords.map(word => byWord.get(word)!.id)
      const existingLinks = await prisma.bookVocabulary.findMany({
        where: { bookId: book.id },
        select: { wordId: true, sortOrder: true }
      })
      const linkByWordId = new Map(existingLinks.map(link => [link.wordId, link.sortOrder]))
      const desiredSort = new Map(uniqueWords.map(word => [byWord.get(word)!.id, desired.get(word)!.sortOrder]))

      const linksToCreate = linkedWordIds
        .filter(wordId => !linkByWordId.has(wordId))
        .map(wordId => ({
          bookId: book.id,
          wordId,
          sortOrder: desiredSort.get(wordId) || 0
        }))
      for (const group of chunk(linksToCreate, WRITE_CHUNK)) {
        await prisma.bookVocabulary.createMany({ data: group })
      }

      const sortUpdates = linkedWordIds
        .filter(wordId => linkByWordId.has(wordId) && linkByWordId.get(wordId) !== desiredSort.get(wordId))
        .map(wordId => prisma.bookVocabulary.update({
          where: { bookId_wordId: { bookId: book.id, wordId } },
          data: { sortOrder: desiredSort.get(wordId) || 0 }
        }))
      for (const group of chunk(sortUpdates, WRITE_CHUNK)) {
        await prisma.$transaction(group)
      }

      await prisma.bookVocabulary.deleteMany({
        where: {
          bookId: book.id,
          wordId: { notIn: linkedWordIds }
        }
      })

      console.log(
        `Book ${bookData.name} synced with ${bookData.words.length} words in ${Date.now() - started}ms`
      )
    }
  } catch (error) {
    console.error('Error initializing books:', error)
  }
}

function buildWordPayload(wordData: WordData) {
  const taxonomy = resolveWordTaxonomy(wordData.word, {
    contentType: wordData.contentType,
    topic: wordData.topic,
    tags: wordData.tags
  })
  return {
    word: wordData.word,
    meaning: wordData.meaning,
    phonetic: wordData.phonetic,
    englishMeaning: wordData.englishMeaning,
    exampleSentence: wordData.exampleSentence,
    imageUrl: wordData.emoji || null,
    contentType: taxonomy.contentType,
    topic: taxonomy.topic,
    tags: taxonomy.tags || []
  }
}

export async function getBooks() {
  const books = await prisma.book.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      level: true,
      wordCount: true,
      isFree: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  })

  return books.map(book => {
    const meta = vocabularyBooks.find(b => b.code === book.code)
    return {
      ...book,
      wordCount: book.wordCount,
      description: meta?.description || book.description
    }
  })
}

export async function getBookByCode(code: string) {
  return prisma.book.findUnique({
    where: { code },
    include: {
      vocabulary: {
        include: {
          word: true
        },
        orderBy: { sortOrder: 'asc' }
      }
    }
  })
}

export async function getRandomWordsFromBook(bookCode: string, count: number = 10) {
  const book = await prisma.book.findUnique({
    where: { code: bookCode },
    select: { id: true }
  })

  if (!book) {
    throw new Error('Book not found')
  }

  const take = Math.min(Math.max(Number(count) || 10, 1), 100)
  const rows = await prisma.$queryRaw<Array<{ wordId: string }>>`
    SELECT "wordId" FROM "BookVocabulary"
    WHERE "bookId" = ${book.id}
    ORDER BY RANDOM()
    LIMIT ${take}
  `
  if (rows.length === 0) return []

  const words = await prisma.vocabulary.findMany({
    where: { id: { in: rows.map(row => row.wordId) } }
  })
  const byId = new Map(words.map(word => [word.id, word]))
  return rows.map(row => byId.get(row.wordId)).filter((word): word is NonNullable<typeof word> => !!word)
}
