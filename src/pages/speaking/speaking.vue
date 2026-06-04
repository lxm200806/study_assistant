<template>
  <view class="container">
    <view v-if="!started" class="start-screen">
      <BookSwitcher compact training-type="speaking" />
      <TrainingStartStats :total="speakingStats.total" :mastered="speakingStats.mastered" />
      <TrainingSetup compact training-type="speaking" />
      <button class="btn-start" @tap="startTraining">开始训练</button>
    </view>

    <view v-else-if="!showFinish" class="training-screen">
      <TrainingProgressBar
        :current-index="currentIndex"
        :words-in-group="words.length"
      />

      <view class="word-card">
        <text v-if="currentWord?.image" class="word-image">{{ currentWord.image }}</text>
        <text class="word-text">{{ currentWord?.word }}</text>
        <text class="word-phonetic">{{ currentWord?.phonetic }}</text>
        <text class="word-meaning">{{ getWordMeaning(currentWord!, vocabStore.meaningType) }}</text>
      </view>

      <view class="action-row">
        <button class="btn-audio" @tap="playWord">🔊 听发音</button>
        <button :class="['btn-record', isRecording ? 'recording' : '']" @tap="toggleRecord">
          {{ isRecording ? '⏹ 停止录音' : '🎤 开始跟读' }}
        </button>
      </view>

      <view v-if="hasRecorded && !showGroupActions" class="self-check">
        <text class="check-hint">跟读完成，自评一下：</text>
        <view class="check-btns">
          <button class="btn-good" @tap="submitPractice(true)">练好了 ✓</button>
          <button class="btn-weak" @tap="submitPractice(false)">还需练习</button>
        </view>
      </view>

      <TrainingGroupActions
        v-if="showGroupActions"
        @next-group="completeAndNextGroup"
        @finish="completeAndFinish"
      />
    </view>

    <view v-else class="finish-screen">
      <view class="finish-icon">🎉</view>
      <text class="finish-title">口语训练完成!</text>
      <TrainingAnalysis :analysis="sessionAnalysis" :newly-covered="newlyCovered" :due-count="dueCount" />
      <TrainingFinishActions />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useVocabularyStore } from '@/stores/vocabulary'
import type { Vocabulary } from '@/types'
import { getWordMeaning } from '@/utils/vocabulary'
import { speakWord } from '@/utils/tts'
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
import { useGroupComplete } from '@/composables/useGroupComplete'
import { useDailySession } from '@/composables/useDailySession'

const vocabStore = useVocabularyStore()
const { recordAnswer, getAnalysis, resetSession } = useSessionAnalysis('speaking')
const { newlyCovered, resetFlow, loadGroup, finishSession } = useTrainingFlow('speaking')

const started = ref(false)
const showFinish = ref(false)
const isRecording = ref(false)
const hasRecorded = ref(false)
const currentIndex = ref(0)
const words = ref<Vocabulary[]>([])
const dueCount = ref(0)
const speakingStats = ref({ total: 0, mastered: 0, avgMastery: 0 })
const autoStart = ref(false)
const showGroupActions = ref(false)

let recorder: UniApp.RecorderManager | null = null

const sessionAnalysis = computed(() => getAnalysis())
const currentWord = computed(() => words.value[currentIndex.value])
const isLastWord = computed(() => currentIndex.value === words.value.length - 1)

const playWord = async () => {
  if (!currentWord.value) return
  try {
    await speakWord(currentWord.value.word)
  } catch {
    uni.showToast({ title: '播放失败', icon: 'none' })
  }
}

const toggleRecord = () => {
  if (!recorder) {
    recorder = uni.getRecorderManager()
    recorder.onStop(() => {
      isRecording.value = false
      hasRecorded.value = true
    })
  }
  if (isRecording.value) {
    recorder.stop()
  } else {
    hasRecorded.value = false
    isRecording.value = true
    recorder.start({ format: 'mp3' })
  }
}

