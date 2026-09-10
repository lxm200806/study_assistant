<template>
  <view class="container">
    <view class="header">
      <text class="title">草稿审核</text>
      <text class="subtitle">粘贴 CSV / JSON 写入草稿后，再审核发布到知识库</text>
    </view>

    <view class="card">
      <text class="label">关联资源 ID（可选）</text>
      <input class="input" v-model="resourceId" placeholder="从教材页点「用作抽取」会自动带入" />
      <text class="label">CSV 或 JSON</text>
      <textarea class="import-box" v-model="importText" placeholder="kind,level,grade,prompt,answer,tags,source" />
      <button class="btn-primary compact" :disabled="busy" @tap="importDrafts">
        {{ busy ? '正在写入…' : '写入草稿' }}
      </button>
      <text v-if="message" class="banner">{{ message }}</text>
    </view>

    <view class="card">
      <text class="section">待审队列</text>
      <text v-if="loading" class="muted">正在加载草稿…</text>
      <view v-else-if="total === 0" class="hint-block">
        <text class="muted">暂无待审草稿。</text>
        <text class="muted">十二册教材和小学成语同步后会直接进已发布库。只有本页粘贴导入的条目才需要审核。</text>
      </view>
      <template v-else>
        <text class="muted">待审 {{ total }} 条，第 {{ page }} / {{ pageCount }} 页</text>
        <view class="toolbar">
          <button class="btn-secondary compact" @tap="toggleSelectPage">
            {{ allPageSelected ? '取消本页' : '全选本页' }}
          </button>
          <button class="btn-primary compact" :disabled="busy || !selectedIds.length" @tap="publishSelected">
            发布选中（{{ selectedIds.length }}）
          </button>
        </view>
        <view v-for="item in drafts" :key="item.id" class="draft-item">
          <view class="pick" @tap="toggleOne(item.id)">
            <text class="check">{{ isSelected(item.id) ? '☑' : '☐' }}</text>
            <view class="lib-body">
              <text class="name">
                <template v-if="item.kind === 'idiom'">{{ difficultyLabel(item.difficulty) }}</template>
                <template v-else>{{ item.grade || '未分年级' }} / {{ item.level }}</template>
                · {{ kindLabel(item.kind) }}
              </text>
              <text>{{ item.prompt }}</text>
              <text class="muted">{{ item.answer }}</text>
            </view>
          </view>
          <view class="actions">
            <button class="btn-primary compact" :disabled="busy" @tap="publish(item.id)">发布</button>
            <button class="btn-secondary compact" :disabled="busy" @tap="discard(item.id)">弃用</button>
          </view>
        </view>
        <view v-if="pageCount > 1" class="pagination">
          <view :class="['page-btn', page <= 1 ? 'disabled' : '']" @tap="goPage(page - 1)">上一页</view>
          <text class="page-info">{{ page }} / {{ pageCount }}</text>
          <view :class="['page-btn', page >= pageCount ? 'disabled' : '']" @tap="goPage(page + 1)">下一页</view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { chineseAPI } from '@/utils/api'
import { difficultyLabel, kindLabel } from '@/utils/chinese'
import { useUserStore } from '@/stores/user'
import { requireSubject } from '@/utils/subject'

const PAGE_SIZE = 20
const userStore = useUserStore()
const resourceId = ref('')
const importText = ref('')
const drafts = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const selectedIds = ref<string[]>([])
const message = ref('')
const loading = ref(true)
const busy = ref(false)

const pageCount = computed(() => Math.max(1, Math.ceil((Number(total.value) || 0) / PAGE_SIZE)))
const allPageSelected = computed(() => drafts.value.length > 0 && drafts.value.every(item => selectedIds.value.includes(item.id)))

function isSelected(id: string) {
  return selectedIds.value.includes(id)
}

function toggleOne(id: string) {
  if (isSelected(id)) selectedIds.value = selectedIds.value.filter(item => item !== id)
  else selectedIds.value = selectedIds.value.concat(id)
}

function toggleSelectPage() {
  const ids = drafts.value.map(item => item.id)
  if (allPageSelected.value) {
    selectedIds.value = selectedIds.value.filter(id => !ids.includes(id))
    return
  }
  selectedIds.value = selectedIds.value.concat(ids.filter(id => !selectedIds.value.includes(id)))
}

