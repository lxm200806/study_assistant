<template>
  <view class="container">
    <view class="header" @tap="onHeaderTap">
      <view class="user-info">
        <view class="avatar">
          <text class="avatar-text">{{ headerName.charAt(0) }}</text>
        </view>
        <view class="greeting">
          <text class="greeting-text">你好, {{ headerName }}</text>
          <text class="date-text">{{ roleLabel }} · {{ userStore.isChinese ? '语文' : '英语' }} · {{ currentDate }}</text>
        </view>
      </view>
      <text class="header-link">切换 ›</text>
    </view>

    <template v-if="userStore.isStudentRole">
      <template v-if="userStore.isChinese">
        <view v-if="!studentChineseCourses.length" class="card">
          <text class="action-title">还没有课程</text>
          <text class="action-desc">还没有课程。请先在账号里组好，之后会出现在这里。</text>
        </view>
        <view
          v-for="item in studentChineseCourses"
          :key="item.id"
          class="card course-home"
          @tap="goChineseDrill(item.id)"
        >
          <text class="action-title">{{ item.name }}</text>
          <text class="action-desc">{{ courseProgressText(item) }}</text>
        </view>
      </template>
      <template v-else>
        <view class="stats-card">
          <view class="stats-header">
            <text class="stats-title">今日进度</text>
            <text class="stats-subtitle">{{ dailyWordCount }}/{{ dailyGoal }} 词 · 🔥 {{ streak }} 天</text>
          </view>
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: dailyProgress + '%' }"></view>
          </view>
          <text class="rail-hint">从左侧进入认读或拼读</text>
        </view>
      </template>
    </template>

    <template v-else>
      <view class="student-strip">
        <view
          v-for="item in userStore.children"
          :key="item.id"
          :class="['student-chip', item.id === userStore.activeLearnerId ? 'active' : '']"
          @tap="pickChild(item.id)"
        >
          <text>{{ item.name }}</text>
        </view>
        <view class="student-chip add" @tap="goStudents">+ 添加</view>
      </view>
      <view v-if="userStore.learner" class="let-study" @tap="enterCurrentStudent">
        进入 {{ userStore.learnerName }}
      </view>

      <template v-if="userStore.isChinese">
        <view class="quick-actions">
          <view class="action-card" @tap="goChineseCourses">
            <view class="action-icon">📖</view>
            <text class="action-title">我的课程</text>
            <text class="action-desc">计划 · 掌握</text>
          </view>
          <view class="action-card" @tap="goChineseLibrary">
            <view class="action-icon">🧩</view>
            <text class="action-title">组课</text>
            <text class="action-desc">按年级生成课程</text>
          </view>
          <view class="action-card" @tap="goChinesePoints">
            <view class="action-icon">📚</view>
            <text class="action-title">知识点</text>
            <text class="action-desc">浏览已发布库</text>
          </view>
          <view class="action-card" @tap="goChineseCoverage">
            <view class="action-icon">📊</view>
            <text class="action-title">全库覆盖</text>
            <text class="action-desc">学过 · 掌握</text>
          </view>
        </view>
        <view v-for="item in chineseCourses" :key="item.id" class="card course-home" @tap="goChineseCourses">
          <text class="action-title">{{ item.name }}</text>
          <text class="action-desc">{{ item.progress?.title || '今日默写' }} · {{ item.itemCount || item.item_count || 0 }} 条</text>
        </view>
      </template>

      <template v-else>
        <BookSwitcher @change="onBookChange" />

        <view class="stats-card">
          <view class="stats-header">
            <text class="stats-title">今日进度</text>
            <text class="stats-subtitle">{{ dailyWordCount }}/{{ dailyGoal }} 词 · 🔥 {{ streak }} 天</text>
          </view>
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: dailyProgress + '%' }"></view>
          </view>
          <view class="stats-detail">
            <view class="stat-item">
              <text class="stat-value">{{ todayStats.correct }}</text>
              <text class="stat-label">正确</text>
            </view>
            <view class="stat-item">
              <text class="stat-value">{{ todayStats.total - todayStats.correct }}</text>
              <text class="stat-label">错误</text>
            </view>
            <view class="stat-item">
              <text class="stat-value">{{ todayStats.accuracy }}%</text>
              <text class="stat-label">正确率</text>
            </view>
          </view>
        </view>

        <view class="quick-actions">
          <view class="action-card" @tap="goPepPrimary">
            <view class="action-icon">📗</view>
            <text class="action-title">小学 PEP</text>
            <text class="action-desc">三上～五上 · 词汇课文</text>
          </view>
          <view class="action-card" @tap="goToBooks">
            <view class="action-icon">📚</view>
            <text class="action-title">词汇书</text>
            <text class="action-desc">选择与解锁词书</text>
          </view>
          <view class="action-card" @tap="goToVocabulary">
            <view class="action-icon">📊</view>
            <text class="action-title">学习统计</text>
            <text class="action-desc">查看掌握情况</text>
          </view>
        </view>

        <view class="vocabulary-stats">
          <view class="section-header">
            <text class="section-title">词汇掌握</text>
            <text class="section-link" @tap="goToVocabulary">查看统计 →</text>
          </view>
          <view class="vocab-cards">
            <view class="vocab-item">
              <view class="vocab-icon">🎧</view>
              <view class="vocab-info">
                <text class="vocab-label">听力词汇</text>
                <text class="vocab-count">{{ listeningStats.total }} 词</text>
              </view>
              <view class="vocab-stars">
                <text v-for="i in 5" :key="i" :class="['star', i <= listeningStats.avgMastery ? 'active' : '']">★</text>
              </view>
            </view>
            <view class="vocab-item">
              <view class="vocab-icon">👄</view>
              <view class="vocab-info">
                <text class="vocab-label">口语词汇</text>
                <text class="vocab-count">{{ speakingStats.total }} 词</text>
              </view>
              <view class="vocab-stars">
                <text v-for="i in 5" :key="i" :class="['star', i <= speakingStats.avgMastery ? 'active' : '']">★</text>
              </view>
            </view>
            <view class="vocab-item">
              <view class="vocab-icon">📖</view>
              <view class="vocab-info">
                <text class="vocab-label">认读词汇</text>
                <text class="vocab-count">{{ readingStats.total }} 词</text>
              </view>
              <view class="vocab-stars">
                <text v-for="i in 5" :key="i" :class="['star', i <= readingStats.avgMastery ? 'active' : '']">★</text>
              </view>
            </view>
            <view class="vocab-item">
              <view class="vocab-icon">✏️</view>
              <view class="vocab-info">
                <text class="vocab-label">拼写词汇</text>
                <text class="vocab-count">{{ writingStats.total }} 词</text>
              </view>
              <view class="vocab-stars">
                <text v-for="i in 5" :key="i" :class="['star', i <= writingStats.avgMastery ? 'active' : '']">★</text>
              </view>
            </view>
          </view>
        </view>
      </template>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useVocabularyStore } from '@/stores/vocabulary'
