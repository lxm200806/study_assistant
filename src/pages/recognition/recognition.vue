<template>
  <view class="container">
    <view v-if="!started" class="start-screen">
      <view class="start-icon">👁️</view>
      <text class="start-title">认读训练</text>
      <text class="start-desc">看图选词，训练词汇认读能力</text>
      <view class="start-stats">
        <view class="stat-item">
          <text class="stat-value">{{ readingStats.total }}</text>
          <text class="stat-label">已学词汇</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ readingStats.mastered }}</text>
          <text class="stat-label">已掌握</text>
        </view>
      </view>

      <TrainingSetup training-type="reading" />

      <button class="btn-start" @tap="startTraining">开始训练</button>
    </view>

    <view v-else class="training-screen">
      <TrainingProgressBar
        :current-group="currentGroup"
        :current-index="currentIndex"
        :total-groups="totalGroups"
        :words-in-group="words.length"
      />

      <view class="image-card">
        <view class="image-container" :class="{ 'text-mode': questionDisplay.mode === 'text' }">
          <text v-if="questionDisplay.mode === 'image'" class="image-emoji">{{ questionDisplay.content }}</text>
          <text v-else class="meaning-text">{{ questionDisplay.content }}</text>
        </view>
        <text class="image-hint">{{ recognitionHint }}</text>
      </view>

      <view class="options-grid">
        <view 
          v-for="(option, index) in options" 
          :key="index"
          :class="['option-item', selectedOption === index ? 'selected' : '', getOptionClass(index)]"
          @tap="selectOption(index)"
        >
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
          <text class="result-meaning">{{ getWordMeaning(currentWord!, vocabStore.meaningType) }}</text>
          <view v-if="currentWord?.example" class="result-example">
            <text>{{ currentWord.example }}</text>
          </view>
        </view>
        <button class="btn-next" @tap="nextWord">{{ isLastWord ? '完成训练' : '下一题' }}</button>
      </view>
    </view>

    <view v-if="showFinish" class="finish-screen">
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

      <TrainingAnalysis :analysis="sessionAnalysis" :newly-covered="newlyCovered" />

      <view class="finish-actions">
        <button class="btn-secondary" @tap="goToVocabulary">掌握分析</button>
        <button class="btn-primary" @tap="restartTraining">再来一组</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import type { Vocabulary } from '@/types'
import { getWordMeaning, getWordDisplayLabel, getRecognitionHint } from '@/utils/vocabulary'
import TrainingSetup from '@/components/TrainingSetup.vue'
import TrainingAnalysis from '@/components/TrainingAnalysis.vue'
import TrainingProgressBar from '@/components/TrainingProgressBar.vue'
import { useSessionAnalysis } from '@/composables/useSessionAnalysis'
import { useTrainingFlow } from '@/composables/useTrainingFlow'

const vocabStore = useVocabularyStore()
const { recordAnswer, getAnalysis, resetSession } = useSessionAnalysis('reading')
const { newlyCovered, resetFlow, loadGroup, finishSession } = useTrainingFlow('reading')

const started = ref(false)
const showResult = ref(false)
const showFinish = ref(false)
const selectedOption = ref(-1)
const isCorrect = ref(false)
const currentIndex = ref(0)
const currentGroup = ref(0)
const words = ref<Vocabulary[]>([])
const options = ref<string[]>([])

const totalCorrect = ref(0)
const totalCount = ref(0)
const totalGroups = ref(1)

const readingStats = ref({ total: 0, mastered: 0 })

const sessionAnalysis = computed(() => getAnalysis())

const currentWord = computed(() => words.value[currentIndex.value])

const questionDisplay = computed(() => {
  if (!currentWord.value) return { mode: 'text' as const, content: '' }
  return getWordDisplayLabel(currentWord.value, vocabStore.meaningType)
})

const recognitionHint = computed(() => {
  if (!currentWord.value) return ''
  return getRecognitionHint(currentWord.value, vocabStore.meaningType)
})

const isLastWord = computed(() => {
  return currentIndex.value === words.value.length - 1 && currentGroup.value === totalGroups.value - 1
})

const getOptionClass = (index: number) => {
  if (!showResult.value) return ''
  const correctIndex = options.value.indexOf(currentWord.value?.word || '')
  if (index === correctIndex) return 'correct'
  if (index === selectedOption.value && !isCorrect.value) return 'wrong'
  return ''
}

