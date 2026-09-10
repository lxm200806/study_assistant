<template>
  <view class="container">
    <view class="header">
      <text class="title">语文课程</text>
      <text class="subtitle">组课、同步新词、查看掌握。今日默写请让学生角色进入。</text>
    </view>

    <view class="toolbar">
      <button class="btn-primary compact" @tap="goLibrary">组课</button>
      <button class="btn-secondary compact" @tap="goPoints">知识点</button>
      <button class="btn-secondary compact" @tap="goCoverage">覆盖</button>
    </view>

    <text v-if="loading" class="muted">正在加载课程…</text>
    <view v-else-if="!courses.length" class="empty card">
      <text>还没有课程。先去组课，按年级和类型生成一份；或等教材同步后刷新，系统会自动生成默认课程。</text>
    </view>
    <text v-if="staleNames" class="banner">词库有更新：{{ staleNames }} 比已发布库少知识点。点「同步新词」按原筛选补进。</text>

    <view v-for="item in courses" :key="item.id" class="card course-card">
      <template v-if="editingId === item.id">
        <text class="label">课程名称</text>
        <input class="input" v-model="editName" />
        <text class="label">备注</text>
        <input class="input" v-model="editNote" />
        <view class="actions">
          <button class="btn-primary compact" :disabled="busy" @tap="saveEdit(item.id)">保存</button>
          <button class="btn-secondary compact" :disabled="busy" @tap="cancelEdit">取消</button>
        </view>
      </template>
      <template v-else>
        <text class="course-name">{{ item.name }}</text>
        <text class="muted">
          {{ item.note || '无备注' }} · {{ item.itemCount || item.item_count || 0 }} 个知识点
          <template v-if="item.kinds && item.kinds.length"> · {{ kindNames(item.kinds) }} · {{ (item.levels || []).join(' / ') }}</template>
          <template v-if="item.grades && item.grades.length"> · {{ item.grades.join(' / ') }}</template>
          <template v-if="item.difficulties && item.difficulties.length"> · 成语：{{ difficultyNames(item.difficulties) }}</template>
          · 每天新学 {{ item.newEnergy || 30 }} 能 / 复习 {{ item.reviewEnergy || 30 }} 能
        </text>
        <text class="today-title">{{ progressTitle(item) }}</text>
        <text v-if="progressCheer(item)" class="cheer">{{ progressCheer(item) }}</text>
        <text v-if="item.progress && item.progress.summary" class="hint">{{ item.progress.summary }}</text>
        <text v-if="item.pendingCount" class="banner">词库有更新，本课还可补进 {{ item.pendingCount }} 条。</text>
        <view class="pref" @tap="toggleReviewPref(item)">
          <text class="check">{{ item.reviewDefaultTest ? '☑' : '☐' }}</text>
          <text>到期复习默认用测试模式</text>
        </view>
        <view class="actions">
          <button class="btn-primary compact" @tap="goStats(item.id)">查看掌握</button>
          <button class="btn-secondary compact" @tap="goPlan(item.id)">计划</button>
          <button class="btn-secondary compact" @tap="goStats(item.id)">掌握</button>
          <button class="btn-secondary compact" @tap="startEdit(item)">改名</button>
          <button class="btn-secondary compact" :disabled="busy" @tap="syncCourse(item)">同步新词</button>
          <button class="btn-secondary compact danger" :disabled="busy" @tap="removeCourse(item)">删除</button>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { chineseAPI } from '@/utils/api'
import { DIFFICULTY_LABEL, KIND_LABEL } from '@/utils/chinese'
import { openPage } from '@/utils/navigation'
import { requireSubject } from '@/utils/subject'

interface CourseItem {
  id: string
  name: string
  note?: string
  itemCount?: number
  item_count?: number
  newEnergy?: number
  reviewEnergy?: number
  pendingCount?: number
  reviewDefaultTest?: boolean
  kinds?: string[]
  levels?: string[]
  grades?: string[]
  difficulties?: string[]
  progress?: { title?: string; status?: string; summary?: string; todayStreak?: number; todayDoneCount?: number; todayPracticed?: number }
}

const courses = ref<CourseItem[]>([])
const loading = ref(true)
const busy = ref(false)
const editingId = ref('')
const editName = ref('')
const editNote = ref('')

const staleNames = computed(() =>
  courses.value.filter(item => Number(item.pendingCount) > 0).map(item => item.name).join('、')
)

function kindNames(ids: string[]) {
  return (ids || []).map(id => KIND_LABEL[id] || id).join(' / ')
}

function difficultyNames(ids: string[]) {
  return (ids || []).map(id => DIFFICULTY_LABEL[id] || id).join(' / ')
}

