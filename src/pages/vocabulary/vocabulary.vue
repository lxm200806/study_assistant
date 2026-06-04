<template>
  <view class="container">
    <view class="top-bar">
      <BookSwitcher class="book-switcher-wrap" @change="onBookChange" />
    </view>

    <view class="tabs">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-item', activeTab === tab.key ? 'active' : '']"
        @tap="activeTab = tab.key"
      >
        <text class="tab-icon">{{ tab.icon }}</text>
        <text class="tab-text">{{ tab.label }}</text>
        <view v-if="getTypeCount(tab.key) > 0" class="tab-badge">{{ getTypeCount(tab.key) }}</view>
      </view>
    </view>

    <view class="summary-card">
      <view class="summary-item">
        <text class="summary-value">{{ currentStats.total }}</text>
        <text class="summary-label">累计学习</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
        <text class="summary-value">{{ currentStats.mastered }}</text>
        <text class="summary-label">已掌握</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
        <text class="summary-value">{{ currentStats.learning }}</text>
        <text class="summary-label">学习中</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
        <text class="summary-value">{{ currentStats.weak }}</text>
        <text class="summary-label">需加强</text>
      </view>
    </view>

    <view class="filter-bar">
      <view
        v-for="filter in filters"
        :key="filter.key"
        :class="['filter-item', activeFilter === filter.key ? 'active' : '']"
        @tap="activeFilter = filter.key"
      >
        <text>{{ filter.label }}</text>
      </view>
    </view>

    <view v-if="filteredList.length > 0" class="word-list-wrap">
      <scroll-view scroll-y class="word-list-scroll">
        <view class="word-list">
          <view
            v-for="item in paginatedList"
            :key="item.word"
            class="word-card"
            @tap="showWordDetail(item)"
          >
            <view class="word-header">
              <view class="word-title-row">
                <text class="word-text">{{ item.word }}</text>
                <text :class="['level-badge', `level-${getMasteryLevel(item.mastery)}`]">
                  {{ getMasteryLabel(item.mastery) }}
                </text>
              </view>
              <view class="word-stars">
                <text v-for="i in 5" :key="i" :class="['star', i <= item.mastery ? 'active' : '']">★</text>
              </view>
            </view>
            <view class="word-info">
              <text class="word-phonetic">{{ item.phonetic }}</text>
              <text class="word-meaning">{{ item.meaning }}</text>
            </view>
            <view v-if="item.weakReason || item.dueText" class="word-meta">
              <text v-if="item.weakReason" class="weak-reason">{{ item.weakReason }}</text>
              <text v-if="item.dueText" class="due-text">{{ item.dueText }}</text>
            </view>
            <view class="word-footer">
              <text class="practice-count">练习 {{ item.count }} 次 · 正确率 {{ item.accuracy }}%</text>
              <text class="last-practice">{{ item.lastPracticeText }}</text>
            </view>
          </view>
        </view>
      </scroll-view>

      <view v-if="totalPages > 1" class="pagination">
        <view
          :class="['page-btn', currentPage <= 1 ? 'disabled' : '']"
          @tap="goPage(currentPage - 1)"
        >
          <text>上一页</text>
        </view>
        <text class="page-info">第 {{ currentPage }} / {{ totalPages }} 页（共 {{ filteredList.length }} 词）</text>
        <view
          :class="['page-btn', currentPage >= totalPages ? 'disabled' : '']"
          @tap="goPage(currentPage + 1)"
        >
          <text>下一页</text>
        </view>
      </view>
    </view>

    <view v-else class="empty-state">
      <text class="empty-icon">📚</text>
      <text class="empty-text">{{ emptyText }}</text>
      <text class="empty-hint">开始训练来积累词汇吧!</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import BookSwitcher from '@/components/BookSwitcher.vue'
import { formatTimeAgo } from '@/utils'
import { getMasteryLabel, getMasteryLevel, formatDueDate, WEAK_REASON_LABELS } from '@/utils/mastery'
import { STATUS_LABELS } from '@/types/map'
import type { MasteryStatus, WeakReason } from '@/types/map'

const PAGE_SIZE = 40

const vocabStore = useVocabularyStore()

const tabs = [
  { key: 'listening', label: '听力', icon: '🎧' },
  { key: 'speaking', label: '口语', icon: '👄' },
  { key: 'reading', label: '认读', icon: '📖' },
  { key: 'writing', label: '拼写', icon: '✏️' }
] as const

