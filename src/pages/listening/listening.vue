<template>
  <view class="container">
    <view v-if="!started" class="start-screen">
      <BookSwitcher compact training-type="listening" />
      <TrainingStartStats :total="listeningStats.total" :mastered="listeningStats.mastered" />
      <TrainingSetup compact training-type="listening" />
      <button class="btn-start" @tap="startTraining">开始训练</button>
    </view>

    <view v-else-if="!showFinish" class="training-screen">
      <TrainingNavBack @back="requestExit" />

      <TrainingProgressBar
        :current-index="currentIndex"
        :words-in-group="words.length"
      />

      <view class="question-card">
        <button
          type="button"
          class="audio-button"
          hover-class="audio-button-hover"
          @tap.stop="playAudio"
        >
          <text class="audio-icon">{{ isPlaying ? '🔊' : '🔊' }}</text>
        </button>
        <text class="question-hint">{{ isPlaying ? '播放中…' : '点击播放单词发音' }}</text>
        <text v-if="ttsHint" class="tts-hint">{{ ttsHint }}</text>
      </view>

      <view class="options-list">
        <view 
          v-for="(option, index) in options" 
          :key="index"
          :class="['option-item', selectedOption === index ? 'selected' : '', getOptionClass(index)]"
          hover-class="option-hover"
          @tap="selectOption(index)"
        >
          <text class="option-index">{{ optionLabels[index] }}</text>
          <text class="option-text">{{ option }}</text>
          <text v-if="selectedOption === index && showResult" :class="['result-icon', isCorrect ? 'correct' : 'wrong']">
            {{ isCorrect ? '✓' : '✗' }}
          </text>
        </view>
      </view>

      <view v-if="showResult" class="result-section">
        <view :class="['result-card', isCorrect ? 'correct' : 'wrong']">
          <view class="result-header">
            <text v-if="currentWord?.image" class="result-image">{{ currentWord.image }}</text>
            <view class="result-word-info">
              <text class="result-word">{{ currentWord?.word }}</text>
              <text class="result-phonetic">{{ currentWord?.phonetic }}</text>
            </view>
          </view>
          <text class="result-meaning">{{ getWordMeaning(currentWord, vocabStore.meaningType) }}</text>
          <view v-if="currentWord?.example" class="result-example">
            <text>{{ currentWord.example }}</text>
          </view>
        </view>
        <button v-if="showResult && !isLastWord" class="btn-next" @tap="nextWord">下一题</button>
        <TrainingGroupActions
          v-if="showResult && isLastWord"
          @next-group="completeAndNextGroup"
          @finish="completeAndFinish"
        />
      </view>
    </view>

    <view v-else class="finish-screen">
      <view class="finish-icon">{{ sessionAnalysis.accuracy >= 80 ? '🎉' : sessionAnalysis.accuracy >= 60 ? '👍' : '💪' }}</view>
      <text class="finish-title">训练完成!</text>
      <view class="finish-stats">
        <view class="finish-stat">
          <text class="finish-value">{{ sessionAnalysis.correct }}/{{ sessionAnalysis.total }}</text>
          <text class="finish-label">正确</text>
        </view>
        <view class="finish-stat">
          <text class="finish-value">{{ sessionAnalysis.accuracy }}%</text>
          <text class="finish-label">正确率</text>
        </view>
      </view>

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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import type { Vocabulary } from '@/types'
import { getWordMeaning } from '@/utils/vocabulary'
import { buildUniqueOptions } from '@/utils/quiz-options'
import TrainingSetup from '@/components/TrainingSetup.vue'
import TrainingStartStats from '@/components/TrainingStartStats.vue'
import BookSwitcher from '@/components/BookSwitcher.vue'
import TrainingAnalysis from '@/components/TrainingAnalysis.vue'
import TrainingProgressBar from '@/components/TrainingProgressBar.vue'
import TrainingFinishActions from '@/components/TrainingFinishActions.vue'
import TrainingGroupActions from '@/components/TrainingGroupActions.vue'
import TrainingNavBack from '@/components/TrainingNavBack.vue'
import { useSessionAnalysis } from '@/composables/useSessionAnalysis'
import { useTrainingFlow } from '@/composables/useTrainingFlow'
import { ensureTrainingWords, requireLoginForTraining } from '@/composables/useTrainingStart'
import { useUserStore } from '@/stores/user'
import { useDailySession } from '@/composables/useDailySession'
import { speakWord, isTtsSupported, stopSpeak, preloadWordAudio } from '@/utils/tts'
import { consumeTrainingAutoStart } from '@/utils/navigation'
import { onLoad, onShow, onBackPress } from '@dcloudio/uni-app'
import { useGroupComplete } from '@/composables/useGroupComplete'
import { useTrainingExit } from '@/composables/useTrainingExit'

