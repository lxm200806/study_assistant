<template>
  <view class="desk">
    <view class="panel">
      <text class="eyebrow">学习助手</text>
      <text class="title">登录</text>
      <text class="lede">一个账号，多个角色。登录后从左下角进入。</text>

      <view class="form">
        <text class="label">用户名</text>
        <input
          class="field"
          type="text"
          :value="username"
          placeholder="用户名"
          placeholder-class="placeholder"
          :adjust-position="true"
          :hold-keyboard="true"
          @input="onUsername"
        />
        <text class="label">密码</text>
        <input
          class="field"
          type="password"
          :value="password"
          placeholder="密码"
          placeholder-class="placeholder"
          :adjust-position="true"
          :hold-keyboard="true"
          confirm-type="done"
          @input="onPassword"
          @confirm="handleLogin"
        />
        <button class="start" @tap="handleLogin">登录</button>
        <button class="ghost" @tap="showRegister">注册账号</button>
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

function onUsername(e: any) {
  username.value = String(e?.detail?.value ?? '')
}

function onPassword(e: any) {
  password.value = String(e?.detail?.value ?? '')
}

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
  margin: 28px 0 8px;
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

.placeholder {
  color: #b3a89a;
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
