<template>
  <view class="container">
    <view class="header">
      <text class="title">全部知识点</text>
      <text class="subtitle">{{ intro }}</text>
    </view>

    <view class="card">
      <text class="label">类型</text>
      <view class="chips">
        <view :class="['chip', kind === '' ? 'active' : '']" @tap="kind = ''"><text>全部</text></view>
        <view v-for="item in KIND_OPTIONS" :key="item.id" :class="['chip', kind === item.id ? 'active' : '']" @tap="kind = item.id">
          <text>{{ item.label }}</text>
        </view>
      </view>
      <text class="label">级别</text>
      <view class="chips">
        <view :class="['chip', level === '' ? 'active' : '']" @tap="level = ''"><text>全部</text></view>
        <view v-for="item in LEVEL_OPTIONS" :key="item" :class="['chip', level === item ? 'active' : '']" @tap="level = item">
          <text>{{ item }}</text>
        </view>
      </view>
      <text class="label">年级</text>
      <view class="chips">
        <view :class="['chip', grade === '' ? 'active' : '']" @tap="grade = ''"><text>全部</text></view>
        <view v-for="item in GRADE_OPTIONS" :key="item" :class="['chip', grade === item ? 'active' : '']" @tap="grade = item">
          <text>{{ item }}</text>
        </view>
      </view>
      <text class="label">原始资料</text>
      <view class="chips">
        <view :class="['chip', resourceId === 'all' ? 'active' : '']" @tap="resourceId = 'all'"><text>全部</text></view>
        <view :class="['chip', resourceId === 'unlinked' ? 'active' : '']" @tap="resourceId = 'unlinked'"><text>未关联</text></view>
        <view
          v-for="item in officialPacks"
          :key="item.id"
          :class="['chip', resourceId === String(item.id) ? 'active' : '']"
          @tap="resourceId = String(item.id)"
        >
          <text>{{ packShort(item.title || item.filename) }}</text>
        </view>
      </view>
      <text class="label">出题</text>
      <view class="chips">
        <view :class="['chip', questionType === '' ? 'active' : '']" @tap="questionType = ''"><text>全部</text></view>
        <view
          v-for="item in QUESTION_TYPE_OPTIONS"
          :key="item.id"
          :class="['chip', questionType === item.id ? 'active' : '']"
          @tap="questionType = item.id"
        >
          <text>{{ item.label }}</text>
        </view>
      </view>
      <text class="label">受众</text>
      <view class="chips">
        <view :class="['chip', audience === '' ? 'active' : '']" @tap="audience = ''"><text>全部</text></view>
        <view
          v-for="item in AUDIENCE_OPTIONS"
          :key="item.id"
          :class="['chip', audience === item.id ? 'active' : '']"
          @tap="audience = item.id"
        >
          <text>{{ item.label }}</text>
        </view>
      </view>
      <view class="check-row" @tap="byGroup = !byGroup">
        <text class="check">{{ byGroup ? '☑' : '☐' }}</text>
        <text>按词条分组</text>
      </view>
      <text class="muted">
        {{ loading ? '正在加载知识点…' : `词条 ${entryCount} · 卡片 ${total}${total ? `，第 ${page} / ${pageCount} 页` : ''}` }}
      </text>
      <text v-if="!loading && total === 0" class="muted">{{ emptyHint }}</text>
      <text v-if="message" class="banner">{{ message }}</text>
    </view>

    <view v-if="userStore.isAdmin && editing" class="card">
      <text class="section">编辑知识点</text>
      <text class="label">提示</text>
      <input class="input" v-model="editing.prompt" />
      <text class="label">答案</text>
      <textarea class="import-box" v-model="editing.answer" />
      <text class="label">类型</text>
      <view class="chips">
        <view
          v-for="item in KIND_OPTIONS"
          :key="item.id"
          :class="['chip', editing.kind === item.id ? 'active' : '']"
          @tap="editing.kind = item.id"
        >
          <text>{{ item.label }}</text>
        </view>
      </view>
      <text class="label">级别</text>
      <view class="chips">
        <view
          v-for="item in LEVEL_OPTIONS"
          :key="item"
          :class="['chip', editing.level === item ? 'active' : '']"
          @tap="editing.level = item"
        >
          <text>{{ item }}</text>
        </view>
      </view>
      <text class="label">年级</text>
      <view class="chips">
        <view :class="['chip', editing.grade === '' ? 'active' : '']" @tap="editing.grade = ''"><text>未分年级</text></view>
        <view
          v-for="item in GRADE_OPTIONS"
          :key="item"
          :class="['chip', editing.grade === item ? 'active' : '']"
          @tap="editing.grade = item"
        >
          <text>{{ item }}</text>
        </view>
      </view>
      <text class="label">词条</text>
      <input class="input" v-model="editing.lemma" />
      <text class="label">出处</text>
      <input class="input" v-model="editing.source" />
      <view class="toolbar">
        <button class="btn-primary compact" @tap="savePoint">保存</button>
        <button class="btn-secondary compact" @tap="editing = null">取消</button>
      </view>
    </view>

    <template v-if="byGroup">
      <view v-for="group in groupedPoints" :key="group.key" class="card">
        <text class="section">{{ groupHeading(group) }}</text>
        <text class="muted">{{ groupMeta(group) }} · {{ group.items.length }} 张卡</text>
        <view v-for="item in group.items" :key="item.id" class="point-item">
          <text class="name">{{ item.level }} · {{ questionTypeLabel(item.questionType) }} · {{ item.prompt }}</text>
          <text class="muted">{{ item.answer }}</text>
          <button v-if="userStore.isAdmin" class="btn-secondary compact" @tap="startEdit(item)">编辑</button>
        </view>
      </view>
    </template>
    <template v-else>
      <view v-for="item in points" :key="item.id" class="card">
        <text class="name">{{ item.grade || '未分年级' }} · {{ item.level }} · {{ kindLabel(item.kind) }} · {{ questionTypeLabel(item.questionType) }}</text>
        <text>{{ item.prompt }}</text>
        <text class="muted">{{ item.answer }}</text>
        <text class="muted">{{ item.source }}{{ item.resourceTitle ? ' · ' + packShort(item.resourceTitle) : '' }}</text>
        <button v-if="userStore.isAdmin" class="btn-secondary compact" @tap="startEdit(item)">编辑</button>
      </view>
    </template>

    <view v-if="pageCount > 1" class="pagination">
      <view :class="['page-btn', page <= 1 ? 'disabled' : '']" @tap="goPage(page - 1)">上一页</view>
      <text class="page-info">{{ page }} / {{ pageCount }}</text>
      <view :class="['page-btn', page >= pageCount ? 'disabled' : '']" @tap="goPage(page + 1)">下一页</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import { chineseAPI } from '@/utils/api'
