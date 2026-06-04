import prisma from '../prisma/client'
import { vocabularyBooks } from '../data/vocabulary'
import { resolveWordTaxonomy } from '../data/taxonomy/word-tags'

export async function initBooks() {
  try {
    for (const bookData of vocabularyBooks) {
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
            wordCount: bookData.words.length
          }
        })
      } else {
        await prisma.book.update({
          where: { id: book.id },
          data: {
            name: bookData.name,
            description: bookData.description,
            level: bookData.level,
            wordCount: bookData.words.length
          }
        })
      }

      const linkedWordIds: string[] = []

      for (let i = 0; i < bookData.words.length; i++) {
        const wordData = bookData.words[i]
        const taxonomy = resolveWordTaxonomy(wordData.word, {
          contentType: wordData.contentType,
          topic: wordData.topic,
          tags: wordData.tags
        })

        const linked = await prisma.bookVocabulary.findFirst({
          where: {
            bookId: book.id,
            word: { word: wordData.word }
          },
          include: { word: true },
          orderBy: { sortOrder: 'asc' }
        })

        const existingWords = await prisma.vocabulary.findMany({
          where: { word: wordData.word },
          orderBy: { createdAt: 'asc' }
        })

        let word = linked?.word ?? existingWords[0]

        if (!word) {
          word = await prisma.vocabulary.create({
            data: {
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
          })
        } else {
          word = await prisma.vocabulary.update({
            where: { id: word.id },
            data: {
              meaning: wordData.meaning,
              phonetic: wordData.phonetic,
              englishMeaning: wordData.englishMeaning,
              exampleSentence: wordData.exampleSentence,
              imageUrl: wordData.emoji || word.imageUrl,
              contentType: taxonomy.contentType,
              topic: taxonomy.topic,
              tags: taxonomy.tags || []
            }
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
            sortOrder: i
          },
          update: {
            sortOrder: i
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

      console.log(`Book ${bookData.name} synced with ${bookData.words.length} words`)
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

  const words = book.vocabulary.map(bv => bv.word)
  const shuffled = words.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
