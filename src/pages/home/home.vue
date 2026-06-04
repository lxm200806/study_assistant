<template>
  <view class="container">
    <view class="header" @tap="goToMine">
      <view class="user-info">
        <view class="avatar">
          <text class="avatar-text">{{ userStore.username.charAt(0) }}</text>
        </view>
        <view class="greeting">
          <text class="greeting-text">你好, {{ userStore.username }}</text>
          <text class="date-text">{{ currentDate }}</text>
        </view>
      </view>
      <text class="header-link">我的 ›</text>
    </view>

    <BookSwitcher @change="onBookChange" />

    <view class="daily-cta" @tap="startDailyLearning">
      <view class="daily-cta-main">
        <text class="daily-cta-title">开始今日学习</text>
        <text class="daily-cta-desc">
          {{ dueCount > 0 ? `${dueCount} 词待复习 · 智能推荐` : '智能推荐新词' }}
          · 目标 {{ dailyGoal }} 词
        </text>
      </view>
      <text class="daily-cta-arrow">→</text>
    </view>

    <view class="stats-card">
      <view class="stats-header">
        <text class="stats-title">今日进度</text>
        <text class="stats-subtitle">{{ dailyWordCount }}/{{ dailyGoal }} 词 · 🔥 {{ streak }} 天</text>
      </view>
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: dailyProgress + '%' }"></view>
      </view>
      <view class="stats-detail">
        <view class="stat-item">
          <text class="stat-value">{{ todayStats.correct }}</text>
          <text class="stat-label">正确</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ todayStats.total - todayStats.correct }}</text>
          <text class="stat-label">错误</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ todayStats.accuracy }}%</text>
          <text class="stat-label">正确率</text>
        </view>
      </view>
    </view>

    <view class="quick-actions">
      <view v-if="!vocabStore.currentBookCode" class="action-card" @tap="goToBooks">
        <view class="action-icon">📚</view>
        <text class="action-title">词汇书</text>
        <text class="action-desc">选择词汇书</text>
      </view>
      <view class="action-card" @tap="goToListening">
        <view class="action-icon">🎧</view>
        <text class="action-title">听力训练</text>
        <text class="action-desc">训练听力词汇</text>
      </view>
      <view class="action-card" @tap="goToRecognition">
        <view class="action-icon">👁️</view>
        <text class="action-title">认读训练</text>
        <text class="action-desc">看图识词</text>
      </view>
      <view class="action-card" @tap="goToSpelling">
        <view class="action-icon">✍️</view>
        <text class="action-title">拼写训练</text>
        <text class="action-desc">听写单词</text>
      </view>
      <view class="action-card" @tap="goToSpeaking">
        <view class="action-icon">👄</view>
        <text class="action-title">口语训练</text>
        <text class="action-desc">跟读练习</text>
      </view>
      <view class="action-card" @tap="goToQuiz">
        <view class="action-icon">📝</view>
        <text class="action-title">阶段小测</text>
        <text class="action-desc">30 词模拟测</text>
      </view>
      <view class="action-card" @tap="goToChat">
        <view class="action-icon">💬</view>
        <text class="action-title">AI陪聊</text>
        <text class="action-desc">口语练习</text>
      </view>
    </view>

    <view class="vocabulary-stats">
      <view class="section-header">
        <text class="section-title">词汇掌握</text>
        <text class="section-link" @tap="goToVocabulary">查看统计 →</text>
      </view>
      <view class="vocab-cards">
        <view class="vocab-item">
          <view class="vocab-icon">🎧</view>
          <view class="vocab-info">
            <text class="vocab-label">听力词汇</text>
            <text class="vocab-count">{{ listeningStats.total }} 词</text>
          </view>
          <view class="vocab-stars">
            <text v-for="i in 5" :key="i" :class="['star', i <= listeningStats.avgMastery ? 'active' : '']">★</text>
          </view>
        </view>
        <view class="vocab-item">
          <view class="vocab-icon">👄</view>
          <view class="vocab-info">
            <text class="vocab-label">口语词汇</text>
            <text class="vocab-count">{{ speakingStats.total }} 词</text>
          </view>
          <view class="vocab-stars">
            <text v-for="i in 5" :key="i" :class="['star', i <= speakingStats.avgMastery ? 'active' : '']">★</text>
          </view>
        </view>
        <view class="vocab-item">
          <view class="vocab-icon">📖</view>
          <view class="vocab-info">
            <text class="vocab-label">认读词汇</text>
            <text class="vocab-count">{{ readingStats.total }} 词</text>
          </view>
          <view class="vocab-stars">
            <text v-for="i in 5" :key="i" :class="['star', i <= readingStats.avgMastery ? 'active' : '']">★</text>
          </view>
        </view>
        <view class="vocab-item">
          <view class="vocab-icon">✏️</view>
          <view class="vocab-info">
            <text class="vocab-label">拼写词汇</text>
            <text class="vocab-count">{{ writingStats.total }} 词</text>
          </view>
          <view class="vocab-stars">
            <text v-for="i in 5" :key="i" :class="['star', i <= writingStats.avgMastery ? 'active' : '']">★</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useVocabularyStore } from '@/stores/vocabulary'
import BookSwitcher from '@/components/BookSwitcher.vue'
import { useDailySession } from '@/composables/useDailySession'
import { openPage } from '@/utils/navigation'

const userStore = useUserStore()
const vocabStore = useVocabularyStore()
const { startDailyTraining, getDailyGoal, ensureAccessibleBook } = useDailySession()

