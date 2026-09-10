<template>
  <view class="container">
    <view class="header">
      <text class="title">学生角色</text>
      <text class="subtitle">每个学生有自己的语文/英语进度。点按学生可切换家长正在查看的进度。</text>
    </view>

    <view v-for="item in userStore.children" :key="item.id" :class="['card', item.id === userStore.activeLearnerId ? 'active' : '']" @tap="selectStudent(item.id)">
      <view class="row">
        <text class="name">{{ item.name }}</text>
        <text v-if="item.id === userStore.activeLearnerId" class="tag">当前</text>
      </view>
      <view class="actions">
        <text class="link" @tap.stop="rename(item)">改名</text>
        <text class="link danger" @tap.stop="remove(item)">移除</text>
      </view>
    </view>

    <text v-if="!userStore.children.length" class="muted">还没有学生。先添加一个，学习记录会记在这个学生名下。</text>

    <view class="card">
      <text class="label">添加学生</text>
      <input class="input" v-model="name" placeholder="例如：小明" />
      <button class="btn-primary" :disabled="busy" @tap="addStudent">添加</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const name = ref('')
const busy = ref(false)

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
    uni.showToast({ title: '已添加', icon: 'success' })
    if (!userStore.roleChosen) {
      uni.redirectTo({ url: '/pages/family/roles' })
      return
    }
    uni.switchTab({ url: '/pages/home/home' })
  } catch (error: any) {
    uni.showToast({ title: error.message || '添加失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function selectStudent(id: string) {
  if (id === userStore.activeLearnerId) {
    uni.switchTab({ url: '/pages/home/home' })
    return
  }
  try {
    await userStore.switchStudent(id)
    uni.showToast({ title: '已切换学生', icon: 'none' })
    uni.switchTab({ url: '/pages/home/home' })
  } catch (error: any) {
    uni.showToast({ title: error.message || '切换失败', icon: 'none' })
  }
}

function rename(item: { id: string; name: string }) {
  uni.showModal({
    title: '修改姓名',
    editable: true,
    content: item.name,
    success: async (res) => {
      if (!res.confirm) return
      const next = String(res.content || '').trim()
      if (!next) return
      try {
        await userStore.renameStudent(item.id, next)
      } catch (error: any) {
        uni.showToast({ title: error.message || '修改失败', icon: 'none' })
      }
    }
  })
}

function remove(item: { id: string; name: string }) {
  uni.showModal({
    title: '移除学生',
    content: `确定移除 ${item.name}？学习记录会保留，只是不再显示。`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await userStore.removeStudent(item.id)
      } catch (error: any) {
        uni.showToast({ title: error.message || '移除失败', icon: 'none' })
      }
    }
  })
}

onShow(async () => {
  await userStore.checkLogin()
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  if (!userStore.isParent) {
    userStore.goRoles()
    return
  }
  await userStore.refreshProfile()
})
</script>

<style lang="scss" scoped>
.header { padding: 12rpx 8rpx 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.subtitle, .muted, .label { display: block; color: #888; font-size: 24rpx; margin-top: 8rpx; }
.card.active { border: 2rpx solid #667eea; }
.row { display: flex; align-items: center; justify-content: space-between; }
.name { font-size: 32rpx; font-weight: 600; }
.tag { font-size: 22rpx; color: #667eea; background: #eef2ff; padding: 4rpx 12rpx; border-radius: 999rpx; }
.actions { display: flex; gap: 24rpx; margin-top: 16rpx; }
.link { color: #667eea; font-size: 26rpx; }
.link.danger { color: #b91c1c; }
.input { background: #f7f7f7; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; margin: 16rpx 0; }
</style>
