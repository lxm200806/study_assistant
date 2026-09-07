<template>
  <view class="container">
    <view class="profile-card">
      <view class="avatar">
        <text class="avatar-text">{{ displayName.charAt(0) }}</text>
      </view>
      <view class="profile-info">
        <text class="username">{{ userStore.learnerName }}</text>
        <text class="plan-tag">{{ planLabel }}</text>
      </view>
    </view>

    <view class="subject-switch">
      <view :class="['subject-btn', userStore.isChinese ? 'active' : '']" @tap="switchSubject('chinese')">
        <text>语文</text>
      </view>
      <view :class="['subject-btn', !userStore.isChinese ? 'active' : '']" @tap="switchSubject('english')">
        <text>英语</text>
      </view>
    </view>
    <text class="switch-hint">当前在{{ userStore.isChinese ? '语文' : '英语' }}。两个学科分开学，互不影响。</text>

    <view v-if="userStore.isParent" class="menu-section">
      <view class="menu-item" @tap="goStudents">
        <text class="menu-icon">👨‍🎓</text>
        <view class="menu-text">
          <text class="menu-label">学生角色</text>
          <text class="menu-desc">{{ studentHint }}</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view v-for="item in userStore.children" :key="item.id" class="menu-item" @tap="pickStudent(item.id)">
        <text class="menu-icon">{{ item.id === userStore.activeLearnerId ? '✅' : '👤' }}</text>
        <view class="menu-text">
          <text class="menu-label">{{ item.name }}</text>
          <text class="menu-desc">{{ item.id === userStore.activeLearnerId ? '当前学习的学生' : '点按切换' }}</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view v-if="userStore.isChinese" class="menu-section">
      <view class="menu-item" @tap="goChinese">
        <text class="menu-icon">📖</text>
        <view class="menu-text">
          <text class="menu-label">语文课程</text>
          <text class="menu-desc">组课、今日默写、计划</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="goChinesePoints">
        <text class="menu-icon">📚</text>
        <view class="menu-text">
          <text class="menu-label">知识点</text>
          <text class="menu-desc">浏览已发布库</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view v-else class="menu-section">
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

    <view v-if="!userStore.isChinese" class="menu-section">
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
          <text class="menu-label">{{ userStore.isParent ? '学习周报' : '家长周报' }}</text>
          <text class="menu-desc">{{ userStore.isParent ? '当前学生本周概况' : '本周学习概况 · 分享给家长' }}</text>
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
      <view v-if="userStore.isChinese" class="menu-item" @tap="goChineseMaterials">
        <text class="menu-icon">📗</text>
        <view class="menu-text">
          <text class="menu-label">语文教材同步</text>
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

    <button class="btn-logout" @tap="handleLogout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { applySubjectTabBar, type Subject } from '@/utils/subject'

const userStore = useUserStore()

const displayName = computed(() => userStore.learnerName || '学习者')

const planLabel = computed(() => {
  if (userStore.isAdmin) return '管理员'
  const mode = userStore.isParent ? '家长' : '学生'
  if (userStore.plan === 'premium') return `${mode} · Premium`
  return `${mode} · ${userStore.isChinese ? '语文' : '英语'}`
})

const studentHint = computed(() => {
  if (!userStore.children.length) return '添加学生后才能开始学习'
  return `当前：${userStore.learnerName}，共 ${userStore.children.length} 人`
})

async function pickStudent(id: string) {
  if (id === userStore.activeLearnerId) return
  await userStore.switchStudent(id)
  uni.showToast({ title: `已切换到 ${userStore.learnerName}`, icon: 'none' })
  uni.switchTab({ url: '/pages/home/home' })
}

const goStudents = () => {
  uni.navigateTo({ url: '/pages/family/students' })
}

async function switchSubject(subject: Subject) {
  if (userStore.activeSubject === subject) return
  await userStore.setSubject(subject)
  uni.showToast({ title: subject === 'chinese' ? '已切换到语文' : '已切换到英语', icon: 'none' })
  uni.switchTab({ url: '/pages/home/home' })
}

const goBooks = () => {
  uni.navigateTo({ url: '/pages/books/books' })
}

const goChinese = () => {
  uni.navigateTo({ url: '/pages/chinese/courses' })
}

const goChinesePoints = () => {
  uni.navigateTo({ url: '/pages/chinese/points' })
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

const goChineseMaterials = () => {
  uni.navigateTo({ url: '/pages/chinese/materials' })
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

onShow(() => {
  applySubjectTabBar(userStore.activeSubject)
})

onMounted(async () => {
  await userStore.checkLogin()
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  if (userStore.isParent) await userStore.refreshProfile()
})
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
  padding-bottom: 80rpx;
}

.profile-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 24rpx;
  padding: 36rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  color: #fff;
  font-size: 40rpx;
  font-weight: 700;
}

.username {
  display: block;
  color: #fff;
  font-size: 36rpx;
  font-weight: 700;
}

.plan-tag {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.85);
  font-size: 24rpx;
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
  background: #fff;
  border-radius: 20rpx;
  margin-bottom: 24rpx;
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
  padding: 28rpx;
  border-bottom: 1rpx solid #f5f5f5;
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
  font-size: 30rpx;
  color: #222;
}

.menu-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #999;
}

.menu-arrow {
  color: #ccc;
  font-size: 36rpx;
}

.btn-logout {
  margin-top: 20rpx;
  background: #fff;
  color: #b91c1c;
  border-radius: 40rpx;
}
</style>
