<template>
  <view class="desk">
    <view v-if="phase === 'setup'" class="setup">
      <text class="eyebrow">认读练习</text>
      <text class="lede">不用键盘。先学一遍认识单词，再检测一遍看会不会。检测可用汉语、英语、听音。</text>

      <BookSwitcher training-type="reading" @change="onBookChange" />

      <view v-if="setupSummary" class="summary">
        <text>到期 {{ setupSummary.due }}</text>
        <text>已学 {{ setupSummary.learned }}</text>
        <text>掌握 {{ setupSummary.mastered }}</text>
        <text v-if="setupSummary.progress">进度 {{ setupSummary.progress }}</text>
      </view>

      <text class="label">词从哪来</text>
      <view class="chips">
        <view
          v-for="item in sessionModes"
          :key="item.key"
          :class="['chip', vocabStore.studySettings.sessionMode === item.key ? 'on' : '']"
          @tap="setSessionMode(item.key)"
        >{{ item.label }}</view>
      </view>
      <text class="hint">{{ vocabStore.studySettings.sessionMode === 'recheck'
        ? '跨书核对：只测不学。别的书学过、这本书还没确认的词，答对掌握度 +1，答错进入待复习。'
        : '点开始即可。先学后测；检测题型默认全开，测的时候可随时关掉某一种。智能先练错词和到期词。' }}</text>

      <text class="label">这一组</text>
      <view class="chips">
        <view
          v-for="count in groupCounts"
          :key="count"
          :class="['chip', vocabStore.studySettings.wordsPerGroup === count ? 'on' : '']"
          @tap="setWordsPerGroup(count)"
        >{{ count }}</view>
      </view>
      <text
        v-if="vocabStore.getCurrentBook"
        class="hint link"
        @tap="setFullBookRound"
      >全书一轮 ({{ vocabStore.getCurrentBook.wordCount }} 词)</text>

      <button class="start" @tap="startTraining">开始</button>
    </view>

    <view v-else-if="phase === 'bridge'" class="setup bridge">
      <text class="eyebrow">认读练习</text>
      <text class="score-soft">{{ words.length }}</text>
      <text class="lede">本组 {{ words.length }} 词已见过一面。打乱顺序检测一遍，看有没有学会。</text>
      <button class="start" @tap="startQuiz">开始检测</button>
    </view>

    <view v-else-if="phase === 'study' || phase === 'quiz'" class="practice">
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: progressPct + '%' }" />
      </view>
      <view class="topbar">
        <text class="top-meta">{{ progressLabel }}</text>
        <text class="top-link" @tap="endSession">结束</text>
      </view>

      <!-- 学习：初见卡 -->
      <template v-if="phase === 'study'">
        <view class="stage intro-stage">
          <text class="kicker">
            <text class="dot" /> 初次见面
          </text>
          <image v-if="thumb" class="intro-art" :src="thumb" mode="aspectFill" />
          <view class="intro-head">
            <text class="big-word">{{ currentWord ? getWordHeadword(currentWord) : '' }}</text>
            <text
              :class="['speak-mark', isPlaying ? 'is-on' : '']"
              @tap.stop="playAudio"
            >听</text>
          </view>
          <text v-if="currentWord?.phonetic" class="phonetic">{{ currentWord.phonetic }}</text>
          <text class="intro-zh">{{ currentWord ? getWordMeaning(currentWord, 'chinese') : '' }}</text>
          <text v-if="currentWord?.englishMeaning" class="intro-en">{{ currentWord.englishMeaning }}</text>
          <text v-if="ttsHint" class="hint">{{ ttsHint }}</text>
          <text v-else class="hint">自动朗读 · 点「听」可重听 · Enter 继续</text>
        </view>
        <button class="start know" @tap="advanceStudy">认识了</button>
      </template>

      <!-- 检测：一题一词 -->
      <template v-else>
        <view class="practice-rail">
          <view
            v-for="item in recogModes"
            :key="item.key"
            :class="modeChipClass(item.key)"
            @tap="onModeChip(item.key)"
          >
            <text class="rail-label">{{ item.label }}</text>
          </view>
          <view class="rail-gap" aria-hidden="true" />
          <view
            :class="['rail-tab', 'rail-toggle', autoSkip ? 'is-picked' : '']"
            title="答对约一秒后自动下一题；答错仍需点继续"
            @tap="toggleAutoSkip"
          >
            <text class="rail-label">答对跳过</text>
          </view>
        </view>

        <view class="stage quiz-stage">
          <template v-if="quizMode === 'listen'">
            <view class="listen-orb" @tap="playAudio">
              <text>听</text>
            </view>
            <text class="hint compact">{{ ttsHint || (isPlaying ? '播放中…' : '点圆钮重听') }}</text>
          </template>
          <template v-else-if="quizMode === 'en'">
            <text class="big-word">{{ currentWord ? getWordHeadword(currentWord) : '' }}</text>
          </template>
          <template v-else>
            <text class="big-meaning">{{ zhPrompt }}</text>
          </template>
        </view>

        <view class="options">
          <view
            v-for="(option, index) in options"
            :key="index"
            :class="['option', getOptionClass(index)]"
            @tap="selectOption(index)"
          >
            <text class="kbd">{{ index + 1 }}</text>
            <text :class="['option-label', quizMode === 'zh' ? 'is-word' : '']">{{ option.label }}</text>
          </view>
        </view>

        <view v-if="showResult" :class="['feedback', isCorrect ? 'good' : 'bad']">
          <image v-if="thumb" class="feedback-art" :src="thumb" mode="aspectFill" />
          <view class="feedback-copy">
            <text class="verdict">{{ isCorrect ? '答对了' : '记住它' }}</text>
            <text class="feedback-word">{{ currentWord ? getWordHeadword(currentWord) : '' }}</text>
            <text class="feedback-zh">{{ currentWord ? getWordMeaning(currentWord, 'chinese') : '' }}</text>
            <text v-if="currentWord?.example" class="feedback-ex">{{ currentWord.example }}</text>
          </view>
          <button v-if="!isLastQuiz && !(autoSkip && isCorrect)" class="next" @tap="advanceQuiz">继续</button>
          <text v-else-if="!isLastQuiz && autoSkip && isCorrect" class="auto-skip-hint">答对了，马上下一题</text>
        </view>
        <view v-if="showResult && isLastQuiz" class="end-actions">
          <button class="start end-btn" @tap="completeAndNextGroup">下一组</button>
          <button class="ghost end-btn" @tap="completeAndFinish">完成训练</button>
        </view>
        <text v-else-if="!showResult" class="key-hint">数字键 1–4 作答 · Enter 继续</text>
      </template>
    </view>

    <view v-else class="setup done">
      <text class="eyebrow">认读练习</text>
      <text class="score">{{ sessionAnalysis.accuracy }}%</text>
      <text class="lede">{{ sessionAnalysis.correct }}/{{ sessionAnalysis.total }} 正确</text>
      <TrainingAnalysis
        :analysis="sessionAnalysis"
        :newly-covered="newlyCovered"
        :due-count="finishDueCount"
        :weak-topics="weakTopicLabels"
      />
      <TrainingFinishActions />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import type { Vocabulary } from '@/types'
