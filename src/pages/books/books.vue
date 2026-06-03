<template>
  <view class="container">
    <view class="header">
      <text class="header-title">选择词汇书</text>
      <text class="header-subtitle">选择适合您的词汇学习目标</text>
    </view>

    <view class="current-book" v-if="vocabStore.currentBookCode">
      <view class="current-book-label">当前词汇书</view>
      <view class="current-book-name">{{ vocabStore.getCurrentBook?.name || vocabStore.currentBookCode }}</view>
    </view>

    <view class="books-list">
      <view 
        v-for="book in vocabStore.books" 
        :key="book.id"
        :class="['book-card', vocabStore.currentBookCode === book.code ? 'selected' : '']"
        @tap="selectBook(book)"
      >
        <view class="book-icon">📚</view>
        <view class="book-info">
          <text class="book-name">{{ book.name }}</text>
          <text class="book-level">{{ book.level }}</text>
          <text class="book-desc">{{ book.description }}</text>
          <view class="book-meta">
            <text class="book-count">已收录 {{ book.wordCount }} 词</text>
            <text v-if="book.targetWordCount" class="book-target">目标 {{ book.targetWordCount }} 词</text>
          </view>
        </view>
        <view v-if="vocabStore.currentBookCode === book.code" class="selected-badge">✓</view>
        <view class="map-link" @tap.stop="goToBookMap(book.code)">
          <text>掌握图谱</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">解释方式</text>
      <view class="options-group">
        <view 
          :class="['option-item', vocabStore.meaningType === 'chinese' ? 'selected' : '']"
          @tap="setMeaningType('chinese')"
        >
          <text class="option-label">中文解释</text>
          <text class="option-desc">用中文解释单词含义</text>
          <view v-if="vocabStore.meaningType === 'chinese'" class="check-mark">✓</view>
        </view>
        <view 
          :class="['option-item', vocabStore.meaningType === 'english' ? 'selected' : '']"
          @tap="setMeaningType('english')"
        >
          <text class="option-label">英文解释</text>
          <text class="option-desc">用英文解释单词含义，提升英文思维</text>
          <view v-if="vocabStore.meaningType === 'english'" class="check-mark">✓</view>
        </view>
      </view>
    </view>

    <view class="bottom-space"></view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useVocabularyStore, type MeaningType } from '@/stores/vocabulary'

const vocabStore = useVocabularyStore()

const selectBook = (book: any) => {
  vocabStore.setCurrentBook(book.code)
  uni.showToast({ title: `已选择 ${book.name}`, icon: 'success' })
}

const goToBookMap = (code: string) => {
  uni.navigateTo({ url: `/pages/vocabulary-map/vocabulary-map?book=${code}` })
}

const setMeaningType = (type: MeaningType) => {
  vocabStore.setMeaningType(type)
  uni.showToast({ 
    title: type === 'chinese' ? '已切换为中文解释' : '已切换为英文解释', 
    icon: 'success' 
  })
}

onMounted(() => {
  vocabStore.loadBooks()
  vocabStore.loadSettings()
})
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 30rpx;
}

.header {
  padding: 40rpx 0 30rpx;
}

.header-title {
  font-size: 44rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
}

.header-subtitle {
  font-size: 28rpx;
  color: #999;
}

.current-book {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
}

.current-book-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 10rpx;
}

.current-book-name {
  font-size: 36rpx;
  font-weight: 600;
  color: white;
}

.books-list {
  margin-bottom: 40rpx;
}

.book-card {
  background: white;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  border: 3rpx solid transparent;
  transition: all 0.3s ease;
  
  &.selected {
    border-color: #667eea;
    background: #f8f9ff;
  }
}

.book-icon {
  font-size: 60rpx;
  margin-right: 25rpx;
}

.book-info {
  flex: 1;
}

.book-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}

.book-level {
  font-size: 24rpx;
  color: #667eea;
  display: block;
  margin-bottom: 10rpx;
}

.book-desc {
  font-size: 26rpx;
  color: #999;
  display: block;
  margin-bottom: 15rpx;
}

.book-meta {
  display: flex;
  gap: 20rpx;
}

.book-count {
  font-size: 24rpx;
  color: #666;
}

.book-target {
  font-size: 24rpx;
  color: #999;
}

.selected-badge {
  width: 48rpx;
  height: 48rpx;
  background: #667eea;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 28rpx;
}

.map-link {
  margin-left: 16rpx;
  padding: 12rpx 20rpx;
  background: #eef2ff;
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #667eea;
  flex-shrink: 0;
}

.section {
  background: white;
  border-radius: 20rpx;
  padding: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 25rpx;
}

.options-group {
  display: flex;
  flex-direction: column;
  gap: 15rpx;
}

.option-item {
  display: flex;
  align-items: center;
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
  margin-right: 15rpx;
}

.option-desc {
  flex: 1;
  font-size: 26rpx;
  color: #999;
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

.bottom-space {
  height: 120rpx;
}
</style>
