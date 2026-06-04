<template>
  <view :class="['training-setup', compact ? 'training-setup--compact' : '']">
    <view v-if="!compact && vocabStore.bookProgress" class="progress-banner">
      <text class="progress-text">
        本书进度 {{ vocabStore.bookProgress.practicedCount }}/{{ vocabStore.bookProgress.wordCount }}
        · 本轮剩余 {{ vocabStore.bookProgress.cycleRemaining }}
        <text v-if="vocabStore.dueCount.dueCount > 0"> · 待复习 {{ vocabStore.dueCount.dueCount }} 词</text>
      </text>
      <view class="progress-bar">
        <view
          class="progress-fill"
          :style="{ width: vocabStore.bookProgress.coverageRate + '%' }"
        />
      </view>
    </view>

    <view :class="['settings-section', compact ? 'settings-section--compact' : '']">
      <view v-if="compact && vocabStore.bookProgress" class="progress-inline">
        <text>
          进度 {{ vocabStore.bookProgress.practicedCount }}/{{ vocabStore.bookProgress.wordCount }}
          <text v-if="vocabStore.dueCount.dueCount > 0"> · 待复习 {{ vocabStore.dueCount.dueCount }}</text>
        </text>
      </view>

      <view class="section-block">
        <text class="section-title">练习模式</text>
        <view class="mode-options">
          <view
            v-for="mode in sessionModes"
            :key="mode.key"
            :class="['mode-option', compact ? 'mode-option--compact' : '', vocabStore.studySettings.sessionMode === mode.key ? 'selected' : '']"
            @tap="setSessionMode(mode.key)"
          >
            <text class="mode-name">{{ mode.label }}</text>
            <text class="mode-desc">{{ mode.desc }}</text>
          </view>
        </view>
      </view>

      <view class="section-block">
        <text class="section-title">本轮词汇数</text>
        <view class="setting-select">
          <text
            v-for="num in [5, 10, 15, 20]"
            :key="num"
            :class="['select-option', vocabStore.studySettings.wordsPerGroup === num ? 'selected' : '']"
            @tap="setWordsPerGroup(num)"
          >{{ num }}</text>
        </view>
        <text
          v-if="compact && vocabStore.getCurrentBook"
          class="full-round-link"
          @tap="setFullBookRound"
        >全书一轮 ({{ vocabStore.getCurrentBook.wordCount }} 词)</text>
      </view>

      <view v-if="showMeaningType" class="section-block section-block--last">
        <text class="section-title">解释方式</text>
        <view v-if="compact" class="meaning-toggle">
          <text
            :class="['toggle-item', vocabStore.meaningType === 'chinese' ? 'selected' : '']"
            @tap="setMeaningType('chinese')"
          >中文</text>
          <text
            :class="['toggle-item', vocabStore.meaningType === 'english' ? 'selected' : '']"
            @tap="setMeaningType('english')"
          >英文</text>
        </view>
        <view v-else class="options-group">
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

      <view v-if="!compact" class="settings-summary">
        <text class="summary-text">完成一组后可继续「下一组」或「结束」</text>
        <text
          v-if="vocabStore.getCurrentBook"
          class="full-round-btn"
          @tap="setFullBookRound"
        >全书一轮 ({{ vocabStore.getCurrentBook.wordCount }} 词)</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useVocabularyStore, type MeaningType } from '@/stores/vocabulary'
import type { SessionMode } from '@/types/map'
import { SESSION_MODE_LABELS } from '@/types/map'

const props = withDefaults(defineProps<{
  showMeaningType?: boolean
  trainingType?: 'listening' | 'speaking' | 'reading' | 'writing'
  compact?: boolean
}>(), {
  showMeaningType: true,
  trainingType: 'reading',
  compact: false
})

const vocabStore = useVocabularyStore()

const sessionModes = [
  { key: 'coverage' as SessionMode, label: SESSION_MODE_LABELS.coverage, desc: '优先练未覆盖的词' },
  { key: 'review' as SessionMode, label: SESSION_MODE_LABELS.review, desc: '优先练到期复习词' },
  { key: 'weak' as SessionMode, label: SESSION_MODE_LABELS.weak, desc: '优先练薄弱词汇' },
  { key: 'smart' as SessionMode, label: SESSION_MODE_LABELS.smart, desc: '综合到期、薄弱与进度推荐' }
]

const setWordsPerGroup = (num: number) => {
  vocabStore.setStudySettings({ wordsPerGroup: num, groupCount: 1 })
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

.settings-section {
  background: white;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 25rpx;
}

.settings-section--compact {
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.progress-inline {
  font-size: 22rpx;
  color: #667eea;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.section-block {
  margin-bottom: 24rpx;

  &--last {
    margin-bottom: 0;
  }
}

.training-setup--compact .section-block {
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 12rpx;
}

.training-setup--compact .section-title {
  font-size: 24rpx;
  margin-bottom: 10rpx;
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

.mode-option--compact {
  padding: 16rpx 20rpx;
}

.mode-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  display: block;
}

.mode-option--compact .mode-name {
  font-size: 26rpx;
}

.mode-desc {
  font-size: 22rpx;
  color: #999;
  display: block;
  margin-top: 4rpx;
}

.mode-option--compact .mode-desc {
  font-size: 20rpx;
  margin-top: 2rpx;
}

.setting-select {
  display: flex;
  gap: 12rpx;
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

  &.selected {
    background: #667eea;
    color: white;
  }
}

.training-setup--compact .select-option {
  padding: 14rpx 0;
  font-size: 26rpx;
}

.meaning-toggle {
  display: flex;
  background: #f8f9fa;
  border-radius: 12rpx;
  padding: 4rpx;
}

.toggle-item {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  font-size: 26rpx;
  color: #666;
  border-radius: 10rpx;

  &.selected {
    background: white;
    color: #667eea;
    font-weight: 600;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  }
}

.full-round-link {
  display: block;
  margin-top: 12rpx;
  text-align: center;
  font-size: 24rpx;
  color: #667eea;
}

.full-round-btn {
  display: block;
  margin-top: 16rpx;
  text-align: center;
  font-size: 26rpx;
  color: #667eea;
  font-weight: 500;
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
