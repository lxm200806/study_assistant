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

    <view class="menu-section">
      <view class="menu-item" @tap="openPasswordForm">
        <view class="menu-text">
          <text class="menu-label">修改密码</text>
          <text class="menu-desc">修改后所有设备需要重新登录</text>
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

    <view v-if="showPasswordForm" class="password-mask" @tap="closePasswordForm">
      <view class="password-panel" @tap.stop>
        <text class="password-title">修改密码</text>
        <text class="password-hint">修改成功后，所有设备需要重新登录。</text>
        <input
          v-model="currentPassword"
          class="password-input"
          type="password"
          placeholder="当前密码"
          maxlength="200"
        />
        <input
          v-model="newPassword"
          class="password-input"
          type="password"
          placeholder="新密码（至少 8 位）"
          maxlength="200"
        />
        <input
          v-model="confirmPassword"
          class="password-input"
          type="password"
          placeholder="确认新密码"
          maxlength="200"
          @confirm="submitPassword"
        />
        <text v-if="passwordError" class="password-error">{{ passwordError }}</text>
        <view class="password-actions">
          <button class="password-btn ghost" @tap="closePasswordForm">取消</button>
          <button
            class="password-btn primary"
            :class="{ 'is-disabled': passwordSubmitting }"
            :disabled="passwordSubmitting"
            @tap="submitPassword"
          >
            {{ passwordSubmitting ? '提交中…' : '确认修改' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { authAPI } from '@/api/auth'
import { useUserStore } from '@/stores/user'
import { useEntitlementsStore } from '@/stores/entitlements'
import { PERMISSIONS } from '@/utils/permissions'
import { requireReadySession } from '@/utils/subject'

const userStore = useUserStore()
const entitlements = useEntitlementsStore()

const displayName = computed(() =>
  userStore.isStudentRole
    ? (userStore.learnerName || '角色')
    : (userStore.displayName || userStore.username || '账号')
)

const planLabel = computed(() => {
  if (userStore.isStudentRole) return '角色'
  const mode = userStore.isAdmin ? '账号 · 管理' : '账号'
  const active =
    entitlements.subscriptions.length > 0 ||
    entitlements.has(PERMISSIONS.ENGLISH_BOOKS_ALL)
  return active ? `${mode} · 会员` : mode
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

const showPasswordForm = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSubmitting = ref(false)

const resetPasswordForm = () => {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  passwordSubmitting.value = false
}

const openPasswordForm = () => {
  resetPasswordForm()
  showPasswordForm.value = true
}

const closePasswordForm = () => {
  if (passwordSubmitting.value) return
  showPasswordForm.value = false
  resetPasswordForm()
}

const submitPassword = async () => {
  if (passwordSubmitting.value) return
  passwordError.value = ''

  if (!currentPassword.value) {
    passwordError.value = '请输入当前密码'
    return
  }
  if (newPassword.value.length < 8) {
    passwordError.value = '新密码至少 8 位'
    return
  }
  if (newPassword.value === currentPassword.value) {
    passwordError.value = '新密码不能与当前密码相同'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次输入的新密码不一致'
    return
  }

  passwordSubmitting.value = true
  try {
    await authAPI.changePassword(currentPassword.value, newPassword.value)
    showPasswordForm.value = false
    resetPasswordForm()
    uni.showModal({
      title: '密码已修改',
      content: '所有设备需要重新登录。',
      showCancel: false,
      success: () => userStore.clearSession({ toast: '密码已修改，请重新登录' }),
      fail: () => userStore.clearSession({ toast: '密码已修改，请重新登录' })
    })
  } catch (error) {
    passwordError.value = (error as Error)?.message || '修改失败'
  } finally {
    passwordSubmitting.value = false
  }
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

.password-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(20, 16, 12, 0.45);
}

.password-panel {
  box-sizing: border-box;
  width: 100%;
  max-width: 420px;
  padding: 22px;
  border: 1px solid var(--pc-border, #e0d7cb);
  border-radius: 16px;
  background: var(--pc-surface-2, #fffdf8);
  color: var(--pc-text, #1f1a14);
  box-shadow: var(--pc-shadow, 0 18px 40px -18px rgba(26, 32, 53, 0.35));
}

.password-title {
  display: block;
  font-size: 20px;
  font-weight: 600;
}

.password-hint {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  color: var(--pc-text-2, #6d645b);
}

.password-input {
  box-sizing: border-box;
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--pc-border-strong, #cfc6b8);
  border-radius: 10px;
  background: var(--pc-surface-1, #efe6d6);
  color: var(--pc-text, #1f1a14);
  font-size: 15px;
}

.password-error {
  display: block;
  margin-top: 10px;
  font-size: 13px;
  color: var(--pc-danger, #9a3b2f);
}

.password-actions {
  display: flex;
  margin-top: 18px;
}

.password-btn {
  flex: 1;
  border-radius: 999px;
  font-size: 15px;
}

.password-btn.ghost {
  border: 1px solid var(--pc-border, #e0d7cb);
  background: transparent;
  color: var(--pc-text-2, #6d645b);
}

.password-btn.primary {
  margin-left: 10px;
  border: none;
  background: var(--pc-accent, #0f6e6a);
  color: var(--pc-on-accent, #ffffff);
}

.password-btn.is-disabled {
  opacity: 0.6;
}
</style>
