<template>
  <view class="container">
    <view class="header">
      <text class="title">全库覆盖</text>
      <text class="subtitle">同一成语可以出现在多本教材里。全局词条不重复，但可以同时属于多个年级。</text>
    </view>
    <view class="card stats">
      <view class="stat"><text class="num">{{ data.entryCount || data.total || 0 }}</text><text>词条</text></view>
      <view class="stat"><text class="num">{{ data.total || 0 }}</text><text>卡片</text></view>
      <view class="stat"><text class="num">{{ data.inCourse || 0 }}</text><text>已组课</text></view>
      <view class="stat"><text class="num">{{ data.studiedEntries || data.studied || 0 }}</text><text>学过词条</text></view>
      <view class="stat"><text class="num">{{ data.studied || 0 }}</text><text>学过卡片</text></view>
      <view class="stat"><text class="num">{{ data.mastered || 0 }}</text><text>已掌握</text></view>
    </view>
    <view class="card">
      <text class="section">按类型</text>
      <text v-if="emptyLibrary" class="muted">知识库还是空的。管理员请到语文教材同步；学生可先打开默认课程。</text>
      <text v-else-if="emptyCourses" class="muted">词库已有内容，但还没有组进课程。去组课，或打开默认课程开始默写。</text>
      <view v-for="item in data.byKind || []" :key="item.kind" class="row">
        <text>{{ kindLabel(item.kind) }} · 词条 {{ item.entries || item.total }} · 卡片 {{ item.total }} · 已组课 {{ item.in_course || item.inCourse || 0 }}</text>
      </view>
    </view>
    <view class="card">
      <text class="section">按年级（全局词条）</text>
      <text class="muted">同一个成语若既属一年级又属二年级，两边都会计入。</text>
      <view v-for="item in entryGradeRows" :key="item.grade" class="row">
        <text>{{ item.grade }} · 词条 {{ item.entries || item.total }} · 卡片 {{ item.total }} · 已组课 {{ item.in_course || item.inCourse || 0 }}</text>
      </view>
      <text v-if="!entryGradeRows.length" class="muted">还没有按年级的统计。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { chineseAPI } from '@/utils/api'
import { kindLabel } from '@/utils/chinese'
import { requireSubject } from '@/utils/subject'

const data = ref<any>({})
const emptyLibrary = computed(() => !Number(data.value.total))
const emptyCourses = computed(() => Number(data.value.total) > 0 && !Number(data.value.inCourse))
const entryGradeRows = computed(() => data.value.byEntryGrade || data.value.byGrade || [])

onShow(async () => {
  if (!(await requireSubject('chinese'))) return
  try {
    data.value = await chineseAPI.coverage()
  } catch (error: any) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' })
  }
})
</script>

<style lang="scss" scoped>
.header { padding: 12rpx 8rpx 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.subtitle, .muted { display: block; color: #888; font-size: 24rpx; margin-top: 8rpx; }
.stats { display: flex; flex-wrap: wrap; gap: 16rpx; }
.stat { flex: 1 1 28%; }
.num { display: block; font-size: 36rpx; font-weight: 700; color: #667eea; }
.section { display: block; font-weight: 600; font-size: 30rpx; }
.row { margin-top: 12rpx; font-size: 26rpx; }
</style>
