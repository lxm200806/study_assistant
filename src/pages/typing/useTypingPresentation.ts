import { computed, type Ref } from 'vue'
import { liveMarks } from '@/utils/typing'
import { EXAM_MODE_ORDER, LEARN_MODE_ORDER } from './exam-builder'
import type {
  ArticleMode,
  Answered,
  ExamCard,
  ExamMode,
  SentenceItem,
  TypingWord,
  WordMode,
  WordPhase
} from './typing.types'

const WORD_MODE_LABELS: Record<WordMode, string> = {
  follow: '跟写',
  self: '自测',
  recall: '默写',
  dictation: '听写'
}

interface Options {
  lane: Ref<'words' | 'article'>
  wordPhase: Ref<WordPhase>
  wordMode: Ref<WordMode>
  articleMode: Ref<ArticleMode>
  enabledExamModes: Ref<ExamMode[]>
  words: Ref<TypingWord[]>
  sentences: Ref<SentenceItem[]>
  index: Ref<number>
  examQueue: Ref<ExamCard[]>
  examCursor: Ref<number>
  userInput: Ref<string>
  showResult: Ref<boolean>
  selfVisible: Ref<boolean>
  hintLevel: Ref<number>
  accent: Ref<'us' | 'uk'>
  typingShowResult: Ref<boolean>
  committing: Ref<boolean>
  answered: Ref<Answered[]>
  correctCount: Ref<number>
  fullTranslation: Ref<string>
  showFullTranslation: Ref<boolean>
}

