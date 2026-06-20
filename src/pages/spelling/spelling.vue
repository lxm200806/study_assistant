<template>
  <view class="container">
    <view v-if="!started" class="start-screen">
      <BookSwitcher compact training-type="writing" />
      <TrainingStartStats :total="writingStats.total" :mastered="writingStats.mastered" />
      <TrainingSetup compact training-type="writing" />
      <button class="btn-start" @tap="startTraining">开始训练</button>
    </view>

    <view v-else-if="!showFinish" class="training-screen">
      <TrainingProgressBar
        :current-index="currentIndex"
        :words-in-group="words.length"
      />

      <view class="question-card">
        <view v-if="currentWord" class="word-info">
          <text v-if="questionDisplay.mode === 'image'" class="word-image">{{ questionDisplay.content }}</text>
          <text class="word-meaning">{{ questionDisplay.mode === 'text' ? questionDisplay.content : getWordMeaning(currentWord, vocabStore.meaningType) }}</text>
          <text class="word-hint">音标: {{ currentWord.phonetic }}</text>
          <button class="btn-listen" @tap="playSpellingAudio">🔊 听发音</button>
        </view>
      </view>

      <view class="input-card">
        <input 
          class="spell-input" 
          v-model="userInput" 
          placeholder="输入单词拼写"
          :class="{ 'correct': showResult && isCorrect, 'wrong': showResult && !isCorrect }"
          :disabled="showResult"
          @confirm="submitAnswer"
        />
        <button v-if="!showResult" class="btn-submit" @tap="submitAnswer">提交</button>
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
          <text class="result-meaning">{{ getWordMeaning(currentWord!, vocabStore.meaningType) }}</text>
          <view v-if="!isCorrect" class="correct-answer">
            <text class="answer-label">正确答案:</text>
            <text class="answer-text">{{ currentWord?.word }}</text>
          </view>
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
import { ref, computed, onMounted } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import type { Vocabulary } from '@/types'
import { getWordMeaning, getWordDisplayLabel } from '@/utils/vocabulary'
import TrainingSetup from '@/components/TrainingSetup.vue'
import TrainingStartStats from '@/components/TrainingStartStats.vue'
import BookSwitcher from '@/components/BookSwitcher.vue'
import TrainingAnalysis from '@/components/TrainingAnalysis.vue'
import TrainingProgressBar from '@/components/TrainingProgressBar.vue'
import TrainingFinishActions from '@/components/TrainingFinishActions.vue'
import TrainingGroupActions from '@/components/TrainingGroupActions.vue'
import { useSessionAnalysis } from '@/composables/useSessionAnalysis'
import { useTrainingFlow } from '@/composables/useTrainingFlow'
import { ensureTrainingWords } from '@/composables/useTrainingStart'
import { useDailySession } from '@/composables/useDailySession'
import { speakWord } from '@/utils/tts'
import { onLoad } from '@dcloudio/uni-app'
import { useGroupComplete } from '@/composables/useGroupComplete'

const vocabStore = useVocabularyStore()
const { recordAnswer, getAnalysis, resetSession } = useSessionAnalysis('writing')
const { newlyCovered, resetFlow, loadGroup, finishSession } = useTrainingFlow('writing')

const started = ref(false)
const showResult = ref(false)
const showFinish = ref(false)
const isCorrect = ref(false)
const currentIndex = ref(0)
const words = ref<Vocabulary[]>([])
const userInput = ref('')

const totalCorrect = ref(0)
const totalCount = ref(0)

const writingStats = ref({ total: 0, mastered: 0, avgMastery: 0 })
const finishDueCount = ref(0)
const weakTopicLabels = ref<string[]>([])
const autoStart = ref(false)

const playSpellingAudio = async () => {
  if (!currentWord.value) return
  try {
    await speakWord(currentWord.value.word)
  } catch {
    uni.showToast({ title: '播放失败', icon: 'none' })
  }
}

const sessionAnalysis = computed(() => getAnalysis())

const currentWord = computed(() => words.value[currentIndex.value])