import BookSwitcher from '@/components/BookSwitcher.vue'
import { useDailySession } from '@/composables/useDailySession'
import { openPage } from '@/utils/navigation'
import { chineseAPI } from '@/utils/api'
import { applyAppShell, requireReadySession } from '@/utils/subject'

const userStore = useUserStore()
const vocabStore = useVocabularyStore()
const { getDailyGoal, ensureAccessibleBook } = useDailySession()

const currentDate = ref('')
const dailyGoal = ref(30)
const dailyWordCount = ref(0)
const streak = ref(0)
const dailyProgress = ref(0)

const todayStats = ref({
  total: 0,
  correct: 0,
  accuracy: 0
})

const listeningStats = ref({ total: 0, mastered: 0, avgMastery: 0 })
const speakingStats = ref({ total: 0, mastered: 0, avgMastery: 0 })
const readingStats = ref({ total: 0, mastered: 0, avgMastery: 0 })
const writingStats = ref({ total: 0, mastered: 0, avgMastery: 0 })
const chineseCourses = ref<any[]>([])

const headerName = computed(() =>
  userStore.isStudentRole ? userStore.learnerName : (userStore.displayName || userStore.username)
)
const roleLabel = computed(() => (userStore.isStudentRole ? '角色' : '账号'))

const studentChineseCourses = computed(() => {
  const rows = chineseCourses.value
  const parentMade = rows.filter(item => !item.isDefault)
  return parentMade.length ? parentMade : rows
})

function courseProgressText(item: { progress?: { title?: string }; itemCount?: number; item_count?: number }) {
  const count = item.itemCount || item.item_count || 0
  return `${item.progress?.title || '今日默写'} · ${count} 条`
}

const updateDate = () => {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', weekday: 'long' }
  currentDate.value = now.toLocaleDateString('zh-CN', options)
}

const loadStats = async () => {
  await vocabStore.loadVocabulary()
  vocabStore.loadStats()
  vocabStore.loadTrainingRecords()
  
  await vocabStore.loadServerStats()
  await vocabStore.loadDueCount()
  await vocabStore.loadDailyStats()
  
  dailyGoal.value = getDailyGoal()
  dailyWordCount.value = vocabStore.dailyStats.wordCount
  streak.value = vocabStore.dailyStats.streak
  dailyProgress.value = vocabStore.dailyStats.progress
  
  todayStats.value = vocabStore.getTodayStats
  
  listeningStats.value = vocabStore.getTypeStats('listening')
  speakingStats.value = vocabStore.getTypeStats('speaking')
  readingStats.value = vocabStore.getTypeStats('reading')
  writingStats.value = vocabStore.getTypeStats('writing')
}

const onHeaderTap = () => {
  userStore.goRoles()
}

const goStudents = () => {
  uni.navigateTo({ url: '/pages/family/students' })
}

async function pickChild(id: string) {
  if (id === userStore.activeLearnerId) return
  await userStore.switchStudent(id)
  if (userStore.isChinese) await loadChineseHome()
  else await loadStats()
}