/** 练习页的派生展示状态；只读输入 refs，不改变练习流程。 */
export function useTypingPresentation(options: Options) {
  const currentWord = computed(() => {
    if (options.lane.value !== 'words') return undefined
    if (options.wordPhase.value === 'exam' && options.examQueue.value.length) {
      const card = options.examQueue.value[options.examCursor.value]
      return card ? options.words.value[card.wordIndex] : undefined
    }
    return options.words.value[options.index.value]
  })

  const currentSentence = computed(() =>
    options.lane.value === 'article' ? options.sentences.value[options.index.value] : undefined
  )

  const expectedText = computed(
    () => currentWord.value?.word || currentSentence.value?.text || ''
  )

  const total = computed(() =>
    options.lane.value === 'words' ? options.words.value.length : options.sentences.value.length
  )

  const examModes = computed(() =>
    EXAM_MODE_ORDER.filter(mode => options.enabledExamModes.value.includes(mode))
  )

  const activeModeChain = computed(() => {
    if (options.lane.value !== 'words') return [] as WordMode[]
    if (options.wordPhase.value === 'learn') return [...LEARN_MODE_ORDER]
    return examModes.value.length ? [...examModes.value] : ([] as WordMode[])
  })

  const modeStepIndex = computed(() => {
    const i = activeModeChain.value.indexOf(options.wordMode.value)
    return i >= 0 ? i : 0
  })

  const progressLabel = computed(() => {
    if (options.lane.value === 'article') {
      const mode = options.articleMode.value === 'follow' ? '跟写' : '听写'
      return `${mode} · ${Math.min(options.index.value + 1, total.value)}/${total.value}`
    }
    const phaseLabel = options.wordPhase.value === 'learn' ? '学习' : '检测'
    const mode = WORD_MODE_LABELS[options.wordMode.value] || '跟写'
    if (options.wordPhase.value === 'exam' && options.examQueue.value.length) {
      const n = Math.min(options.examCursor.value + 1, options.examQueue.value.length)
      return `${phaseLabel} · ${mode} · ${n}/${options.examQueue.value.length}`
    }
    return `${phaseLabel} · ${mode} · ${Math.min(options.index.value + 1, total.value)}/${total.value}`
  })

  const progressPct = computed(() => {
    if (!total.value) return 0
    if (options.lane.value !== 'words') {
      return Math.min(
        100,
        Math.round(
          ((options.index.value + (options.showResult.value || options.committing.value ? 1 : 0)) /
            total.value) *
            100
        )
      )
    }
    const learnModesCount = LEARN_MODE_ORDER.length
    const examModesCount = examModes.value.length
    const totalSteps =
      total.value * learnModesCount +
      Math.max(options.examQueue.value.length, total.value * examModesCount)
    if (!totalSteps) return 0
    const doneCard = options.showResult.value || options.committing.value ? 1 : 0
    let stepsDone = 0
    if (options.wordPhase.value === 'learn') {
      stepsDone = options.index.value * learnModesCount + modeStepIndex.value + doneCard
    } else {
      stepsDone = total.value * learnModesCount + options.examCursor.value + doneCard
    }
    return Math.min(100, Math.round((stepsDone / totalSteps) * 100))
  })

  const engineMasked = computed(() => {
    if (options.lane.value === 'article') return options.articleMode.value === 'dictation'
    if (options.wordMode.value === 'dictation' || options.wordMode.value === 'recall') return true
    if (options.wordMode.value === 'self') return !options.selfVisible.value
    return false
  })

  /** Only article/sentence uses passage (wait-for-space). Word-lane phrases stay on word engine. */
  const usePassageTyping = computed(() => options.lane.value === 'article')

  const dictationMode = computed(
    () =>
      (options.lane.value === 'words' && options.wordMode.value === 'dictation') ||
      (options.lane.value === 'article' && options.articleMode.value === 'dictation')
  )

  const maskedPrompt = computed(() =>
    '·'.repeat(Math.max(4, Math.min(expectedText.value.length, 24)))
  )

  const followLive = computed(() => {
    if (options.showResult.value) return false
    if (options.lane.value === 'article') return options.articleMode.value === 'follow'
    return options.wordMode.value === 'follow'
  })

  const showSpelling = computed(() => {
    if (!expectedText.value) return false
    if (options.showResult.value) return true
    if (options.lane.value === 'article') return options.articleMode.value === 'follow'
    if (options.wordMode.value === 'follow') return true
    if (options.wordMode.value === 'self') return options.selfVisible.value
    return false
  })

  const marks = computed(() => liveMarks(expectedText.value, options.userInput.value))

  const graded = computed(() =>
    options.showResult.value ? liveMarks(expectedText.value, options.userInput.value) : []
  )

  const phoneticLine = computed(() => {
    const word = currentWord.value
    if (!word) return ''
    if (options.accent.value === 'uk' && word.phoneticUk) return word.phoneticUk
    if (options.accent.value === 'us' && word.phoneticUs) return word.phoneticUs
    return word.phonetic || ''
  })

  const showPhonetic = computed(() => {
    if (options.lane.value !== 'words' || !phoneticLine.value) return false
    if (options.showResult.value || options.wordMode.value === 'follow') return true
    return options.hintLevel.value >= 1
  })

  const showMeaningLine = computed(() => {
    if (options.lane.value !== 'words' || !currentWord.value) return false
    if (options.wordMode.value === 'recall' && !options.showResult.value) {
      return !!currentWord.value.englishMeaning
    }
    if (options.showResult.value || options.wordMode.value === 'follow') return true
    return options.hintLevel.value >= 1
  })

  const meaningLine = computed(() => {
    if (!currentWord.value) return ''
    if (options.wordMode.value === 'recall' && !options.showResult.value) {
      return currentWord.value.englishMeaning || ''
    }
    return currentWord.value.meaning
  })

  const firstLetter = computed(() => {
    if (showSpelling.value || options.hintLevel.value < 2) return ''
    return expectedText.value.trim().charAt(0)
  })

  const exampleList = computed(() => {
    const word = currentWord.value
    if (!word || options.lane.value !== 'words') return [] as string[]
    const list = [...(word.examples || []), ...(word.example ? [word.example] : [])]
      .map(item => item.trim())
      .filter(Boolean)
    return [...new Set(list)]
  })

  const showExamplesPanel = computed(() => {
    if (!exampleList.value.length) return false
    if (options.showResult.value || options.typingShowResult.value) return true
    if (options.wordMode.value === 'follow') return true
    if (options.wordMode.value === 'self' && options.selfVisible.value) return true
    return options.hintLevel.value >= 1
  })

  const sentenceTranslation = computed(() => {
    const text = currentSentence.value?.translation || ''
    if (!text) return ''
    if (options.showResult.value || options.articleMode.value === 'follow') return text
    return ''
  })

  const showAside = computed(
    () =>
      !!currentWord.value?.englishMeaning ||
      !!sentenceTranslation.value ||
      !!(options.showFullTranslation.value && options.fullTranslation.value) ||
      !!(
        currentWord.value?.note ||
        currentWord.value?.synonyms ||
        currentWord.value?.roots ||
        currentWord.value?.etymology ||
        currentWord.value?.phrases ||
        currentWord.value?.topic
      )
  )

  const promptKicker = computed(() => {
    if (options.lane.value === 'article') {
      const title = currentSentence.value?.title ? `${currentSentence.value.title} · ` : ''
      return title + (options.articleMode.value === 'follow' ? '跟着这一句输入' : '听写这一句')
    }
    if (options.wordMode.value === 'self' && options.selfVisible.value) return '看一眼，马上遮住'
    if (options.wordMode.value === 'self') return '凭刚才的印象输入'
    if (options.wordMode.value === 'recall') return '根据释义默写'
    if (options.wordMode.value === 'dictation') return '听写'
    return '跟着拼写'
  })

  const placeholder = computed(() => (options.lane.value === 'article' ? '输入这一句' : '输入单词'))

  const accuracy = computed(() =>
    options.answered.value.length
      ? Math.round((options.correctCount.value / options.answered.value.length) * 100)
      : 0
  )

  const missed = computed(() => options.answered.value.filter(item => !item.ok))

  return {
    currentWord,
    currentSentence,
    expectedText,
    total,
    examModes,
    activeModeChain,
    modeStepIndex,
    progressLabel,
    progressPct,
    engineMasked,
    usePassageTyping,
    dictationMode,
    maskedPrompt,
    followLive,
    showSpelling,
    marks,
    graded,
    phoneticLine,
    showPhonetic,
    showMeaningLine,
    meaningLine,
    firstLetter,
    exampleList,
    showExamplesPanel,
    sentenceTranslation,
    showAside,
    promptKicker,
    placeholder,
    accuracy,
    missed
  }
}