function progressTitle(item: CourseItem) {
  return item.progress?.title || (item.progress?.status === 'done' ? '今天练完了' : '今天还没开始练')
}

function progressCheer(item: CourseItem) {
  const progress = item.progress || {}
  const parts = []
  if (Number(progress.todayStreak) > 0) parts.push(`连续正确 ${progress.todayStreak}`)
  if (Number(progress.todayDoneCount) > 0) parts.push(`今日已完成 ${progress.todayDoneCount} 条`)
  else if (Number(progress.todayPracticed) > 0) parts.push(`今日已练 ${progress.todayPracticed} 条`)
  return parts.join(' · ')
}

async function loadCourses() {
  loading.value = true
  try {
    const data = (await chineseAPI.courses()) as unknown as CourseItem[]
    courses.value = Array.isArray(data) ? data : []
  } catch (error: any) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function startEdit(item: CourseItem) {
  editingId.value = item.id
  editName.value = item.name
  editNote.value = item.note || ''
}

function cancelEdit() {
  editingId.value = ''
}

async function saveEdit(id: string) {
  busy.value = true
  try {
    await chineseAPI.patchCourse(id, { name: editName.value, note: editNote.value })
    editingId.value = ''
    uni.showToast({ title: '已保存', icon: 'success' })
    await loadCourses()
  } catch (error: any) {
    uni.showToast({ title: error.message || '保存失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function toggleReviewPref(item: CourseItem) {
  busy.value = true
  try {
    const result = (await chineseAPI.patchCourse(item.id, { reviewDefaultTest: !item.reviewDefaultTest })) as any
    item.reviewDefaultTest = !!result.reviewDefaultTest
    uni.showToast({
      title: item.reviewDefaultTest ? '到期复习将默认用测试' : '已改回自动选择模式',
      icon: 'none'
    })
  } catch (error: any) {
    uni.showToast({ title: error.message || '保存失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function syncCourse(item: CourseItem) {
  busy.value = true
  try {
    const result = (await chineseAPI.syncCourse(item.id)) as any
    uni.showToast({
      title: result.added ? `新补 ${result.added} 条` : '没有新知识点',
      icon: 'success'
    })
    await loadCourses()
  } catch (error: any) {
    uni.showToast({ title: error.message || '同步失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

function removeCourse(item: CourseItem) {
  uni.showModal({
    title: '删除课程',
    content: `确定删除「${item.name}」？学习记录也会删掉。`,
    success: async res => {
      if (!res.confirm) return
      busy.value = true
      try {
        await chineseAPI.deleteCourse(item.id)
        await loadCourses()
      } catch (error: any) {
        uni.showToast({ title: error.message || '删除失败', icon: 'none' })
      } finally {
        busy.value = false
      }
    }
  })
}

const goLibrary = () => openPage('/pages/chinese/library')
const goPoints = () => openPage('/pages/chinese/points')
const goCoverage = () => openPage('/pages/chinese/coverage')
const goPlan = (id: string) => openPage(`/pages/chinese/plan?id=${id}`)
const goStats = (id: string) => openPage(`/pages/chinese/stats?id=${id}`)

onShow(async () => {
  if (!(await requireSubject('chinese', 'parent'))) return
  await loadCourses()
})
</script>

<style lang="scss" scoped>
.header { padding: 12rpx 8rpx 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; color: #222; }
.subtitle { display: block; margin-top: 8rpx; color: #888; font-size: 26rpx; }
.toolbar { display: flex; gap: 16rpx; margin-bottom: 16rpx; }
.compact { flex: 1; margin: 0; font-size: 28rpx; height: 80rpx; line-height: 80rpx; }
.muted, .hint { display: block; color: #888; font-size: 24rpx; margin-top: 8rpx; }
.course-name { display: block; font-size: 32rpx; font-weight: 600; color: #222; }
.today-title { display: block; margin-top: 16rpx; font-size: 30rpx; color: #667eea; font-weight: 600; }
.cheer { display: block; margin-top: 8rpx; color: #667eea; font-size: 24rpx; }
.banner { display: block; margin-top: 12rpx; color: #b45309; font-size: 24rpx; }
.pref { display: flex; align-items: center; gap: 12rpx; margin-top: 16rpx; font-size: 26rpx; }
.check { color: #667eea; font-size: 32rpx; }
.actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 20rpx; }
.actions .compact { flex: 1 1 40%; }
.danger { color: #b91c1c; }
.label { display: block; margin: 16rpx 0 8rpx; font-size: 26rpx; color: #555; }
.input { background: #f7f7f7; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; }
.empty { padding: 40rpx; }
</style>
