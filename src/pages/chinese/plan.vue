<template>
  <view class="container">
    <view class="header">
      <text class="title">学习计划</text>
      <text class="subtitle">{{ plan.course && plan.course.name }} · 新学约 {{ plan.newDayCount }} 天，含复习 {{ plan.dayCount }} 天</text>
    </view>
    <text v-if="loading" class="muted">正在生成计划…</text>
    <view v-for="day in plan.days || []" :key="day.day" class="card">
      <text class="day">第 {{ day.day }} 天 · {{ day.mode === 'review' ? '复习' : day.mode === 'mixed' ? '新学+复习' : '新学' }} · {{ day.energy }} 能</text>
      <text v-for="(card, index) in day.cards" :key="index" class="muted">
        {{ card.role === 'review' ? '复习' : '新学' }} · {{ card.title }} · {{ card.energy }} 能 · {{ card.pointCount }} 条
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { chineseAPI } from '@/utils/api'
import { requireSubject } from '@/utils/subject'

const plan = ref<any>({})
const loading = ref(true)

onLoad(async (query) => {
  if (!(await requireSubject('chinese'))) return
  try {
    plan.value = await chineseAPI.plan(String(query?.id || ''))
  } catch (error: any) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.header { padding: 12rpx 8rpx 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.subtitle, .muted, .day { display: block; color: #666; font-size: 26rpx; margin-top: 8rpx; }
.day { font-weight: 700; color: #222; font-size: 30rpx; }
</style>