const vocabStore = useVocabularyStore()
const userStore = useUserStore()
const { recordAnswer, getAnalysis, resetSession } = useSessionAnalysis('listening')
const { newlyCovered, resetFlow, loadGroup, finishSession } = useTrainingFlow('listening')

const started = ref(false)
const showResult = ref(false)
const showFinish = ref(false)
const isPlaying = ref(false)
const selectedOption = ref(-1)
const isCorrect = ref(false)
const currentIndex = ref(0)
const words = ref<Vocabulary[]>([])
const options = ref<string[]>([])
const optionLabels = ['A', 'B', 'C', 'D']

const totalCorrect = ref(0)
const totalCount = ref(0)

const listeningStats = ref({ total: 0, mastered: 0, avgMastery: 0 })
const finishDueCount = ref(0)
const weakTopicLabels = ref<string[]>([])
const autoStart = ref(false)
const ttsHint = ref('')
let playToken = 0

const sessionAnalysis = computed(() => getAnalysis())

const currentWord = computed(() => {
  return words.value[currentIndex.value]
})

const isLastWord = computed(() => currentIndex.value === words.value.length - 1)

const preloadListeningAudio = (fromIndex = currentIndex.value) => {
  const current = words.value[fromIndex]
  const next = words.value[fromIndex + 1]
  if (current?.word) preloadWordAudio(current.word)
  if (next?.word) preloadWordAudio(next.word)
}

watch(currentWord, (word) => {
  if (word?.word) preloadListeningAudio(currentIndex.value)
})

const getOptionClass = (index: number) => {
  if (!showResult.value || !currentWord.value) return ''
  const correctAnswer = getWordMeaning(currentWord.value, vocabStore.meaningType)
  if (index === options.value.indexOf(correctAnswer)) return 'correct'
  if (index === selectedOption.value && !isCorrect.value) return 'wrong'
  return ''
}

const playAudio = async () => {
  if (!currentWord.value || isPlaying.value) return

  const token = ++playToken
  isPlaying.value = true
  ttsHint.value = ''
  stopSpeak()

  if (!isTtsSupported()) {
    isPlaying.value = false
    ttsHint.value = '当前环境不支持发音，请使用 Chrome 浏览器'
    uni.showToast({ title: '当前环境不支持发音', icon: 'none' })
    return
  }

  try {
    await speakWord(currentWord.value.word)
    if (token === playToken) {
      ttsHint.value = ''
    }
  } catch {
    if (token === playToken) {
      ttsHint.value = '播放失败，请检查浏览器音量或再点一次喇叭'
      uni.showToast({ title: '播放失败，请再点一次', icon: 'none' })
    }
  } finally {
    if (token === playToken) {
      isPlaying.value = false
    }
  }
}

const selectOption = (index: number) => {
  if (showResult.value) return
  
  selectedOption.value = index
  const correctAnswer = getWordMeaning(currentWord.value!, vocabStore.meaningType)
  isCorrect.value = options.value[index] === correctAnswer
  showResult.value = true
  
  vocabStore.updateWordStats(currentWord.value?.id || '', currentWord.value?.word || '', 'listening', isCorrect.value)
  vocabStore.addTrainingRecord('listening', currentWord.value?.word || '', isCorrect.value)
  recordAnswer(
    currentWord.value!,
    isCorrect.value,
    (w) => vocabStore.getWordStats(w, 'listening'),
    vocabStore.meaningType
  )

  void vocabStore.loadBookProgress()
  
  if (isCorrect.value) {
    totalCorrect.value++
  }
}

const nextWord = async () => {
  currentIndex.value++
  selectedOption.value = -1
  showResult.value = false
  isCorrect.value = false
  generateOptions()
  void playAudio()
}

const generateOptions = () => {
  const current = currentWord.value
  if (!current) return
  
  const allMeanings = words.value.map(w => getWordMeaning(w, vocabStore.meaningType))
  const correctMeaning = getWordMeaning(current, vocabStore.meaningType)
  const otherMeanings = allMeanings.filter(m => m !== correctMeaning)

  options.value = buildUniqueOptions(correctMeaning, otherMeanings, 4)
}