import { getWordMeaning, buildWordChoices, getWordHeadword } from '@/utils/vocabulary'
import { buildUniqueOptions } from '@/utils/quiz-options'
import { speakWord, isTtsSupported, stopSpeak, preloadWordAudio, unlockTtsPlayback } from '@/utils/tts'
import BookSwitcher from '@/components/BookSwitcher.vue'
import type { SessionMode } from '@/types/map'
import { SESSION_MODE_LABELS } from '@/types/map'
import TrainingAnalysis from '@/components/TrainingAnalysis.vue'
import TrainingFinishActions from '@/components/TrainingFinishActions.vue'
import { useSessionAnalysis } from '@/composables/useSessionAnalysis'
import { useTrainingFlow } from '@/composables/useTrainingFlow'
import { ensureTrainingWords } from '@/composables/useTrainingStart'
import { useGroupComplete } from '@/composables/useGroupComplete'
import { useDailySession } from '@/composables/useDailySession'
import { onLoad } from '@dcloudio/uni-app'
import { requireSubject } from '@/utils/subject'
import { isBrowserH5 } from '@/platform/runtime'
import { atlasThumbUrl, resolveAtlasId } from '@/utils/wordAtlas'
import {
  RECOG_MODES as recogModes,
  RECOG_MODE_ORDER,
  loadAutoSkip,
  loadEnabledRecogModes,
  saveAutoSkip,
  saveEnabledRecogModes,
  type RecogMode
} from './recognition-preferences'

