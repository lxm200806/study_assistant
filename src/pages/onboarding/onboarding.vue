<template>
  <view class="container">
    <view class="progress-dots">
      <view v-for="i in 3" :key="i" :class="['dot', step >= i ? 'active' : '']" />
    </view>

    <view v-if="step === 1" class="step">
      <text class="title">选择考试目标</text>
      <text class="subtitle">我们将为你推荐对应词书</text>
      <view class="book-list">
        <view
          v-for="book in books"
          :key="book.code"
          :class="['book-item', selectedBook === book.code ? 'selected' : '']"
          @tap="selectedBook = book.code"
        >
          <text class="book-name">{{ book.name }}</text>
          <text class="book-level">{{ book.level }}</text>
          <text v-if="book.isFree === false" class="book-lock">🔒</text>
        </view>
      </view>
      <button class="btn-next" @tap="nextStep">下一步</button>
    </view>

    <view v-else-if="step === 2" class="step">
      <text class="title">设定每日目标</text>
      <text class="subtitle">坚持小目标，更容易养成习惯</text>
      <view class="goal-options">
        <view
          v-for="n in goalOptions"
          :key="n"
          :class="['goal-item', dailyGoal === n ? 'selected' : '']"
          @tap="dailyGoal = n"
        >
          <text class="goal-num">{{ n }}</text>
          <text class="goal-label">词/天</text>
        </view>
      </view>
      <button class="btn-next" @tap="nextStep">下一步</button>
    </view>

    <view v-else class="step">
      <text class="title">来试试 10 词体验课</text>
      <text class="subtitle">快速感受智能推荐训练</text>
      <view class="trial-card">
        <text class="trial-icon">📚</text>
        <text class="trial-book">{{ selectedBookName }}</text>
        <text class="trial-desc">10 词认读 · 约 3 分钟</text>
      </view>
      <button class="btn-next" @tap="startTrial">开始体验</button>
      <text class="skip-link" @tap="finishOnboarding">跳过，直接进入</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import { useUserStore } from '@/stores/user'
import { authAPI } from '@/utils/api'

const vocabStore = useVocabularyStore()
const userStore = useUserStore()

const step = ref(1)
const selectedBook = ref('ket')
const dailyGoal = ref(30)
const goalOptions = [20, 30, 50]
const books = ref<Array<{ code: string; name: string; level: string; isFree?: boolean }>>([])

const selectedBookName = computed(() =>
  books.value.find(b => b.code === selectedBook.value)?.name || selectedBook.value
)

const nextStep = () => {
  if (step.value === 1) {
    vocabStore.setCurrentBook(selectedBook.value)
    uni.setStorageSync('studyGoalBook', selectedBook.value)
  }
  if (step.value === 2) {
    uni.setStorageSync('dailyGoal', dailyGoal.value)
    vocabStore.setStudySettings({ wordsPerGroup: 10, groupCount: 1 })
  }
  step.value++
}

const finishOnboarding = async () => {
  try {
    await authAPI.onboard()
    userStore.setOnboarded(true)
  } catch {
    // still proceed locally
    userStore.setOnboarded(true)
  }
  uni.switchTab({ url: '/pages/home/home' })
}

const startTrial = async () => {
  vocabStore.setCurrentBook(selectedBook.value)
  uni.setStorageSync('dailyGoal', dailyGoal.value)
  uni.setStorageSync('studyGoalBook', selectedBook.value)
  vocabStore.setStudySettings({ wordsPerGroup: 10, groupCount: 1, sessionMode: 'smart' })
  try {
    await authAPI.onboard()
    userStore.setOnboarded(true)
  } catch {
    userStore.setOnboarded(true)
  }
  uni.navigateTo({ url: '/pages/recognition/recognition?autoStart=1' })
}

onMounted(async () => {
  await vocabStore.loadBooks()
  books.value = vocabStore.books as typeof books.value
})
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(180deg, #eef2ff 0%, #f5f5f5 40%);
  padding: 60rpx 40rpx;
}

.progress-dots {
  display: flex;
  justify-content: center;
  gap: 16rpx;
  margin-bottom: 60rpx;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #ddd;

  &.active {
    background: #667eea;
    width: 40rpx;
    border-radius: 8rpx;
  }
}

.step {
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 44rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
}

.subtitle {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 40rpx;
}

.book-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 40rpx;
}

.book-item {
  background: white;
  border-radius: 16rpx;
  padding: 28rpx;
  display: flex;
  align-items: center;
  border: 2rpx solid transparent;

  &.selected {
    border-color: #667eea;
    background: #eef2ff;
  }
}

.book-name {
  flex: 1;
  font-size: 32rpx;
  font-weight: 500;
  color: #333;
}

.book-level {
  font-size: 24rpx;
  color: #999;
  margin-right: 12rpx;
}

.goal-options {
  display: flex;
  gap: 20rpx;
  margin-bottom: 40rpx;
}

.goal-item {
  flex: 1;
  background: white;
  border-radius: 16rpx;
  padding: 30rpx;
  text-align: center;
  border: 2rpx solid transparent;

  &.selected {
    border-color: #667eea;
    background: #eef2ff;
  }
}

.goal-num {
  font-size: 48rpx;
  font-weight: 600;
  color: #667eea;
  display: block;
}

.goal-label {
  font-size: 24rpx;
  color: #999;
}

.trial-card {
  background: white;
  border-radius: 20rpx;
  padding: 50rpx;
  text-align: center;
  margin-bottom: 40rpx;
}

.trial-icon {
  font-size: 80rpx;
  display: block;
  margin-bottom: 20rpx;
}

.trial-book {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
  display: block;
}

.trial-desc {
  font-size: 26rpx;
  color: #999;
  margin-top: 12rpx;
  display: block;
}

.btn-next {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 40rpx;
  padding: 28rpx;
  font-size: 32rpx;
}

.skip-link {
  text-align: center;
  font-size: 26rpx;
  color: #999;
  margin-top: 24rpx;
}
</style>
