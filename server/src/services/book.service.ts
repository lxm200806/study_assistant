import prisma from '../prisma/client'
import { VOCABULARY_BOOK_CODES, loadBook } from '../data/vocabulary'
import { collectBookWordEntries } from '../data/vocabulary/book-entries'
import { resolveSense } from '../data/vocabulary/senses'
import { isWeakTopic, normalizeTopic } from '../data/taxonomy'
import { resolveWordTaxonomy } from '../data/taxonomy/word-tags'
import { formatBookWord, isPlaceholderExample } from '../utils/wordFormat'

/** 全局词行主题：强主题不被弱主题覆盖，避免多书同步互相冲掉。 */
function preferTopic(existing: string | null | undefined, next: string | null | undefined): string {
  const a = normalizeTopic(existing)
  const b = normalizeTopic(next)
  if (isWeakTopic(a) && !isWeakTopic(b)) return b
  if (!isWeakTopic(a)) return a
  return b
}

function preferExample(
  spelling: string,
  existing: string | null | undefined,
  candidates: string[]
): string {
  const real = candidates.map(s => s.trim()).filter(s => s && !isPlaceholderExample(s, spelling))
  if (real[0]) return real[0]
  if (existing && !isPlaceholderExample(existing, spelling)) return existing
  return candidates.find(Boolean) || existing || ''
}

const BOOK_CODE_RENAMES: Record<string, string> = {
  kew1: 'kew1200-1',
  kew2: 'kew1200-2',
  kew3: 'kew1200-3',
  ket: 'mse-ket',
  pet: 'mse-pet'
}

async function migrateLegacyBookCodes() {
  for (const [from, to] of Object.entries(BOOK_CODE_RENAMES)) {
    const oldBook = await prisma.book.findUnique({ where: { code: from } })
    if (!oldBook) continue
    const taken = await prisma.book.findUnique({ where: { code: to } })
    if (taken) {
      console.warn(`Skip renaming ${from} → ${to}: target code already exists`)
      continue
    }
    await prisma.book.update({ where: { id: oldBook.id }, data: { code: to } })
    console.log(`Renamed book code ${from} → ${to}`)
  }
}

export async function syncBookByCode(code: string) {
  const bookData = loadBook(code)
  if (!bookData) {
    console.warn(`Skip sync: book JSON not found for ${code}`)
    return
  }

  const entries = collectBookWordEntries(bookData.words)
  let book = await prisma.book.findUnique({ where: { code: bookData.code } })

  if (!book) {
    console.log(`Creating book: ${bookData.name}`)
    book = await prisma.book.create({
      data: {
        name: bookData.name,
        code: bookData.code,
        description: bookData.description,
        level: bookData.level,
        wordCount: entries.length,
        isFree: bookData.code === 'mse-ket' || bookData.code === 'ket'
      }
    })
  } else {
    await prisma.book.update({
      where: { id: book.id },
      data: {
        name: bookData.name,
        description: bookData.description,
        level: bookData.level,
        wordCount: entries.length,
        isFree: bookData.code === 'mse-ket' || bookData.code === 'ket' ? true : book.isFree
      }
    })
  }

  const linkedWordIds: string[] = []

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const sense = resolveSense(entry.word, entry)
    const taxonomy = resolveWordTaxonomy(entry.word, {
      contentType: entry.contentType,
      topic: entry.topic,
      tags: entry.tags
    })
    const bookExamples = entry.examples.filter(ex => ex && !isPlaceholderExample(ex, entry.word))
    const examplesForBook = bookExamples.length ? bookExamples : entry.examples.slice(0, 1)

    let word = await prisma.vocabulary.findUnique({ where: { word: entry.word } })

    const wordFields = {
      meaning: sense.meaning,
      phonetic: sense.phonetic || entry.phonetic,
      englishMeaning: sense.englishMeaning || entry.englishMeaning,
      exampleSentence: preferExample(entry.word, word?.exampleSentence, [
        sense.exampleSentence || '',
        ...examplesForBook
      ]),
      imageUrl: entry.emoji || word?.imageUrl || null,
      contentType: taxonomy.contentType || word?.contentType || null,
      topic: preferTopic(word?.topic, taxonomy.topic),
      tags: [...new Set([...(word?.tags || []), ...(taxonomy.tags || []), ...entry.tags])],
      senseKey: '',
      senseLabel: ''
    }

    if (!word) {
      word = await prisma.vocabulary.create({
        data: { word: entry.word, ...wordFields }
      })
    } else {
      word = await prisma.vocabulary.update({
        where: { id: word.id },
        data: wordFields
      })
    }

    await prisma.bookVocabulary.upsert({
      where: { bookId_wordId: { bookId: book.id, wordId: word.id } },
      create: {
        bookId: book.id,
        wordId: word.id,
        sortOrder: i,
        meaning: entry.meaning || sense.meaning,
        englishMeaning: entry.englishMeaning || sense.englishMeaning,
        exampleSentences: examplesForBook
      },
      update: {
        sortOrder: i,
        meaning: entry.meaning || sense.meaning,
        englishMeaning: entry.englishMeaning || sense.englishMeaning,
        exampleSentences: examplesForBook
      }
    })

    linkedWordIds.push(word.id)
    if ((i + 1) % 500 === 0) {
      console.log(`  … ${bookData.code} ${i + 1}/${entries.length}`)
    }
  }

  await prisma.bookVocabulary.deleteMany({
    where: { bookId: book.id, wordId: { notIn: linkedWordIds } }
  })

  console.log(`Book ${bookData.name} synced with ${entries.length} words`)
}

export async function initBooks(onlyCodes?: string[]) {
  try {
    await migrateLegacyBookCodes()
    const codes = onlyCodes?.length ? onlyCodes : [...VOCABULARY_BOOK_CODES]
    for (const code of codes) {
      await syncBookByCode(code)
    }
  } catch (error) {
    console.error('Error initializing books:', error)
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
    const meta = loadBook(book.code)
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
  const book = await getBookByCode(bookCode)

  if (!book) {
    throw new Error('Book not found')
  }

  const shuffled = [...book.vocabulary].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map(bv => formatBookWord(bv))
}
