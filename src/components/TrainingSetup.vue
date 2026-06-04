<template>
  <view class="training-setup">
    <view class="settings-section">
      <view class="section-header">
        <text class="section-title">📚 选择词汇书</text>
        <text v-if="vocabStore.getCurrentBook" class="section-subtitle">
          已选 {{ vocabStore.getCurrentBook.name }} · {{ vocabStore.getCurrentBook.wordCount }} 词
        </text>
      </view>
      <view class="book-options">
        <view
          v-for="book in vocabStore.books"
          :key="book.id"
          :class="['book-option', vocabStore.currentBookCode === book.code ? 'selected' : '']"
          @tap="selectBook(book)"
        >
          <text class="book-name">{{ book.name }}</text>
          <text class="book-level">{{ book.level }}</text>
          <text class="book-count">{{ book.wordCount }} 词</text>
        </view>
      </view>
    </view>

    <view v-if="vocabStore.bookProgress" class="progress-banner">
      <text class="progress-text">
        本书进度 {{ vocabStore.bookProgress.practicedCount }}/{{ vocabStore.bookProgress.wordCount }}
        · 本轮剩余 {{ vocabStore.bookProgress.cycleRemaining }}
        <text v-if="vocabStore.dueCount.dueCount > 0"> · 待复习 {{ vocabStore.dueCount.dueCount }} 词</text>
      </text>
      <view class="progress-bar">
        <view
          class="progress-fill"
          :style="{ width: vocabStore.bookProgress.coverageRate + '%' }"
        ></view>
      </view>
    </view>

    <view class="settings-section">
      <view class="section-header">
        <text class="section-title">🎯 练习模式</text>
      </view>
      <view class="mode-options">
        <view
          v-for="mode in sessionModes"
          :key="mode.key"
          :class="['mode-option', vocabStore.studySettings.sessionMode === mode.key ? 'selected' : '']"
          @tap="setSessionMode(mode.key)"
        >
          <text class="mode-name">{{ mode.label }}</text>
          <text class="mode-desc">{{ mode.desc }}</text>
        </view>
      </view>
    </view>

    <view class="settings-section">
      <view class="settings-grid">
        <view class="setting-item">
          <text class="setting-label">每组词汇数</text>
          <view class="setting-select">
            <text
              v-for="num in [5, 10, 15, 20]"
              :key="num"
              :class="['select-option', vocabStore.studySettings.wordsPerGroup === num ? 'selected' : '']"
              @tap="setWordsPerGroup(num)"
            >{{ num }}</text>
          </view>
        </view>
        <view class="setting-item">
          <text class="setting-label">组数</text>
          <view class="setting-select">
            <text
              v-for="num in [1, 2, 3, 5]"
              :key="num"
              :class="['select-option', vocabStore.studySettings.groupCount === num ? 'selected' : '']"
              @tap="setGroupCount(num)"
            >{{ num }}</text>
          </view>
        </view>
      </view>
      <view class="settings-summary">
        <text class="summary-text">共 {{ vocabStore.studySettings.wordsPerGroup * vocabStore.studySettings.groupCount }} 个词汇</text>
        <text
          v-if="vocabStore.getCurrentBook"
          class="full-round-btn"
          @tap="setFullBookRound"
        >全书一轮 ({{ vocabStore.getCurrentBook.wordCount }} 词)</text>
      </view>
    </view>

    <view v-if="showMeaningType" class="settings-section">
      <view class="section-header">
        <text class="section-title">💡 解释方式</text>
        <text class="section-subtitle">复杂词汇将显示所选释义（简单词仍用图片）</text>
      </view>
      <view class="options-group">
        <view
          :class="['option-item', vocabStore.meaningType === 'chinese' ? 'selected' : '']"
          @tap="setMeaningType('chinese')"
        >
          <view class="option-info">
            <text class="option-label">中文解释</text>
            <text class="option-desc">用中文释义辅助理解</text>
          </view>
          <view v-if="vocabStore.meaningType === 'chinese'" class="check-mark">✓</view>
        </view>
        <view
          :class="['option-item', vocabStore.meaningType === 'english' ? 'selected' : '']"
          @tap="setMeaningType('english')"
        >
          <view class="option-info">
            <text class="option-label">英文解释</text>
            <text class="option-desc">用英文释义，培养英语思维</text>
          </view>
          <view v-if="vocabStore.meaningType === 'english'" class="check-mark">✓</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useVocabularyStore, type MeaningType } from '@/stores/vocabulary'
