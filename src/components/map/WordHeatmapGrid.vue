<template>
  <view class="heatmap">
    <view class="filter-bar">
      <view
        v-for="f in filters"
        :key="f.key"
        :class="['filter-item', activeFilter === f.key ? 'active' : '']"
        @tap="activeFilter = f.key"
      >
        <text>{{ f.label }}</text>
      </view>
    </view>

    <view class="word-grid">
      <view
        v-for="word in filteredWords"
        :key="word.wordId"
        class="word-cell"
        :style="{ backgroundColor: getCellColor(word.status) }"
        @tap="showDetail(word)"
      >
        <text class="cell-word">{{ word.word }}</text>
      </view>
    </view>

    <view class="legend">
      <view v-for="item in legendItems" :key="item.status" class="legend-item">
        <view class="legend-dot" :style="{ backgroundColor: item.color }"></view>
        <text class="legend-label">{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MapWordEntry, MasteryStatus } from '@/types/map'
import { STATUS_COLORS, STATUS_LABELS, TOPIC_LABELS } from '@/types/map'

const props = defineProps<{
  words: MapWordEntry[]
}>()

const activeFilter = ref('all')

const filters = computed(() => {
  const base = [{ key: 'all', label: '全部' }]
  const types = [...new Set(props.words.map(w => w.contentType).filter(Boolean))]
  const typeFilters = types.map(t => ({
    key: t as string,
    label: t === 'fiction' ? '虚构' : t === 'non-fiction' ? '非虚构' : '功能词'
  }))
  const topics = [...new Set(props.words.map(w => w.topic).filter(Boolean))].slice(0, 4)
  const topicFilters = topics.map(t => ({
    key: `topic:${t}`,
    label: TOPIC_LABELS[t as string] || t as string
  }))
  return [...base, ...typeFilters, ...topicFilters]
})

const filteredWords = computed(() => {
  if (activeFilter.value === 'all') return props.words
  if (activeFilter.value.startsWith('topic:')) {
    const topic = activeFilter.value.replace('topic:', '')
    return props.words.filter(w => w.topic === topic)
  }
  return props.words.filter(w => w.contentType === activeFilter.value)
})

const legendItems = [
  { status: 'mastered', label: STATUS_LABELS.mastered, color: STATUS_COLORS.mastered },
  { status: 'learning', label: STATUS_LABELS.learning, color: STATUS_COLORS.learning },
  { status: 'unfamiliar', label: STATUS_LABELS.unfamiliar, color: STATUS_COLORS.unfamiliar },
  { status: 'unpracticed', label: STATUS_LABELS.unpracticed, color: STATUS_COLORS.unpracticed }
]

const getCellColor = (status: MasteryStatus) => STATUS_COLORS[status]

const showDetail = (word: MapWordEntry) => {
  const typeDetail = Object.entries(word.byType)
    .map(([type, score]) => `${type}: ${score}/5`)
    .join('\n')

  uni.showModal({
    title: word.word,
    content: `${word.meaning}\n\n掌握: ${word.mastery}/5 (${STATUS_LABELS[word.status]})\n${typeDetail || '尚未练习'}`,
    showCancel: false
  })
}
</script>

<style lang="scss" scoped>
.heatmap {
  background: white;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.filter-item {
  padding: 12rpx 24rpx;
  background: #f5f5f5;
  border-radius: 30rpx;
  font-size: 24rpx;
  color: #666;

  &.active {
    background: #667eea;
    color: white;
  }
}

.word-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.word-cell {
  aspect-ratio: 1;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8rpx;
}

.cell-word {
  font-size: 22rpx;
  color: #333;
  text-align: center;
  word-break: break-all;
  font-weight: 500;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.legend-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 4rpx;
}

.legend-label {
  font-size: 22rpx;
  color: #999;
}
</style>
