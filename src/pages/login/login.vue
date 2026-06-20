<template>
  <view class="container">
    <view class="logo-section">
      <view class="logo">
        <text class="logo-text">学</text>
      </view>
      <text class="app-title">学习助手</text>
      <text class="app-subtitle">让学习更高效</text>
    </view>

    <view class="form-card">
      <view class="form-item">
        <text class="form-label">用户名</text>
        <input 
          class="form-input" 
          v-model="username" 
          placeholder="请输入用户名"
          placeholder-class="placeholder"
        />
      </view>
      <view class="form-item">
        <text class="form-label">密码</text>
        <input 
          class="form-input" 
          v-model="password" 
          type="password"
          placeholder="请输入密码"
          placeholder-class="placeholder"
        />
      </view>
      
      <view class="form-actions">
        <view class="remember-me">
          <checkbox :checked="rememberMe" @change="rememberMe = !rememberMe" />
          <text>记住我</text>
        </view>
        <text class="forgot-password" @tap="showForgotPassword">忘记密码?</text>
      </view>

      <button class="btn-login" @tap="handleLogin">登 录</button>
      
      <view class="register-link">
        <text>还没有账号? </text>
        <text class="link" @tap="showRegister">立即注册</text>
      </view>
      <text class="admin-hint">管理员账号：admin（默认密码见服务端配置）</text>
    </view>

    <view class="quick-login">
      <text class="divider">其他登录方式</text>
      <view class="social-buttons">
        <view class="social-btn" @tap="loginWithWechat">
          <text class="social-icon">微信</text>
        </view>
        <view class="social-btn" @tap="loginWithPhone">
          <text class="social-icon">手机</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const username = ref('')
const password = ref('')
const rememberMe = ref(false)

const handleLogin = () => {
  if (!username.value || !password.value) {
    uni.showToast({ title: '请输入用户名和密码', icon: 'none' })
    return
  }
  
  userStore.login(username.value, password.value)
}

const showRegister = () => {
  uni.navigateTo({ url: '/pages/register/register' })
}

const showForgotPassword = () => {
  uni.showToast({ title: '忘记密码功能开发中', icon: 'none' })
}

const loginWithWechat = () => {
  userStore.wechatLogin(`demo_${Date.now()}`)
}

const loginWithPhone = () => {
  uni.showToast({ title: '手机登录开发中', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx;
  box-sizing: border-box;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0 60rpx;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 30rpx;
}

.logo-text {
  font-size: 72rpx;
  color: white;
  font-weight: bold;
}

.app-title {
  font-size: 48rpx;
  color: white;
  font-weight: 600;
  margin-bottom: 10rpx;
}

.app-subtitle {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
}

.form-card {
  background: white;
  border-radius: 24rpx;
  padding: 40rpx;
  margin-bottom: 30rpx;
}

.form-item {
  margin-bottom: 30rpx;
}

.form-label {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 15rpx;
  display: block;
}

.form-input {
  width: 100%;
  height: 80rpx;
  border: 2rpx solid #e8e8e8;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 30rpx;
  box-sizing: border-box;
}

.placeholder {
  color: #ccc;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40rpx;
}

.remember-me {
  display: flex;
  align-items: center;
  font-size: 26rpx;
  color: #666;
}

.forgot-password {
  font-size: 26rpx;
  color: #667eea;
}

.btn-login {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  margin-bottom: 30rpx;
}

.register-link {
  text-align: center;
  font-size: 26rpx;
  color: #666;
}

.link {
  color: #667eea;
}

.admin-hint {
  display: block;
  text-align: center;
  font-size: 22rpx;
  color: #999;
  margin-top: 20rpx;
}

.quick-login {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 24rpx;
  padding: 40rpx;
}

.divider {
  display: block;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 26rpx;
  margin-bottom: 30rpx;
}

.social-buttons {
  display: flex;
  justify-content: center;
  gap: 40rpx;
}

.social-btn {
  width: 120rpx;
  height: 120rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.social-icon {
  font-size: 24rpx;
  color: white;
}
</style>