const submitPractice = async (correct: boolean) => {
  if (!currentWord.value) return
  vocabStore.updateWordStats(currentWord.value.id, currentWord.value.word, 'speaking', correct)
  vocabStore.addTrainingRecord('speaking', currentWord.value.word, correct)
  recordAnswer(
    currentWord.value,
    correct,
    (w) => vocabStore.getWordStats(w, 'speaking'),
    vocabStore.meaningType
  )
  hasRecorded.value = false
  if (isLastWord.value) {
    showGroupActions.value = true
    return
  }
  currentIndex.value++
  void playWord()
}

const startGroup = async () => {
  words.value = await loadGroup(vocabStore.studySettings.wordsPerGroup)
}

const { ensureAccessibleBook } = useDailySession()

const startTraining = async () => {
  if (!vocabStore.ensureBookSelected()) return
  ensureAccessibleBook()
  currentIndex.value = 0
  resetSession()
  resetFlow()
  await vocabStore.loadBookProgress()
  await startGroup()

  if (!(await ensureTrainingWords(words.value))) {
    return
  }

  started.value = true
  showFinish.value = false
  void playWord()
}

const nextGroupTraining = async () => {
  showFinish.value = false
  showGroupActions.value = false
  resetSession()
  resetFlow()
  currentIndex.value = 0
  hasRecorded.value = false
  await startGroup()
  if (!(await ensureTrainingWords(words.value))) return
  void playWord()
}

const { completeAndNextGroup, completeAndFinish } = useGroupComplete({
  finishSession,
  nextGroupTraining,
  showFinish,
  showResult: showGroupActions,
  finishDueCount: dueCount,
  onAfterNextGroup: () => {
    showGroupActions.value = false
  }
})

onLoad((query) => {
  if (query?.autoStart === '1') autoStart.value = true
  if (query?.topic) vocabStore.setSessionTopic(query.topic as string)
})

onMounted(async () => {
  vocabStore.loadBooks()
  vocabStore.loadStats()
  vocabStore.loadSettings()
  await vocabStore.loadServerStats()
  speakingStats.value = vocabStore.getTypeStats('speaking')
  if (autoStart.value) {
    await startTraining()
  }
})
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
}

.start-screen {
  padding: 20rpx 24rpx 120rpx;
}

.finish-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 20rpx;
}

.finish-icon {
  font-size: 100rpx;
  margin: 30rpx 0;
}

.finish-title {
  font-size: 40rpx;
  font-weight: 600;
  color: #333;
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

.word-card {
  background: white;
  border-radius: 20rpx;
  padding: 40rpx;
  margin: 20rpx 0;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.word-image {
  font-size: 80rpx;
  display: block;
  margin-bottom: 16rpx;
}

.word-text {
  font-size: 48rpx;
  font-weight: 600;
  color: #333;
  display: block;
}

.word-phonetic {
  font-size: 28rpx;
  color: #999;
  display: block;
  margin: 8rpx 0;
}

.word-meaning {
  font-size: 32rpx;
  color: #667eea;
  display: block;
}

.action-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.btn-audio, .btn-record {
  flex: 1;
  border: none;
  border-radius: 40rpx;
  padding: 24rpx;
  font-size: 28rpx;
  background: white;
  color: #333;
}

.btn-record.recording {
  background: #ffebee;
  color: #f44336;
}

.self-check {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx;
}

.check-hint {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 16rpx;
  text-align: center;
}

.check-btns {
  display: flex;
  gap: 16rpx;
}

.btn-good, .btn-weak {
  flex: 1;
  border: none;
  border-radius: 40rpx;
  padding: 20rpx;
  font-size: 28rpx;
}

.btn-good {
  background: #e8f5e9;
  color: #2e7d32;
}

.btn-weak {
  background: #fff3e0;
  color: #e65100;
}
</style>
