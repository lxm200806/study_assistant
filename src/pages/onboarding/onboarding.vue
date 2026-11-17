<template>
  <view class="desk" />
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

onShow(async () => {
  await userStore.checkLogin()
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  try {
    await userStore.ensureAccountReady()
  } catch {
    userStore.setOnboarded(true)
  }
  userStore.goRoles()
})
</script>

<style scoped>
.desk {
  min-height: 100vh;
  background: #f4f1ea;
}
</style>
