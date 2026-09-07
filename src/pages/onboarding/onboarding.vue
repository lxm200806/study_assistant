<template>
  <view class="container">
    <view class="progress-dots">
      <view v-for="i in totalSteps" :key="i" :class="['dot', stepIndex >= i ? 'active' : '']" />
    </view>

    <view v-if="step === 'role'" class="step">
      <text class="title">选择使用模式</text>
      <text class="subtitle">语文和英语都有家长模式、学生模式。家长可添加多个学生。</text>
      <view class="subject-list">
        <view :class="['subject-item', accountType === 'student' ? 'selected' : '']" @tap="accountType = 'student'">
          <text class="subject-icon">🎒</text>
          <view class="subject-copy">
            <text class="book-name">学生模式</text>
            <text class="book-level">自己学、自己练，进度只属于你</text>
          </view>
        </view>
        <view :class="['subject-item', accountType === 'parent' ? 'selected' : '']" @tap="accountType = 'parent'">
          <text class="subject-icon">👨‍👩‍👧</text>
          <view class="subject-copy">
            <text class="book-name">家长模式</text>
            <text class="book-level">创建多个学生角色，分别查看进度</text>
          </view>
        </view>
      </view>
      <button class="btn-next" @tap="chooseRole">下一步</button>
    </view>

    <view v-else-if="step === 'subject'" class="step">
      <text class="title">选择学习学科</text>
      <text class="subtitle">语文和英语分开学，互不影响。之后可在「我的」里切换。</text>
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

    <view v-else-if="step === 'student'" class="step">
      <text class="title">添加第一个学生</text>
      <text class="subtitle">学习进度记在这个学生名下。之后还能在「我的」里继续添加。</text>
      <input class="name-input" v-model="studentName" placeholder="例如：小明" />
      <button class="btn-next" @tap="createFirstStudent">进入学习</button>
    </view>

    <view v-else-if="step === 'book'" class="step">
      <text class="title">选择考试目标</text>
      <text class="subtitle">我们将为你推荐对应词书</text>
      <view class="book-list">
        <view
          v-for="book in books"
          :key="book.code"
          :class="['book-item', selectedBook === book.code ? 'selected' : '']"
          @tap="selectedBook = book.code"
        >
          <text class="book-name">{{ book.name }}</text>
          <text class="book-level">{{ book.level }}</text>
          <text v-if="book.isFree === false" class="book-lock">🔒</text>
        </view>
      </view>
      <button class="btn-next" @tap="nextEnglish">下一步</button>
    </view>

    <view v-else-if="step === 'goal'" class="step">
      <text class="title">设定每日目标</text>
      <text class="subtitle">坚持小目标，更容易养成习惯</text>
      <view class="goal-options">
        <view
          v-for="n in goalOptions"
          :key="n"
          :class="['goal-item', dailyGoal === n ? 'selected' : '']"
          @tap="dailyGoal = n"
        >
          <text class="goal-num">{{ n }}</text>
          <text class="goal-label">词/天</text>
        </view>
      </view>
      <button class="btn-next" @tap="nextEnglish">下一步</button>
    </view>

    <view v-else class="step">
      <text class="title">来试试 10 词体验课</text>
      <text class="subtitle">快速感受智能推荐训练</text>
      <view class="trial-card">
        <text class="trial-icon">📚</text>
        <text class="trial-book">{{ selectedBookName }}</text>
        <text class="trial-desc">10 词认读 · 约 3 分钟</text>
      </view>
      <button class="btn-next" @tap="startTrial">开始体验</button>
      <text class="skip-link" @tap="finishStudentEnglish">跳过，直接进入</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import { useUserStore, type AccountType } from '@/stores/user'
import { authAPI } from '@/utils/api'
import type { Subject } from '@/utils/subject'

type Step = 'role' | 'subject' | 'student' | 'book' | 'goal' | 'trial'

const vocabStore = useVocabularyStore()
const userStore = useUserStore()

const step = ref<Step>(userStore.accountType ? 'subject' : 'role')
const accountType = ref<AccountType>(userStore.accountType || 'student')
const subject = ref<Subject | ''>('')
const studentName = ref('')
const selectedBook = ref('ket')
const dailyGoal = ref(30)
const goalOptions = [20, 30, 50]
const books = ref<Array<{ code: string; name: string; level: string; isFree?: boolean }>>([])