type Phase = 'setup' | 'study' | 'bridge' | 'quiz' | 'done'

function shuffleIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const vocabStore = useVocabularyStore()
const { recordAnswer, getAnalysis, resetSession } = useSessionAnalysis('reading')
const { newlyCovered, resetFlow, loadGroup, finishSession } = useTrainingFlow('reading')

const phase = ref<Phase>('setup')
/** 本组是否用「跨书核对」：只测不学，答案直接写 BookWordCheck。 */
const recheckAtStart = ref(false)
const showResult = ref(false)
const showFinish = ref(false)
const selectedOption = ref(-1)
const isCorrect = ref(false)
const studyIndex = ref(0)
const quizIndex = ref(0)
const quizOrder = ref<number[]>([])
const words = ref<Vocabulary[]>([])
const options = ref<Array<{ id: string; label: string }>>([])
const enabledModes = ref<RecogMode[]>(loadEnabledRecogModes())
const quizMode = ref<RecogMode>(enabledModes.value[0] || 'zh')
const modeCursor = ref(0)
const autoSkip = ref(loadAutoSkip())
let autoSkipTimer: ReturnType<typeof setTimeout> | null = null

function clearAutoSkipTimer() {
  if (autoSkipTimer) {
    clearTimeout(autoSkipTimer)
    autoSkipTimer = null
  }
}

function toggleAutoSkip() {
  autoSkip.value = !autoSkip.value
  saveAutoSkip(autoSkip.value)
  if (!autoSkip.value) clearAutoSkipTimer()
}

const totalCorrect = ref(0)
const totalCount = ref(0)

const readingStats = ref({ total: 0, mastered: 0, avgMastery: 0 })
const finishDueCount = ref(0)
const weakTopicLabels = ref<string[]>([])
const autoStart = ref(false)
const groupCounts = [5, 10, 15, 20, 30, 40, 50]
const sessionModes: Array<{ key: SessionMode; label: string }> = [
  { key: 'smart', label: SESSION_MODE_LABELS.smart },
  { key: 'review', label: SESSION_MODE_LABELS.review },
  { key: 'weak', label: SESSION_MODE_LABELS.weak },
  { key: 'coverage', label: SESSION_MODE_LABELS.coverage },
  { key: 'recheck', label: SESSION_MODE_LABELS.recheck }
]

const sessionAnalysis = computed(() => getAnalysis())
const setupSummary = computed(() => {
  const progress = vocabStore.bookProgress
  return {
    due: vocabStore.dueCount?.dueCount ?? 0,
    learned: readingStats.value.total,
    mastered: readingStats.value.mastered,
    progress: progress
      ? `${progress.practicedCount}/${progress.wordCount}`
      : ''
  }
})

function setSessionMode(mode: SessionMode) {
  vocabStore.setSessionMode(mode)
}

function setWordsPerGroup(count: number) {
  vocabStore.setStudySettings({ wordsPerGroup: count, groupCount: 1 })
}

function setFullBookRound() {
  vocabStore.setFullBookRound()
  uni.showToast({ title: '已设为全书一轮', icon: 'success' })
}

async function onBookChange() {
  await vocabStore.loadBookProgress()
  await vocabStore.loadDueCount(vocabStore.currentBookCode, 'reading')
  readingStats.value = vocabStore.getTypeStats('reading')
}

const currentWordIndex = computed(() => {
  if (phase.value === 'study') return studyIndex.value
  if (phase.value === 'quiz') return quizOrder.value[quizIndex.value] ?? 0
  return 0
})
const currentWord = computed(() => words.value[currentWordIndex.value])
const activeModeChain = computed(() => {
  const selected = enabledModes.value
  return selected.length ? selected : (['zh'] as RecogMode[])
})
const isPlaying = ref(false)
const ttsHint = ref('')
let playToken = 0
const thumb = ref('')