const startGroup = async () => {
  words.value = await loadGroup(vocabStore.studySettings.wordsPerGroup)
}

const { ensureAccessibleBook } = useDailySession()

const startTraining = async () => {
  if (!(await requireLoginForTraining())) return
  if (!vocabStore.ensureBookSelected()) return
  ensureAccessibleBook()

  totalCount.value = vocabStore.studySettings.wordsPerGroup
  totalCorrect.value = 0
  currentIndex.value = 0
  resetSession()
  resetFlow()

  let loadError: unknown
  try {
    await vocabStore.loadBookProgress()
    words.value = await loadGroup(vocabStore.studySettings.wordsPerGroup)
  } catch (error) {
    loadError = error
    words.value = []
  }

  if (!(await ensureTrainingWords(words.value, loadError))) {
    return
  }
  
  selectedOption.value = -1
  showResult.value = false
  showFinish.value = false
  started.value = true
  generateOptions()
  words.value.forEach(w => preloadWordAudio(w.word))
  preloadListeningAudio()
  ttsHint.value = '请先点击喇叭播放发音'
}

const nextGroupTraining = async () => {
  showFinish.value = false
  resetSession()
  resetFlow()
  totalCorrect.value = 0
  currentIndex.value = 0
  selectedOption.value = -1
  showResult.value = false
  ttsHint.value = '请先点击喇叭播放发音'
  try {
    await startGroup()
  } catch (error) {
    if (!(await ensureTrainingWords([], error))) return
    return
  }
  if (!(await ensureTrainingWords(words.value))) return
  generateOptions()
  words.value.forEach(w => preloadWordAudio(w.word))
  preloadListeningAudio()
}

const { completeAndNextGroup, completeAndFinish } = useGroupComplete({
  finishSession,
  nextGroupTraining,
  showFinish,
  showResult,
  finishDueCount,
  weakTopicLabels,
  onAfterNextGroup: () => {
    ttsHint.value = '请先点击喇叭播放发音'
  }
})

const resetTrainingState = () => {
  stopSpeak()
  isPlaying.value = false
  autoStart.value = false
  started.value = false
  showFinish.value = false
  showResult.value = false
  selectedOption.value = -1
  isCorrect.value = false
  currentIndex.value = 0
  words.value = []
  options.value = []
  ttsHint.value = ''
}

const { requestExit } = useTrainingExit({
  beforeExit: stopSpeak,
  onExit: resetTrainingState
})

onBackPress(() => {
  if (started.value && !showFinish.value) {
    requestExit()
    return true
  }
  return false
})

const backToHome = () => {
  uni.navigateBack()
}

const goToVocabulary = () => {
  uni.switchTab({ url: '/pages/vocabulary/vocabulary' })
}

onLoad((query) => {
  if (query?.autoStart === '1') autoStart.value = true
  if (query?.topic) vocabStore.setSessionTopic(query.topic as string)
})

onMounted(async () => {
  await userStore.checkLogin()
  vocabStore.loadBooks()
  vocabStore.loadStats()
  vocabStore.loadSettings()
  ensureAccessibleBook()
  vocabStore.loadBookProgress()
  await vocabStore.loadServerStats()
  listeningStats.value = vocabStore.getTypeStats('listening')
  if (autoStart.value) {
    await startTraining()
  }
})

onShow(async () => {
  if (!autoStart.value && consumeTrainingAutoStart()) {
    autoStart.value = true
    if (!started.value) {
      await startTraining()
    }
  }
})

onUnmounted(() => {
  stopSpeak()
})
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
}

.start-screen {
  padding: 20rpx 24rpx 120rpx;
}

.btn-start {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  margin-top: 8rpx;
}

.btn-start::after {
  border: none;
}

.settings-section {
  background: white;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 25rpx;
}

.section-header {
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.book-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15rpx;
}

.book-option {
  background: #f8f9fa;
  border-radius: 16rpx;
  padding: 25rpx;
  border: 2rpx solid transparent;
  transition: all 0.3s ease;
  
  &.selected {
    border-color: #667eea;
    background: #eef2ff;
  }
}

.book-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}

.book-level {
  font-size: 22rpx;
  color: #667eea;
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 25rpx;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 15rpx;
}

.setting-label {
  font-size: 28rpx;
  color: #666;
}

