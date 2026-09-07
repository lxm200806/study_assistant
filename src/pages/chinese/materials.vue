<template>
  <view class="container">
    <view class="header">
      <text class="title">语文教材</text>
      <text class="subtitle">官方册同步后直接进已发布库。灰色未同步、红色有更新、绿色已同步。</text>
    </view>
    <view class="toolbar">
      <button class="btn-primary compact" :disabled="busy" @tap="sync(false)">增量同步</button>
      <button class="btn-secondary compact" :disabled="busy" @tap="sync(true)">全部重同步</button>
    </view>
    <view class="toolbar">
      <button class="btn-secondary compact" @tap="goDrafts">草稿审核</button>
      <button class="btn-secondary compact" @tap="goPoints">知识点</button>
    </view>
    <text v-if="message" class="banner">{{ message }}</text>
    <text v-if="previewMeta" class="muted">{{ previewMeta }}</text>

    <view v-if="!officialPacks.length && !otherResources.length" class="card">
      <text class="muted">还没有资源。请先做一次增量同步。</text>
    </view>

    <view v-for="item in officialPacks" :key="item.id" class="card">
      <view class="row-between">
        <text class="name">{{ item.title || item.filename }}</text>
        <text class="sync-tag" :class="item.syncState">{{ syncLabel(item) }}</text>
      </view>
      <text class="muted">{{ item.filename }} · 文件 v{{ item.version || 1 }} · 已同步 v{{ item.syncedVersion || 0 }} · {{ item.pointCount || 0 }} 条</text>
      <text v-if="item.syncState === 'outdated'" class="warn">内容已变化，尚未同步到知识库。</text>
      <text v-else-if="item.syncState === 'pending'" class="warn">尚未写入知识库。</text>
      <view class="actions">
        <button class="btn-primary compact" :disabled="busy" @tap="syncOne(item.id)">同步本册</button>
        <button class="btn-secondary compact" @tap="previewResource(item.id)">查看原文</button>
        <button class="btn-secondary compact" @tap="useForExtract(item.id)">用作抽取</button>
      </view>
    </view>

    <template v-if="originalFiles.length">
      <text class="section">原文备份</text>
      <view v-for="item in originalFiles" :key="item.id" class="card">
        <text class="name">{{ item.filename }}</text>
        <text class="muted">{{ item.slug }}</text>
        <button class="btn-secondary compact" @tap="previewResource(item.id)">查看原文</button>
      </view>
    </template>

    <template v-if="otherResources.length">
      <text class="section">其他上传</text>
      <view v-for="item in otherResources" :key="item.id" class="card">
        <text class="name">{{ item.filename }}</text>
        <text class="muted">{{ item.ownerType || item.owner_type }} · {{ item.status }}</text>
        <view class="actions">
          <button class="btn-primary compact" :disabled="busy" @tap="syncOne(item.id)">同步到知识库</button>
          <button class="btn-secondary compact" @tap="previewResource(item.id)">查看原文</button>
          <button class="btn-secondary compact" @tap="useForExtract(item.id)">用作抽取</button>
        </view>
      </view>
    </template>

    <view v-if="preview" class="card">
      <text class="section">原文预览</text>
      <text class="preview">{{ preview }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { chineseAPI } from '@/utils/api'
import { useUserStore } from '@/stores/user'
import { openPage } from '@/utils/navigation'
import { requireSubject } from '@/utils/subject'

const userStore = useUserStore()
const resources = ref<any[]>([])
const busy = ref(false)
const message = ref('')
const preview = ref('')
const previewMeta = ref('')

const officialPacks = computed(() => resources.value.filter(item => item.isPack))
const originalFiles = computed(() => resources.value.filter(item => item.isOriginal))
const otherResources = computed(() => resources.value.filter(item => !item.isPack && !item.isOriginal))

function syncLabel(item: any) {
  if (item.syncState === 'synced') return '已同步'
  if (item.syncState === 'outdated') return '有更新'
  if (item.syncState === 'pending') return '未同步'
  return item.status || ''
}

async function load() {
  try {
    const data = (await chineseAPI.resources()) as unknown as any[]
    resources.value = Array.isArray(data) ? data : []
  } catch (error: any) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' })
  }
}

async function sync(all: boolean) {
  busy.value = true
  try {
    const result = (await (all ? chineseAPI.syncAll() : chineseAPI.syncIncremental())) as any
    if (all) {
      message.value = `重新同步官方材料：新增 ${result.inserted || 0}，更新 ${result.updated || 0}`
    } else {
      message.value = `增量同步：写入 ${result.synced || 0} 册，跳过 ${result.skipped || 0} 册，新增 ${result.inserted || 0}，更新 ${result.updated || 0}`
    }
    await load()
  } catch (error: any) {
    uni.showToast({ title: error.message || '同步失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function syncOne(id: string) {
  busy.value = true
  try {
    const result = (await chineseAPI.syncResource(id)) as any
    message.value = `${result.title || result.filename}：新增 ${result.inserted || 0}，更新 ${result.updated || 0}，未改 ${result.unchanged || 0}`
    await load()
  } catch (error: any) {
    uni.showToast({ title: error.message || '同步失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function previewResource(id: string) {
  try {
    const data = (await chineseAPI.resource(id)) as any
    preview.value = data.original || '（空）'
    previewMeta.value = `${data.filename} 已关联 ${data.linkedPoints || 0} 个知识点`
  } catch (error: any) {
    uni.showToast({ title: error.message || '预览失败', icon: 'none' })
  }
}

function useForExtract(id: string) {
  openPage(`/pages/chinese/drafts?resourceId=${encodeURIComponent(id)}`)
}

function goDrafts() {
  openPage('/pages/chinese/drafts')
}

function goPoints() {
  openPage('/pages/chinese/points')
}

onShow(async () => {
  if (!(await requireSubject('chinese'))) return
  if (!userStore.isAdmin) {
    uni.showToast({ title: '需要管理员', icon: 'none' })
    uni.navigateBack()
    return
  }
  await load()
})
</script>

<style lang="scss" scoped>
.header { padding: 12rpx 8rpx 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.subtitle, .muted { display: block; color: #888; font-size: 24rpx; margin-top: 8rpx; }
.toolbar { display: flex; gap: 16rpx; margin-bottom: 16rpx; }
.compact { flex: 1; margin: 0; }
.name { display: block; font-weight: 600; flex: 1; }
.banner { display: block; margin-bottom: 16rpx; color: #667eea; }
.row-between { display: flex; align-items: center; gap: 12rpx; }
.sync-tag { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 999rpx; background: #eee; color: #666; }
.sync-tag.synced { background: #dcfce7; color: #166534; }
.sync-tag.outdated { background: #fee2e2; color: #b91c1c; }
.sync-tag.pending { background: #e5e7eb; color: #4b5563; }
.warn { display: block; margin-top: 8rpx; color: #b91c1c; font-size: 24rpx; }
.actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 16rpx; }
.actions .compact { flex: 1 1 30%; }
.section { display: block; margin: 16rpx 8rpx 8rpx; font-weight: 600; }
.preview { display: block; white-space: pre-wrap; font-size: 24rpx; line-height: 1.6; max-height: 600rpx; overflow: hidden; }
</style>
