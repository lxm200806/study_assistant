<template>
  <view class="start-stats-line">
    <text class="stat-text">已学 {{ total }} 词</text>
    <text class="stat-dot">·</text>
    <text class="stat-text">掌握 {{ mastered }} 词</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  total: number
  mastered: number
}>()
</script>

<style lang="scss" scoped>
.start-stats-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.stat-text {
  font-size: 24rpx;
  color: #888;
}

.stat-dot {
  font-size: 24rpx;
  color: #ccc;
}
</style>