const selectedBookName = computed(() =>
  books.value.find(b => b.code === selectedBook.value)?.name || selectedBook.value
)
const totalSteps = computed(() => {
  if (accountType.value === 'parent') return 3
  return subject.value === 'english' ? 5 : 2
})
const stepIndex = computed(() => {
  const order: Step[] = accountType.value === 'parent'
    ? ['role', 'subject', 'student']
    : subject.value === 'english'
      ? ['role', 'subject', 'book', 'goal', 'trial']
      : ['role', 'subject']
  return order.indexOf(step.value) + 1
})

const chooseRole = () => {
  if (!accountType.value) {
    uni.showToast({ title: '请选择家长或学生模式', icon: 'none' })
    return
  }
  userStore.setAccountType(accountType.value)
  step.value = 'subject'
}

const chooseSubject = async () => {
  if (!subject.value) {
    uni.showToast({ title: '请先选择语文或英语', icon: 'none' })
    return
  }
  await userStore.setSubject(subject.value, false)
  if (accountType.value === 'parent') {
    step.value = 'student'
    return
  }
  if (subject.value === 'chinese') {
    await finishOnboarding()
    goHome()
    return
  }
  step.value = 'book'
}

const nextEnglish = () => {
  if (step.value === 'book') {
    vocabStore.setCurrentBook(selectedBook.value)
    uni.setStorageSync('studyGoalBook', selectedBook.value)
    step.value = 'goal'
    return
  }
  uni.setStorageSync('dailyGoal', dailyGoal.value)
  vocabStore.setStudySettings({ wordsPerGroup: 10, groupCount: 1 })
  step.value = 'trial'
}

const finishOnboarding = async () => {
  const picked: Subject = subject.value === 'chinese' ? 'chinese' : 'english'
  try {
    await authAPI.onboard(picked, accountType.value)
    await userStore.setSubject(picked, false)
    userStore.setAccountType(accountType.value)
    userStore.setOnboarded(true)
  } catch {
    userStore.setOnboarded(true)
  }
}

const goHome = () => {
  if (userStore.isParent && !userStore.activeLearnerId) {
    uni.reLaunch({ url: '/pages/family/students' })
    return
  }
  uni.switchTab({ url: '/pages/home/home' })
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
  goHome()
}

const finishStudentEnglish = async () => {
  await finishOnboarding()
  goHome()
}

const startTrial = async () => {
  vocabStore.setCurrentBook(selectedBook.value)
  uni.setStorageSync('dailyGoal', dailyGoal.value)
  uni.setStorageSync('studyGoalBook', selectedBook.value)
  vocabStore.setStudySettings({ wordsPerGroup: 10, groupCount: 1, sessionMode: 'smart' })
  await finishOnboarding()
  uni.navigateTo({ url: '/pages/recognition/recognition?autoStart=1' })
}

onMounted(async () => {
  if (userStore.accountType) accountType.value = userStore.accountType
  await vocabStore.loadBooks()
  books.value = vocabStore.books as typeof books.value
})
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

.subject-list,
.book-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 40rpx;
}

.subject-item,
.book-item {
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

.goal-options {
  display: flex;
  gap: 20rpx;
  margin-bottom: 40rpx;
}

.goal-item {
  flex: 1;
  background: white;
  border-radius: 16rpx;
  padding: 30rpx;
  text-align: center;
  border: 2rpx solid transparent;

  &.selected {
    border-color: #667eea;
    background: #eef2ff;
  }
}

.goal-num {
  font-size: 48rpx;
  font-weight: 600;
  color: #667eea;
  display: block;
}

.goal-label {
  font-size: 24rpx;
  color: #999;
}

.trial-card {
  background: white;
  border-radius: 20rpx;
  padding: 50rpx;
  text-align: center;
  margin-bottom: 40rpx;
}

.trial-icon {
  font-size: 80rpx;
  display: block;
  margin-bottom: 20rpx;
}

.trial-book {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
  display: block;
}

.trial-desc {
  font-size: 26rpx;
  color: #999;
  margin-top: 12rpx;
  display: block;
}

.btn-next {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 40rpx;
  padding: 28rpx;
  font-size: 32rpx;
}

.skip-link {
  text-align: center;
  font-size: 26rpx;
  color: #999;
  margin-top: 24rpx;
}

.name-input {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  font-size: 32rpx;
  margin-bottom: 40rpx;
}
</style>