import {
  AUDIENCE_OPTIONS,
  GRADE_OPTIONS,
  KIND_OPTIONS,
  LEVEL_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  kindLabel,
  questionTypeLabel
} from '@/utils/chinese'
import { useUserStore } from '@/stores/user'
import { requireSubject } from '@/utils/subject'

const userStore = useUserStore()
const intro = computed(() =>
  userStore.isAdmin
    ? '已发布库，管理员可改题目和答案。已组课程不会自动改文案；可用课程页「同步新词」补进。'
    : '已发布库，可按年级、类型、册、出题方式浏览。'
)

const kind = ref('')
const level = ref('')
const grade = ref('')
const resourceId = ref('all')
const questionType = ref('')
const audience = ref('')
const byGroup = ref(false)
const loading = ref(true)
const resources = ref<any[]>([])
const points = ref<any[]>([])
const total = ref(0)
const entryCount = ref(0)
const page = ref(1)
const PAGE_SIZE = 20
const editing = ref<any | null>(null)
const message = ref('')
let loadTicket = 0

const pageCount = computed(() => Math.max(1, Math.ceil((Number(total.value) || 0) / PAGE_SIZE)))
const officialPacks = computed(() =>
  resources.value
    .filter(item => item.isPack)
    .slice()
    .sort((left, right) => packOrder(left.slug) - packOrder(right.slug))
)

const groupedPoints = computed(() => {
  const groups: any[] = []
  const seen: Record<string, any> = {}
  for (const item of points.value) {
    const key = item.entryKey || item.groupKey || String(item.id)
    if (!seen[key]) {
      seen[key] = {
        key,
        kind: item.kind,
        grade: item.grade,
        grades: item.entryGrades || item.grade || '',
        levels: item.entryLevels || item.level || '',
        source: item.source || '',
        lemma: item.lemma || '',
        items: []
      }
      groups.push(seen[key])
    }
    seen[key].items.push(item)
  }
  return groups
})

const emptyHint = computed(() => {
  if (resourceId.value === 'unlinked') return '没有未关联教材的知识点。系统预置词库都已挂到各册。'
  if (kind.value || level.value || grade.value || questionType.value || audience.value || resourceId.value !== 'all') {
    return '没有符合当前筛选的已发布知识点。可清空筛选后再看。'
  }
  return '知识库还是空的。管理员请到「语文教材」同步。'
})

function packOrder(slug: string) {
  const matched = /^grade(\d+)-(shang|xia)$/.exec(slug || '')
  if (!matched) return 999
  return Number(matched[1]) * 2 + (matched[2] === 'xia' ? 1 : 0)
}

function packShort(title: string) {
  return String(title || '').split('｜')[0]
}

function formatLabels(text: string, empty: string) {
  const items = String(text || '')
    .split(/[;；,，]/)
    .map(item => item.trim())
    .filter(Boolean)
  return items.join('、') || empty || ''
}

function groupMeta(group: any) {
  const parts = [formatLabels(group.grades || group.grade, '未分年级')]
  const levels = formatLabels(group.levels, '')
  if (levels) parts.push(levels)
  parts.push(kindLabel(group.kind))
  return parts.join(' · ')
}

