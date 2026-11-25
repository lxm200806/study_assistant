import prisma from '../prisma/client'
import { createHash } from 'crypto'
import { VOCABULARY_BOOK_CODES, isFreeBookCode, loadBook } from '../data/vocabulary'
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
  kew1: 'kew1200',
  kew2: 'kew1200',
  kew3: 'kew1200',
  'kew1200-1': 'kew1200',
  'kew1200-2': 'kew1200',
  'kew1200-3': 'kew1200',
  'kew4500-1': 'kew4500',
  'kew4500-2': 'kew4500',
  'kew4500-3': 'kew4500',
  'kew4500-4': 'kew4500',
  'kew7200-1': 'kew7200',
  'kew7200-2': 'kew7200',
  'kew7200-3': 'kew7200',
  ket: 'mse-ket',
  pet: 'mse-pet'
}

async function absorbBookInto(fromId: string, toId: string, fromCode: string, toCode: string) {
  const oldProgress = await prisma.bookStudyProgress.findMany({ where: { bookId: fromId } })
  for (const row of oldProgress) {
    const existing = await prisma.bookStudyProgress.findUnique({
      where: { learnerId_bookId: { learnerId: row.learnerId, bookId: toId } }
    })
    if (existing) {
      const merged = [...new Set([...existing.practicedWordIds, ...row.practicedWordIds])]
      await prisma.bookStudyProgress.update({
        where: { id: existing.id },
        data: {
          practicedWordIds: merged,
          cycleStartedAt:
            existing.cycleStartedAt < row.cycleStartedAt ? existing.cycleStartedAt : row.cycleStartedAt
        }
      })
      await prisma.bookStudyProgress.delete({ where: { id: row.id } })
    } else {
      await prisma.bookStudyProgress.update({
        where: { id: row.id },
        data: { bookId: toId }
      })
    }
  }

  const oldUnlocks = await prisma.userBookUnlock.findMany({ where: { bookId: fromId } })
  for (const row of oldUnlocks) {
    const existing = await prisma.userBookUnlock.findUnique({
      where: { userId_bookId: { userId: row.userId, bookId: toId } }
    })
    if (existing) {
      await prisma.userBookUnlock.delete({ where: { id: row.id } })
    } else {
      await prisma.userBookUnlock.update({
        where: { id: row.id },
        data: { bookId: toId }
      })
    }
  }

  await prisma.bookVocabulary.deleteMany({ where: { bookId: fromId } })
  await prisma.book.delete({ where: { id: fromId } })
  console.log(`Merged book ${fromCode} → ${toCode}`)
}

async function migrateLegacyBookCodes() {
  for (const [from, to] of Object.entries(BOOK_CODE_RENAMES)) {
    const oldBook = await prisma.book.findUnique({ where: { code: from } })
    if (!oldBook) continue
    const taken = await prisma.book.findUnique({ where: { code: to } })
    if (taken) {
      await absorbBookInto(oldBook.id, taken.id, from, to)
      continue
    }
    await prisma.book.update({ where: { id: oldBook.id }, data: { code: to } })
    console.log(`Renamed book code ${from} → ${to}`)
  }
}

