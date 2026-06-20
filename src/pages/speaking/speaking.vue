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

      <view class="mode-toggle">
        <text :class="['mode-btn', practiceMode === 'word' ? 'active' : '']" @tap="practiceMode = 'word'">单词</text>
        <text
          :class="['mode-btn', practiceMode === 'example' ? 'active' : '']"
          @tap="practiceMode = 'example'"
        >例句</text>
      </view>

      <view class="word-card">
        <text v-if="currentWord?.image && practiceMode === 'word'" class="word-image">{{ currentWord.image }}</text>
        <text v-if="practiceMode === 'word'" class="word-text">{{ currentWord?.word }}</text>
        <text v-else class="word-text example-text">{{ exampleText || currentWord?.word }}</text>
        <text v-if="practiceMode === 'word'" class="word-phonetic">{{ currentWord?.phonetic }}</text>
        <text class="word-meaning">{{ getWordMeaning(currentWord!, vocabStore.meaningType) }}</text>
      </view>

      <view class="action-row">
        <button class="btn-audio" @tap="playReference">🔊 听标准音</button>
        <button :class="['btn-record', isRecording ? 'recording' : '']" @tap="toggleRecord">
          {{ isRecording ? '⏹ 停止录音' : '🎤 开始跟读' }}
        </button>
      </view>

      <view v-if="hasRecorded && recordPath" class="replay-row">
        <button class="btn-replay" @tap="replayRecording">▶ 回放我的录音</button>
      </view>

      <view v-if="assessResult" class="assess-card">
        <text class="assess-line">识别：{{ assessResult.transcript || '—' }}</text>
        <text class="assess-line">得分：{{ assessResult.score }} · {{ assessResult.feedback }}</text>
      </view>

      <view v-if="hasRecorded && !showGroupActions && !isAssessing" class="self-check">
        <text class="check-hint">{{ assessResult ? '确认结果或手动调整：' : '跟读完成，自评一下：' }}</text>
        <view class="check-btns">
          <button class="btn-good" @tap="submitPractice(true)">练好了 ✓</button>
          <button class="btn-weak" @tap="submitPractice(false)">还需练习</button>
        </view>
      </view>

      <view v-if="isAssessing" class="assessing-hint">
        <text>正在评估发音...</text>
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
      <TrainingAnalysis
        :analysis="sessionAnalysis"
        :newly-covered="newlyCovered"
        :due-count="dueCount"
        :weak-topics="weakTopicLabels"
      />
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
import { speakWord, speakText } from '@/utils/tts'
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
import { useAudioSession } from '@/composables/useAudioSession'

const vocabStore = useVocabularyStore()
const audio = useAudioSession()
const { recordAnswer, getAnalysis, resetSession } = useSessionAnalysis('speaking')
const { newlyCovered, resetFlow, loadGroup, finishSession } = useTrainingFlow('speaking')

const started = ref(false)
const showFinish = ref(false)
const isRecording = ref(false)
const hasRecorded = ref(false)
const isAssessing = ref(false)
const currentIndex = ref(0)
const words = ref<Vocabulary[]>([])
const dueCount = ref(0)
const weakTopicLabels = ref<string[]>([])
const speakingStats = ref({ total: 0, mastered: 0, avgMastery: 0 })
const autoStart = ref(false)
const showGroupActions = ref(false)
const practiceMode = ref<'word' | 'example'>('word')
const recordPath = ref('')
const assessResult = ref<{ transcript: string; score: number; passed: boolean; feedback: string } | null>(null)

const sessionAnalysis = computed(() => getAnalysis())
const currentWord = computed(() => words.value[currentIndex.value])
const isLastWord = computed(() => currentIndex.value === words.value.length - 1)
const exampleText = computed(() => currentWord.value?.example || '')

const referenceText = computed(() => {
  if (practiceMode.value === 'example' && exampleText.value) return exampleText.value
  return currentWord.value?.word || ''
})

