<template>
  <view class="container">
    <view class="logo-section">
      <view class="logo">
        <text class="logo-text">学</text>
      </view>
      <text class="app-title">学习助手</text>
      <text class="app-subtitle">创建新账号</text>
    </view>

    <view class="form-card">
      <view class="form-item">
        <text class="form-label">用户名</text>
        <input 
          class="form-input" 
          v-model="username" 
          placeholder="请输入用户名"
          placeholder-class="placeholder"
          @input="validateUsername"
        />
        <text v-if="usernameError" class="error-text">{{ usernameError }}</text>
      </view>
      
      <view class="form-item">
        <text class="form-label">密码</text>
        <input 
          class="form-input" 
          v-model="password" 
          type="password"
          placeholder="请输入密码"
          placeholder-class="placeholder"
          @input="validatePassword"
        />
        <text v-if="passwordError" class="error-text">{{ passwordError }}</text>
      </view>
      
      <view class="form-item">
        <text class="form-label">确认密码</text>
        <input 
          class="form-input" 
          v-model="confirmPassword" 
          type="password"
          placeholder="请再次输入密码"
          placeholder-class="placeholder"
          @input="validateConfirmPassword"
        />
        <text v-if="confirmPasswordError" class="error-text">{{ confirmPasswordError }}</text>
      </view>

      <button class="btn-register" :disabled="!isFormValid" @tap="handleRegister">注 册</button>
      
      <view class="login-link">
        <text>已有账号? </text>
        <text class="link" @tap="goToLogin">立即登录</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')

const usernameError = ref('')
const passwordError = ref('')
const confirmPasswordError = ref('')

const validateUsername = () => {
  if (!username.value) {
    usernameError.value = '请输入用户名'
  } else if (username.value.length < 3) {
    usernameError.value = '用户名至少需要3个字符'
  } else {
    usernameError.value = ''
  }
}

const validatePassword = () => {
  if (!password.value) {
    passwordError.value = '请输入密码'
  } else if (password.value.length < 6) {
    passwordError.value = '密码至少需要6个字符'
  } else {
    passwordError.value = ''
  }
  validateConfirmPassword()
}

const validateConfirmPassword = () => {
  if (!confirmPassword.value) {
    confirmPasswordError.value = '请确认密码'
  } else if (confirmPassword.value !== password.value) {
    confirmPasswordError.value = '两次输入的密码不一致'
  } else {
    confirmPasswordError.value = ''
  }
}

const isFormValid = computed(() => {
  return !usernameError.value && !passwordError.value && !confirmPasswordError.value &&
         username.value && password.value && confirmPassword.value
})

const handleRegister = () => {
  validateUsername()
  validatePassword()
  validateConfirmPassword()
  
  if (!isFormValid.value) {
    return
  }
  
  userStore.register(username.value, password.value)
}

const goToLogin = () => {
  uni.navigateBack()
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
  padding: 80rpx 0 50rpx;
}

.logo {
  width: 140rpx;
  height: 140rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 25rpx;
}

.logo-text {
  font-size: 64rpx;
  color: white;
  font-weight: bold;
}

.app-title {
  font-size: 44rpx;
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

.error-text {
  font-size: 24rpx;
  color: #ff6b6b;
  margin-top: 10rpx;
  display: block;
}

.btn-register {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  margin: 30rpx 0;
  
  &[disabled] {
    opacity: 0.5;
  }
}

.login-link {
  text-align: center;
  font-size: 26rpx;
  color: #666;
}

.link {
  color: #667eea;
}
</style>