async function loadDrafts() {
  const offset = (page.value - 1) * PAGE_SIZE
  const data = (await chineseAPI.drafts(`status=draft&limit=${PAGE_SIZE}&offset=${offset}`)) as any
  total.value = Number(data.total) || 0
  const pages = Math.max(1, Math.ceil(total.value / PAGE_SIZE))
  if (page.value > pages) {
    page.value = pages
    return loadDrafts()
  }
  drafts.value = data.items || []
}

async function reload() {
  loading.value = true
  try {
    await loadDrafts()
  } catch (error: any) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goPage(next: number) {
  if (next < 1 || next > pageCount.value) return
  page.value = next
  reload()
}

async function importDrafts() {
  if (!importText.value.trim()) {
    uni.showToast({ title: '请粘贴 CSV 或 JSON', icon: 'none' })
    return
  }
  busy.value = true
  message.value = ''
  try {
    const payload: Record<string, unknown> = { text: importText.value }
    if (resourceId.value.trim()) payload.resourceId = resourceId.value.trim()
    const result = (await chineseAPI.importDrafts(payload)) as any
    message.value = `写入 ${result.ok} 条，跳过 ${result.skip}`
    importText.value = ''
    page.value = 1
    await loadDrafts()
  } catch (error: any) {
    uni.showToast({ title: error.message || '导入失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function publish(id: string) {
  busy.value = true
  try {
    await chineseAPI.publishDraft(id)
    message.value = '已发布，默认课程会自动补进'
    selectedIds.value = selectedIds.value.filter(item => item !== id)
    await loadDrafts()
  } catch (error: any) {
    uni.showToast({ title: error.message || '发布失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function publishSelected() {
  if (!selectedIds.value.length) {
    uni.showToast({ title: '请先勾选草稿', icon: 'none' })
    return
  }
  busy.value = true
  try {
    const result = (await chineseAPI.publishDrafts(selectedIds.value.slice())) as any
    const parts = [`已发布 ${result.ok} 条`]
    if (result.fail) parts.push(`失败 ${result.fail} 条`)
    message.value = parts.join('，') + '，默认课程会自动补进'
    selectedIds.value = []
    await loadDrafts()
  } catch (error: any) {
    uni.showToast({ title: error.message || '批量发布失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function discard(id: string) {
  busy.value = true
  try {
    await chineseAPI.patchDraft(id, { status: 'discarded' })
    selectedIds.value = selectedIds.value.filter(item => item !== id)
    await loadDrafts()
  } catch (error: any) {
    uni.showToast({ title: error.message || '弃用失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

onLoad((query: Record<string, string | undefined> = {}) => {
  if (query.resourceId) resourceId.value = String(query.resourceId)
})

onShow(async () => {
  if (!(await requireSubject('chinese', 'parent'))) return
  if (!userStore.isAdmin) {
    uni.showToast({ title: '需要管理员', icon: 'none' })
    uni.navigateBack()
    return
  }
  await reload()
})
</script>

<style lang="scss" scoped>
.header { padding: 12rpx 8rpx 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.subtitle, .muted { display: block; color: #888; font-size: 24rpx; margin-top: 8rpx; }
.label { display: block; margin: 16rpx 0 8rpx; font-size: 26rpx; color: #555; }
.input, .import-box { background: #f7f7f7; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 26rpx; width: 100%; box-sizing: border-box; }
.import-box { min-height: 220rpx; }
.compact { margin: 16rpx 0 0; }
.banner { display: block; margin-top: 16rpx; color: #667eea; }
.section { display: block; font-weight: 600; font-size: 30rpx; }
.toolbar { display: flex; gap: 16rpx; margin: 16rpx 0; }
.toolbar .compact { flex: 1; margin: 0; }
.draft-item { padding: 16rpx 0; border-top: 1rpx solid #f0f0f0; }
.pick { display: flex; gap: 16rpx; }
.check { font-size: 36rpx; color: #667eea; }
.lib-body { flex: 1; }
.name { display: block; font-weight: 600; }
.hint-block { padding: 12rpx 0; }
.actions { display: flex; gap: 12rpx; margin-top: 12rpx; }
.actions .compact { flex: 1; margin: 0; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 24rpx; margin-top: 24rpx; }
.page-btn { color: #667eea; }
.page-btn.disabled { color: #ccc; }
.page-info { color: #888; font-size: 24rpx; }
</style>
