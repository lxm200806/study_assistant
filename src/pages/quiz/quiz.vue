<template>
  <view class="container">
    <view v-if="!started && !finished" class="start-screen">
      <BookSwitcher compact />
      <view class="start-icon">📝</view>
      <text class="start-title">阶段模拟小测</text>
      <text class="start-desc">30 词限时四选一，检验掌握程度（不更新复习计划）</text>
      <button class="btn-start" @tap="startQuiz">开始测验</button>
    </view>

    <view v-else-if="!finished" class="quiz-screen">
      <view class="quiz-header">
        <text>{{ currentIndex + 1 }} / {{ words.length }}</text>
        <text class="timer">{{ timeLeft }}s</text>
      </view>
      <view class="question-card">
        <text class="question-label">选择正确的英文单词</text>
        <text class="question-hint">{{ getWordMeaning(currentWord!, vocabStore.meaningType) }}</text>
      </view>
      <view class="options">
        <view
          v-for="(opt, i) in options"
          :key="i"
          :class="['option', selected === i ? 'selected' : '', showAnswer ? getOptionClass(i) : '']"
          @tap="selectOption(i)"
        >
          <text>{{ opt }}</text>
        </view>
      </view>
      <button v-if="showAnswer" class="btn-next" @tap="nextQuestion">下一题</button>
    </view>

    <view v-else class="result-screen">
      <view class="result-icon">{{ result?.accuracy >= 80 ? '🎉' : '💪' }}</view>
      <text class="result-title">测验完成</text>
      <text class="result-score">{{ result?.correct }}/{{ result?.total }} · {{ result?.accuracy }}%</text>
      <button class="btn-primary" @tap="goToMap">查看薄弱分析</button>
      <button class="btn-secondary" @tap="goHome">返回首页</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import type { Vocabulary } from '@/types'
import { getWordMeaning } from '@/utils/vocabulary'
import { buildUniqueOptions } from '@/utils/quiz-options'
import { quizAPI } from '@/utils/api'
import { openMapTab } from '@/utils/navigation'
import BookSwitcher from '@/components/BookSwitcher.vue'

const vocabStore = useVocabularyStore()

const started = ref(false)
const finished = ref(false)
const words = ref<Vocabulary[]>([])
const currentIndex = ref(0)
const options = ref<string[]>([])
const selected = ref(-1)
const showAnswer = ref(false)
const answers = ref<{ wordId: string; isCorrect: boolean }[]>([])
const timeLeft = ref(600)
const result = ref<{ total: number; correct: number; accuracy: number } | null>(null)

let timer: ReturnType<typeof setInterval> | null = null

const currentWord = computed(() => words.value[currentIndex.value])

const getOptionClass = (i: number) => {
  const correct = currentWord.value?.word || ''
  if (options.value[i] === correct) return 'correct'
  if (i === selected.value) return 'wrong'
  return ''
}

const buildOptions = () => {
  if (!currentWord.value) return
  const correct = currentWord.value.word
  const candidates = words.value.map(w => w.word).filter(w => w !== correct)
  options.value = buildUniqueOptions(correct, candidates, 4)
}

const selectOption = (i: number) => {
  if (showAnswer.value) return
  selected.value = i
  showAnswer.value = true
  const correct = options.value[i] === currentWord.value?.word
  answers.value.push({ wordId: currentWord.value!.id, isCorrect: correct })
}

const nextQuestion = () => {
  if (currentIndex.value >= words.length - 1) {
    void submitQuiz()
    return
  }
  currentIndex.value++
  selected.value = -1
  showAnswer.value = false
  buildOptions()
}

const startQuiz = async () => {
  if (!vocabStore.ensureBookSelected()) return
  try {
    const res = await quizAPI.words(vocabStore.currentBookCode, 30)
    words.value = (res.data as Vocabulary[]) || []
    if (words.value.length === 0) {
      uni.showToast({ title: '暂无词汇', icon: 'none' })
      return
    }
    started.value = true
    buildOptions()
    timer = setInterval(() => {
      timeLeft.value--
      if (timeLeft.value <= 0) void submitQuiz()
    }, 1000)
  } catch (e: any) {
    uni.showToast({ title: e.message || '加载失败', icon: 'none' })
  }
}

const submitQuiz = async () => {
  if (timer) clearInterval(timer)
  try {
    const res = await quizAPI.submit(vocabStore.currentBookCode, answers.value)
    result.value = res.data as typeof result.value
  } catch {
    const correct = answers.value.filter(a => a.isCorrect).length
    result.value = {
      total: answers.value.length,
      correct,
      accuracy: answers.value.length ? Math.round((correct / answers.value.length) * 100) : 0
    }
  }
  finished.value = true
}

const goToMap = () => {
  openMapTab(vocabStore.currentBookCode)
}

const goHome = () => {
  uni.switchTab({ url: '/pages/home/home' })
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
}

.start-screen, .result-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 20rpx;
}

.start-icon, .result-icon {
  font-size: 100rpx;
  margin: 30rpx 0;
}

.start-title, .result-title {
  font-size: 40rpx;
  font-weight: 600;
  color: #333;
}

.start-desc {
  font-size: 26rpx;
  color: #999;
  text-align: center;
  margin: 16rpx 0 40rpx;
}

.btn-start, .btn-primary, .btn-secondary, .btn-next {
  width: 100%;
  border: none;
  border-radius: 40rpx;
  padding: 24rpx;
  font-size: 32rpx;
  margin-top: 16rpx;
}

.btn-start, .btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  padding: 20rpx;
  font-size: 28rpx;
  color: #666;
}

.question-card {
  background: white;
  border-radius: 20rpx;
  padding: 40rpx;
  text-align: center;
  margin-bottom: 24rpx;
}

.question-word {
  font-size: 44rpx;
  font-weight: 600;
  color: #333;
  display: block;
}

.question-hint {
  font-size: 28rpx;
  color: #999;
  margin-top: 12rpx;
  display: block;
}

.option {
  background: white;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 16rpx;
  font-size: 30rpx;

  &.selected { border: 2rpx solid #667eea; }
  &.correct { background: #e8f5e9; }
  &.wrong { background: #ffebee; }
}

.result-score {
  font-size: 48rpx;
  font-weight: 600;
  color: #667eea;
  margin: 20rpx 0 40rpx;
}
</style>
