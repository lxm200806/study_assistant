<template>
  <view class="container">
    <view class="header">
      <text class="title">组课</text>
      <text class="subtitle">按年级、类型、级别筛选后生成课程。组课页不显示答案。没有课的账号打开「语文课程」时会自动生成默认课程。</text>
    </view>

    <view class="card">
      <text class="label">课程名称</text>
      <input class="input" v-model="name" placeholder="三年级上册默写" />
      <text class="label">备注</text>
      <input class="input" v-model="note" placeholder="部编必背与日积月累" />

      <text class="label">年级</text>
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

      <text class="label">级别</text>
      <view class="chips">
        <view
          v-for="item in LEVEL_OPTIONS"
          :key="item"
          :class="['chip', levels.includes(item) ? 'active' : '']"
          @tap="toggle(levels, item)"
        >
          <text>{{ item }}</text>
        </view>
      </view>

      <view class="row">
        <view class="field">
          <text class="label">每天新学能量</text>
          <input class="input" type="number" v-model.number="newEnergy" />
        </view>
        <view class="field">
          <text class="label">每天复习能量</text>
          <input class="input" type="number" v-model.number="reviewEnergy" />
        </view>
      </view>

      <text class="muted">
        {{ loading ? '正在预览…' : `当前筛选 ${entryCount} 个词条、${total} 张卡片。${previewText}` }}
      </text>
      <button class="btn-primary" :disabled="busy || loading || total === 0" @tap="createCourse">
        {{ busy ? '正在生成…' : '生成课程' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { chineseAPI } from '@/utils/api'
import { GRADE_OPTIONS, KIND_OPTIONS, LEVEL_OPTIONS } from '@/utils/chinese'
import { openPage } from '@/utils/navigation'
import { requireSubject } from '@/utils/subject'

const kinds = ref(KIND_OPTIONS.map(item => item.id))
const levels = ref([...LEVEL_OPTIONS])
const grades = ref(['三年级上'])
const newEnergy = ref(30)
const reviewEnergy = ref(30)
const name = ref('三年级上册默写')
const note = ref('部编三年级上册必背与日积月累')
const total = ref(0)
const entryCount = ref(0)
const preview = ref<{ dayCount?: number; newDayCount?: number; groupCount?: number; totalEnergy?: number }>({})
const loading = ref(false)
const busy = ref(false)
let ticket = 0

const previewText = computed(() => {
  if (!preview.value.dayCount) return ''
  return `约 ${preview.value.groupCount} 张学习卡、${preview.value.totalEnergy} 能量；新学约 ${preview.value.newDayCount || preview.value.dayCount} 天，含复习共 ${preview.value.dayCount} 天。`
})

function toggle(list: string[], item: string) {
  const index = list.indexOf(item)
  if (index >= 0) list.splice(index, 1)
  else list.push(item)
}

async function loadLibrary() {
  if (!kinds.value.length || !levels.value.length) {
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
    params.set('levels', levels.value.join(','))
    if (grades.value.length) params.set('grades', grades.value.join(','))
    params.set('limit', '20')
    const data = (await chineseAPI.library(params.toString())) as any
    if (current !== ticket) return
    total.value = data.total || 0
    entryCount.value = data.entryCount || data.total || 0
    preview.value = (await chineseAPI.previewCourse({
      kinds: kinds.value,
      levels: levels.value,
      grades: grades.value,
      newEnergy: newEnergy.value,
      reviewEnergy: reviewEnergy.value
    })) as any
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
      levels: levels.value,
      grades: grades.value,
      newEnergy: newEnergy.value,
      reviewEnergy: reviewEnergy.value
    })) as any
    uni.showToast({ title: `已生成 ${course.itemCount || 0} 条`, icon: 'success' })
    setTimeout(() => openPage('/pages/chinese/courses'), 400)
  } catch (error: any) {
    uni.showToast({ title: error.message || '生成失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

watch([kinds, levels, grades, newEnergy, reviewEnergy], loadLibrary, { deep: true })
onMounted(async () => {
  if (!(await requireSubject('chinese'))) return
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
.row { display: flex; gap: 16rpx; }
.field { flex: 1; }
.muted { display: block; margin: 16rpx 0; color: #888; font-size: 24rpx; }
</style>
