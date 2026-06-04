<template>
  <view class="training-progress">
    <view v-if="bookProgress" class="coverage-banner">
      <text class="coverage-text">
        本书进度 {{ bookProgress.practicedCount }}/{{ bookProgress.wordCount }}
        · 本轮剩余 {{ bookProgress.cycleRemaining }}
      </text>
      <view class="coverage-bar">
        <view
          class="coverage-fill"
          :style="{ width: bookProgress.coverageRate + '%' }"
        />
      </view>
    </view>

    <view class="session-bar">
      <view class="session-fill" :style="{ width: sessionPercent + '%' }" />
    </view>
    <text class="session-text">
      第 {{ currentGroup + 1 }} 组 / {{ totalGroups }} · {{ currentIndex + 1 }} / {{ wordsInGroup }}
    </text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'

const props = defineProps<{
  currentGroup: number
  currentIndex: number
  totalGroups: number
  wordsInGroup: number
}>()

const vocabStore = useVocabularyStore()

const bookProgress = computed(() => vocabStore.bookProgress)

const sessionPercent = computed(() => {
  if (props.wordsInGroup <= 0 || props.totalGroups <= 0) return 0
  const totalItems = props.totalGroups * props.wordsInGroup
  const done = props.currentGroup * props.wordsInGroup + props.currentIndex + 1
  return Math.min(100, (done / totalItems) * 100)
})
</script>

<style lang="scss" scoped>
.training-progress {
  margin-bottom: 24rpx;
}

.coverage-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
}

.coverage-text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.95);
  display: block;
  margin-bottom: 12rpx;
}

.coverage-bar {
  height: 10rpx;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 5rpx;
  overflow: hidden;
}

.coverage-fill {
  height: 100%;
  background: white;
  border-radius: 5rpx;
  transition: width 0.3s ease;
}

.session-bar {
  height: 12rpx;
  background: #e8e8e8;
  border-radius: 6rpx;
  overflow: hidden;
}

.session-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 6rpx;
  transition: width 0.3s ease;
}

.session-text {
  font-size: 26rpx;
  color: #999;
  text-align: center;
  display: block;
  margin-top: 12rpx;
}
</style>