async function enterCurrentStudent() {
  if (!userStore.activeLearnerId) {
    userStore.goRoles()
    return
  }
  await userStore.chooseStudentRole(userStore.activeLearnerId)
  uni.showToast({ title: `已进入 ${userStore.learnerName}`, icon: 'none' })
}

const goPepPrimary = () => {
  openPage('/pages/primary/index')
}

const goToBooks = () => {
  uni.switchTab({ url: '/pages/books/books' })
}

const goToVocabulary = () => {
  uni.switchTab({ url: '/pages/vocabulary/vocabulary' })
}

const goChineseCourses = () => openPage('/pages/chinese/courses')
const goChineseLibrary = () => openPage('/pages/chinese/library')
const goChinesePoints = () => openPage('/pages/chinese/points')
const goChineseCoverage = () => openPage('/pages/chinese/coverage')
const goChineseDrill = (id: string) => openPage(`/pages/chinese/drill?id=${id}`)

async function loadChineseHome() {
  try {
    const data = (await chineseAPI.courses()) as unknown as any[]
    chineseCourses.value = Array.isArray(data) ? data : []
  } catch {
    chineseCourses.value = []
  }
}

onShow(async () => {
  if (!(await requireReadySession({ allowNoStudents: true }))) return
  if (!(userStore.isStudentRole && userStore.isChinese)) {
    userStore.goHome()
    return
  }
  applyAppShell()
  uni.setNavigationBarTitle({ title: userStore.isChinese ? '语文' : '英语' })
  updateDate()
  if (userStore.isChinese) {
    await loadChineseHome()
    return
  }
  vocabStore.loadBooks()
  vocabStore.loadSettings()
  ensureAccessibleBook()
  loadStats()
})

const onBookChange = async () => {
  await loadStats()
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  box-sizing: border-box;
  max-width: 880px;
  margin: 0 auto;
  padding: 28px 22px 80px;
  background: var(--pc-main-bg, #f4f1ea);
  color: #1f1a14;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0 30rpx;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.avatar {
  width: 44px;
  height: 44px;
  background: #1f1a14;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 18px;
  color: #f4f1ea;
  font-weight: 600;
}

.greeting {
  display: flex;
  flex-direction: column;
}

.greeting-text {
  font-size: 22px;
  font-weight: 650;
  color: #1f1a14;
}

.date-text {
  font-size: 13px;
  color: #8a8175;
  margin-top: 4px;
}

.header-link {
  font-size: 26rpx;
  color: #0f6e6a;
  flex-shrink: 0;
}

.student-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.student-chip {
  background: #fff;
  border-radius: 999rpx;
  padding: 12rpx 24rpx;
  font-size: 26rpx;
  color: #555;
  border: 2rpx solid transparent;

  &.active {
    border-color: #1f1a14;
    color: #f4f1ea;
    background: #1f1a14;
  }

  &.add {
    color: #0f6e6a;
  }
}

.let-study {
  background: #0f6e6a;
  color: #fff;
  text-align: center;
  border-radius: 16rpx;
  padding: 20rpx;
  font-size: 28rpx;
  margin-bottom: 24rpx;
}


.rail-hint {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6d645b;
}

.stats-card {
  background: #fff;
  border: 1px solid #e0d7cb;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  color: #1f1a14;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.stats-title {
  font-size: 32rpx;
  color: #1f1a14;
  font-weight: 600;
}

.stats-subtitle {
  font-size: 28rpx;
  color: #6d645b;
}

.progress-bar {
  height: 12rpx;
  background: #efe7da;
  border-radius: 6rpx;
  margin-bottom: 25rpx;
}

.progress-fill {
  height: 100%;
  background: #0f6e6a;
  border-radius: 6rpx;
  transition: width 0.3s ease;
}

.stats-detail {
  display: flex;
  justify-content: space-around;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 40rpx;
  color: #1f1a14;
  font-weight: 600;
}

.stat-label {
  font-size: 24rpx;
  color: #6d645b;
  margin-top: 5rpx;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.action-card {
  background: white;
  border-radius: 16rpx;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid #e0d7cb;
  box-shadow: none;
}

.action-icon {
  font-size: 60rpx;
  margin-bottom: 15rpx;
}

.action-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 5rpx;
}

.action-desc {
  font-size: 24rpx;
  color: #999;
}

.vocabulary-stats {
  margin-bottom: 30rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.section-link {
  font-size: 26rpx;
  color: #0f6e6a;
}

.vocab-cards {
  background: #fff;
  border: 1px solid #e0d7cb;
  border-radius: 16px;
  padding: 8px 16px;
}

.vocab-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
  
  &:last-child {
    border-bottom: none;
  }
}

.vocab-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.vocab-info {
  flex: 1;
}

.vocab-label {
  font-size: 28rpx;
  color: #666;
  display: block;
}

.vocab-count {
  font-size: 24rpx;
  color: #999;
}

.vocab-stars {
  display: flex;
  gap: 5rpx;
}

.star {
  font-size: 28rpx;
  color: #ddd;
  
  &.active {
    color: #0f6e6a;
  }
}

.course-home {
  margin-top: 8rpx;
}
</style>