const currentDate = ref('')
const dueCount = ref(0)
const dailyGoal = ref(30)
const dailyWordCount = ref(0)
const streak = ref(0)
const dailyProgress = ref(0)

const todayStats = ref({
  total: 0,
  correct: 0,
  accuracy: 0
})

const listeningStats = ref({ total: 0, mastered: 0, avgMastery: 0 })
const speakingStats = ref({ total: 0, mastered: 0, avgMastery: 0 })
const readingStats = ref({ total: 0, mastered: 0, avgMastery: 0 })
const writingStats = ref({ total: 0, mastered: 0, avgMastery: 0 })

const updateDate = () => {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', weekday: 'long' }
  currentDate.value = now.toLocaleDateString('zh-CN', options)
}

const loadStats = async () => {
  await vocabStore.loadVocabulary()
  vocabStore.loadStats()
  vocabStore.loadTrainingRecords()
  
  await vocabStore.loadServerStats()
  await vocabStore.loadDueCount()
  await vocabStore.loadDailyStats()
  
  dueCount.value = vocabStore.dueCount.dueCount
  dailyGoal.value = getDailyGoal()
  dailyWordCount.value = vocabStore.dailyStats.wordCount
  streak.value = vocabStore.dailyStats.streak
  dailyProgress.value = vocabStore.dailyStats.progress
  
  todayStats.value = vocabStore.getTodayStats
  
  listeningStats.value = vocabStore.getTypeStats('listening')
  speakingStats.value = vocabStore.getTypeStats('speaking')
  readingStats.value = vocabStore.getTypeStats('reading')
  writingStats.value = vocabStore.getTypeStats('writing')
}

const startDailyLearning = () => {
  void startDailyTraining('reading')
}

const goToMine = () => {
  uni.switchTab({ url: '/pages/mine/mine' })
}

const goToBooks = () => {
  uni.navigateTo({ url: '/pages/books/books' })
}

const goToListening = () => {
  openPage('/pages/listening/listening')
}

const goToRecognition = () => {
  uni.navigateTo({ url: '/pages/recognition/recognition' })
}

const goToSpelling = () => {
  uni.navigateTo({ url: '/pages/spelling/spelling' })
}

const goToSpeaking = () => {
  uni.navigateTo({ url: '/pages/speaking/speaking' })
}

const goToQuiz = () => {
  uni.navigateTo({ url: '/pages/quiz/quiz' })
}

const goToChat = () => {
  uni.navigateTo({ url: '/pages/chat/chat' })
}

const goToVocabulary = () => {
  uni.switchTab({ url: '/pages/vocabulary/vocabulary' })
}

onMounted(async () => {
  await userStore.checkLogin()
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  if (!userStore.hasOnboarded) {
    uni.reLaunch({ url: '/pages/onboarding/onboarding' })
    return
  }
  updateDate()
  vocabStore.loadBooks()
  vocabStore.loadSettings()
  ensureAccessibleBook()
  loadStats()
})

const onBookChange = async () => {
  await loadStats()
}
</script>

<style lang="scss" scoped>
.container {
  padding: 20rpx;
  padding-bottom: 120rpx;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0 30rpx;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.avatar {
  width: 80rpx;
  height: 80rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 36rpx;
  color: white;
  font-weight: 600;
}

.greeting {
  display: flex;
  flex-direction: column;
}

.greeting-text {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.date-text {
  font-size: 24rpx;
  color: #999;
  margin-top: 5rpx;
}

.header-link {
  font-size: 26rpx;
  color: #667eea;
  flex-shrink: 0;
}

.daily-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  border-radius: 20rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(102, 126, 234, 0.15);
  border: 2rpx solid #eef2ff;
}

.daily-cta-main {
  flex: 1;
}

.daily-cta-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
  display: block;
}

.daily-cta-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 6rpx;
  display: block;
}

.daily-cta-arrow {
  font-size: 40rpx;
  color: #667eea;
}

.stats-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.stats-title {
  font-size: 32rpx;
  color: white;
  font-weight: 600;
}

.stats-subtitle {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
}

.progress-bar {
  height: 12rpx;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 6rpx;
  margin-bottom: 25rpx;
}

.progress-fill {
  height: 100%;
  background: white;
  border-radius: 6rpx;
  transition: width 0.3s ease;
}

.stats-detail {
  display: flex;
  justify-content: space-around;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 40rpx;
  color: white;
  font-weight: 600;
}

.stat-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 5rpx;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.action-card {
  background: white;
  border-radius: 16rpx;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.action-icon {
  font-size: 60rpx;
  margin-bottom: 15rpx;
}

.action-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 5rpx;
}

.action-desc {
  font-size: 24rpx;
  color: #999;
}

.vocabulary-stats {
  margin-bottom: 30rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.section-link {
  font-size: 26rpx;
  color: #667eea;
}

.vocab-cards {
  background: white;
  border-radius: 16rpx;
  padding: 20rpx;
}

.vocab-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
  
  &:last-child {
    border-bottom: none;
  }
}

.vocab-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.vocab-info {
  flex: 1;
}

.vocab-label {
  font-size: 28rpx;
  color: #666;
  display: block;
}

.vocab-count {
  font-size: 24rpx;
  color: #999;
}

.vocab-stars {
  display: flex;
  gap: 5rpx;
}

.star {
  font-size: 28rpx;
  color: #ddd;
  
  &.active {
    color: #ffc107;
  }
}
</style>
