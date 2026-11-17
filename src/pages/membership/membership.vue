<template>
  <view class="desk">
    <view class="setup">
      <text class="eyebrow">账号</text>
      <text class="title">会员</text>
      <text class="lede">开通后，这个账号下的角色都可以用。</text>

      <view class="plan featured">
        <text class="plan-name">Premium · ¥29.9 / 月</text>
        <text class="plan-line">全部英语词书 · AI 陪聊不限 · 阶段小测报告 · 学习周报</text>
        <button class="start" @tap="subscribe">开通会员（演示）</button>
      </view>

      <view class="plan">
        <text class="plan-name">免费版</text>
        <text class="plan-line">KET 词书 · 每日 20 词 · AI 陪聊 5 条/天</text>
      </view>

      <text class="label">词书解锁</text>
      <view v-for="book in books" :key="book.code" class="book-row">
        <text class="book-name">{{ book.name }}</text>
        <text :class="['book-status', isUnlocked(book) ? 'on' : '']">
          {{ isUnlocked(book) ? '已解锁' : '会员解锁' }}
        </text>
      </view>

      <text class="label">学习周报</text>
      <view v-if="weeklyReport" class="report">
        <text>本周学习 {{ weeklyReport.totalWords }} 词 · 活跃 {{ weeklyReport.activeDays }} 天</text>
        <text>正确率 {{ weeklyReport.accuracy }}% · 连续打卡 {{ weeklyReport.streak }} 天</text>
      </view>
      <text v-else class="hint">暂无周报数据</text>
      <button class="ghost" @tap="shareReport">复制周报</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useVocabularyStore } from '@/stores/vocabulary'
import { useUserStore } from '@/stores/user'
import { statsAPI } from '@/utils/api'
import { requireReadySession } from '@/utils/subject'

const vocabStore = useVocabularyStore()
const userStore = useUserStore()

const books = ref<Array<{ code: string; name: string; unlockType?: string }>>([])
const weeklyReport = ref<{
  totalWords: number
  activeDays: number
  accuracy: number
  streak: number
} | null>(null)

function isUnlocked(book: { unlockType?: string }) {
  if (userStore.plan === 'premium') return true
  return book.unlockType === 'free' || !book.unlockType
}

function subscribe() {
  uni.showToast({ title: '演示：会员已开通', icon: 'none' })
}

function shareReport() {
  if (!weeklyReport.value) {
    uni.showToast({ title: '暂无周报', icon: 'none' })
    return
  }
  const r = weeklyReport.value
  const text = `本周学习 ${r.totalWords} 词，活跃 ${r.activeDays} 天，正确率 ${r.accuracy}%，连续 ${r.streak} 天`
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '周报已复制', icon: 'success' })
  })
}

onLoad(() => {})

onMounted(async () => {
  // 账号页：未选角色、还没有角色时也要能打开，避免一直被踢回角色页
  if (!(await requireReadySession({ allowNoStudents: true, allowMissingRole: true }))) return
  if (!userStore.isParent) {
    try {
      await userStore.chooseParentRole()
    } catch {
      return
    }
  }
  try {
    await vocabStore.loadBooks()
    books.value = vocabStore.books as typeof books.value
  } catch {
    books.value = []
  }
  try {
    const res = await statsAPI.weeklyReport()
    weeklyReport.value = res.data as typeof weeklyReport.value
  } catch {
    weeklyReport.value = null
  }
})
</script>

<style lang="scss" scoped>
.desk {
  min-height: 100vh;
  background: #f4f1ea;
  color: #1f1a14;
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif;
}

.setup {
  max-width: 880px;
  margin: 0 auto;
  padding: 28px 22px 80px;
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

.lede, .hint, .plan-line, .report text {
  display: block;
  color: #6d645b;
  font-size: 14px;
  line-height: 1.6;
}

.lede { margin: 10px 0 22px; }

.label {
  display: block;
  margin: 24px 0 10px;
  font-size: 13px;
  font-weight: 650;
}

.plan {
  border: 1px solid #e0d7cb;
  border-radius: 16px;
  padding: 16px 18px;
  margin-bottom: 12px;
}

.plan.featured {
  border-color: #0f6e6a;
}

.plan-name {
  display: block;
  font-size: 18px;
  font-weight: 650;
}

.plan-line {
  margin-top: 6px;
}

.start, .ghost {
  margin-top: 14px;
  border-radius: 999px;
  font-size: 15px;
}

.start {
  background: #0f6e6a;
  color: #fff;
}

.ghost {
  background: transparent;
  color: #1f1a14;
  border: 1px solid #e0d7cb;
}

.book-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #efe7da;
}

.book-name { font-size: 15px; }
.book-status { font-size: 13px; color: #8a8175; }
.book-status.on { color: #0f6e6a; }

.report {
  border: 1px solid #e0d7cb;
  border-radius: 12px;
  padding: 14px 16px;
}
</style>
