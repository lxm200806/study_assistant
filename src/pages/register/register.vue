<template>
  <view class="desk">
    <view class="panel">
      <text class="eyebrow">学习助手</text>
      <text class="title">注册</text>
      <text class="lede">注册账号后添加角色，再进入账号或某个角色。</text>

      <view class="form">
        <text class="label">用户名</text>
        <input
          class="field"
          type="text"
          :value="username"
          placeholder="至少 3 个字符"
          placeholder-class="placeholder"
          @input="onUsername"
        />
        <text v-if="usernameError" class="error">{{ usernameError }}</text>

        <text class="label">密码</text>
        <input
          class="field"
          type="password"
          :value="password"
          placeholder="至少 6 个字符"
          placeholder-class="placeholder"
          @input="onPassword"
        />
        <text v-if="passwordError" class="error">{{ passwordError }}</text>

        <text class="label">确认密码</text>
        <input
          class="field"
          type="password"
          :value="confirmPassword"
          placeholder="再输入一次"
          placeholder-class="placeholder"
          @input="onConfirm"
        />
        <text v-if="confirmPasswordError" class="error">{{ confirmPasswordError }}</text>

        <button class="start" :disabled="!isFormValid" @tap="handleRegister">注册</button>
        <button class="ghost" @tap="goToLogin">返回登录</button>
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

function onUsername(e: any) {
  username.value = String(e?.detail?.value ?? '')
  validateUsername()
}

function onPassword(e: any) {
  password.value = String(e?.detail?.value ?? '')
  validatePassword()
}

function onConfirm(e: any) {
  confirmPassword.value = String(e?.detail?.value ?? '')
  validateConfirmPassword()
}

const validateUsername = () => {
  if (!username.value) usernameError.value = '请输入用户名'
  else if (username.value.length < 3) usernameError.value = '用户名至少需要 3 个字符'
  else usernameError.value = ''
}

const validatePassword = () => {
  if (!password.value) passwordError.value = '请输入密码'
  else if (password.value.length < 6) passwordError.value = '密码至少需要 6 个字符'
  else passwordError.value = ''
  validateConfirmPassword()
}

const validateConfirmPassword = () => {
  if (!confirmPassword.value) confirmPasswordError.value = '请确认密码'
  else if (confirmPassword.value !== password.value) confirmPasswordError.value = '两次输入的密码不一致'
  else confirmPasswordError.value = ''
}

const isFormValid = computed(() =>
  !usernameError.value &&
  !passwordError.value &&
  !confirmPasswordError.value &&
  !!username.value &&
  !!password.value &&
  !!confirmPassword.value
)

const handleRegister = () => {
  validateUsername()
  validatePassword()
  validateConfirmPassword()
  if (!isFormValid.value) return
  userStore.register(username.value, password.value)
}

const goToLogin = () => {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.desk {
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background: #f4f1ea;
  color: #1f1a14;
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif;
}

.panel {
  width: 100%;
  max-width: 420px;
}

.eyebrow,
.title,
.lede {
  display: block;
  text-align: center;
}

.eyebrow {
  font-size: 13px;
  letter-spacing: 0.18em;
  color: #8a8175;
}

.title {
  margin-top: 14px;
  font-family: Palatino, "Palatino Linotype", "Songti SC", serif;
  font-size: 56px;
  line-height: 1.05;
}

.lede {
  margin: 14px auto 0;
  max-width: 22em;
  color: #6d645b;
  font-size: 15px;
  line-height: 1.65;
}

.form {
  margin-top: 8px;
  position: relative;
  z-index: 2;
}

.label {
  display: block;
  margin: 22px 0 8px;
  font-size: 13px;
  font-weight: 650;
  color: #1f1a14;
}

.field {
  display: block;
  width: 100%;
  height: 48px;
  box-sizing: border-box;
  border: 1px solid #e0d7cb;
  background: #fff;
  border-radius: 12px;
  padding: 0 16px;
  font-size: 16px;
  color: #1f1a14;
  line-height: 48px;
  pointer-events: auto;
  -webkit-user-select: text;
  user-select: text;
}

.placeholder { color: #b3a89a; }

.error {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  color: #b91c1c;
}

.start,
.ghost {
  display: block;
  width: 100%;
  margin-top: 14px;
  line-height: 46px;
  border-radius: 999px;
  font-size: 16px;
}

.start {
  margin-top: 28px;
  background: #0f6e6a;
  color: #fff;
}

.start[disabled] { opacity: 0.45; }

.ghost {
  background: transparent;
  color: #1f1a14;
  border: 1px solid #e0d7cb;
}

.start::after,
.ghost::after {
  border: none;
}
</style>
