<template>
  <view class="container">
    <view class="header">
      <view class="user-info">
        <view class="avatar">
          <text class="avatar-text">{{ userStore.username.charAt(0) }}</text>
        </view>
        <view class="greeting">
          <text class="greeting-text">你好, {{ userStore.username }}</text>
          <text class="date-text">{{ currentDate }}</text>
        </view>
      </view>
      <view class="header-actions">
        <view v-if="userStore.isAdmin" class="admin-btn" @tap="goAdmin">
          <text>词库管理</text>
        </view>
        <view class="logout-btn" @tap="handleLogout">
          <text class="logout-icon">退出</text>
        </view>
      </view>
    </view>

    <view class="stats-card">
      <view class="stats-header">
        <text class="stats-title">今日学习</text>
        <text class="stats-subtitle">{{ todayStats.total }} 词</text>
      </view>
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: todayStats.accuracy + '%' }"></view>
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
      <view class="action-card" @tap="goToBooks">
        <view class="action-icon">📚</view>
        <text class="action-title">词汇书</text>
        <text class="action-desc">{{ vocabStore.getCurrentBook?.name || '选择词汇书' }}</text>
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
      <view class="action-card" @tap="goToChat">
        <view class="action-icon">💬</view>
        <text class="action-title">AI陪聊</text>
        <text class="action-desc">口语练习</text>
      </view>
    </view>

    <view class="vocabulary-stats">
      <view class="section-header">
        <text class="section-title">词汇掌握</text>
        <text class="section-link" @tap="goToVocabulary">查看详情 →</text>
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

    <view v-if="reviewWords.length > 0" class="review-section">
      <view class="section-header">
        <text class="section-title">复习提醒</text>
        <text class="section-badge">{{ reviewWords.length }} 词待复习</text>
      </view>
      <view class="review-words">
        <view 
          v-for="word in reviewWords.slice(0, 5)" 
          :key="word" 
          class="review-word"
          @tap="startReview"
        >
          <text class="word-text">{{ word }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useVocabularyStore } from '@/stores/vocabulary'

const userStore = useUserStore()
const vocabStore = useVocabularyStore()

const currentDate = ref('')
const reviewWords = ref<string[]>([])

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
  
  todayStats.value = vocabStore.getTodayStats
  
  listeningStats.value = vocabStore.getTypeStats('listening')
  speakingStats.value = vocabStore.getTypeStats('speaking')
  readingStats.value = vocabStore.getTypeStats('reading')
  writingStats.value = vocabStore.getTypeStats('writing')
  
  const [listeningReview, speakingReview, readingReview, writingReview] = await Promise.all([
    vocabStore.getWordsForReview('listening'),
    vocabStore.getWordsForReview('speaking'),
    vocabStore.getWordsForReview('reading'),
    vocabStore.getWordsForReview('writing')
  ])
  
  const allReviewWords = [...listeningReview, ...speakingReview, ...readingReview, ...writingReview]
  reviewWords.value = [...new Set(allReviewWords)]
}

const handleLogout = () => {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗?',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
      }
    }
  })
}

const goAdmin = () => {
  uni.navigateTo({ url: '/pages/admin/admin' })
}

const goToBooks = () => {
  uni.navigateTo({ url: '/pages/books/books' })
}

const goToListening = () => {
  uni.navigateTo({ url: '/pages/listening/listening' })
}

const goToRecognition = () => {
  uni.navigateTo({ url: '/pages/recognition/recognition' })
}

const goToSpelling = () => {
  uni.navigateTo({ url: '/pages/spelling/spelling' })
}

const goToChat = () => {
  uni.switchTab({ url: '/pages/chat/chat' })
}

const goToVocabulary = () => {
  uni.switchTab({ url: '/pages/vocabulary/vocabulary' })
}

const startReview = () => {
  uni.showToast({ title: '开始复习', icon: 'none' })
}

onMounted(async () => {
  await userStore.checkLogin()
  updateDate()
  vocabStore.loadBooks()
  vocabStore.loadSettings()
  loadStats()
})
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.admin-btn {
  padding: 15rpx 24rpx;
  background: #eef2ff;
  border-radius: 30rpx;
  font-size: 24rpx;
  color: #667eea;
}

.logout-btn {
  padding: 15rpx 30rpx;
  background: #f5f5f5;
  border-radius: 30rpx;
}

.logout-icon {
  font-size: 26rpx;
  color: #666;
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

.section-badge {
  font-size: 22rpx;
  color: #fff;
  background: #ff6b6b;
  padding: 5rpx 15rpx;
  border-radius: 20rpx;
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

.review-section {
  background: white;
  border-radius: 16rpx;
  padding: 20rpx;
}

.review-words {
  display: flex;
  flex-wrap: wrap;
  gap: 15rpx;
}

.review-word {
  background: #fff3e0;
  padding: 15rpx 25rpx;
  border-radius: 30rpx;
  border: 1rpx solid #ffe0b2;
}

.word-text {
  font-size: 26rpx;
  color: #ff9800;
}
</style>
