<template>
  <view class="container">
    <view class="header">
      <text class="title">学习计划</text>
      <text class="subtitle">
        {{ plan.course && plan.course.name }} · 每天约 {{ dailyMinutes }} 分钟 · 预计 {{ estimatedDays }} 天
      </text>
    </view>
    <text v-if="loading" class="muted">正在生成计划…</text>
    <view v-for="day in plan.days || []" :key="day.day" class="card">
      <text class="day">
        第 {{ day.day }} 天 · {{ modeLabel(day.mode) }} · 预计 {{ dayMinutes(day) }} 分钟
      </text>
      <view
        v-for="(card, index) in day.cards || []"
        :key="card.id || card.groupKey || index"
        class="plan-card"
      >
        <text class="knowledge-point">{{ card.knowledgePoint || card.title || '学习内容' }}</text>
        <text v-if="card.summary" class="summary">{{ card.summary }}</text>
        <view class="meta">
          <text v-if="card.questionCount != null">{{ card.questionCount }} 道题</text>
          <text>预计 {{ card.estimatedMinutes != null ? card.estimatedMinutes : '—' }} 分钟</text>
        </view>
        <view v-if="hasDetails(card)" class="detail-toggle" @tap="toggleDetails(day.day, index)">
          <text>{{ isExpanded(day.day, index) ? '收起细节' : '展开词条与题目' }}</text>
        </view>
        <view v-if="isExpanded(day.day, index)" class="details">
          <view v-if="card.entries && card.entries.length" class="detail-section">
            <text class="detail-title">词条</text>
            <text v-for="(entry, entryIndex) in card.entries" :key="entryIndex" class="detail-line">
              {{ detailText(entry) }}
            </text>
          </view>
          <view v-if="(!card.entries || !card.entries.length) && card.prompts && card.prompts.length" class="detail-section">
            <text class="detail-title">题目</text>
            <text v-for="(prompt, promptIndex) in card.prompts" :key="promptIndex" class="detail-line">
              {{ detailText(prompt) }}
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { chineseAPI } from '@/utils/api'
import { questionTypeLabel } from '@/utils/chinese'
import { requireSubject } from '@/utils/subject'

const plan = ref<any>({})
const loading = ref(true)
const expanded = ref<Record<string, boolean>>({})

const dailyMinutes = computed(() =>
  Number(plan.value.dailyMinutes || plan.value.course?.dailyMinutes || 15)
)

const estimatedDays = computed(() =>
  Number(plan.value.estimatedDays || plan.value.dayCount || (plan.value.days || []).length || 0)
)

function modeLabel(mode?: string) {
  if (mode === 'review') return '复习'
  if (mode === 'mixed') return '新学+复习'
  return '新学'
}

function dayMinutes(day: any) {
  return Number(day?.estimatedMinutes || dailyMinutes.value)
}

function detailKey(day: unknown, index: number) {
  return `${day}-${index}`
}

function isExpanded(day: unknown, index: number) {
  return !!expanded.value[detailKey(day, index)]
}

function toggleDetails(day: unknown, index: number) {
  const key = detailKey(day, index)
  expanded.value[key] = !expanded.value[key]
}

function hasDetails(card: any) {
  return !!(card?.entries?.length || card?.prompts?.length)
}

function detailText(item: any) {
  if (typeof item === 'string' || typeof item === 'number') return String(item)
  if (!item) return ''
  if (item.questionType && item.prompt) return `${questionTypeLabel(item.questionType)}：${item.prompt}`
  const heading = item.knowledgePoint || item.title || item.lemma || item.name || item.text || item.prompt
  return [heading, item.summary].filter(Boolean).join('：') || '未命名内容'
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
</script>

<style lang="scss" scoped>
.header { padding: 12rpx 8rpx 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.subtitle, .muted, .day { display: block; color: #666; font-size: 26rpx; margin-top: 8rpx; }
.day { font-weight: 700; color: #222; font-size: 30rpx; }
.plan-card { margin-top: 20rpx; padding: 20rpx; border-radius: 16rpx; background: #f7f8fc; }
.knowledge-point { display: block; color: #222; font-size: 28rpx; font-weight: 600; }
.summary { display: block; margin-top: 8rpx; color: #666; font-size: 24rpx; line-height: 1.6; }
.meta { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 12rpx; color: #888; font-size: 23rpx; }
.detail-toggle { margin-top: 16rpx; color: #667eea; font-size: 24rpx; }
.details { margin-top: 12rpx; padding-top: 12rpx; border-top: 1rpx solid #e5e7eb; }
.detail-section + .detail-section { margin-top: 14rpx; }
.detail-title { display: block; color: #555; font-size: 24rpx; font-weight: 600; }
.detail-line { display: block; margin-top: 6rpx; color: #777; font-size: 23rpx; line-height: 1.5; }
</style>
