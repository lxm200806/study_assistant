<template>
  <view class="category-chart">
    <text class="chart-title">虚构 vs 非虚构</text>
    <view v-for="item in items" :key="item.type" class="bar-row">
      <text class="bar-label">{{ item.label }}</text>
      <view class="bar-track">
        <view
          class="bar-segment mastered"
          :style="{ width: segmentWidth(item, 'mastered') }"
        ></view>
        <view
          class="bar-segment learning"
          :style="{ width: segmentWidth(item, 'learning') }"
        ></view>
        <view
          class="bar-segment weak"
          :style="{ width: segmentWidth(item, 'weak') }"
        ></view>
        <view
          class="bar-segment unpracticed"
          :style="{ width: segmentWidth(item, 'unpracticed') }"
        ></view>
      </view>
      <text class="bar-meta">{{ item.avgMastery }}/5 · {{ item.wordCount }}词</text>
    </view>
    <view v-if="weakestType" class="weak-hint">
      <text>相对薄弱：{{ weakestType.label }}（均分 {{ weakestType.avgMastery }}）</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CategoryStats } from '@/types/map'

const props = defineProps<{
  items: CategoryStats[]
}>()

const segmentWidth = (item: CategoryStats, key: 'mastered' | 'learning' | 'weak' | 'unpracticed') => {
  if (item.wordCount === 0) return '0%'
  const count = item[key]
  return `${(count / item.wordCount) * 100}%`
}

const weakestType = computed(() => {
  const fiction = props.items.filter(i => i.type !== 'function' && i.wordCount >= 2)
  if (fiction.length === 0) return null
  return [...fiction].sort((a, b) => a.avgMastery - b.avgMastery)[0]
})
</script>

<style lang="scss" scoped>
.category-chart {
  background: white;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.chart-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 24rpx;
}

.bar-row {
  margin-bottom: 24rpx;
}

.bar-label {
  font-size: 26rpx;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
}

.bar-track {
  display: flex;
  height: 20rpx;
  border-radius: 10rpx;
  overflow: hidden;
  background: #f5f5f5;
}

.bar-segment {
  height: 100%;
  &.mastered { background: #4caf50; }
  &.learning { background: #2196f3; }
  &.weak { background: #ff9800; }
  &.unpracticed { background: #e0e0e0; }
}

.bar-meta {
  font-size: 22rpx;
  color: #999;
  display: block;
  margin-top: 8rpx;
}

.weak-hint {
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  background: #fff3e0;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #e65100;
}
</style>
