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
      <text class="hint">点开始即可。先学后测；检测题型默认全开，测的时候可随时关掉某一种。智能先练错词和到期词。</text>

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
import { isBrowserH5 } from '@/utils/audio-recording'
import { atlasThumbUrl, resolveAtlasId } from '@/utils/wordAtlas'

type RecogMode = 'zh' | 'en' | 'listen'
type Phase = 'setup' | 'study' | 'bridge' | 'quiz' | 'done'

const RECOG_MODE_ORDER: RecogMode[] = ['zh', 'en', 'listen']
const recogModes: Array<{ key: RecogMode; label: string }> = [
  { key: 'zh', label: '汉语' },
  { key: 'en', label: '英语' },
  { key: 'listen', label: '听音' }
]

function loadEnabledRecogModes(): RecogMode[] {
  try {
    const raw = localStorage.getItem('recog-enabled-modes')
    if (!raw) return [...RECOG_MODE_ORDER]
    const parsed = JSON.parse(raw) as string[]
    const next = RECOG_MODE_ORDER.filter((key) => parsed.includes(key))
    return next.length ? next : [...RECOG_MODE_ORDER]
  } catch {
    return [...RECOG_MODE_ORDER]
  }
}

function saveEnabledRecogModes(modes: RecogMode[]) {
  try {
    localStorage.setItem('recog-enabled-modes', JSON.stringify(modes))
  } catch {
    /* ignore */
  }
}

function loadAutoSkip(): boolean {
  try {
    return localStorage.getItem('recog-auto-skip') !== '0'
  } catch {
    return true
  }
}