const filters = [
  { key: 'all', label: '全部' },
  { key: 'mastered', label: '已掌握' },
  { key: 'learning', label: '学习中' },
  { key: 'weak', label: '需加强' },
  { key: 'unpracticed', label: '未练习' }
] as const

type TabKey = typeof tabs[number]['key']
type FilterKey = typeof filters[number]['key']

const activeTab = ref<TabKey>('listening')
const activeFilter = ref<FilterKey>('all')
const currentPage = ref(1)

const currentStats = computed(() => {
  if (vocabStore.bookMapData) {
    const s = vocabStore.bookMapData.summary
    return {
      total: s.practiced ?? (s.mastered + s.learning + s.unfamiliar),
      mastered: s.mastered,
      learning: s.learning,
      weak: s.unfamiliar,
      unpracticed: s.unpracticed
    }
  }

  const words = vocabStore.stats[activeTab.value]
  const list = Object.values(words)
  const total = list.length
  const mastered = list.filter(w => w.mastery >= 4).length
  const learning = list.filter(w => w.mastery >= 2 && w.mastery < 4).length
  const weak = list.filter(w => w.mastery > 0 && w.mastery < 2).length
  return {
    total,
    mastered,
    learning,
    weak,
    unpracticed: 0
  }
})

interface WordListItem {
  word: string
  meaning: string
  phonetic: string
  example?: string
  mastery: number
  count: number
  accuracy: number
  lastPracticeText: string
  status: MasteryStatus
  dueText: string
  weakReason: string
}

const allWordList = computed<WordListItem[]>(() => {
  if (!vocabStore.bookMapData?.words.length) return []

  return vocabStore.bookMapData.words.map(w => {
    const localStat = vocabStore.stats[activeTab.value][w.word]
    const apiStats = w.typeStats
    const mastery = apiStats?.practiceCount
      ? apiStats.mastery
      : (w.byType[activeTab.value] ?? w.mastery)
    const count = apiStats?.practiceCount ?? localStat?.count ?? 0
    const accuracy = apiStats?.practiceCount
      ? apiStats.accuracy
      : (localStat && localStat.count > 0
        ? Math.round((localStat.correctCount / localStat.count) * 100)
        : 0)

    let lastPracticeText = STATUS_LABELS[w.status]
    if (w.status === 'unpracticed') {
      lastPracticeText = '未练习'
    } else if (w.lastPractice) {
      lastPracticeText = formatTimeAgo(new Date(w.lastPractice).getTime())
    } else if (localStat?.lastPractice) {
      lastPracticeText = formatTimeAgo(localStat.lastPractice)
    }

    const dueText = apiStats?.due ? formatDueDate(apiStats.due) : ''
    const weakReasonLabel = apiStats?.weakReason
      ? WEAK_REASON_LABELS[apiStats.weakReason as WeakReason]
      : ''

    return {
      word: w.word,
      meaning: w.meaning,
      phonetic: '',
      mastery,
      count,
      accuracy,
      lastPracticeText,
      status: w.status,
      dueText,
      weakReason: weakReasonLabel
    }
  }).sort((a, b) => a.mastery - b.mastery)
})

const filteredList = computed(() => {
  if (activeFilter.value === 'all') return allWordList.value
  if (activeFilter.value === 'unpracticed') {
    return allWordList.value.filter(item => item.status === 'unpracticed')
  }
  if (activeFilter.value === 'weak') {
    return allWordList.value.filter(item => item.status === 'unfamiliar')
  }
  if (activeFilter.value === 'mastered') {
    return allWordList.value.filter(item => item.status === 'mastered')
  }
  if (activeFilter.value === 'learning') {
    return allWordList.value.filter(item => item.status === 'learning')
  }
  return allWordList.value
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredList.value.length / PAGE_SIZE))
)

const paginatedList = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredList.value.slice(start, start + PAGE_SIZE)
})

const emptyText = computed(() => {
  if (allWordList.value.length === 0) {
    return '暂无词汇数据'
  }
  const filterLabel = filters.find(f => f.key === activeFilter.value)?.label || ''
  return `暂无「${filterLabel}」词汇`
})

const getTypeCount = (type: string) => {
  if (vocabStore.bookMapData) {
    return vocabStore.bookMapData.words.filter(w => {
      const ts = w.typeStats
      if (ts?.practiceCount) return true
      return (w.byType[type] ?? 0) > 0
    }).length
  }
  return Object.keys(vocabStore.stats[type as TabKey]).length
}

const goPage = (page: number) => {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}

