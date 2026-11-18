/**
 * 字段合并：词书 gloss > 全局词典 > 已有成书/默认
 */
import { asFlatSense, type GlobalSense } from '../../src/data/vocabulary/senses'
import type {
  CefrLevel,
  ContentType,
  TopicCategory,
  WordData,
  WordExample,
  WordSources
} from '../../src/data/vocabulary/types'
import { normalizeTopic } from '../../src/data/taxonomy'
import type { KewGloss } from './kew-gloss'

export interface MergedLexiconFields {
  meaning: string
  englishMeaning: string
  phonetic: string
  exampleSentence: string
  exampleSentenceZh: string
  examExample: string
  examExampleZh: string
  topic: TopicCategory
  cefr: string
  contentType: string
  pos?: string
  sources: Partial<WordSources> & {
    meaning: string
    englishMeaning: string
    phonetic: string
    example: string
  }
}

export function mergeLexiconFields(opts: {
  gloss?: KewGloss | null
  global?: GlobalSense | null
  existing?: Partial<WordData> | null
  defaultSources: {
    list: string
    editor: string
    englishMeaning: string
    meaning?: string
  }
}): MergedLexiconFields {
  const { gloss, global, existing, defaultSources } = opts
  const g = asFlatSense(global || undefined)

  const pick = (
    glossVal: string | undefined,
    globalVal: string | undefined,
    existingVal: string | undefined,
    glossSrc: string,
    globalSrc: string,
    fallbackSrc: string
  ) => {
    if (glossVal?.trim()) return { value: glossVal.trim(), source: glossSrc }
    if (globalVal?.trim()) return { value: globalVal.trim(), source: globalSrc }
    if (existingVal?.trim()) return { value: existingVal.trim(), source: fallbackSrc }
    return { value: '', source: fallbackSrc }
  }

  const meaning = pick(
    gloss?.meaning,
    g.meaning,
    existing?.meaning,
    defaultSources.meaning || defaultSources.editor,
    g.origin || 'lexicon',
    'fallback'
  )
  const english = pick(
    gloss?.englishMeaning,
    g.englishMeaning,
    existing?.englishMeaning,
    defaultSources.englishMeaning,
    g.origin || 'lexicon',
    'fallback'
  )
  const phonetic = pick(
    gloss?.phonetic,
    g.phonetic,
    existing?.phonetic,
    defaultSources.editor,
    g.origin || 'lexicon',
    'fallback'
  )
  const example = pick(
    gloss?.exampleSentence,
    g.exampleSentence,
    existing?.exampleSentence,
    defaultSources.editor,
    g.origin || 'lexicon',
    'fallback'
  )
  const exampleZh = pick(
    gloss?.exampleSentenceZh,
    g.exampleSentenceZh,
    undefined,
    defaultSources.editor,
    g.origin || 'lexicon',
    'fallback'
  )
  const exam = pick(
    gloss?.examExample,
    g.examExample,
    existing?.examples?.find(e => e.role === 'exam')?.en,
    defaultSources.editor,
    g.origin || 'lexicon',
    'fallback'
  )
  const examZh = pick(
    gloss?.examExampleZh,
    g.examExampleZh,
    existing?.examples?.find(e => e.role === 'exam')?.zh,
    defaultSources.editor,
    g.origin || 'lexicon',
    'fallback'
  )
  const topicRaw = pick(
    gloss?.topic as string | undefined,
    g.topic,
    existing?.topic,
    defaultSources.editor,
    g.origin || 'lexicon',
    'taxonomy'
  )
  const cefr = pick(
    gloss?.cefr as string | undefined,
    g.cefr,
    existing?.cefr,
    defaultSources.editor,
    g.origin || 'lexicon',
    'fallback'
  )
  const contentType = pick(
    gloss?.contentType as string | undefined,
    g.contentType,
    existing?.contentType,
    defaultSources.editor,
    g.origin || 'lexicon',
    'taxonomy'
  )

  const topic = normalizeTopic(topicRaw.value || existing?.topic || 'uncategorized')

  return {
    meaning: meaning.value,
    englishMeaning: english.value,
    phonetic: phonetic.value,
    exampleSentence: example.value,
    exampleSentenceZh: exampleZh.value,
    examExample: exam.value,
    examExampleZh: examZh.value,
    topic,
    cefr: cefr.value,
    contentType: contentType.value,
    pos: g.pos,
    sources: {
      list: defaultSources.list,
      meaning: meaning.source,
      englishMeaning: english.source,
      phonetic: phonetic.source,
      example: example.source,
      ...(exam.value ? { examExample: exam.source } : {}),
      ...(topicRaw.value ? { topic: topicRaw.source } : {}),
      ...(cefr.value ? { cefr: cefr.source } : {})
    }
  }
}

export function buildExamplesFromMerged(
  merged: MergedLexiconFields,
  existing?: WordExample[]
): WordExample[] {
  const examples: WordExample[] = []
  if (merged.exampleSentence) {
    examples.push({
      en: merged.exampleSentence,
      ...(merged.exampleSentenceZh ? { zh: merged.exampleSentenceZh } : {}),
      role: 'basic',
      source: merged.sources.example
    })
  }
  if (merged.examExample) {
    examples.push({
      en: merged.examExample,
      ...(merged.examExampleZh ? { zh: merged.examExampleZh } : {}),
      role: 'exam',
      source: merged.sources.examExample || 'lexicon'
    })
  }
  for (const ex of existing || []) {
    if (ex.role === 'sense' && ex.en?.trim()) {
      if (!examples.some(e => e.en.trim().toLowerCase() === ex.en.trim().toLowerCase())) {
        examples.push(ex)
      }
    }
  }
  return examples
}

export function applyMergedToWord(item: WordData, merged: MergedLexiconFields): WordData {
  const examples = buildExamplesFromMerged(merged, item.examples)
  const topic = merged.topic
  const next: WordData = {
    ...item,
    meaning: merged.meaning || item.meaning,
    englishMeaning: merged.englishMeaning || item.englishMeaning,
    phonetic: merged.phonetic || item.phonetic,
    exampleSentence: merged.exampleSentence || item.exampleSentence,
    exampleSentences: examples.map(e => e.en),
    examples,
    topic,
    topics: [topic],
    sources: {
      list: merged.sources.list,
      meaning: merged.sources.meaning,
      phonetic: merged.sources.phonetic,
      englishMeaning: merged.sources.englishMeaning,
      example: merged.sources.example,
      examExample: merged.sources.examExample,
      topic: merged.sources.topic,
      cefr: merged.sources.cefr
    }
  }
  if (merged.cefr) next.cefr = merged.cefr as CefrLevel
  if (merged.contentType) next.contentType = merged.contentType as ContentType
  return next
}
