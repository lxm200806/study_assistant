import prisma from '../prisma/client'
import {
  parseListDocument,
  partitionKnownSpellings,
  type ListEntry,
  type RejectedToken
} from './typing-logic'

const LIST_TEXT_LIMIT = 20_000
const NAME_LIMIT = 40

function cleanName(value: unknown, fallback: string): string {
  const name = String(value || '').trim().slice(0, NAME_LIMIT)
  return name || fallback
}

async function fillOwnedLexical(
  word: {
    id: string
    meaning: string
    phonetic: string | null
    phoneticUk: string | null
    phoneticUs: string | null
    synonyms: string
    roots: string
    etymology: string
    phrases: string
    ownerLearnerId: string | null
  },
  entry: ListEntry
) {
  if (word.ownerLearnerId !== null && word.ownerLearnerId !== undefined) {
    const data: {
      meaning?: string
      phonetic?: string
      phoneticUk?: string
      phoneticUs?: string
      synonyms?: string
      roots?: string
      etymology?: string
      phrases?: string
    } = {}
    if (!word.meaning && entry.gloss) data.meaning = entry.gloss
    if (!word.phoneticUk && entry.phoneticUk) data.phoneticUk = entry.phoneticUk
    if (!word.phoneticUs && entry.phoneticUs) data.phoneticUs = entry.phoneticUs
    if (!word.synonyms && entry.synonyms) data.synonyms = entry.synonyms
    if (!word.roots && entry.roots) data.roots = entry.roots
    if (!word.etymology && entry.etymology) data.etymology = entry.etymology
    if (!word.phrases && entry.phrases) data.phrases = entry.phrases
    if (Object.keys(data).length === 0) return
    if (word.ownerLearnerId) {
      await prisma.vocabulary.update({ where: { id: word.id }, data })
    }
  }
}

async function resolveListEntries(learnerId: string, entries: ListEntry[]) {
  const spellings = entries.map(entry => entry.spelling)
  const found = spellings.length
    ? await prisma.vocabulary.findMany({
        where: { word: { in: spellings } }
      })
    : []
  const knownIds = new Map(found.map(word => [word.word.toLowerCase(), word.id]))
  const knownById = new Map(found.map(word => [word.id, word]))
  const { linked, unknown } = partitionKnownSpellings(entries, knownIds)
  const rejected: RejectedToken[] = []
  const created: string[] = []
  const wordIds = new Map<string, string>()

  for (const entry of linked) {
    wordIds.set(entry.spelling, entry.wordId)
    const word = knownById.get(entry.wordId)
    if (word?.ownerLearnerId === learnerId) await fillOwnedLexical(word, entry)
  }

  for (const entry of unknown) {
    try {
      const word = await prisma.vocabulary.create({
        data: {
          word: entry.spelling,
          meaning: entry.gloss || '',
          phoneticUk: entry.phoneticUk || null,
          phoneticUs: entry.phoneticUs || null,
          synonyms: entry.synonyms,
          roots: entry.roots,
          etymology: entry.etymology,
          phrases: entry.phrases,
          ownerLearnerId: learnerId,
          englishMeaning: ''
        }
      })
      created.push(entry.spelling)
      wordIds.set(entry.spelling, word.id)
    } catch {
      const again = await prisma.vocabulary.findFirst({
        where: { word: entry.spelling }
      })
      if (again) wordIds.set(entry.spelling, again.id)
      else rejected.push({ token: entry.spelling, reason: 'save_failed' })
    }
  }

  const items = entries.flatMap(entry => {
    const wordId = wordIds.get(entry.spelling)
    return wordId ? [{ ...entry, wordId }] : []
  })
  return { items, linked: linked.length, created, rejected }
}

export async function ensureListItems(learnerId: string, listId: string, source: string) {
  const existing = await prisma.practiceListItem.findMany({
    where: { listId },
    include: { word: true },
    orderBy: { position: 'asc' }
  })
  if (existing.length) return { items: existing, rejected: [] as RejectedToken[] }
  const parsed = parseListDocument(source)
  const resolved = await resolveListEntries(learnerId, parsed.entries)
  if (resolved.items.length) {
    await prisma.practiceListItem.createMany({
      skipDuplicates: true,
      data: resolved.items.map((item, position) => ({
        listId,
        position,
        spelling: item.spelling,
        gloss: item.gloss,
        wordId: item.wordId,
        synonyms: item.synonyms,
        roots: item.roots,
        etymology: item.etymology,
        phrases: item.phrases,
        phoneticUk: item.phoneticUk,
        phoneticUs: item.phoneticUs
      }))
    })
  }
  const items = await prisma.practiceListItem.findMany({
    where: { listId },
    include: { word: true },
    orderBy: { position: 'asc' }
  })
  return { items, rejected: [...parsed.rejected, ...resolved.rejected] }
}

export async function listPracticeLists(learnerId: string) {
  const rows = await prisma.practiceList.findMany({
    where: { learnerId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { items: true } } }
  })
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    count: row._count.items || parseListDocument(row.source).entries.length,
    createdAt: row.createdAt
  }))
}

export async function createPracticeList(learnerId: string, name: unknown, text: unknown) {
  const source = String(text || '').trim()
  if (!source || source.length > LIST_TEXT_LIMIT) throw new Error('BAD_INPUT')
  const parsed = parseListDocument(source)
  if (!parsed.entries.length) {
    const error = new Error('BAD_INPUT') as Error & { rejected?: RejectedToken[] }
    error.rejected = parsed.rejected
    throw error
  }
  const resolved = await resolveListEntries(learnerId, parsed.entries)
  const rejected = [...parsed.rejected, ...resolved.rejected]
  if (!resolved.items.length) {
    const error = new Error('BAD_INPUT') as Error & { rejected?: RejectedToken[] }
    error.rejected = rejected
    throw error
  }
  const row = await prisma.practiceList.create({
    data: {
      learnerId,
      name: cleanName(name, '我的词表'),
      source,
      items: {
        create: resolved.items.map((item, position) => ({
          position,
          spelling: item.spelling,
          gloss: item.gloss,
          wordId: item.wordId,
          synonyms: item.synonyms,
          roots: item.roots,
          etymology: item.etymology,
          phrases: item.phrases,
          phoneticUk: item.phoneticUk,
          phoneticUs: item.phoneticUs
        }))
      }
    }
  })
  return {
    id: row.id,
    name: row.name,
    count: resolved.items.length,
    linked: resolved.linked,
    created: resolved.created,
    matched: resolved.linked,
    missing: resolved.rejected.map(item => item.token),
    rejected
  }
}

export async function deletePracticeList(learnerId: string, id: string) {
  const row = await prisma.practiceList.findFirst({ where: { id, learnerId } })
  if (!row) throw new Error('NOT_FOUND')
  await prisma.practiceList.delete({ where: { id } })
}