const questionDisplay = computed(() => {
  if (!currentWord.value) return { mode: 'text' as const, content: '' }
  return getWordDisplayLabel(currentWord.value, vocabStore.meaningType)
})

const isLastWord = computed(() => currentIndex.value === words.value.length - 1)

const submitAnswer = () => {
  if (!userInput.value.trim() || showResult.value) return
  
  const correctAnswer = currentWord.value?.word || ''
  isCorrect.value = userInput.value.toLowerCase().trim() === correctAnswer.toLowerCase()
  showResult.value = true
  
  vocabStore.updateWordStats(currentWord.value?.id || '', currentWord.value?.word || '', 'writing', isCorrect.value)
  vocabStore.addTrainingRecord('writing', currentWord.value?.word || '', isCorrect.value)
  recordAnswer(
    currentWord.value!,
    isCorrect.value,
    (w) => vocabStore.getWordStats(w, 'writing'),
    vocabStore.meaningType
  )

  void vocabStore.loadBookProgress()
  
  if (isCorrect.value) {
    totalCorrect.value++
  }
}

const nextWord = async () => {
  currentIndex.value++
  userInput.value = ''
  showResult.value = false
  isCorrect.value = false
}

const startGroup = async () => {
  words.value = await loadGroup(vocabStore.studySettings.wordsPerGroup)
}

const { ensureAccessibleBook } = useDailySession()

const startTraining = async () => {
  if (!vocabStore.ensureBookSelected()) return
  ensureAccessibleBook()

  totalCount.value = vocabStore.studySettings.wordsPerGroup
  totalCorrect.value = 0
  currentIndex.value = 0
  resetSession()
  resetFlow()

  await vocabStore.loadBookProgress()
  await startGroup()

  if (!(await ensureTrainingWords(words.value))) {
    return
  }
  
  userInput.value = ''
  showResult.value = false
  showFinish.value = false
  started.value = true
}

const nextGroupTraining = async () => {
  showFinish.value = false
  resetSession()
  resetFlow()
  totalCorrect.value = 0
  currentIndex.value = 0
  userInput.value = ''
  showResult.value = false
  await startGroup()
  if (!(await ensureTrainingWords(words.value))) return
}

const { completeAndNextGroup, completeAndFinish } = useGroupComplete({
  finishSession,
  nextGroupTraining,
  showFinish,
  showResult,
  finishDueCount,
  weakTopicLabels
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
  vocabStore.loadBooks()
  vocabStore.loadStats()
  vocabStore.loadSettings()
  vocabStore.loadBookProgress()
  await vocabStore.loadServerStats()
  writingStats.value = vocabStore.getTypeStats('writing')
  if (autoStart.value) {
    await startTraining()
  }
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

.btn-start {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 48rpx;
  font-size: 34rpx;
  font-weight: 600;
  margin-top: 20rpx;
}

.training-screen {
  padding: 30rpx;
}

.question-card {
  background: white;
  border-radius: 20rpx;
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.word-image {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.word-meaning {
  font-size: 40rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 15rpx;
}

.word-hint {
  font-size: 26rpx;
  color: #999;
  font-style: italic;
  display: block;
  margin-bottom: 16rpx;
}

.btn-listen {
  background: #eef2ff;
  color: #667eea;
  border: none;
  border-radius: 30rpx;
  padding: 16rpx 32rpx;
  font-size: 26rpx;
}

.input-card {
  background: white;
  border-radius: 20rpx;
  padding: 20rpx;
  display: flex;
  gap: 20rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.spell-input {
  flex: 1;
  height: 88rpx;
  border: 2rpx solid #e8e8e8;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 32rpx;
  
  &.correct {
    border-color: #4caf50;
    background: #e8f5e9;
  }
  
  &.wrong {
    border-color: #f44336;
    background: #ffebee;
  }
}

.btn-submit {
  height: 88rpx;
  padding: 0 40rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12rpx;
  font-size: 30rpx;
  font-weight: 600;
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

.correct-answer {
  background: #ffebee;
  padding: 20rpx;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}

.answer-label {
  font-size: 26rpx;
  color: #f44336;
}

.answer-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #f44336;
  margin-left: 10rpx;
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