.setting-select {
  display: flex;
  gap: 15rpx;
}

.select-option {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #666;
  border: 2rpx solid transparent;
  transition: all 0.3s ease;
  
  &.selected {
    background: #667eea;
    color: white;
  }
}

.settings-summary {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #eee;
}

.summary-text {
  font-size: 26rpx;
  color: #999;
  text-align: center;
}

.options-group {
  display: flex;
  flex-direction: column;
  gap: 15rpx;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 25rpx;
  background: #f8f9fa;
  border-radius: 16rpx;
  border: 2rpx solid transparent;
  transition: all 0.3s ease;
  
  &.selected {
    background: #eef2ff;
    border-color: #667eea;
  }
}

.option-label {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.check-mark {
  width: 40rpx;
  height: 40rpx;
  background: #667eea;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24rpx;
}

.training-screen {
  padding: 30rpx;
}

.question-card {
  background: white;
  border-radius: 20rpx;
  padding: 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.audio-button {
  width: 160rpx;
  height: 160rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
  border: none;
  padding: 0;
  line-height: 1;
}

.audio-button::after {
  border: none;
}

.audio-button-hover {
  opacity: 0.85;
  transform: scale(0.96);
}

.audio-icon {
  font-size: 60rpx;
}

.question-hint {
  font-size: 28rpx;
  color: #999;
}

.tts-hint {
  font-size: 24rpx;
  color: #ff9800;
  margin-top: 12rpx;
  display: block;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.option-item {
  display: flex;
  align-items: center;
  background: white;
  border-radius: 16rpx;
  padding: 30rpx;
  border: 2rpx solid transparent;
  transition: all 0.3s ease;
  cursor: pointer;

  &.selected {
    border-color: #667eea;
    background: #f5f7ff;
  }
  
  &.correct {
    border-color: #4caf50;
    background: #e8f5e9;
  }
  
  &.wrong {
    border-color: #f44336;
    background: #ffebee;
  }
}

.option-hover {
  background: #f5f7ff;
}

.option-index {
  width: 56rpx;
  height: 56rpx;
  background: #f0f0f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
  color: #666;
  margin-right: 20rpx;
  
  .selected & {
    background: #667eea;
    color: white;
  }
  
  .correct & {
    background: #4caf50;
    color: white;
  }
  
  .wrong & {
    background: #f44336;
    color: white;
  }
}

.option-text {
  flex: 1;
  font-size: 32rpx;
  color: #333;
}

.result-icon {
  font-size: 40rpx;
  
  &.correct {
    color: #4caf50;
  }
  
  &.wrong {
    color: #f44336;
  }
}

.result-section {
  margin-top: 20rpx;
}

.result-card {
  background: white;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  
  &.correct {
    border-left: 8rpx solid #4caf50;
  }
  
  &.wrong {
    border-left: 8rpx solid #f44336;
  }
}

.result-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.result-image {
  font-size: 80rpx;
}

.result-word-info {
  flex: 1;
}

.result-word {
  font-size: 48rpx;
  font-weight: 600;
  color: #333;
  display: block;
}

.result-phonetic {
  font-size: 28rpx;
  color: #999;
  font-style: italic;
}

.result-meaning {
  font-size: 36rpx;
  font-weight: 500;
  color: #667eea;
  display: block;
  margin-bottom: 20rpx;
}

.result-example {
  background: #f8f9fa;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #666;
  font-style: italic;
}

.btn-next {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 48rpx;
  font-size: 34rpx;
  font-weight: 600;
}

.finish-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 30rpx 120rpx;
  max-height: 100vh;
  overflow-y: auto;
}

.finish-icon {
  font-size: 120rpx;
  margin-bottom: 30rpx;
}

.finish-title {
  font-size: 48rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 50rpx;
}

.finish-stats {
  display: flex;
  gap: 80rpx;
  margin-bottom: 60rpx;
}

.finish-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.finish-value {
  font-size: 56rpx;
  font-weight: 600;
  color: #667eea;
}

.finish-label {
  font-size: 28rpx;
  color: #999;
}

.finish-actions {
  width: 100%;
  display: flex;
  gap: 20rpx;
  margin-top: 10rpx;
}

.btn-secondary {
  flex: 1;
  height: 88rpx;
  background: #f0f0f0;
  color: #666;
  border: none;
  border-radius: 44rpx;
  font-size: 30rpx;
}

.btn-primary {
  flex: 1;
  height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
}
</style>