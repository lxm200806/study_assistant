<template>
  <view class="container">
    <view class="header">
      <text class="title">组课</text>
      <text class="subtitle">按年级、类型筛选后生成课程。组课页不显示答案。没有课的账号打开「语文课程」时会自动生成默认课程。</text>
    </view>

    <view class="card">
      <text class="label">课程名称</text>
      <input class="input" v-model="name" placeholder="三年级上册默写" @input="nameTouched = true" />
      <text class="label">备注</text>
      <input class="input" v-model="note" placeholder="部编必背与日积月累" @input="nameTouched = true" />

      <text class="label">年级（古诗文等内容）</text>
      <view class="chips">
        <view
          v-for="item in GRADE_OPTIONS"
          :key="item"
          :class="['chip', grades.includes(item) ? 'active' : '']"
          @tap="toggle(grades, item)"
        >
          <text>{{ item }}</text>
        </view>
      </view>

      <text class="label">类型</text>
      <view class="chips">
        <view
          v-for="item in KIND_OPTIONS"
          :key="item.id"
          :class="['chip', kinds.includes(item.id) ? 'active' : '']"
          @tap="toggle(kinds, item.id)"
        >
          <text>{{ item.label }}</text>
        </view>
      </view>

      <text class="label">成语分层（不按年级）</text>
      <view class="chips">
        <view
          v-for="item in DIFFICULTY_OPTIONS"
          :key="item.id"
          :class="['chip', difficulties.includes(item.id) ? 'active' : '']"
          @tap="toggleRequired(difficulties, item.id)"
        >
          <text>{{ item.label }}</text>
        </view>
      </view>

      <text class="label">每天学习时间</text>
      <view class="chips">
        <view
          v-for="item in DAILY_MINUTE_OPTIONS"
          :key="item"
          :class="['chip', dailyMinutes === item ? 'active' : '']"
          @tap="dailyMinutes = item"
        >
          <text>{{ item }} 分钟</text>
        </view>
      </view>

      <text class="muted">
        {{ loading ? '正在预览…' : previewText }}
      </text>
      <text v-if="!loading && sizeWarning" class="warning">{{ sizeWarning }}</text>
      <button class="btn-primary" :disabled="busy || loading || total === 0" @tap="createCourse">
        {{ busy ? '正在生成…' : '生成课程' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { chineseAPI } from '@/utils/api'
import { DIFFICULTY_OPTIONS, GRADE_OPTIONS, KIND_OPTIONS, LEVEL_OPTIONS } from '@/utils/chinese'
import { openPage } from '@/utils/navigation'
import { requireSubject } from '@/utils/subject'

const kinds = ref(KIND_OPTIONS.map(item => item.id))
const difficulties = ref(DIFFICULTY_OPTIONS.map(item => item.id))
const grades = ref(['三年级上'])
const DAILY_MINUTE_OPTIONS = [10, 15, 20, 30]
const dailyMinutes = ref(15)
const name = ref('三年级上册默写')
const note = ref('部编三年级上册必背与日积月累')
const total = ref(0)
const entryCount = ref(0)
const preview = ref<{
  dayCount?: number
  estimatedDays?: number
  rawDayCount?: number
  calendarDays?: number
  truncated?: boolean
  warning?: string
  newPerDay?: number
  entryCount?: number
  suggestedName?: string
  suggestedNote?: string
}>({})
const loading = ref(false)
const busy = ref(false)
const nameTouched = ref(false)
let ticket = 0

const sizeWarning = computed(() => String(preview.value.warning || ''))

const previewText = computed(() => {
  const days = preview.value.estimatedDays || preview.value.rawDayCount || preview.value.dayCount
  const calendar = preview.value.calendarDays
  const pace = preview.value.newPerDay
  let text = `当前筛选 ${entryCount.value} 个词条、${total.value} 张题卡 · 每天 ${dailyMinutes.value} 分钟`
  if (pace) text += ` · 约 ${pace} 个新词条/天`
  if (days) text += ` · 预计 ${days} 天`
  if (preview.value.truncated && calendar && calendar !== days) {
    text += `（课表仅展示前 ${calendar} 天）`
  }
  return text
})

function toggle(list: string[], item: string) {
  const index = list.indexOf(item)
  if (index >= 0) list.splice(index, 1)
  else list.push(item)
}

function toggleRequired(list: string[], item: string) {
  if (list.includes(item) && list.length === 1) {
    uni.showToast({ title: '至少选择一个难度', icon: 'none' })
    return
  }
  toggle(list, item)
}

async function loadLibrary() {
  if (!kinds.value.length) {
    total.value = 0
    entryCount.value = 0
    preview.value = {}
    return
  }
  const current = ++ticket
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('kinds', kinds.value.join(','))
    params.set('levels', LEVEL_OPTIONS.join(','))
    params.set('difficulties', difficulties.value.join(','))
    if (grades.value.length) params.set('grades', grades.value.join(','))
    params.set('limit', '20')
    const data = (await chineseAPI.library(params.toString())) as any
    if (current !== ticket) return
    total.value = data.total || 0
    entryCount.value = data.entryCount || data.total || 0
    preview.value = (await chineseAPI.previewCourse({
      kinds: kinds.value,
      levels: LEVEL_OPTIONS,
      grades: grades.value,
      difficulties: difficulties.value,
      dailyMinutes: dailyMinutes.value
    })) as any
    if (!nameTouched.value && preview.value.suggestedName) {
      name.value = String(preview.value.suggestedName)
      note.value = String(preview.value.suggestedNote || note.value)
    }
  } catch (error: any) {
    if (current !== ticket) return
    uni.showToast({ title: error.message || '预览失败', icon: 'none' })
  } finally {
    if (current === ticket) loading.value = false
  }
}

async function createCourse() {
  busy.value = true
  try {
    const course = (await chineseAPI.createCourse({
      name: name.value,
      note: note.value,
      kinds: kinds.value,
      levels: LEVEL_OPTIONS,
      grades: grades.value,
      difficulties: difficulties.value,
      dailyMinutes: dailyMinutes.value
    })) as any
    uni.showToast({
      title: course.reused ? '已有相同课程，未重复生成' : `已生成 ${course.entryCount || course.itemCount || 0} 个词条`,
      icon: 'success'
    })
    setTimeout(() => openPage('/pages/chinese/courses'), 400)
  } catch (error: any) {
    uni.showToast({ title: error.message || '生成失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

watch([kinds, grades, difficulties, dailyMinutes], loadLibrary, { deep: true })
onMounted(async () => {
  if (!(await requireSubject('chinese', 'parent'))) return
  await loadLibrary()
})
</script>

<style lang="scss" scoped>
.header { padding: 12rpx 8rpx 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.subtitle { display: block; margin-top: 8rpx; color: #888; font-size: 24rpx; }
.label { display: block; margin: 20rpx 0 12rpx; font-size: 26rpx; color: #555; }
.input { background: #f7f7f7; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; }
.chips { display: flex; flex-wrap: wrap; gap: 12rpx; }
.chip { padding: 10rpx 18rpx; border-radius: 999rpx; background: #f3f3f3; font-size: 24rpx; color: #555; }
.chip.active { background: #667eea; color: #fff; }
.muted { display: block; margin: 16rpx 0; color: #888; font-size: 24rpx; }
.warning {
  display: block;
  margin: 0 0 16rpx;
  padding: 16rpx 18rpx;
  border-radius: 12rpx;
  background: #fff7ed;
  color: #9a3412;
  font-size: 24rpx;
  line-height: 1.55;
}
</style>