export async function syncBookByCode(code: string, opts?: { force?: boolean }) {
  const bookData = loadBook(code)
  if (!bookData) {
    console.warn(`Skip sync: book JSON not found for ${code}`)
    return
  }

  const entries = collectBookWordEntries(bookData.words)
  const contentHash = createHash('sha256')
    .update(
      JSON.stringify({
        name: bookData.name,
        description: bookData.description || '',
        level: bookData.level,
        entries
      })
    )
    .digest('hex')
  let book = await prisma.book.findUnique({ where: { code: bookData.code } })

  // 内容指纹一致才跳过全量重写，避免每次启动卡死 API
  if (book && !opts?.force) {
    const linked = await prisma.bookVocabulary.count({ where: { bookId: book.id } })
    const countsMatch = book.wordCount === entries.length && linked === entries.length
    if (countsMatch && book.contentHash === contentHash) {
      console.log(`Skip sync ${bookData.code}: unchanged (${entries.length} words)`)
      return
    }
    if (countsMatch && !book.contentHash) {
      // 历史数据没有指纹：补写一次，后续按内容变化决定是否重写
      await prisma.book.update({
        where: { id: book.id },
        data: {
          name: bookData.name,
          description: bookData.description,
          level: bookData.level,
          isFree: isFreeBookCode(bookData.code) ? true : book.isFree,
          contentHash
        }
      })
      console.log(`Adopt sync fingerprint ${bookData.code}: ${entries.length} words`)
      return
    }
  }

  if (!book) {
    console.log(`Creating book: ${bookData.name}`)
    book = await prisma.book.create({
      data: {
        name: bookData.name,
        code: bookData.code,
        description: bookData.description,
        level: bookData.level,
        wordCount: entries.length,
        isFree: isFreeBookCode(bookData.code)
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
        isFree: isFreeBookCode(bookData.code) ? true : book.isFree
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
    const senseExamples = [sense.exampleSentence, sense.examExample].filter(
      (ex): ex is string => !!ex && !isPlaceholderExample(ex, entry.word)
    )
    const examplesForBook = bookExamples.length
      ? bookExamples
      : senseExamples.length
        ? senseExamples
        : entry.examples.slice(0, 1)

    let word = await prisma.vocabulary.findUnique({ where: { word: entry.word } })

    const wordFields = {
      meaning: sense.meaning || entry.meaning,
      phonetic: sense.phonetic || entry.phonetic,
      englishMeaning: sense.englishMeaning || entry.englishMeaning,
      exampleSentence: preferExample(entry.word, word?.exampleSentence, [
        sense.exampleSentence || '',
        ...examplesForBook
      ]),
      imageUrl: entry.emoji || word?.imageUrl || null,
      contentType: taxonomy.contentType || sense.contentType || word?.contentType || null,
      topic: preferTopic(word?.topic, taxonomy.topic || sense.topic),
      tags: [...new Set([...(word?.tags || []), ...(taxonomy.tags || []), ...entry.tags])],
      senseKey: entry.senseKey || '',
      senseLabel: entry.senseLabel || ''
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
        meaning: sense.meaning || entry.meaning,
        englishMeaning: sense.englishMeaning || entry.englishMeaning,
        exampleSentences: examplesForBook
      },
      update: {
        sortOrder: i,
        meaning: sense.meaning || entry.meaning,
        englishMeaning: sense.englishMeaning || entry.englishMeaning,
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

  await prisma.book.update({ where: { id: book.id }, data: { contentHash } })
  console.log(`Book ${bookData.name} synced with ${entries.length} words`)
}

export async function initBooks(onlyCodes?: string[], opts?: { force?: boolean }) {
  try {
    await migrateLegacyBookCodes()
  } catch (error) {
    console.error('Error migrating legacy book codes:', error)
  }

  const codes = onlyCodes?.length ? onlyCodes : [...VOCABULARY_BOOK_CODES]
  const failures: Array<{ code: string; error: unknown }> = []

  for (const code of codes) {
    try {
      await syncBookByCode(code, opts)
    } catch (error) {
      failures.push({ code, error })
      console.error(`Error syncing book ${code}:`, error)
    }
  }

  if (failures.length > 0) {
    console.error(
      `Book sync finished with ${failures.length} failure(s): ${failures.map(item => item.code).join(', ')}`
    )
  }

  return { total: codes.length, synced: codes.length - failures.length, failures }
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
      name: meta?.name || book.name,
      wordCount: book.wordCount,
      description: meta?.description || book.description
    }
  })
}

export async function getBookMetaByCode(code: string) {
  return prisma.book.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      level: true,
      wordCount: true,
      isFree: true
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