const resetPage = () => {
  currentPage.value = 1
}

const onBookChange = async () => {
  resetPage()
  await reloadMap()
}

const reloadMap = async () => {
  await vocabStore.loadBookMap(vocabStore.currentBookCode, activeTab.value)
}

watch(activeTab, () => {
  resetPage()
  reloadMap()
})

watch(activeFilter, () => {
  resetPage()
})

const showWordDetail = (item: WordListItem) => {
  const extra = [
    item.dueText ? `待复习：${item.dueText}` : '',
    item.weakReason ? `薄弱原因：${item.weakReason}` : ''
  ].filter(Boolean).join('\n')

  uni.showModal({
    title: item.word,
    content: `${item.phonetic}\n\n${item.meaning}\n\n掌握程度: ${getMasteryLabel(item.mastery)}\n练习 ${item.count} 次，正确率 ${item.accuracy}%\n${extra ? extra + '\n\n' : ''}${item.example || ''}`,
    showCancel: false
  })
}

onMounted(async () => {
  vocabStore.loadStats()
  vocabStore.loadTrainingRecords()
  vocabStore.loadSettings()
  await vocabStore.loadBooks()
  await vocabStore.loadServerStats()
  await reloadMap()
})
</script>

<style lang="scss" scoped>
.container {
  padding: 20rpx;
  padding-bottom: 120rpx;
}

.top-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.book-switcher-wrap {
  width: 100%;
  margin-bottom: 0 !important;
}

.tabs {
  display: flex;
  background: white;
  border-radius: 16rpx;
  padding: 10rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 0;
  position: relative;
  border-radius: 12rpx;
  transition: all 0.3s ease;

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

    .tab-text, .tab-icon {
      color: white;
    }

    .tab-badge {
      background: rgba(255, 255, 255, 0.3);
      color: white;
    }
  }
}

.tab-icon {
  font-size: 40rpx;
  margin-bottom: 8rpx;
  color: #999;
}

.tab-text {
  font-size: 26rpx;
  color: #666;
}

.tab-badge {
  position: absolute;
  top: 10rpx;
  right: 20rpx;
  font-size: 20rpx;
  background: #f0f0f0;
  color: #666;
  padding: 3rpx 10rpx;
  border-radius: 20rpx;
  min-width: 32rpx;
  text-align: center;
}

.summary-card {
  display: flex;
  background: white;
  border-radius: 16rpx;
  padding: 25rpx 10rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.summary-value {
  font-size: 40rpx;
  font-weight: 600;
  color: #667eea;
}

.summary-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

.summary-divider {
  width: 1rpx;
  background: #f0f0f0;
  margin: 0 8rpx;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.filter-item {
  flex: 1;
  min-width: 120rpx;
  text-align: center;
  padding: 16rpx 0;
  background: white;
  border-radius: 30rpx;
  font-size: 24rpx;
  color: #666;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

  &.active {
    background: #667eea;
    color: white;
  }
}

.word-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.word-list-scroll {
  max-height: calc(100vh - 520rpx);
}

.word-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.word-card {
  background: white;
  border-radius: 16rpx;
  padding: 25rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.word-header {
  margin-bottom: 15rpx;
}

.word-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
}

.word-text {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.level-badge {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
}

.level-mastered {
  background: #e8f5e9;
  color: #2e7d32;
}

.level-learning {
  background: #e3f2fd;
  color: #1565c0;
}

.level-weak {
  background: #fff3e0;
  color: #e65100;
}

.word-stars {
  display: flex;
  gap: 5rpx;
}

.star {
  font-size: 24rpx;
  color: #ddd;

  &.active {
    color: #ffc107;
  }
}

.word-info {
  display: flex;
  align-items: center;
  gap: 15rpx;
  margin-bottom: 15rpx;
}

.word-phonetic {
  font-size: 26rpx;
  color: #999;
  font-style: italic;
}

.word-meaning {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.word-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.weak-reason {
  font-size: 22rpx;
  color: #e65100;
  background: #fff3e0;
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
}

.due-text {
  font-size: 22rpx;
  color: #667eea;
  background: #eef2ff;
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
}

.word-footer {
  display: flex;
  justify-content: space-between;
}

.practice-count {
  font-size: 24rpx;
  color: #999;
}

.last-practice {
  font-size: 24rpx;
  color: #999;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 8rpx;
  background: white;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
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
  flex: 1;
  text-align: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 40rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 30rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #666;
  margin-bottom: 15rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: #999;
}
</style>
