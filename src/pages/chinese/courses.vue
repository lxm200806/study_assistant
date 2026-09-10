<template>
  <view class="container course-list">
    <text v-if="loading" class="loading-text">正在加载课程…</text>
    <view v-else-if="!courses.length" class="empty card">
      <text class="empty-title">还没有课程</text>
      <text class="empty-desc">先按年级和类型生成一份课程。</text>
      <button class="btn-primary empty-btn" @tap="goLibrary">去组课</button>
    </view>

    <view v-for="item in courses" :key="item.id" class="card course-card">
      <template v-if="editingId === item.id">
        <text class="edit-title">修改课程名称</text>
        <input class="input" v-model="editName" maxlength="30" focus />
        <view class="edit-actions">
          <button class="action-btn primary-action" :disabled="busy" @tap="saveEdit(item.id)">保存</button>
          <button class="action-btn plain-action" :disabled="busy" @tap="cancelEdit">取消</button>
        </view>
      </template>
      <template v-else>
        <view class="course-heading">
          <text class="course-name">{{ item.name }}</text>
          <text v-if="item.pendingCount" class="update-badge">可同步 {{ item.pendingCount }} 条</text>
        </view>
        <view class="course-details">
          <text>词条 {{ item.entryCount || 0 }}</text>
          <text class="detail-dot">·</text>
          <text>题卡 {{ item.itemCount || item.item_count || 0 }}</text>
          <text class="detail-dot">·</text>
          <text>每天 {{ item.dailyMinutes || 15 }} 分钟</text>
        </view>
        <view class="main-actions">
          <button class="action-btn primary-action" @tap="goStats(item.id)">查看掌握</button>
          <button class="action-btn plan-action" @tap="goPlan(item.id)">学习计划</button>
        </view>
        <view class="minor-actions">
          <button class="text-action" @tap="startEdit(item)">改名</button>
          <button class="text-action" :disabled="busy" @tap="syncCourse(item)">同步新词</button>
          <button class="text-action danger" :disabled="busy" @tap="removeCourse(item)">删除</button>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { chineseAPI } from '@/utils/api'
import { openPage } from '@/utils/navigation'
import { requireSubject } from '@/utils/subject'

interface CourseItem {
  id: string
  name: string
  note?: string
  itemCount?: number
  item_count?: number
  entryCount?: number
  dailyMinutes?: number
  pendingCount?: number
}

const courses = ref<CourseItem[]>([])
const loading = ref(true)
const busy = ref(false)
const editingId = ref('')
const editName = ref('')

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
}

function cancelEdit() {
  editingId.value = ''
}

async function saveEdit(id: string) {
  const name = editName.value.trim()
  if (!name) {
    uni.showToast({ title: '请输入课程名称', icon: 'none' })
    return
  }
  busy.value = true
  try {
    await chineseAPI.patchCourse(id, { name })
    editingId.value = ''
    uni.showToast({ title: '已保存', icon: 'success' })
    await loadCourses()
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
const goPlan = (id: string) => openPage(`/pages/chinese/plan?id=${id}`)
const goStats = (id: string) => openPage(`/pages/chinese/stats?id=${id}`)

onShow(async () => {
  if (!(await requireSubject('chinese', 'parent'))) return
  await loadCourses()
})
</script>

<style lang="scss" scoped>
.course-list { padding-top: 20rpx; }
.loading-text { display: block; padding: 80rpx 0; text-align: center; color: #999; font-size: 26rpx; }
.course-card {
  margin-bottom: 22rpx;
  padding: 28rpx;
  overflow: hidden;
  border: 1rpx solid #eef0f7;
  border-radius: 24rpx;
  box-shadow: 0 10rpx 30rpx rgba(60, 72, 120, 0.08);
}
.course-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.course-name { flex: 1; color: #1f2937; font-size: 34rpx; font-weight: 700; line-height: 1.35; }
.update-badge { flex-shrink: 0; padding: 6rpx 12rpx; border-radius: 999rpx; background: #fff7ed; color: #c2410c; font-size: 20rpx; }
.course-details { display: flex; align-items: center; flex-wrap: wrap; gap: 10rpx; margin-top: 14rpx; color: #6b7280; font-size: 24rpx; }
.detail-dot { color: #d1d5db; }
.main-actions { display: flex; gap: 16rpx; margin-top: 26rpx; }
.action-btn {
  flex: 1;
  height: 72rpx;
  margin: 0;
  border: 0;
  border-radius: 14rpx;
  font-size: 25rpx;
  font-weight: 600;
  line-height: 72rpx;
}
.action-btn::after, .text-action::after { border: 0; }
.primary-action { background: linear-gradient(135deg, #667eea, #5b6ee1); color: #fff; }
.plan-action { background: #eef2ff; color: #5264d9; }
.plain-action { background: #f3f4f6; color: #4b5563; }
.minor-actions { display: flex; align-items: center; justify-content: flex-end; margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid #f0f1f5; }
.text-action { min-width: 0; height: 48rpx; margin: 0; padding: 0 20rpx; background: transparent; color: #6b7280; font-size: 23rpx; line-height: 48rpx; }
.text-action + .text-action { border-left: 1rpx solid #eee; border-radius: 0; }
.danger { color: #dc2626; }
.edit-title { display: block; margin-bottom: 14rpx; color: #374151; font-size: 26rpx; font-weight: 600; }
.input { box-sizing: border-box; width: 100%; background: #f7f8fc; border: 2rpx solid #dfe4ff; border-radius: 14rpx; padding: 18rpx 20rpx; font-size: 28rpx; }
.edit-actions { display: flex; gap: 16rpx; margin-top: 18rpx; }
.empty { padding: 60rpx 40rpx; text-align: center; }
.empty-title { display: block; color: #374151; font-size: 30rpx; font-weight: 600; }
.empty-desc { display: block; margin-top: 10rpx; color: #9ca3af; font-size: 24rpx; }
.empty-btn { width: 240rpx; margin-top: 26rpx; }
</style>