function groupHeading(group: any) {
  if (group.lemma) return group.lemma
  if (group.source) return group.source
  const first = group.items[0]
  return (first && (first.lemma || first.prompt)) || '未标词条'
}

function libraryQuery(offset: number) {
  const query = [`limit=${PAGE_SIZE}`, `offset=${offset}`, 'answers=1']
  if (kind.value) query.push(`kind=${encodeURIComponent(kind.value)}`)
  if (level.value) query.push(`level=${encodeURIComponent(level.value)}`)
  if (grade.value) query.push(`grade=${encodeURIComponent(grade.value)}`)
  if (resourceId.value === 'unlinked') query.push('resourceId=unlinked')
  else if (resourceId.value && resourceId.value !== 'all') query.push(`resourceId=${encodeURIComponent(resourceId.value)}`)
  if (questionType.value) query.push(`questionType=${encodeURIComponent(questionType.value)}`)
  if (audience.value) query.push(`audience=${encodeURIComponent(audience.value)}`)
  return query.join('&')
}

async function loadPoints() {
  const ticket = ++loadTicket
  loading.value = true
  try {
    let data = (await chineseAPI.library(libraryQuery((page.value - 1) * PAGE_SIZE))) as any
    if (ticket !== loadTicket) return
    total.value = Number(data.total) || 0
    entryCount.value = Number(data.entryCount) || total.value
    const pages = Math.max(1, Math.ceil(total.value / PAGE_SIZE))
    if (page.value > pages) {
      page.value = pages
      data = (await chineseAPI.library(libraryQuery((page.value - 1) * PAGE_SIZE))) as any
      if (ticket !== loadTicket) return
      total.value = Number(data.total) || 0
      entryCount.value = Number(data.entryCount) || total.value
    }
    points.value = data.items || []
  } catch (error: any) {
    if (ticket !== loadTicket) return
    uni.showToast({ title: error.message || '加载失败', icon: 'none' })
    points.value = []
    total.value = 0
    entryCount.value = 0
  } finally {
    if (ticket === loadTicket) loading.value = false
  }
}

function goPage(next: number) {
  if (next < 1 || next > pageCount.value) return
  page.value = next
  loadPoints()
}

function startEdit(item: any) {
  editing.value = {
    id: item.id,
    kind: item.kind,
    level: item.level,
    grade: item.grade || '',
    prompt: item.prompt,
    answer: item.answer,
    lemma: item.lemma || '',
    source: item.source || '',
    questionType: item.questionType || 'dictation',
    audience: item.audience || 'all',
    tags: item.tags || ''
  }
}

async function savePoint() {
  if (!editing.value) return
  try {
    await chineseAPI.patchPoint(editing.value.id, editing.value)
    message.value = '已保存'
    editing.value = null
    await loadPoints()
  } catch (error: any) {
    uni.showToast({ title: error.message || '保存失败', icon: 'none' })
  }
}

watch([kind, level, grade, resourceId, questionType, audience], () => {
  page.value = 1
  loadPoints()
})

onShow(async () => {
  if (!(await requireSubject('chinese', 'parent'))) return
  try {
    const data = (await chineseAPI.resources()) as unknown as any[]
    resources.value = Array.isArray(data) ? data : []
  } catch {
    resources.value = []
  }
  await loadPoints()
})
</script>

<style lang="scss" scoped>
.header { padding: 12rpx 8rpx 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.subtitle, .muted { display: block; color: #888; font-size: 24rpx; margin-top: 8rpx; }
.label { display: block; margin: 20rpx 0 12rpx; font-size: 26rpx; color: #555; }
.chips { display: flex; flex-wrap: wrap; gap: 12rpx; }
.chip { padding: 10rpx 18rpx; border-radius: 999rpx; background: #f3f3f3; font-size: 24rpx; color: #555; }
.chip.active { background: #667eea; color: #fff; }
.check-row { display: flex; align-items: center; gap: 12rpx; margin-top: 20rpx; }
.check { color: #667eea; font-size: 32rpx; }
.banner { display: block; margin-top: 12rpx; color: #667eea; }
.section { display: block; font-weight: 600; font-size: 30rpx; }
.name { display: block; font-weight: 600; margin-bottom: 8rpx; }
.point-item { padding: 16rpx 0; border-top: 1rpx solid #f0f0f0; }
.input, .import-box { background: #f7f7f7; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 26rpx; width: 100%; box-sizing: border-box; }
.import-box { min-height: 160rpx; }
.toolbar { display: flex; gap: 16rpx; margin-top: 16rpx; }
.toolbar .compact, .compact { flex: 1; margin: 16rpx 0 0; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 24rpx; margin: 24rpx 0 40rpx; }
.page-btn { color: #667eea; }
.page-btn.disabled { color: #ccc; }
.page-info { color: #888; font-size: 24rpx; }
</style>
