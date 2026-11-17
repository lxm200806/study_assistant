<template>
  <view class="desk">
    <text class="eyebrow">学习助手</text>
    <text class="title">切换</text>
    <text class="lede">选账号看全部角色，选角色开始学习。</text>

    <view :class="['card', 'role-card', userStore.isParent ? 'on' : '']" @tap="pickAccount">
      <view class="copy">
        <text class="name">账号</text>
        <text class="muted">{{ accountHint }}</text>
      </view>
      <text class="arrow">›</text>
    </view>

    <view
      v-for="item in userStore.children"
      :key="item.id"
      :class="['card', 'role-card', isCurrentRole(item.id) ? 'on' : '']"
      @tap="pickRole(item.id)"
    >
      <view class="copy">
        <text class="name">{{ item.name }}</text>
        <text class="muted">只看这个角色自己的学习</text>
      </view>
      <text class="arrow">›</text>
    </view>

    <text v-if="!userStore.children.length" class="muted empty">还没有角色。进账号后可以添加。</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { requireReadySession } from '@/utils/subject'

const userStore = useUserStore()

const accountHint = computed(() => {
  const name = userStore.displayName || userStore.username || '当前账号'
  const n = userStore.children.length
  return n ? `${name} · ${n} 个角色` : name
})

function isCurrentRole(id: string) {
  return userStore.isStudentRole && userStore.activeLearnerId === id
}

async function pickAccount() {
  try {
    if (!userStore.isParent) await userStore.chooseParentRole()
    uni.switchTab({ url: '/pages/mine/mine' })
  } catch (error: any) {
    uni.showToast({ title: error.message || '进入失败', icon: 'none' })
  }
}

async function pickRole(id: string) {
  try {
    if (!isCurrentRole(id)) await userStore.chooseStudentRole(id)
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
.desk {
  min-height: 100vh;
  box-sizing: border-box;
  max-width: 560px;
  margin: 0 auto;
  padding: 48px 22px 80px;
  background: #f4f1ea;
  color: #1f1a14;
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
.lede, .muted { display: block; color: #6d645b; font-size: 14px; line-height: 1.6; }
.lede { margin: 10px 0 18px; }
.role-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: transparent;
  border: 1px solid #e0d7cb;
  box-shadow: none;
  border-radius: 16px;
}
.role-card.on { border-color: #0f6e6a; background: #fff; }
.copy { flex: 1; }
.name { display: block; font-size: 18px; font-weight: 650; }
.arrow { color: #8a8175; font-size: 22px; }
.empty { margin-top: 12px; }
</style>
