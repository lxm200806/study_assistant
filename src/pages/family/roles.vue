<template>
  <view class="container">
    <view class="header">
      <text class="title">选择进入角色</text>
      <text class="subtitle">家长看管理和进度。学生只进入今日学习。</text>
    </view>

    <view v-if="!userStore.children.length" class="card">
      <text class="label">还没有学生</text>
      <text class="muted">先创建一个学生，学习记录会记在这个学生名下。</text>
      <input class="input" v-model="name" placeholder="例如：小明" />
      <button class="btn-primary" :disabled="busy" @tap="addStudent">创建学生</button>
    </view>

    <template v-else>
      <view class="card role-card" @tap="pickParent">
        <text class="icon">👨‍👩‍👧</text>
        <view class="copy">
          <text class="name">家长</text>
          <text class="muted">管理学生、切换学科、查看统计和会员</text>
        </view>
        <text class="arrow">›</text>
      </view>

      <view
        v-for="(item, index) in userStore.children"
        :key="item.id"
        class="card role-card"
        @tap="pickStudent(item.id)"
      >
        <text class="icon">🎒</text>
        <view class="copy">
          <text class="name">{{ studentLabel(item.name, index) }}</text>
          <text class="muted">只显示今日学习入口</text>
        </view>
        <text class="arrow">›</text>
      </view>

      <view class="card">
        <text class="label">再添加一个学生</text>
        <input class="input" v-model="name" placeholder="例如：小红" />
        <button class="btn-secondary" :disabled="busy" @tap="addStudent">添加学生</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { requireReadySession } from '@/utils/subject'

const userStore = useUserStore()
const name = ref('')
const busy = ref(false)

function studentLabel(studentName: string, index: number) {
  return studentName || `学生${index + 1}`
}

async function addStudent() {
  const value = name.value.trim()
  if (!value) {
    uni.showToast({ title: '请填写学生姓名', icon: 'none' })
    return
  }
  busy.value = true
  try {
    await userStore.createStudent(value)
    name.value = ''
    uni.showToast({ title: '已添加，请选择角色进入', icon: 'none' })
  } catch (error: any) {
    uni.showToast({ title: error.message || '添加失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function pickParent() {
  try {
    await userStore.chooseParentRole()
    userStore.goHome()
  } catch (error: any) {
    uni.showToast({ title: error.message || '进入失败', icon: 'none' })
  }
}

async function pickStudent(id: string) {
  try {
    await userStore.chooseStudentRole(id)
    userStore.goHome()
  } catch (error: any) {
    uni.showToast({ title: error.message || '进入失败', icon: 'none' })
  }
}

onShow(async () => {
  if (!(await requireReadySession({ allowMissingRole: true, allowNoStudents: true }))) return
  if (typeof uni.hideTabBar === 'function') uni.hideTabBar({ animation: false })
  await userStore.refreshProfile()
})
</script>

<style lang="scss" scoped>
.header { padding: 12rpx 8rpx 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.subtitle, .muted, .label { display: block; color: #888; font-size: 24rpx; margin-top: 8rpx; }
.role-card { display: flex; align-items: center; gap: 20rpx; }
.icon { font-size: 44rpx; }
.copy { flex: 1; }
.name { display: block; font-size: 32rpx; font-weight: 600; }
.arrow { color: #ccc; font-size: 40rpx; }
.input { background: #f7f7f7; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; margin: 16rpx 0; }
</style>
