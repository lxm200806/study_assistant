<template>
  <view class="container">
    <view class="header">
      <text class="title">{{ data.courseName || '课程掌握' }}</text>
      <text class="subtitle">间隔是下次再见到大约隔几天。「学过几遍」是这个词条进过几门课并练过。</text>
    </view>
    <view v-if="today.status === 'empty'" class="card">
      <text>这门课还没有知识点。请回课程页点「同步新词」，或去组课重新生成。</text>
    </view>
    <template v-else>
      <view class="card">
        <text class="today-title">{{ today.title || '今天还没开始练' }}</text>
        <text class="hint">{{ data.summary }}</text>
        <view class="stats">
          <view class="stat"><text class="num">{{ today.todayPracticed || 0 }}</text><text>今日已练</text></view>
          <view class="stat"><text class="num">{{ accuracyText }}</text><text>正确率</text></view>
          <view class="stat"><text class="num">{{ remainingText }}</text><text>还差</text></view>
          <view class="stat"><text class="num">{{ mastery.mastered || 0 }}/{{ mastery.total || 0 }}</text><text>已掌握</text></view>
        </view>
        <text v-if="weakText" class="hint">相对容易错：{{ weakText }}</text>
        <text v-if="today.todayDoneCount" class="cheer">
          今日已完成 {{ today.todayDoneCount }} 条<template v-if="today.todayStreak"> · 连续正确 {{ today.todayStreak }}</template>
        </text>
        <view class="pref" @tap="toggleReviewPref">
          <text class="check">{{ reviewDefaultTest ? '☑' : '☐' }}</text>
          <text>到期复习默认用测试模式</text>
        </view>
      </view>
      <view class="card stats">
        <view class="stat"><text class="num">{{ mastery.learning || 0 }}</text><text>学习中</text></view>
        <view class="stat"><text class="num">{{ mastery.unseen || 0 }}</text><text>还没学</text></view>
      </view>
      <view v-for="item in data.items || []" :key="item.id" class="card">
        <text class="prompt">{{ item.lemma || item.prompt }}</text>
        <text class="muted">
          {{ item.grade || '未分年级' }} · {{ item.kind }} · {{ item.mastered ? '已掌握' : item.last ? '学习中' : '未学' }}
        </text>
        <text class="muted">
          学 {{ item.study_count || 0 }} / 复习 {{ item.review_count || 0 }} / 错 {{ item.error_count || 0 }}
          · 学过几遍 {{ item.passCount || item.pass_count || 0 }}
          · 间隔 {{ item.interval || 0 }} 天
        </text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { chineseAPI } from '@/utils/api'
import { requireSubject } from '@/utils/subject'

const courseId = ref('')
const data = ref<any>({})
const reviewDefaultTest = ref(false)

const today = computed(() => data.value.today || {})
const mastery = computed(() => data.value.mastery || {})
const accuracyText = computed(() => (today.value.todayAccuracy == null ? '—' : `${today.value.todayAccuracy}%`))
const remainingText = computed(() => {
  if (today.value.status === 'done') return '练完了'
  const parts = []
  if (today.value.remainingNewEnergy) parts.push(`新${today.value.remainingNewEnergy}`)
  if (today.value.remainingReviewEnergy) parts.push(`复${today.value.remainingReviewEnergy}`)
  return parts.join(' / ') || '0 能'
})
const weakText = computed(() => {
  const rows = today.value.weakKinds || mastery.value.weakKinds || []
  return rows.map((item: any) => item.label || item.kind).join('、')
})

async function loadStats() {
  data.value = await chineseAPI.stats(courseId.value)
  reviewDefaultTest.value = !!data.value.reviewDefaultTest
}

async function toggleReviewPref() {
  try {
    const result = (await chineseAPI.patchCourse(courseId.value, { reviewDefaultTest: !reviewDefaultTest.value })) as any
    reviewDefaultTest.value = !!result.reviewDefaultTest
  } catch (error: any) {
    uni.showToast({ title: error.message || '保存失败', icon: 'none' })
  }
}

onLoad(async query => {
  if (!(await requireSubject('chinese'))) return
  courseId.value = String(query?.id || '')
  try {
    await loadStats()
  } catch (error: any) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' })
  }
})
</script>

<style lang="scss" scoped>
.header { padding: 12rpx 8rpx 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.subtitle, .hint, .muted { display: block; color: #888; font-size: 24rpx; margin-top: 8rpx; }
.today-title, .prompt { display: block; font-size: 30rpx; font-weight: 600; }
.stats { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 16rpx; }
.stat { flex: 1 1 40%; }
.num { display: block; font-size: 36rpx; font-weight: 700; color: #667eea; }
.cheer { display: block; margin-top: 12rpx; color: #667eea; }
.pref { display: flex; align-items: center; gap: 12rpx; margin-top: 16rpx; }
.check { color: #667eea; font-size: 32rpx; }
</style>