const playReference = async () => {
  if (!currentWord.value) return
  try {
    if (practiceMode.value === 'example' && exampleText.value) {
      await speakText(exampleText.value)
    } else {
      await speakWord(currentWord.value.word)
    }
  } catch {
    uni.showToast({ title: '播放失败', icon: 'none' })
  }
}

const runAssess = async (path: string) => {
  if (!referenceText.value) return
  isAssessing.value = true
  assessResult.value = null
  try {
    const result = await audio.assessPronunciation(path, referenceText.value)
    if (result) assessResult.value = result
  } catch {
    // fallback to self-check only
  } finally {
    isAssessing.value = false
  }
}

const toggleRecord = async () => {
  if (isRecording.value) {
    isRecording.value = false
    try {
      recordPath.value = await audio.stopRecord()
      hasRecorded.value = true
      await runAssess(recordPath.value)
    } catch {
      uni.showToast({ title: '录音失败', icon: 'none' })
      hasRecorded.value = false
    }
  } else {
    assessResult.value = null
    hasRecorded.value = false
    recordPath.value = ''
    try {
      await audio.startRecord()
      isRecording.value = true
    } catch (error) {
      const msg = (error as Error).message || ''
      uni.showToast({
        title: msg.includes('麦克风') || msg.includes('不支持') ? msg : '无法开始录音',
        icon: 'none'
      })
    }
  }
}

const replayRecording = async () => {
  if (!recordPath.value) return
  try {
    await audio.playLocal(recordPath.value)
  } catch {
    uni.showToast({ title: '回放失败', icon: 'none' })
  }
}

const submitPractice = async (manualCorrect: boolean) => {
  if (!currentWord.value) return
  const correct = assessResult.value?.passed ?? manualCorrect
  vocabStore.updateWordStats(currentWord.value.id, currentWord.value.word, 'speaking', correct)
  vocabStore.addTrainingRecord('speaking', currentWord.value.word, correct)
  recordAnswer(
    currentWord.value,
    correct,
    (w) => vocabStore.getWordStats(w, 'speaking'),
    vocabStore.meaningType
  )
  hasRecorded.value = false
  recordPath.value = ''
  assessResult.value = null
  if (isLastWord.value) {
    showGroupActions.value = true
    return
  }
  currentIndex.value++
  void playReference()
}

const startGroup = async () => {
  words.value = await loadGroup(vocabStore.studySettings.wordsPerGroup)
}

const { ensureAccessibleBook } = useDailySession()

const resetWordState = () => {
  hasRecorded.value = false
  recordPath.value = ''
  assessResult.value = null
  isRecording.value = false
}

const startTraining = async () => {
  if (!vocabStore.ensureBookSelected()) return
  ensureAccessibleBook()
  currentIndex.value = 0
  resetSession()
  resetFlow()
  resetWordState()
  await vocabStore.loadBookProgress()
  await startGroup()

  if (!(await ensureTrainingWords(words.value))) {
    return
  }

  started.value = true
  showFinish.value = false
  void playReference()
}

const nextGroupTraining = async () => {
  showFinish.value = false
  showGroupActions.value = false
  resetSession()
  resetFlow()
  currentIndex.value = 0
  resetWordState()
  await startGroup()
  if (!(await ensureTrainingWords(words.value))) return
  void playReference()
}

const { completeAndNextGroup, completeAndFinish } = useGroupComplete({
  finishSession,
  nextGroupTraining,
  showFinish,
  showResult: showGroupActions,
  finishDueCount: dueCount,
  weakTopicLabels,
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

.mode-toggle {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.mode-btn {
  flex: 1;
  text-align: center;
  padding: 16rpx;
  background: white;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #666;

  &.active {
    background: #667eea;
    color: white;
    font-weight: 600;
  }
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

  &.example-text {
    font-size: 32rpx;
    line-height: 1.5;
  }
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

.action-row, .replay-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.btn-audio, .btn-record, .btn-replay {
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

.assess-card {
  background: #eef2ff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.assess-line {
  display: block;
  font-size: 24rpx;
  color: #333;
  margin-bottom: 6rpx;
}

.assessing-hint {
  text-align: center;
  padding: 20rpx;
  color: #999;
  font-size: 26rpx;
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