function saveAutoSkip(on: boolean) {
  try {
    localStorage.setItem('recog-auto-skip', on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

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
const groupCounts = [5, 10, 15, 20]
const sessionModes: Array<{ key: SessionMode; label: string }> = [
  { key: 'smart', label: SESSION_MODE_LABELS.smart },
  { key: 'review', label: SESSION_MODE_LABELS.review },
  { key: 'weak', label: SESSION_MODE_LABELS.weak },
  { key: 'coverage', label: SESSION_MODE_LABELS.coverage }
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
  const totalSteps = n * 2
  if (phase.value === 'study') {
    return Math.min(100, Math.round(((studyIndex.value) / totalSteps) * 100))
  }
  if (phase.value === 'bridge') {
    return Math.min(100, Math.round((n / totalSteps) * 100))
  }
  if (phase.value === 'quiz') {
    const done = showResult.value ? 1 : 0
    return Math.min(100, Math.round(((n + quizIndex.value + done) / totalSteps) * 100))
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
  // 汉语、英语、听音都计入「认识」。听音另外留一条听力记录。
  vocabStore.updateWordStats(wordId, wordText, 'reading', isCorrect.value)
  vocabStore.addTrainingRecord('reading', wordText, isCorrect.value)
  if (quizMode.value === 'listen') {
    vocabStore.updateWordStats(wordId, wordText, 'listening', isCorrect.value)
    vocabStore.addTrainingRecord('listening', wordText, isCorrect.value)
  }
  recordAnswer(
    currentWord.value!,
    isCorrect.value,
    (w) => vocabStore.getWordStats(w, 'reading'),
    'chinese'
  )

  void vocabStore.loadBookProgress()

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

const startGroup = async () => {
  words.value = await loadGroup(vocabStore.studySettings.wordsPerGroup)
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

const startTraining = async () => {
  if (!vocabStore.ensureBookSelected()) return
  ensureAccessibleBook()

  totalCount.value = vocabStore.studySettings.wordsPerGroup
  totalCorrect.value = 0
  resetSession()
  resetFlow()

  await vocabStore.loadBookProgress()
  await startGroup()

  if (!(await ensureTrainingWords(words.value))) {
    return
  }

  beginStudyPhase()
}

const nextGroupTraining = async () => {
  showFinish.value = false
  resetSession()
  resetFlow()
  totalCorrect.value = 0
  await startGroup()
  if (!(await ensureTrainingWords(words.value))) {
    phase.value = 'setup'
    return
  }
  beginStudyPhase()
}

const { completeAndNextGroup, completeAndFinish } = useGroupComplete({
  finishSession,
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
})

onMounted(async () => {
  if (isBrowserH5() && typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown)
  }
  if (!(await requireSubject('english', 'student'))) return
  vocabStore.loadBooks()
  vocabStore.loadStats()
  vocabStore.loadSettings()
  await vocabStore.loadBookProgress()
  await vocabStore.loadDueCount(vocabStore.currentBookCode, 'reading')
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

<style lang="scss" scoped>
.desk {
  min-height: 100vh;
  background: #f4f1ea;
  color: #1f1a14;
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif;
}

.setup, .practice {
  max-width: 880px;
  margin: 0 auto;
  padding: 28px 22px 80px;
  box-sizing: border-box;
}

.eyebrow {
  display: block;
  font-size: 13px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8a8175;
}

.lede, .hint, .key-hint {
  display: block;
  color: #6d645b;
  font-size: 14px;
  line-height: 1.6;
  margin: 8px 0 18px;
}

.hint.link {
  color: #0f6e6a;
  cursor: pointer;
}

.label {
  display: block;
  margin: 16px 0 8px;
  font-size: 13px;
  font-weight: 650;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  border: 1px solid #ddd4c6;
  background: transparent;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 14px;
  color: #1f1a14;
  cursor: pointer;
}

.chip.on {
  background: #1f1a14;
  color: #f4f1ea;
  border-color: #1f1a14;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 14px 0;
  color: #3d4f4d;
  font-size: 14px;
}

.start,
.ghost {
  margin-top: 16px;
  border-radius: 999px;
  font-size: 16px;
  padding: 12px 28px;
}

.start {
  background: #0f6e6a;
  color: #fff;
  border: none;
}

.ghost {
  background: transparent;
  color: #1f1a14;
  border: 1px solid #cfc6b8;
}

.start.know {
  display: block;
  width: fit-content;
  margin: 8px auto 0;
  padding: 14px 36px;
  font-size: 17px;
}

.end-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  justify-content: flex-start;
}

.end-btn {
  margin-top: 0;
  min-width: 132px;
}

.progress-track {
  height: 8px;
  background: #efe6d6;
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #0f6e6a;
  border-radius: inherit;
  transition: width 0.25s ease;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 0 8px;
}

.top-meta {
  font-size: 14px;
  color: #6d645b;
  font-variant-numeric: tabular-nums;
}

.top-link {
  color: #0f6e6a;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.practice-rail {
  display: flex;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 2px;
  margin: 8px 0 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.rail-tab {
  position: relative;
  flex: 0 0 auto;
  padding: 8px 12px 10px;
  border: none;
  background: transparent;
  color: #8a8175;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.rail-label {
  font-size: 14px;
  line-height: 1.2;
}

.rail-tab.is-off {
  color: #8a8175;
  font-weight: 500;
}

.rail-tab.is-on {
  color: #0f6e6a;
  font-weight: 650;
}

.rail-tab.is-current::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 2px;
  height: 3px;
  border-radius: 999px;
  background: #0f6e6a;
}

.rail-gap {
  width: 1px;
  align-self: stretch;
  margin: 6px 8px;
  background: #e0d7cb;
  flex: 0 0 auto;
}

.rail-toggle {
  color: #8a8175;
  font-weight: 500;
}

.rail-toggle.is-picked {
  color: #0f6e6a;
  font-weight: 650;
}

.auto-skip-hint {
  flex: 0 0 auto;
  font-size: 13px;
  color: #0f6e6a;
  white-space: nowrap;
}

.stage {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 12px 0 8px;
}

.quiz-stage {
  min-height: 140px;
  padding: 8px 0 4px;
}

.intro-stage {
  min-height: 320px;
}

.hint.compact {
  margin: 10px 0 0;
  font-size: 13px;
}

.kicker {
  display: block;
  margin-bottom: 16px;
  font-size: 13px;
  font-weight: 650;
  color: #8a8175;
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 8px;
  border-radius: 50%;
  background: #0f6e6a;
  vertical-align: middle;
}

.intro-art {
  width: 160px;
  height: 160px;
  border-radius: 20px;
  margin-bottom: 16px;
  background: #efe6d6;
  object-fit: cover;
}

.intro-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.speak-mark {
  flex: 0 0 auto;
  min-width: 28px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(31, 26, 20, 0.18);
  background: #fffdf8;
  color: #6d645b;
  font-size: 12px;
  font-weight: 650;
  line-height: 28px;
  text-align: center;
  cursor: pointer;
  user-select: none;
}

.speak-mark.is-on {
  border-color: #0f6e6a;
  color: #0f6e6a;
  background: #e7f3ef;
}

.phonetic {
  display: block;
  margin-top: 6px;
  font-size: 16px;
  color: #8a8175;
}

.intro-zh {
  display: block;
  margin-top: 14px;
  max-width: 18em;
  font-size: 22px;
  line-height: 1.4;
  color: #1f1a14;
}

.intro-en {
  display: block;
  margin-top: 6px;
  max-width: 22em;
  font-size: 15px;
  line-height: 1.45;
  color: #6d645b;
}

.big-meaning,
.big-word {
  display: block;
  max-width: 18em;
  font-family: "Iowan Old Style", Palatino, "Songti SC", "Noto Serif SC", serif;
  font-size: clamp(32px, 4vw, 48px);
  line-height: 1.25;
  color: #1f1a14;
}

.big-word {
  font-family: Palatino, "Iowan Old Style", "Songti SC", serif;
}

.listen-orb {
  width: 132px;
  height: 132px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1f1a14;
  color: #f4f1ea;
  font-size: 28px;
  font-weight: 650;
  cursor: pointer;
  box-shadow: 0 18px 40px -18px rgba(26, 32, 53, 0.7);
}

.options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 8px;
}

.option {
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: #fffdf8;
  border: 1.5px solid rgba(31, 26, 20, 0.14);
  border-bottom-width: 3px;
  cursor: pointer;
  box-sizing: border-box;
}

.option.correct {
  background: #e7f3ef;
  border-color: #0f6e6a;
}

.option.wrong {
  background: #f8ebe6;
  border-color: #9a3b2f;
}

.kbd {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: 8px;
  border: 1px solid rgba(31, 26, 20, 0.16);
  background: #f4f1ea;
  text-align: center;
  line-height: 28px;
  font-size: 13px;
  color: #6d645b;
}

.option-label {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  line-height: 1.35;
  text-align: left;
}

.option-label.is-word {
  font-family: Palatino, "Iowan Old Style", "Songti SC", serif;
  font-size: 22px;
}

.feedback {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 18px;
  background: #fffdf8;
  border: 1px solid rgba(26, 32, 53, 0.08);
}

.feedback.good { box-shadow: inset 3px 0 0 #0f6e6a; }
.feedback.bad { box-shadow: inset 3px 0 0 #9a3b2f; }

.feedback-art {
  width: 72px;
  height: 72px;
  border-radius: 14px;
  flex: 0 0 auto;
  background: #efe6d6;
}

.feedback-copy {
  flex: 1;
  min-width: 0;
}

.verdict, .feedback-zh, .feedback-ex {
  display: block;
  color: #6d645b;
  font-size: 13px;
  line-height: 1.45;
}

.feedback-word {
  display: block;
  margin: 2px 0;
  font-family: Palatino, "Iowan Old Style", "Songti SC", serif;
  font-size: 28px;
  color: #1f1a14;
}

.next {
  flex: 0 0 auto;
  margin: 0;
  background: #0f6e6a;
  color: white;
  border: none;
  border-radius: 999px;
  padding: 0 22px;
  height: 44px;
  line-height: 44px;
  font-size: 15px;
}

.score {
  display: block;
  margin-top: 8px;
  font-family: Palatino, "Songti SC", serif;
  font-size: 72px;
  line-height: 1;
  color: #1f1a14;
}

.score-soft {
  display: block;
  margin-top: 12px;
  font-family: Palatino, "Songti SC", serif;
  font-size: 64px;
  line-height: 1;
  color: #1f1a14;
}

.bridge .lede {
  max-width: 28em;
}

.start::after,
.ghost::after,
.next::after {
  border: none;
}

@media (max-width: 720px) {
  .options {
    grid-template-columns: 1fr;
  }
  .big-meaning,
  .big-word {
    font-size: 32px;
  }
  .feedback {
    flex-wrap: wrap;
  }
  .intro-art {
    width: 120px;
    height: 120px;
  }
}
</style>