const zhPrompt = computed(() =>
  currentWord.value ? getWordMeaning(currentWord.value, 'chinese') : ''
)

const correctChoiceId = computed(() => {
  if (!currentWord.value) return ''
  if (quizMode.value === 'zh') return currentWord.value.id || ''
  return getWordMeaning(currentWord.value, 'chinese')
})

const progressLabel = computed(() => {
  const n = words.value.length
  if (!n) return ''
  if (phase.value === 'study') {
    return `学习 · ${Math.min(studyIndex.value + 1, n)}/${n}`
  }
  if (phase.value === 'quiz') {
    const mode = recogModes.find((item) => item.key === quizMode.value)?.label || '检测'
    return `检测 · ${mode} · ${Math.min(quizIndex.value + 1, n)}/${n}`
  }
  return ''
})

const isLastQuiz = computed(() => {
  if (!words.value.length) return true
  return quizIndex.value >= words.value.length - 1
})

const progressPct = computed(() => {
  const n = words.value.length
  if (!n) return 0
  const totalSteps = recheckAtStart.value ? n : n * 2
  if (phase.value === 'study') {
    return Math.min(100, Math.round(((studyIndex.value) / totalSteps) * 100))
  }
  if (phase.value === 'bridge') {
    return Math.min(100, Math.round((n / totalSteps) * 100))
  }
  if (phase.value === 'quiz') {
    const done = showResult.value ? 1 : 0
    const base = recheckAtStart.value ? 0 : n
    return Math.min(100, Math.round(((base + quizIndex.value + done) / totalSteps) * 100))
  }
  return 100
})

const getOptionClass = (index: number) => {
  if (!showResult.value) return ''
  if (options.value[index]?.id === correctChoiceId.value) return 'correct'
  if (index === selectedOption.value && !isCorrect.value) return 'wrong'
  return ''
}

const playAudio = async () => {
  const word = currentWord.value?.word
  if (!word) return
  const token = ++playToken
  isPlaying.value = true
  ttsHint.value = ''
  stopSpeak()
  if (!isTtsSupported()) {
    isPlaying.value = false
    ttsHint.value = '当前环境不支持发音，请使用 Chrome 浏览器'
    return
  }
  try {
    await unlockTtsPlayback()
    if (token !== playToken) return
    await speakWord(word)
  } catch {
    if (token === playToken) ttsHint.value = '播放失败，请再点一次'
  } finally {
    if (token === playToken) isPlaying.value = false
  }
}

const selectOption = (index: number) => {
  if (phase.value !== 'quiz' || showResult.value) return

  selectedOption.value = index
  isCorrect.value = options.value[index]?.id === correctChoiceId.value
  showResult.value = true

  const wordId = currentWord.value?.id || ''
  const wordText = currentWord.value?.word || ''
  if (recheckAtStart.value) {
    // 跨书核对只写 reading 的核对结果；听音答题也不额外累加 listening。
    void vocabStore.recheckWord(wordId, wordText, 'reading', isCorrect.value)
  } else {
    // 汉语、英语、听音都计入「认识」。听音另外留一条听力记录。
    vocabStore.updateWordStats(wordId, wordText, 'reading', isCorrect.value)
    if (quizMode.value === 'listen') {
      vocabStore.updateWordStats(wordId, wordText, 'listening', isCorrect.value)
      vocabStore.addTrainingRecord('listening', wordText, isCorrect.value)
    }
  }
  vocabStore.addTrainingRecord('reading', wordText, isCorrect.value)
  recordAnswer(
    currentWord.value!,
    isCorrect.value,
    (w) => vocabStore.getWordStats(w, 'reading'),
    'chinese'
  )

  if (isCorrect.value) {
    totalCorrect.value++
    // 答对：闪一下反馈后自动下一题；最后一题仍停住选下一组/完成
    if (autoSkip.value && !isLastQuiz.value) {
      clearAutoSkipTimer()
      autoSkipTimer = setTimeout(() => {
        autoSkipTimer = null
        if (phase.value === 'quiz' && showResult.value && isCorrect.value && !isLastQuiz.value) {
          advanceQuiz()
        }
      }, 1000)
    }
  }
}

