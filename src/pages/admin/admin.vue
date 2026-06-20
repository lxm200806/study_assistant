<template>
  <view class="container">
    <view class="header">
      <text class="title">词库管理</text>
      <text class="subtitle">词汇问题排查 · 管理员 {{ userStore.username }}</text>
    </view>

    <view class="filter-row">
      <view
        v-for="tab in issueTabs"
        :key="tab.value"
        :class="['filter-chip', activeIssue === tab.value ? 'active' : '']"
        @tap="selectIssue(tab.value)"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <view class="summary-row">
      <view
        v-for="item in summary"
        :key="item.bookCode"
        :class="['summary-chip', activeBook === item.bookCode ? 'active' : '']"
        @tap="selectBook(item.bookCode)"
      >
        <text class="chip-name">{{ item.bookName }}</text>
        <text class="chip-count">{{ countForBook(item) }}</text>
      </view>
      <view
        :class="['summary-chip', activeBook === '' ? 'active' : '']"
        @tap="selectBook('')"
      >
        <text class="chip-name">全部</text>
      </view>
    </view>

    <view v-if="words.length > 0" class="list">
      <view v-for="item in words" :key="item.id + item.word" class="word-card">
        <view class="word-row">
          <text class="word-text">{{ item.word }}</text>
          <view class="tag-row">
            <text v-if="item.issueType === 'parse_error'" class="issue-tag parse">解析错误</text>
            <text v-else class="issue-tag missing">缺释义</text>
            <text v-if="item.bookName" class="book-tag">{{ item.bookName }}</text>
          </view>
        </view>
        <text class="meaning missing">{{ item.meaning || '（无释义）' }}</text>
        <text v-if="item.phonetic" class="phonetic">{{ item.phonetic }}</text>
      </view>
    </view>

    <view v-else class="empty">
      <text>{{ emptyText }}</text>
    </view>

    <view v-if="totalPages > 1" class="pagination">
      <view :class="['page-btn', page <= 1 ? 'disabled' : '']" @tap="goPage(page - 1)">
        <text>上一页</text>
      </view>
      <text class="page-info">第 {{ page }} / {{ totalPages }} 页（共 {{ total }} 词）</text>
      <view :class="['page-btn', page >= totalPages ? 'disabled' : '']" @tap="goPage(page + 1)">
        <text>下一页</text>
      </view>
    </view>

    <view class="footer-actions">
      <button class="btn-secondary" @tap="goHome">返回首页</button>
      <button class="btn-logout" @tap="userStore.logout">退出登录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { adminAPI } from '@/utils/api'

const userStore = useUserStore()

interface SummaryItem {
  bookCode: string
  bookName: string
  wordCount: number
  missingCount: number
  parseErrorCount: number
  issueCount: number
}

interface MissingWord {
  id: string
  word: string
  meaning: string
  englishMeaning?: string
  phonetic?: string
  bookCode?: string
  bookName?: string
  issueType?: 'missing_cn' | 'parse_error'
}

type IssueFilter = '' | 'missing_cn' | 'parse_error'

const issueTabs: { label: string; value: IssueFilter }[] = [
  { label: '全部问题', value: '' },
  { label: '缺释义', value: 'missing_cn' },
  { label: '解析错误', value: 'parse_error' }
]

const summary = ref<SummaryItem[]>([])
const words = ref<MissingWord[]>([])
const activeBook = ref('')
const activeIssue = ref<IssueFilter>('')
const page = ref(1)
const total = ref(0)
const limit = 40

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

const emptyText = computed(() => {
  if (activeIssue.value === 'parse_error') return '暂无解析错误词条'
  if (activeIssue.value === 'missing_cn') return '暂无缺释义词汇'
  return '暂无问题词汇'
})

const countForBook = (item: SummaryItem) => {
  if (activeIssue.value === 'missing_cn') return `${item.missingCount} 缺释义`
  if (activeIssue.value === 'parse_error') return `${item.parseErrorCount} 解析错`
  return `${item.issueCount} 问题`
}

const loadSummary = async () => {
  const result = await adminAPI.missingSummary()
  summary.value = (result.data as SummaryItem[]) || []
}

const loadWords = async () => {
  const result = await adminAPI.missingWords(
    activeBook.value || undefined,
    page.value,
    limit,
    activeIssue.value || undefined
  )
  const data = result.data as { words: MissingWord[]; total: number }
  words.value = data?.words || []
  total.value = data?.total || 0
}

const selectIssue = async (value: IssueFilter) => {
  activeIssue.value = value
  page.value = 1
  await loadWords()
}

const selectBook = async (code: string) => {
  activeBook.value = code
  page.value = 1
  await loadWords()
}

const goPage = async (p: number) => {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  await loadWords()
}

const goHome = () => {
  uni.switchTab({ url: '/pages/home/home' })
}

onMounted(async () => {
  const ok = await userStore.checkLogin()
  if (!ok || !userStore.isAdmin) {
    uni.showToast({ title: '需要管理员账号', icon: 'none' })
    setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 800)
    return
  }
  await loadSummary()
  await loadWords()
})
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
  padding-bottom: 120rpx;
}

.header {
  margin-bottom: 24rpx;
}

.title {
  font-size: 40rpx;
  font-weight: 600;
  color: #333;
  display: block;
}

.subtitle {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.filter-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.filter-chip {
  padding: 12rpx 20rpx;
  background: white;
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #666;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);

  &.active {
    background: #eef2ff;
    color: #667eea;
    font-weight: 600;
  }
}

.summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.summary-chip {
  padding: 16rpx 20rpx;
  background: white;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);

  &.active {
    background: #667eea;
    .chip-name, .chip-count { color: white; }
  }
}

.chip-name {
  font-size: 24rpx;
  color: #333;
  display: block;
}

.chip-count {
  font-size: 22rpx;
  color: #e65100;
  display: block;
  margin-top: 4rpx;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.word-card {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.word-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12rpx;
  gap: 12rpx;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  justify-content: flex-end;
}

.issue-tag {
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 10rpx;

  &.parse {
    color: #c62828;
    background: #ffebee;
  }

  &.missing {
    color: #e65100;
    background: #fff3e0;
  }
}

.word-text {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}

.book-tag {
  font-size: 22rpx;
  color: #667eea;
  background: #eef2ff;
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
}

.meaning.missing {
  font-size: 26rpx;
  color: #e65100;
}

.phonetic {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.empty {
  text-align: center;
  padding: 80rpx;
  color: #999;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
  padding: 16rpx;
  background: white;
  border-radius: 16rpx;
}

.page-btn {
  padding: 12rpx 24rpx;
  background: #667eea;
  color: white;
  border-radius: 24rpx;
  font-size: 24rpx;

  &.disabled {
    opacity: 0.4;
    pointer-events: none;
  }
}

.page-info {
  font-size: 24rpx;
  color: #666;
}

.footer-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 32rpx;
}

.btn-secondary, .btn-logout {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
}

.btn-secondary {
  background: #eef2ff;
  color: #667eea;
}

.btn-logout {
  background: #f5f5f5;
  color: #666;
}
</style>
