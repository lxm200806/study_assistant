<template>
  <view class="analysis">
    <view class="analysis-summary">
      <view class="summary-row">
        <view class="summary-block">
          <text class="summary-num">{{ analysis.accuracy }}%</text>
          <text class="summary-txt">本次正确率</text>
        </view>
        <view class="summary-block">
          <text class="summary-num">{{ analysis.breakdown.mastered.length }}</text>
          <text class="summary-txt">已掌握</text>
        </view>
        <view class="summary-block">
          <text class="summary-num">{{ analysis.breakdown.learning.length }}</text>
          <text class="summary-txt">学习中</text>
        </view>
        <view class="summary-block">
          <text class="summary-num">{{ analysis.breakdown.weak.length }}</text>
          <text class="summary-txt">需加强</text>
        </view>
      </view>
    </view>

    <view v-if="newlyCovered && newlyCovered > 0" class="section highlight">
      <text class="section-title">📖 本轮新覆盖 {{ newlyCovered }} 个词</text>
    </view>

    <view v-if="analysis.newlyMastered.length > 0" class="section">
      <text class="section-title">🎉 新掌握 {{ analysis.newlyMastered.length }} 个词</text>
      <view class="tag-list">
        <text v-for="item in analysis.newlyMastered" :key="item.word" class="tag tag-mastered">
          {{ item.word }}
        </text>
      </view>
    </view>

    <view v-if="analysis.sessionWrong.length > 0" class="section">
      <text class="section-title">⚠️ 本次答错 {{ analysis.sessionWrong.length }} 个词</text>
      <view class="word-rows">
        <view v-for="item in analysis.sessionWrong" :key="item.word" class="word-row">
          <view class="word-main">
            <text class="word-name">{{ item.word }}</text>
            <text v-if="item.meaning" class="word-meaning">{{ item.meaning }}</text>
          </view>
          <view class="word-meta">
            <view class="stars">
              <text v-for="i in 5" :key="i" :class="['star', i <= item.mastery ? 'on' : '']">★</text>
            </view>
            <text class="mastery-label">{{ getMasteryLabel(item.mastery) }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="analysis.breakdown.weak.length > 0 && analysis.sessionWrong.length === 0" class="section">
      <text class="section-title">📌 建议复习</text>
      <view class="tag-list">
        <text
          v-for="item in analysis.breakdown.weak.slice(0, 8)"
          :key="item.word"
          class="tag tag-weak"
        >{{ item.word }}</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">📊 全部词汇掌握</text>
      <view class="word-rows">
        <view
          v-for="item in sortedResults"
          :key="item.word"
          class="word-row"
        >
          <view class="word-main">
            <text class="word-name">{{ item.word }}</text>
            <text v-if="item.meaning" class="word-meaning">{{ item.meaning }}</text>
          </view>
          <view class="word-meta">
            <text :class="['result-badge', item.correct ? 'ok' : 'bad']">
              {{ item.correct ? '✓' : '✗' }}
            </text>
            <view class="stars">
              <text v-for="i in 5" :key="i" :class="['star', i <= item.mastery ? 'on' : '']">★</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SessionAnalysis } from '@/utils/mastery'
import { getMasteryLabel } from '@/utils/mastery'

const props = defineProps<{
  analysis: SessionAnalysis
  newlyCovered?: number
}>()

const sortedResults = computed(() => {
  return [...props.analysis.breakdown.weak, ...props.analysis.breakdown.learning, ...props.analysis.breakdown.mastered]
    .sort((a, b) => a.mastery - b.mastery)
})
</script>

<style lang="scss" scoped>
.analysis {
  width: 100%;
  margin-bottom: 30rpx;
}

.section.highlight {
  background: linear-gradient(135deg, #eef2ff 0%, #f3e5f5 100%);
}

.analysis-summary {
  background: white;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.summary-row {
  display: flex;
  justify-content: space-between;
}

.summary-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.summary-num {
  font-size: 40rpx;
  font-weight: 600;
  color: #667eea;
}

.summary-txt {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

.section {
  background: white;
  border-radius: 20rpx;
  padding: 25rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.tag {
  font-size: 24rpx;
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
}

.tag-mastered {
  background: #e8f5e9;
  color: #2e7d32;
}

.tag-weak {
  background: #fff3e0;
  color: #e65100;
}

.word-rows {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.word-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.word-main {
  flex: 1;
  min-width: 0;
}

.word-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
}

.word-meaning {
  font-size: 24rpx;
  color: #999;
  display: block;
  margin-top: 4rpx;
}

.word-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.result-badge {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 600;

  &.ok {
    background: #e8f5e9;
    color: #4caf50;
  }

  &.bad {
    background: #ffebee;
    color: #f44336;
  }
}

.stars {
  display: flex;
  gap: 2rpx;
}

.star {
  font-size: 22rpx;
  color: #ddd;

  &.on {
    color: #ffc107;
  }
}

.mastery-label {
  font-size: 20rpx;
  color: #999;
}
</style>
