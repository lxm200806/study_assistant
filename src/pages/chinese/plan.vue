<template>
  <view class="container">
    <view class="header">
      <text class="title">学习计划</text>
      <text class="subtitle">
        {{ plan.course && plan.course.name }} · 每天约 {{ dailyMinutes }} 分钟 · 预计 {{ estimatedDays }} 天
        <template v-if="plan.truncated && plan.calendarDays && plan.calendarDays !== estimatedDays">
          （课表仅排出前 {{ plan.calendarDays }} 天）
        </template>
      </text>
      <text v-if="plan.warning" class="warning">{{ plan.warning }}</text>
    </view>
    <text v-if="loading" class="muted">正在生成计划…</text>
    <view v-for="item in visibleDays" :key="item.day.day" class="card plan-day">
      <text class="day">第 {{ item.day.day }} 天</text>
      <view class="counts-row">
        <text class="count-item">
          <text class="summary-label new-label">新学</text>
          词条 {{ item.summary.newEntries }} · 题卡 {{ item.summary.newQuestions }}
        </text>
        <text class="count-divider">|</text>
        <text class="count-item">
          <text class="summary-label review-label">复习</text>
          词条 {{ item.summary.reviewEntries }} · 题卡 {{ item.summary.reviewQuestions }}
        </text>
      </view>
      <view class="footer-row">
        <text class="time-text">预计 {{ dayMinutes(item.day) }} 分钟</text>
        <view class="detail-toggle" @tap="toggleDetails(item.day.day)">
          <text>{{ isExpanded(item.day.day) ? '收起词条列表' : '展开词条列表' }}</text>
        </view>
      </view>
      <view v-if="isExpanded(item.day.day)" class="details">
        <view v-if="item.newEntries.length" class="detail-section">
          <text class="detail-title">新学词条</text>
          <view v-for="entry in item.newEntries" :key="entry.key" class="detail-line">
            <text class="entry-name">{{ entry.name }}</text>
            <text class="entry-count">题卡 {{ entry.questionCount }}</text>
          </view>
        </view>
        <view v-if="item.reviewEntries.length" class="detail-section">
          <text class="detail-title">复习词条</text>
          <view v-for="entry in item.reviewEntries" :key="entry.key" class="detail-line">
            <text class="entry-name">{{ entry.name }}</text>
            <text class="entry-count">题卡 {{ entry.questionCount }}</text>
          </view>
        </view>
      </view>
    </view>
    <text v-if="hasMore" class="load-more">继续上滑，加载更多计划</text>
    <text v-else-if="!loading && visibleDays.length" class="load-more">已显示全部计划</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { chineseAPI } from '@/utils/api'
import { requireSubject } from '@/utils/subject'

const plan = ref<any>({})
const loading = ref(true)
const expanded = ref<Record<string, boolean>>({})
const PAGE_SIZE = 50
const visibleCount = ref(PAGE_SIZE)

const dailyMinutes = computed(() =>
  Number(plan.value.dailyMinutes || plan.value.course?.dailyMinutes || 15)
)

const estimatedDays = computed(() =>
  Number(plan.value.estimatedDays || plan.value.rawDayCount || plan.value.dayCount || (plan.value.days || []).length || 0)
)

const visibleDays = computed(() =>
  (plan.value.days || []).slice(0, visibleCount.value).map((day: any) => {
    const newEntries = entriesFor(day, 'new')
    const reviewEntries = entriesFor(day, 'review')
    return {
      day,
      newEntries,
      reviewEntries,
      summary: {
        newEntries: newEntries.length,
        newQuestions: newEntries.reduce((sum, item) => sum + item.questionCount, 0),
        reviewEntries: reviewEntries.length,
        reviewQuestions: reviewEntries.reduce((sum, item) => sum + item.questionCount, 0)
      }
    }
  })
)

const hasMore = computed(() => visibleCount.value < (plan.value.days || []).length)

function dayMinutes(day: any) {
  return Number(day?.estimatedMinutes || dailyMinutes.value)
}

function isReview(card: any) {
  return card?.role === 'review'
}

function entriesFor(day: any, role: 'new' | 'review') {
  const merged = new Map<string, { key: string; name: string; questionCount: number }>()
  for (const card of day?.cards || []) {
    if (isReview(card) !== (role === 'review')) continue
    const key = String(card.groupKey || card.knowledgePoint || card.title || merged.size)
    const existing = merged.get(key)
    if (existing) {
      existing.questionCount += Number(card.questionCount || 0)
    } else {
      merged.set(key, {
        key,
        name: String(card.knowledgePoint || card.title || '学习内容'),
        questionCount: Number(card.questionCount || 0)
      })
    }
  }
  return [...merged.values()]
}

function isExpanded(day: unknown) {
  return !!expanded.value[String(day)]
}

function toggleDetails(day: unknown) {
  const key = String(day)
  expanded.value[key] = !expanded.value[key]
}

onLoad(async (query) => {
  if (!(await requireSubject('chinese', 'parent'))) return
  try {
    plan.value = await chineseAPI.plan(String(query?.id || ''))
  } catch (error: any) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})

onReachBottom(() => {
  if (hasMore.value) visibleCount.value += PAGE_SIZE
})
</script>

<style lang="scss" scoped>
.header { padding: 4rpx 4rpx 16rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.subtitle, .muted, .day { display: block; color: #666; font-size: 26rpx; margin-top: 8rpx; }
.warning {
  display: block;
  margin-top: 12rpx;
  padding: 16rpx 18rpx;
  border-radius: 12rpx;
  background: #fff7ed;
  color: #9a3412;
  font-size: 24rpx;
  line-height: 1.55;
}
.plan-day { margin-bottom: 14rpx; padding: 18rpx 20rpx; }
.day { margin-top: 0; font-weight: 700; color: #222; font-size: 28rpx; }
.counts-row { display: flex; align-items: center; gap: 10rpx; margin-top: 10rpx; color: #555; font-size: 22rpx; white-space: nowrap; }
.count-item { flex: 1; }
.count-divider { color: #ddd; }
.summary-label { margin-right: 6rpx; color: #666; font-weight: 600; }
.new-label { color: #2563eb; }
.review-label { color: #b45309; }
.footer-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10rpx; padding-top: 10rpx; border-top: 1rpx solid #eee; }
.time-text { color: #777; font-size: 22rpx; }
.detail-toggle { color: #667eea; font-size: 22rpx; }
.details { margin-top: 10rpx; padding-top: 8rpx; border-top: 1rpx dashed #e5e7eb; }
.detail-section + .detail-section { margin-top: 10rpx; }
.detail-title { display: block; color: #555; font-size: 23rpx; font-weight: 600; }
.detail-line { display: flex; justify-content: space-between; gap: 20rpx; margin-top: 7rpx; color: #777; font-size: 22rpx; line-height: 1.4; }
.entry-name { flex: 1; color: #444; }
.entry-count { flex-shrink: 0; color: #888; }
.load-more { display: block; padding: 18rpx 0 30rpx; text-align: center; color: #aaa; font-size: 22rpx; }
</style>