const selectOption = (index: number) => {
  if (showResult.value) return
  
  selectedOption.value = index
  const correctAnswer = currentWord.value?.word || ''
  isCorrect.value = options.value[index] === correctAnswer
  showResult.value = true
  
  vocabStore.updateWordStats(currentWord.value?.id || '', currentWord.value?.word || '', 'reading', isCorrect.value)
  vocabStore.addTrainingRecord('reading', currentWord.value?.word || '', isCorrect.value)
  recordAnswer(
    currentWord.value!,
    isCorrect.value,
    (w) => vocabStore.getWordStats(w, 'reading'),
    vocabStore.meaningType
  )

  void vocabStore.loadBookProgress()
  
  if (isCorrect.value) {
    totalCorrect.value++
  }
}

const nextWord = async () => {
  if (isLastWord.value) {
    await finishSession()
    showFinish.value = true
    return
  }
  
  if (currentIndex.value === words.value.length - 1) {
    currentGroup.value++
    currentIndex.value = 0
    startGroup()
  } else {
    currentIndex.value++
  }
  
  selectedOption.value = -1
  showResult.value = false
  isCorrect.value = false
  generateOptions()
}

const generateOptions = () => {
  const current = currentWord.value
  if (!current) return
  
  const allWords = words.value.map(w => w.word)
  const otherWords = allWords.filter(w => w !== current.word)
  
  const shuffled = otherWords.sort(() => Math.random() - 0.5)
  const wrongOptions = shuffled.slice(0, 3)
  
  options.value = [current.word, ...wrongOptions].sort(() => Math.random() - 0.5)
}

const startGroup = async () => {
  words.value = await loadGroup(vocabStore.studySettings.wordsPerGroup)
}

const startTraining = async () => {
  if (!vocabStore.ensureBookSelected()) return

  totalGroups.value = vocabStore.studySettings.groupCount
  totalCount.value = vocabStore.studySettings.wordsPerGroup * totalGroups.value
  totalCorrect.value = 0
  currentGroup.value = 0
  currentIndex.value = 0
  resetSession()
  resetFlow()

  await vocabStore.loadBookProgress()
  await startGroup()
  
  selectedOption.value = -1
  showResult.value = false
  showFinish.value = false
  started.value = true
  generateOptions()
}

const restartTraining = () => {
  showFinish.value = false
  startTraining()
}

const backToHome = () => {
  uni.navigateBack()
}

const goToVocabulary = () => {
  uni.switchTab({ url: '/pages/vocabulary/vocabulary' })
}

onMounted(() => {
  vocabStore.loadBooks()
  vocabStore.loadStats()
  vocabStore.loadSettings()
  vocabStore.loadBookProgress()
  readingStats.value = vocabStore.getTypeStats('reading')
})
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
}

.start-screen {
  padding: 30rpx;
}

.start-icon {
  font-size: 120rpx;
  text-align: center;
  margin-bottom: 30rpx;
}

.start-title {
  font-size: 48rpx;
  font-weight: 600;
  color: #333;
  text-align: center;
  display: block;
  margin-bottom: 20rpx;
}

.start-desc {
  font-size: 28rpx;
  color: #999;
  text-align: center;
  display: block;
  margin-bottom: 50rpx;
}

.start-stats {
  display: flex;
  justify-content: center;
  gap: 60rpx;
  margin-bottom: 40rpx;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 48rpx;
  font-weight: 600;
  color: #667eea;
}

.stat-label {
  font-size: 26rpx;
  color: #999;
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

.image-card {
  background: white;
  border-radius: 20rpx;
  padding: 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.image-container {
  width: 300rpx;
  min-height: 300rpx;
  background: #f8f9fa;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
  padding: 30rpx;

  &.text-mode {
    border-radius: 24rpx;
    width: 100%;
    min-height: 200rpx;
  }
}

.image-emoji {
  font-size: 150rpx;
}

.meaning-text {
  font-size: 34rpx;
  color: #333;
  text-align: center;
  line-height: 1.6;
  font-weight: 500;
}

.image-hint {
  font-size: 28rpx;
  color: #999;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 16rpx;
  padding: 35rpx;
  border: 2rpx solid transparent;
  transition: all 0.3s ease;
  
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

.option-text {
  font-size: 32rpx;
  color: #333;
  font-weight: 500;
}

.result-icon {
  font-size: 36rpx;
  margin-left: 15rpx;
  
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