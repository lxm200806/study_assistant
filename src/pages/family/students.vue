<template>
  <view class="desk">
    <view class="setup">
    <text class="eyebrow">账号</text>
    <text class="title">角色</text>
    <text class="lede">点一个名字就进入这个角色。改名和移除留在这里。</text>

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

    <text v-if="!userStore.children.length" class="muted">还没有角色。先添加一个，学习记录会记在这个角色名下。</text>

    <view class="card">
      <text class="label">添加角色</text>
      <input class="input" v-model="name" placeholder="例如：小明" />
      <button class="btn-primary" :disabled="busy" @tap="addStudent">添加</button>
    </view>

    <button class="btn-logout" @tap="logout">退出登录</button>
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
    uni.showToast({ title: '请填写角色名称', icon: 'none' })
    return
  }
  busy.value = true
  try {
    await userStore.createStudent(value)
    name.value = ''
    uni.showToast({ title: '已添加', icon: 'success' })
  } catch (error: any) {
    uni.showToast({ title: error.message || '添加失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function selectStudent(id: string) {
  try {
    if (!(userStore.isStudentRole && userStore.activeLearnerId === id)) {
      await userStore.chooseStudentRole(id)
    }
    userStore.goHome()
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

function logout() {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) userStore.logout()
    }
  })
}

function remove(item: { id: string; name: string }) {
  uni.showModal({
    title: '移除角色',
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
  if (!userStore.hasOnboarded) {
    try {
      await userStore.ensureAccountReady()
    } catch {
      userStore.setOnboarded(true)
    }
  }
  if (!userStore.isParent) {
    try {
      await userStore.chooseParentRole()
    } catch {
      return
    }
  }
  await userStore.refreshProfile()
})
</script>

<style lang="scss" scoped>
.desk {
  min-height: 100vh;
  background: #f4f1ea;
  color: #1f1a14;
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif;
}
.setup {
  max-width: 880px;
  margin: 0 auto;
  padding: 28px 22px 80px;
}
.eyebrow {
  display: block;
  font-size: 13px;
  letter-spacing: 0.14em;
  color: #8a8175;
}
.title {
  display: block;
  margin-top: 8px;
  font-family: Palatino, "Palatino Linotype", "Songti SC", serif;
  font-size: 40px;
}
.lede, .muted, .label { display: block; color: #6d645b; font-size: 14px; line-height: 1.6; }
.lede { margin: 10px 0 22px; }
.card {
  background: transparent;
  border: 1px solid #e0d7cb;
  box-shadow: none;
  border-radius: 16px;
}
.card.active { border-color: #0f6e6a; }
.row { display: flex; align-items: center; justify-content: space-between; }
.name { font-size: 18px; font-weight: 650; }
.tag { font-size: 12px; color: #0f6e6a; background: transparent; border: 1px solid #0f6e6a; padding: 2px 10px; border-radius: 999px; }
.actions { display: flex; gap: 16px; margin-top: 12px; }
.link { color: #0f6e6a; font-size: 14px; }
.link.danger { color: #b91c1c; }
.input {
  background: transparent;
  border: 1px solid #e0d7cb;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 15px;
  margin: 12px 0;
  color: #1f1a14;
}
.btn-logout { margin-top: 12px; background: transparent; color: #b91c1c; border: 1px solid #e0d7cb; border-radius: 999px; }
</style>
