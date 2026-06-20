<template>
  <view class="summary-ring">
    <view class="ring-stats">
      <view class="stat-item mastered">
        <text class="stat-num">{{ summary.mastered }}</text>
        <text class="stat-label">已掌握</text>
      </view>
      <view class="stat-item learning">
        <text class="stat-num">{{ summary.learning }}</text>
        <text class="stat-label">熟悉</text>
      </view>
      <view class="stat-item unfamiliar">
        <text class="stat-num">{{ summary.unfamiliar }}</text>
        <text class="stat-label">陌生</text>
      </view>
      <view class="stat-item unpracticed">
        <text class="stat-num">{{ summary.unpracticed }}</text>
        <text class="stat-label">未练习</text>
      </view>
    </view>
    <view class="coverage-bar">
      <view class="coverage-fill" :style="{ width: summary.coverageRate + '%' }"></view>
    </view>
    <text class="coverage-text">覆盖率 {{ summary.coverageRate }}%</text>
  </view>
</template>

<script setup lang="ts">
import type { VocabularyMapData } from '@/types/map'

defineProps<{
  summary: VocabularyMapData['summary']
}>()
</script>

<style lang="scss" scoped>
.summary-ring {
  background: white;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.ring-stats {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-num {
  font-size: 44rpx;
  font-weight: 600;
}

.stat-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

.mastered .stat-num { color: #4caf50; }
.learning .stat-num { color: #2196f3; }
.unfamiliar .stat-num { color: #ff9800; }
.unpracticed .stat-num { color: #bdbdbd; }

.coverage-bar {
  height: 16rpx;
  background: #f0f0f0;
  border-radius: 8rpx;
  overflow: hidden;
  margin-bottom: 12rpx;
}

.coverage-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 8rpx;
}

.coverage-text {
  font-size: 24rpx;
  color: #666;
  text-align: center;
  display: block;
}
</style>
