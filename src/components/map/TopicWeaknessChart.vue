<template>
  <view class="topic-chart">
    <text class="chart-title">非虚构主题掌握度</text>
    <view v-for="item in displayTopics" :key="item.topic" class="topic-row" @tap="emitPractice(item.topic)">
      <text class="topic-label">{{ item.label }}</text>
      <view class="topic-bar-track">
        <view
          class="topic-bar-fill"
          :class="{ weak: item.avgMastery < 3 }"
          :style="{ width: (item.avgMastery / 5 * 100) + '%' }"
        ></view>
      </view>
      <text class="topic-score">{{ item.avgMastery }}/5</text>
    </view>
    <view v-if="weakestTopics.length > 0" class="weak-topics">
      <text class="weak-title">薄弱主题</text>
      <view class="weak-tags">
        <text v-for="t in weakestTopics" :key="t" class="weak-tag" @tap="emitPractice(t)">{{ getTopicLabel(t) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TopicStats } from '@/types/map'
import { TOPIC_LABELS } from '@/types/map'

const props = defineProps<{
  topics: TopicStats[]
  weakestTopics: string[]
}>()

const emit = defineEmits<{ practice: [topic: string] }>()

const emitPractice = (topic: string) => {
  emit('practice', topic)
}

const displayTopics = computed(() =>
  [...props.topics]
    .filter(t => t.wordCount > 0)
    .sort((a, b) => a.avgMastery - b.avgMastery)
    .slice(0, 8)
)

const getTopicLabel = (topic: string) => TOPIC_LABELS[topic] || topic
</script>

<style lang="scss" scoped>
.topic-chart {
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

.topic-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.topic-label {
  width: 140rpx;
  font-size: 24rpx;
  color: #666;
  flex-shrink: 0;
}

.topic-bar-track {
  flex: 1;
  height: 16rpx;
  background: #f0f0f0;
  border-radius: 8rpx;
  overflow: hidden;
}

.topic-bar-fill {
  height: 100%;
  background: #667eea;
  border-radius: 8rpx;

  &.weak {
    background: #ff9800;
  }
}

.topic-score {
  width: 70rpx;
  font-size: 22rpx;
  color: #999;
  text-align: right;
}

.weak-topics {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}

.weak-title {
  font-size: 24rpx;
  color: #999;
  display: block;
  margin-bottom: 12rpx;
}

.weak-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.weak-tag {
  font-size: 22rpx;
  padding: 8rpx 18rpx;
  background: #fff3e0;
  color: #e65100;
  border-radius: 20rpx;
}
</style>