function firstEnabledMode(): RecogMode {
  return activeModeChain.value[0] || 'zh'
}

function pickQuizModeForIndex(i: number): RecogMode {
  const chain = activeModeChain.value
  return chain[i % chain.length] || 'zh'
}

function persistEnabledModes(next: RecogMode[]) {
  enabledModes.value = RECOG_MODE_ORDER.filter((key) => next.includes(key))
  if (!enabledModes.value.length) enabledModes.value = ['zh']
  saveEnabledRecogModes(enabledModes.value)
}

function modeChipClass(key: RecogMode) {
  const classes = ['rail-tab']
  if (enabledModes.value.includes(key)) classes.push('is-on')
  else classes.push('is-off')
  if (quizMode.value === key) classes.push('is-current')
  return classes
}

function onModeChip(key: RecogMode) {
  if (phase.value !== 'quiz' || showResult.value) return
  const enabled = enabledModes.value.includes(key)
  if (!enabled) {
    persistEnabledModes([...enabledModes.value, key])
    quizMode.value = key
    prepareQuizCard()
    return
  }
  if (enabledModes.value.length <= 1) {
    uni.showToast({ title: '至少保留一种方式', icon: 'none' })
    return
  }
  const chain = [...enabledModes.value]
  const wasCurrent = quizMode.value === key
  persistEnabledModes(chain.filter((mode) => mode !== key))
  if (!wasCurrent) return
  quizMode.value = firstEnabledMode()
  prepareQuizCard()
}

function prepareStudyCard() {
  stopSpeak()
  void playAudio()
}

function prepareQuizCard() {
  clearAutoSkipTimer()
  selectedOption.value = -1
  showResult.value = false
  isCorrect.value = false
  generateOptions()
  // 汉语选题看释义选词：自动发音会泄题；听音必须播，英语看词可播
  if (quizMode.value === 'zh') {
    stopSpeak()
    return
  }
  void playAudio()
}

function advanceStudy() {
  stopSpeak()
  if (studyIndex.value + 1 >= words.value.length) {
    phase.value = 'bridge'
    return
  }
  studyIndex.value += 1
  prepareStudyCard()
}

function startQuiz() {
  quizOrder.value = shuffleIndices(words.value.length)
  quizIndex.value = 0
  modeCursor.value = 0
  quizMode.value = pickQuizModeForIndex(0)
  phase.value = 'quiz'
  showResult.value = false
  prepareQuizCard()
}

function advanceQuiz() {
  clearAutoSkipTimer()
  if (quizIndex.value + 1 >= words.value.length) return
  quizIndex.value += 1
  modeCursor.value += 1
  quizMode.value = pickQuizModeForIndex(modeCursor.value)
  prepareQuizCard()
}

const generateOptions = () => {
  const current = currentWord.value
  if (!current) return
  if (current.word) preloadWordAudio(current.word)
  if (quizMode.value === 'zh') {
    options.value = buildWordChoices(current, words.value, 4)
    return
  }
  const correctMeaning = getWordMeaning(current, 'chinese')
  const others = words.value
    .filter((word) => word.id !== current.id)
    .map((word) => getWordMeaning(word, 'chinese'))
  options.value = buildUniqueOptions(correctMeaning, others, 4).map((label) => ({ id: label, label }))
}

watch(currentWord, async (word) => {
  thumb.value = ''
  if (!word?.word) return
  preloadWordAudio(word.word)
  const id = await resolveAtlasId(word.word)
  if (currentWord.value?.word === word.word) thumb.value = atlasThumbUrl(id) || ''
})

function onKeyDown(event: KeyboardEvent) {
  if (!isBrowserH5() || phase.value === 'setup' || phase.value === 'done') return
  if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

  if (phase.value === 'bridge') {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      startQuiz()
    }
    return
  }

  if (phase.value === 'study') {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      advanceStudy()
    }
    return
  }

  if (phase.value === 'quiz') {
    if ((event.key === 'Enter' || event.key === ' ') && showResult.value && !isLastQuiz.value) {
      event.preventDefault()
      advanceQuiz()
      return
    }
    const n = Number(event.key)
    if (!showResult.value && n >= 1 && n <= options.value.length) {
      event.preventDefault()
      selectOption(n - 1)
    }
  }
}

