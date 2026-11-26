import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useTypingPresentation } from './useTypingPresentation'
import type {
  Answered,
  ArticleMode,
  ExamCard,
  ExamMode,
  SentenceItem,
  TypingWord,
  WordMode,
  WordPhase
} from './typing.types'

function word(overrides: Partial<TypingWord> = {}): TypingWord {
  return {
    id: 'w1',
    word: 'apple',
    meaning: '苹果',
    phonetic: '/ˈæpl/',
    favorite: false,
    skipMastered: false,
    inWrongBook: false,
    ...overrides
  }
}

function setup(
  initial: {
    lane?: 'words' | 'article'
    wordPhase?: WordPhase
    wordMode?: WordMode
    articleMode?: ArticleMode
    enabledExamModes?: ExamMode[]
    words?: TypingWord[]
    sentences?: SentenceItem[]
    index?: number
    examQueue?: ExamCard[]
    examCursor?: number
    answered?: Answered[]
    correctCount?: number
  } = {}
) {
  const refs = {
    lane: ref(initial.lane ?? 'words'),
    wordPhase: ref(initial.wordPhase ?? 'learn'),
    wordMode: ref(initial.wordMode ?? 'follow'),
    articleMode: ref(initial.articleMode ?? 'follow'),
    enabledExamModes: ref(initial.enabledExamModes ?? (['recall', 'dictation'] as ExamMode[])),
    words: ref(initial.words ?? []),
    sentences: ref(initial.sentences ?? []),
    index: ref(initial.index ?? 0),
    examQueue: ref(initial.examQueue ?? []),
    examCursor: ref(initial.examCursor ?? 0),
    userInput: ref(''),
    showResult: ref(false),
    selfVisible: ref(false),
    hintLevel: ref(0),
    accent: ref<'us' | 'uk'>('us'),
    typingShowResult: ref(false),
    committing: ref(false),
    answered: ref(initial.answered ?? []),
    correctCount: ref(initial.correctCount ?? 0),
    fullTranslation: ref(''),
    showFullTranslation: ref(false)
  }

  return useTypingPresentation(refs)
}

describe('useTypingPresentation', () => {
  it('resolves the current word and learn progress', () => {
    const presentation = setup({
      words: [word(), word({ id: 'w2', word: 'banana' })],
      index: 1
    })

    expect(presentation.currentWord.value?.word).toBe('banana')
    expect(presentation.expectedText.value).toBe('banana')
    expect(presentation.total.value).toBe(2)
    expect(presentation.progressLabel.value).toContain('学习')
    expect(presentation.progressLabel.value).toContain('跟写')
  })

  it('uses the exam queue position in exam mode', () => {
    const presentation = setup({
      wordPhase: 'exam',
      words: [word(), word({ id: 'w2', word: 'banana' })],
      examQueue: [{ wordIndex: 1, mode: 'recall' }]
    })

    expect(presentation.currentWord.value?.word).toBe('banana')
    expect(presentation.examModes.value).toEqual(['recall', 'dictation'])
    expect(presentation.progressLabel.value).toContain('检测')
    expect(presentation.progressLabel.value).toContain('1/1')
  })

  it('switches to sentence mode for articles', () => {
    const sentence: SentenceItem = {
      text: 'Hello world',
      translation: '你好世界',
      articleKey: 'a1',
      index: 0,
      title: 'Lesson 1'
    }
    const presentation = setup({ lane: 'article', sentences: [sentence] })

    expect(presentation.usePassageTyping.value).toBe(true)
    expect(presentation.currentSentence.value?.translation).toBe('你好世界')
    expect(presentation.expectedText.value).toBe('Hello world')
    expect(presentation.sentenceTranslation.value).toBe('你好世界')
  })

  it('dedupes examples and masks recall/dictation cards', () => {
    const presentation = setup({
      words: [
        word({
          examples: ['An apple.', 'An apple.'],
          example: 'A red apple.'
        })
      ],
      wordMode: 'dictation'
    })

    expect(presentation.exampleList.value).toEqual(['An apple.', 'A red apple.'])
    expect(presentation.engineMasked.value).toBe(true)
  })

  it('calculates accuracy and missed answers', () => {
    const presentation = setup({
      answered: [
        { id: '1', label: 'apple', ok: true },
        { id: '2', label: 'banana', ok: false }
      ],
      correctCount: 1
    })

    expect(presentation.accuracy.value).toBe(50)
    expect(presentation.missed.value).toHaveLength(1)
  })

  it('keeps the active mode chain aligned with enabled exam modes', () => {
    const presentation = setup({
      words: [word()],
      enabledExamModes: ['dictation'],
      wordPhase: 'exam'
    })

    expect(presentation.examModes.value).toEqual(['dictation'])
    expect(presentation.activeModeChain.value).toEqual(['dictation'])
  })
})