import type { Book } from '@/stores/vocabulary'
import type { SessionMode } from '@/types/map'
import { SESSION_MODE_LABELS } from '@/types/map'

const props = withDefaults(defineProps<{
  showMeaningType?: boolean
  trainingType?: 'listening' | 'speaking' | 'reading' | 'writing'
}>(), {
  showMeaningType: true,
  trainingType: 'reading'
})

const vocabStore = useVocabularyStore()

const sessionModes = [
  { key: 'coverage' as SessionMode, label: SESSION_MODE_LABELS.coverage, desc: '优先练未覆盖的词' },
  { key: 'review' as SessionMode, label: SESSION_MODE_LABELS.review, desc: '优先练到期复习词' },
  { key: 'weak' as SessionMode, label: SESSION_MODE_LABELS.weak, desc: '优先练薄弱词汇' },
  { key: 'random' as SessionMode, label: SESSION_MODE_LABELS.random, desc: '随机抽取' }
]

const selectBook = async (book: Book) => {
  vocabStore.setCurrentBook(book.code)
  await vocabStore.loadBookProgress(book.code)
  await vocabStore.loadDueCount(book.code, props.trainingType)
  uni.showToast({ title: `已选择 ${book.name}`, icon: 'success' })
}

const setWordsPerGroup = (num: number) => {
  vocabStore.setStudySettings({ wordsPerGroup: num })
}

const setGroupCount = (num: number) => {
  vocabStore.setStudySettings({ groupCount: num })
}

const setMeaningType = (type: MeaningType) => {
  vocabStore.setMeaningType(type)
}

const setSessionMode = (mode: SessionMode) => {
  vocabStore.setSessionMode(mode)
}

const setFullBookRound = () => {
  vocabStore.setFullBookRound()
  uni.showToast({ title: '已设为全书一轮', icon: 'success' })
}

onMounted(() => {
  if (vocabStore.currentBookCode) {
    vocabStore.loadBookProgress()
    vocabStore.loadDueCount(vocabStore.currentBookCode, props.trainingType)
  }
})

watch(() => vocabStore.currentBookCode, (code) => {
  if (code) {
    vocabStore.loadDueCount(code, props.trainingType)
  }
})
</script>

<style lang="scss" scoped>
.progress-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx;
  padding: 24rpx 30rpx;
  margin-bottom: 25rpx;
}

.progress-text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.95);
  display: block;
  margin-bottom: 16rpx;
}

.progress-bar {
  height: 12rpx;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: white;
  border-radius: 6rpx;
  transition: width 0.3s ease;
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.mode-option {
  padding: 20rpx 24rpx;
  background: #f8f9fa;
  border-radius: 14rpx;
  border: 2rpx solid transparent;

  &.selected {
    border-color: #667eea;
    background: #eef2ff;
  }
}

.mode-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  display: block;
}

.mode-desc {
  font-size: 22rpx;
  color: #999;
  display: block;
  margin-top: 6rpx;
}

.full-round-btn {
  display: block;
  margin-top: 16rpx;
  text-align: center;
  font-size: 26rpx;
  color: #667eea;
  font-weight: 500;
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
  display: block;
}

.section-subtitle {
  font-size: 24rpx;
  color: #999;
  display: block;
  margin-top: 8rpx;
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
  display: block;
  margin-bottom: 6rpx;
}

.book-count {
  font-size: 22rpx;
  color: #999;
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

.option-info {
  flex: 1;
}

.option-label {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  display: block;
}

.option-desc {
  font-size: 24rpx;
  color: #999;
  display: block;
  margin-top: 6rpx;
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
  flex-shrink: 0;
  margin-left: 15rpx;
}
</style>
