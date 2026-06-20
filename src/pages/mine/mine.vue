<template>
  <view class="container">
    <view class="profile-card">
      <view class="avatar">
        <text class="avatar-text">{{ displayName.charAt(0) }}</text>
      </view>
      <view class="profile-info">
        <text class="username">{{ displayName }}</text>
        <text class="plan-tag">{{ planLabel }}</text>
      </view>
    </view>

    <view class="menu-section">
      <view class="menu-item" @tap="goBooks">
        <text class="menu-icon">📚</text>
        <view class="menu-text">
          <text class="menu-label">词汇书</text>
          <text class="menu-desc">切换与学习词书</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="goChat">
        <text class="menu-icon">💬</text>
        <view class="menu-text">
          <text class="menu-label">AI 陪聊</text>
          <text class="menu-desc">口语练习与对话</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="menu-section">
      <text class="section-label">会员与服务</text>
      <view class="menu-item" @tap="goMembership">
        <text class="menu-icon">👑</text>
        <view class="menu-text">
          <text class="menu-label">会员中心</text>
          <text class="menu-desc">解锁词书 · 开通 Premium</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="goParentReport">
        <text class="menu-icon">📊</text>
        <view class="menu-text">
          <text class="menu-label">家长周报</text>
          <text class="menu-desc">本周学习概况 · 分享给家长</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view v-if="userStore.isAdmin" class="menu-section">
      <view class="menu-item" @tap="goAdmin">
        <text class="menu-icon">⚙️</text>
        <view class="menu-text">
          <text class="menu-label">词库管理</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <button class="btn-logout" @tap="handleLogout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const displayName = computed(() => userStore.username || '学习者')

const planLabel = computed(() => {
  if (userStore.isAdmin) return '管理员'
  if (userStore.plan === 'premium') return 'Premium 会员'
  return '免费版'
})

const goBooks = () => {
  uni.navigateTo({ url: '/pages/books/books' })
}

const goMembership = () => {
  uni.navigateTo({ url: '/pages/membership/membership' })
}

const goParentReport = () => {
  uni.navigateTo({ url: '/pages/membership/membership?focus=report' })
}

const goChat = () => {
  uni.navigateTo({ url: '/pages/chat/chat' })
}

const goAdmin = () => {
  uni.navigateTo({ url: '/pages/admin/admin' })
}

const handleLogout = () => {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) userStore.logout()
    }
  })
}

onMounted(async () => {
  await userStore.checkLogin()
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/login' })
  }
})
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
  padding-bottom: 120rpx;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 24rpx;
  padding: 36rpx 32rpx;
  margin-bottom: 24rpx;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 40rpx;
  font-weight: 600;
  color: white;
}

.profile-info {
  flex: 1;
}

.username {
  font-size: 36rpx;
  font-weight: 600;
  color: white;
  display: block;
  margin-bottom: 8rpx;
}

.plan-tag {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}

.menu-section {
  background: white;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}

.section-label {
  display: block;
  padding: 24rpx 32rpx 8rpx;
  font-size: 24rpx;
  color: #999;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.menu-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.menu-text {
  flex: 1;
  min-width: 0;
}

.menu-label {
  display: block;
  font-size: 30rpx;
  color: #333;
}

.menu-desc {
  display: block;
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #999;
}

.menu-arrow {
  font-size: 32rpx;
  color: #ccc;
  margin-left: 12rpx;
}

.btn-logout {
  width: 100%;
  height: 88rpx;
  background: white;
  color: #666;
  border: none;
  border-radius: 44rpx;
  font-size: 30rpx;
}

.btn-logout::after {
  border: none;
}
</style>
