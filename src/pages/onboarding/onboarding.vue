<template>
  <view class="container">
    <view class="progress-dots">
      <view v-for="i in 2" :key="i" :class="['dot', stepIndex >= i ? 'active' : '']" />
    </view>

    <view v-if="step === 'subject'" class="step">
      <text class="title">选择学习学科</text>
      <text class="subtitle">语文和英语分开学，互不影响。之后可在家长端「我的」里切换。</text>
      <view class="subject-list">
        <view :class="['subject-item', subject === 'chinese' ? 'selected' : '']" @tap="subject = 'chinese'">
          <text class="subject-icon">📖</text>
          <view class="subject-copy">
            <text class="book-name">语文</text>
            <text class="book-level">古诗 · 成语 · 今日默写</text>
          </view>
        </view>
        <view :class="['subject-item', subject === 'english' ? 'selected' : '']" @tap="subject = 'english'">
          <text class="subject-icon">🔤</text>
          <view class="subject-copy">
            <text class="book-name">英语</text>
            <text class="book-level">听力 · 认读 · 拼写 · 口语</text>
          </view>
        </view>
      </view>
      <button class="btn-next" @tap="chooseSubject">下一步</button>
    </view>

    <view v-else class="step">
      <text class="title">添加第一个学生</text>
      <text class="subtitle">学习进度记在这个学生名下。之后还能继续添加。</text>
      <input class="name-input" v-model="studentName" placeholder="例如：小明" />
      <button class="btn-next" @tap="createFirstStudent">下一步</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { authAPI } from '@/utils/api'
import type { Subject } from '@/utils/subject'

const userStore = useUserStore()

const step = ref<'subject' | 'student'>('subject')
const subject = ref<Subject | ''>('')
const studentName = ref('')
const stepIndex = computed(() => (step.value === 'subject' ? 1 : 2))

const chooseSubject = async () => {
  if (!subject.value) {
    uni.showToast({ title: '请先选择语文或英语', icon: 'none' })
    return
  }
  await userStore.setSubject(subject.value, false)
  step.value = 'student'
}

const finishOnboarding = async () => {
  const picked: Subject = subject.value === 'chinese' ? 'chinese' : 'english'
  try {
    await authAPI.onboard(picked)
    await userStore.setSubject(picked, false)
    userStore.setOnboarded(true)
  } catch {
    userStore.setOnboarded(true)
  }
}

const createFirstStudent = async () => {
  const name = studentName.value.trim()
  if (!name) {
    uni.showToast({ title: '请填写学生姓名', icon: 'none' })
    return
  }
  await finishOnboarding()
  try {
    await userStore.createStudent(name)
  } catch (error: any) {
    uni.showToast({ title: error.message || '添加失败', icon: 'none' })
    return
  }
  uni.reLaunch({ url: '/pages/family/roles' })
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(180deg, #eef2ff 0%, #f5f5f5 40%);
  padding: 60rpx 40rpx;
}

.progress-dots {
  display: flex;
  justify-content: center;
  gap: 16rpx;
  margin-bottom: 60rpx;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #ddd;

  &.active {
    background: #667eea;
    width: 40rpx;
    border-radius: 8rpx;
  }
}

.step {
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 44rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
}

.subtitle {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 40rpx;
}

.subject-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 40rpx;
}

.subject-item {
  background: white;
  border-radius: 16rpx;
  padding: 28rpx;
  display: flex;
  align-items: center;
  border: 2rpx solid transparent;

  &.selected {
    border-color: #667eea;
    background: #eef2ff;
  }
}

.subject-icon {
  font-size: 48rpx;
  margin-right: 20rpx;
}

.subject-copy {
  flex: 1;
}

.book-name {
  flex: 1;
  font-size: 32rpx;
  font-weight: 500;
  color: #333;
  display: block;
}

.book-level {
  font-size: 24rpx;
  color: #999;
  margin-right: 12rpx;
}

.btn-next {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 40rpx;
  padding: 28rpx;
  font-size: 32rpx;
}

.name-input {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  font-size: 32rpx;
  margin-bottom: 40rpx;
}
</style>
