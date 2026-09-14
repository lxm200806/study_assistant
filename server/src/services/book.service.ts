import prisma from '../prisma/client'
import { vocabularyBooks } from '../data/vocabulary'
import { collectBookWordEntries } from '../data/vocabulary/book-entries'
import { resolveSense } from '../data/vocabulary/senses'
import { resolveWordTaxonomy } from '../data/taxonomy/word-tags'
import { formatBookWord } from '../utils/wordFormat'

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

export async function initBooks() {
  try {
    await migrateLegacyBookCodes()
    for (const bookData of vocabularyBooks) {
      const entries = collectBookWordEntries(bookData.words)
      let book = await prisma.book.findUnique({
        where: { code: bookData.code }
      })

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

        let word = await prisma.vocabulary.findUnique({
          where: { word: entry.word }
        })

        const wordFields = {
          meaning: sense.meaning,
          phonetic: sense.phonetic || entry.phonetic,
          englishMeaning: sense.englishMeaning || entry.englishMeaning,
          exampleSentence: entry.examples[0] || word?.exampleSentence || '',
          imageUrl: entry.emoji || word?.imageUrl || null,
          contentType: taxonomy.contentType,
          topic: taxonomy.topic,
          tags: [...new Set([...(taxonomy.tags || []), ...entry.tags])],
          senseKey: '',
          senseLabel: ''
        }

        if (!word) {
          word = await prisma.vocabulary.create({
            data: {
              word: entry.word,
              ...wordFields
            }
          })
        } else {
          word = await prisma.vocabulary.update({
            where: { id: word.id },
            data: wordFields
          })
        }

        await prisma.bookVocabulary.upsert({
          where: {
            bookId_wordId: {
              bookId: book.id,
              wordId: word.id
            }
          },
          create: {
            bookId: book.id,
            wordId: word.id,
            sortOrder: i,
            meaning: entry.meaning || sense.meaning,
            englishMeaning: entry.englishMeaning || sense.englishMeaning,
            exampleSentences: entry.examples
          },
          update: {
            sortOrder: i,
            meaning: entry.meaning || sense.meaning,
            englishMeaning: entry.englishMeaning || sense.englishMeaning,
            exampleSentences: entry.examples
          }
        })

        linkedWordIds.push(word.id)
      }

      await prisma.bookVocabulary.deleteMany({
        where: {
          bookId: book.id,
          wordId: { notIn: linkedWordIds }
        }
      })

      console.log(`Book ${bookData.name} synced with ${entries.length} words`)
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
  const book = await getBookByCode(bookCode)

  if (!book) {
    throw new Error('Book not found')
  }

  const shuffled = [...book.vocabulary].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map(bv => formatBookWord(bv))
}