const startGroup = async (): Promise<boolean> => {
  // 词汇练习：按设置的一组数量走记忆曲线队列
  const mode = vocabStore.studySettings.sessionMode
  recheckAtStart.value = mode === 'recheck'
  words.value = await loadGroup(vocabStore.studySettings.wordsPerGroup, { mode })
  if (!words.value.length) {
    if (recheckAtStart.value) {
      const meta = vocabStore.lastRecheckMeta
      uni.showToast({
        title: meta?.complete ? '本书已全部核对完成' : '暂无可核对的词',
        icon: 'none'
      })
    }
    return false
  }
  return true
}

const { ensureAccessibleBook } = useDailySession()

function beginStudyPhase() {
  studyIndex.value = 0
  quizIndex.value = 0
  quizOrder.value = []
  selectedOption.value = -1
  showResult.value = false
  showFinish.value = false
  phase.value = 'study'
  prepareStudyCard()
}

function beginRecheckQuiz() {
  studyIndex.value = 0
  quizIndex.value = 0
  quizOrder.value = shuffleIndices(words.value.length)
  selectedOption.value = -1
  showResult.value = false
  showFinish.value = false
  modeCursor.value = 0
  quizMode.value = pickQuizModeForIndex(0)
  phase.value = 'quiz'
  prepareQuizCard()
}

const startTraining = async () => {
  if (!vocabStore.ensureBookSelected()) return
  ensureAccessibleBook()

  totalCorrect.value = 0
  resetSession()
  resetFlow()

  await vocabStore.loadBookProgress()
  const hasWords = await startGroup()
  if (!hasWords) {
    phase.value = 'setup'
    return
  }
  totalCount.value = words.value.length || vocabStore.studySettings.wordsPerGroup

  if (!(await ensureTrainingWords(words.value))) return

  if (recheckAtStart.value) beginRecheckQuiz()
  else beginStudyPhase()
}

const nextGroupTraining = async () => {
  showFinish.value = false
  resetSession()
  resetFlow()
  totalCorrect.value = 0
  const hasWords = await startGroup()
  if (!hasWords) {
    phase.value = 'setup'
    return
  }
  totalCount.value = words.value.length || vocabStore.studySettings.wordsPerGroup
  if (!(await ensureTrainingWords(words.value))) {
    phase.value = 'setup'
    return
  }
  if (recheckAtStart.value) beginRecheckQuiz()
  else beginStudyPhase()
}

/** 跨书核对只测不学：不写本书覆盖进度，也不重复累计每日学习量。 */
const finishSessionForMode = async () => {
  if (recheckAtStart.value) return
  await finishSession()
}

const { completeAndNextGroup, completeAndFinish } = useGroupComplete({
  finishSession: finishSessionForMode,
  nextGroupTraining,
  showFinish,
  showResult,
  finishDueCount,
  weakTopicLabels
})

watch(showFinish, (done) => {
  if (done) phase.value = 'done'
})

const endSession = () => {
  stopSpeak()
  uni.navigateBack()
}

onLoad((query) => {
  if (query?.autoStart === '1') autoStart.value = true
  if (query?.topic) vocabStore.setSessionTopic(query.topic as string)
  // 侧栏认读：强制记忆曲线流程，清掉文章单元残留
  vocabStore.setSessionUnitId(undefined)
  vocabStore.setSessionBookCode(undefined)
})

onMounted(async () => {
  if (isBrowserH5() && typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown)
  }
  if (!(await requireSubject('english', 'student'))) return
  vocabStore.loadBooks()
  vocabStore.loadStats()
  vocabStore.loadSettings()
  // BookSwitcher 挂载时已加载本进度与到期数，这里不重复请求
  await vocabStore.loadServerStats()
  readingStats.value = vocabStore.getTypeStats('reading')
  if (autoStart.value) {
    await startTraining()
  }
})

onUnmounted(() => {
  clearAutoSkipTimer()
  stopSpeak()
  if (isBrowserH5() && typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeyDown)
  }
})
</script>

<style scoped lang="scss" src="./recognition.scss"></style>
