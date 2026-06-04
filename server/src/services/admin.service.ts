import prisma from '../prisma/client'
import { getBookByCode } from './book.service'
import { classifyVocabularyIssue, type VocabularyIssueType } from '../utils/word-quality'

function countIssues(
  words: Array<{ word: string; meaning: string; englishMeaning: string | null }>
) {
  let missingCount = 0
  let parseErrorCount = 0
  for (const w of words) {
    const issue = classifyVocabularyIssue(w.word, w.meaning, w.englishMeaning)
    if (issue === 'missing_cn') missingCount++
    else if (issue === 'parse_error') parseErrorCount++
  }
  return { missingCount, parseErrorCount }
}

export async function getMissingMeaningSummary() {
  const books = await prisma.book.findMany({
    orderBy: { code: 'asc' },
    include: {
      vocabulary: {
        include: { word: true }
      }
    }
  })

  return books.map(book => {
    const words = book.vocabulary.map(bv => bv.word)
    const { missingCount, parseErrorCount } = countIssues(words)
    return {
      bookCode: book.code,
      bookName: book.name,
      wordCount: book.wordCount,
      missingCount,
      parseErrorCount,
      issueCount: missingCount + parseErrorCount
    }
  })
}

export async function getMissingMeaningWords(
  bookCode?: string,
  page: number = 1,
  limit: number = 50,
  issueType?: VocabularyIssueType
) {
  const skip = (page - 1) * limit

  const filterWord = (w: { word: string; meaning: string; englishMeaning: string | null }) => {
    const issue = classifyVocabularyIssue(w.word, w.meaning, w.englishMeaning)
    if (!issue) return false
    if (issueType) return issue === issueType
    return true
  }

  if (bookCode) {
    const book = await getBookByCode(bookCode)
    if (!book) {
      throw new Error('Book not found')
    }

    const all = book.vocabulary
      .map(bv => bv.word)
      .filter(filterWord)
      .sort((a, b) => a.word.localeCompare(b.word))

    const slice = all.slice(skip, skip + limit)
    return {
      bookCode,
      bookName: book.name,
      total: all.length,
      page,
      limit,
      words: slice.map(w => ({
        id: w.id,
        word: w.word,
        meaning: w.meaning,
        englishMeaning: w.englishMeaning,
        phonetic: w.phonetic,
        issueType: classifyVocabularyIssue(w.word, w.meaning, w.englishMeaning)
      }))
    }
  }

  const books = await prisma.book.findMany({
    orderBy: { code: 'asc' },
    include: {
      vocabulary: {
        include: { word: true },
        orderBy: { sortOrder: 'asc' }
      }
    }
  })

  const allMissing = books.flatMap(book =>
    book.vocabulary
      .filter(bv => filterWord(bv.word))
      .map(bv => ({
        bookCode: book.code,
        bookName: book.name,
        id: bv.word.id,
        word: bv.word.word,
        meaning: bv.word.meaning,
        englishMeaning: bv.word.englishMeaning,
        phonetic: bv.word.phonetic,
        issueType: classifyVocabularyIssue(bv.word.word, bv.word.meaning, bv.word.englishMeaning)
      }))
  )

  const slice = allMissing.slice(skip, skip + limit)
  return {
    total: allMissing.length,
    page,
    limit,
    words: slice
  }
}
