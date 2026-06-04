<template>
  <view class="container">
    <view class="hero">
      <text class="hero-title">学习会员</text>
      <text class="hero-desc">解锁全部词书 · 无限 AI 陪聊</text>
    </view>

    <view class="plan-card featured">
      <text class="plan-badge">推荐</text>
      <text class="plan-name">Premium 会员</text>
      <text class="plan-price">¥29.9 / 月</text>
      <view class="plan-features">
        <text>✓ 四本考纲词书全部解锁</text>
        <text>✓ AI 陪聊不限次数</text>
        <text>✓ 阶段模拟小测报告</text>
        <text>✓ 家长周报分享</text>
      </view>
      <button class="btn-subscribe" @tap="subscribe">开通会员（演示）</button>
    </view>

    <view class="plan-card">
      <text class="plan-name">免费版</text>
      <text class="plan-price">¥0</text>
      <view class="plan-features">
        <text>✓ KET 词书</text>
        <text>✓ 每日 20 词训练</text>
        <text>✓ AI 陪聊 5 条/天</text>
      </view>
    </view>

    <view class="books-section">
      <text class="section-title">词书解锁状态</text>
      <view v-for="book in books" :key="book.code" class="book-row">
        <text class="book-name">{{ book.name }}</text>
        <text :class="['book-status', isUnlocked(book) ? 'unlocked' : 'locked']">
          {{ isUnlocked(book) ? '已解锁' : '🔒 会员解锁' }}
        </text>
      </view>
    </view>

    <view id="parent-report" class="report-section">
      <text class="section-title">家长周报</text>
      <view v-if="weeklyReport" class="report-card">
        <text>本周学习 {{ weeklyReport.totalWords }} 词 · 活跃 {{ weeklyReport.activeDays }} 天</text>
        <text>正确率 {{ weeklyReport.accuracy }}% · 连续打卡 {{ weeklyReport.streak }} 天</text>
      </view>
      <button class="btn-share" @tap="shareReport">分享给家长</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useVocabularyStore } from '@/stores/vocabulary'
import { useUserStore } from '@/stores/user'
import { statsAPI } from '@/utils/api'

const vocabStore = useVocabularyStore()
const userStore = useUserStore()

const books = ref(vocabStore.books)
const weeklyReport = ref<{
  totalWords: number
  activeDays: number
  streak: number
  accuracy: number
} | null>(null)
const focusReport = ref(false)

const isUnlocked = (book: { code: string; isFree?: boolean }) => {
  if (userStore.plan === 'premium') return true
  return book.isFree !== false || book.code === 'ket'
}

const subscribe = () => {
  uni.showModal({
    title: '演示模式',
    content: '正式环境将接入微信支付。当前为功能预留演示。',
    showCancel: false
  })
}

const shareReport = () => {
  if (!weeklyReport.value) {
    uni.showToast({ title: '暂无周报数据', icon: 'none' })
    return
  }
  const r = weeklyReport.value
  const text = `本周学习 ${r.totalWords} 词，活跃 ${r.activeDays} 天，正确率 ${r.accuracy}%，连续打卡 ${r.streak} 天`
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '周报已复制，可分享给家长', icon: 'success' })
  })
}

onLoad((options) => {
  focusReport.value = options?.focus === 'report'
})

onMounted(async () => {
  await vocabStore.loadBooks()
  books.value = vocabStore.books as typeof books.value
  try {
    const res = await statsAPI.weeklyReport()
    weeklyReport.value = res.data as typeof weeklyReport.value
  } catch {
    // ignore
  }
  if (focusReport.value) {
    await nextTick()
    uni.pageScrollTo({ selector: '#parent-report', duration: 300 })
  }
})
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
  padding-bottom: 80rpx;
}

.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx;
  padding: 40rpx;
  margin-bottom: 24rpx;
}

.hero-title {
  font-size: 40rpx;
  font-weight: 600;
  color: white;
  display: block;
}

.hero-desc {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 8rpx;
  display: block;
}

.plan-card {
  background: white;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  position: relative;

  &.featured {
    border: 2rpx solid #667eea;
  }
}

.plan-badge {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  background: #667eea;
  color: white;
  font-size: 20rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
}

.plan-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  display: block;
}

.plan-price {
  font-size: 44rpx;
  font-weight: 600;
  color: #667eea;
  margin: 12rpx 0 20rpx;
  display: block;
}

.plan-features {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 20rpx;
}

.btn-subscribe {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 40rpx;
  padding: 24rpx;
  font-size: 30rpx;
}

.books-section, .report-section {
  background: white;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
}

.book-row {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.book-status.locked {
  color: #ff9800;
  font-size: 24rpx;
}

.book-status.unlocked {
  color: #4caf50;
  font-size: 24rpx;
}

.report-card {
  background: #eef2ff;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 26rpx;
  color: #333;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 16rpx;
}

.btn-share {
  background: #f5f5f5;
  color: #667eea;
  border: none;
  border-radius: 40rpx;
  padding: 20rpx;
  font-size: 28rpx;
}
</style>
