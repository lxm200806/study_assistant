<template>
  <view class="desk">
    <text class="eyebrow">{{ userStore.isStudentRole ? '角色' : '账号' }}</text>
    <text class="title">{{ displayName }}</text>
    <text class="lede">{{ planLabel }}</text>

    <view v-if="userStore.isStudentRole" class="menu-section">
      <view class="menu-item">
        <view class="menu-text">
          <text class="menu-label">当前角色</text>
          <text class="menu-desc">这里只显示这个角色自己的信息</text>
        </view>
      </view>
      <view class="menu-item" @tap="userStore.goRoles()">
        <view class="menu-text">
          <text class="menu-label">切换</text>
          <text class="menu-desc">回到账号或其他角色</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <template v-else>
    <view class="menu-section">
      <view class="menu-item" @tap="goStudents">
        <view class="menu-text">
          <text class="menu-label">管理角色</text>
          <text class="menu-desc">{{ roleHint }}</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view v-for="item in userStore.children" :key="item.id" class="menu-item">
        <view class="menu-text">
          <text class="menu-label">{{ item.name }}</text>
        </view>
      </view>
      <text v-if="!userStore.children.length" class="menu-item">还没有角色</text>
    </view>

    <view class="menu-section">
      <view class="menu-item" @tap="goMembership">
        <view class="menu-text">
          <text class="menu-label">会员</text>
          <text class="menu-desc">开通后，这个账号下的角色都可以用</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view v-if="userStore.isAdmin" class="menu-section">
      <view v-if="!userStore.isChinese" class="menu-item" @tap="goAdmin">
        <text class="menu-icon">⚙️</text>
        <view class="menu-text">
          <text class="menu-label">词库管理</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view v-if="userStore.isChinese" class="menu-item" @tap="goChineseDrafts">
        <text class="menu-icon">📝</text>
        <view class="menu-text">
          <text class="menu-label">语文草稿审核</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>
    </template>

    <button class="btn-logout" @tap="handleLogout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { requireReadySession } from '@/utils/subject'

const userStore = useUserStore()

const displayName = computed(() =>
  userStore.isStudentRole
    ? (userStore.learnerName || '角色')
    : (userStore.displayName || userStore.username || '账号')
)

const planLabel = computed(() => {
  if (userStore.isStudentRole) return '角色'
  const mode = userStore.isAdmin ? '账号 · 管理' : '账号'
  return userStore.plan === 'premium' ? `${mode} · Premium` : mode
})

const roleHint = computed(() => {
  if (!userStore.children.length) return '添加角色后，选中角色再开始学习'
  return `共 ${userStore.children.length} 个角色`
})

const goStudents = () => {
  uni.navigateTo({ url: '/pages/family/students' })
}

const goMembership = () => {
  uni.navigateTo({ url: '/pages/membership/membership' })
}

const goAdmin = () => {
  uni.navigateTo({ url: '/pages/admin/admin' })
}

const goChineseDrafts = () => {
  uni.navigateTo({ url: '/pages/chinese/drafts' })
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

onShow(async () => {
  if (!(await requireReadySession({ allowNoStudents: true, allowMissingRole: true }))) return
  userStore.goHome()
})

onMounted(async () => {
  if (!(await requireReadySession({ allowNoStudents: true }))) return
  if (userStore.isParent) await userStore.refreshProfile()
})
</script>

<style lang="scss" scoped>
.desk {
  min-height: 100vh;
  box-sizing: border-box;
  max-width: 720px;
  margin: 0 auto;
  padding: 36px 22px 80px;
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

.lede {
  display: block;
  margin: 8px 0 22px;
  color: #6d645b;
  font-size: 14px;
}

.subject-switch {
  display: flex;
  background: #fff;
  border-radius: 999rpx;
  padding: 8rpx;
  margin-bottom: 12rpx;
}

.subject-btn {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  border-radius: 999rpx;
  color: #666;
  font-size: 28rpx;
}

.subject-btn.active {
  background: #667eea;
  color: #fff;
  font-weight: 600;
}

.switch-hint {
  display: block;
  color: #888;
  font-size: 24rpx;
  margin-bottom: 24rpx;
  padding: 0 8rpx;
}

.menu-section {
  background: transparent;
  border: 1px solid #e0d7cb;
  border-radius: 16px;
  margin-bottom: 16px;
  overflow: hidden;
}

.section-label {
  display: block;
  padding: 20rpx 28rpx 0;
  color: #999;
  font-size: 24rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 16px 18px;
  border-bottom: 1px solid #efe7da;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.menu-text {
  flex: 1;
}

.menu-label {
  display: block;
  font-size: 16px;
  color: #1f1a14;
}

.menu-desc {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: #6d645b;
}

.menu-arrow {
  color: #8a8175;
  font-size: 20px;
}

.btn-logout {
  margin-top: 8px;
  background: transparent;
  color: #b91c1c;
  border: 1px solid #e0d7cb;
  border-radius: 999px;
}
</style>
