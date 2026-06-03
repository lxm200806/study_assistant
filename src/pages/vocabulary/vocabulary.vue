<template>
  <view class="container">
    <view class="top-bar">
      <scroll-view scroll-x class="book-scroll">
        <view
          v-for="book in vocabStore.books"
          :key="book.code"
          :class="['book-chip', vocabStore.currentBookCode === book.code ? 'active' : '']"
          @tap="selectBook(book.code)"
        >
          <text>{{ book.name }}</text>
        </view>
      </scroll-view>
      <view class="map-btn" @tap="goToMap">
        <text>📊 图谱</text>
      </view>
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

    <view v-if="wordList.length > 0" class="word-list">
      <view 
        v-for="item in wordList" 
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
        <view class="word-footer">
          <text class="practice-count">练习 {{ item.count }} 次 · 正确率 {{ item.accuracy }}%</text>
          <text class="last-practice">{{ item.lastPracticeText }}</text>
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
import { formatTimeAgo } from '@/utils'
import { getMasteryLabel, getMasteryLevel } from '@/utils/mastery'
import { STATUS_LABELS } from '@/types/map'

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
  { key: 'weak', label: '需加强' }
] as const

type TabKey = typeof tabs[number]['key']
type FilterKey = typeof filters[number]['key']

const activeTab = ref<TabKey>('listening')
const activeFilter = ref<FilterKey>('all')

const activeTabLabel = computed(() => {
  return tabs.find(t => t.key === activeTab.value)?.label || ''
})

const currentStats = computed(() => {
  if (vocabStore.bookMapData) {
    const s = vocabStore.bookMapData.summary
    return {
      total: s.practiced ?? (s.mastered + s.learning + s.unfamiliar),
      mastered: s.mastered,
      learning: s.learning,
      weak: s.unfamiliar + s.unpracticed,
      avgMastery: 0
    }
  }

  const words = vocabStore.stats[activeTab.value]
  const list = Object.values(words)
  const total = list.length
  const mastered = list.filter(w => w.mastery >= 4).length
  const learning = list.filter(w => w.mastery >= 2 && w.mastery < 4).length
  const weak = list.filter(w => w.mastery < 2).length
  const avgMastery = total > 0
    ? Math.round(list.reduce((sum, w) => sum + w.mastery, 0) / total)
    : 0
  return { total, mastered, learning, weak, avgMastery }
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
}

const allWordList = computed<WordListItem[]>(() => {
  if (vocabStore.bookMapData?.words.length) {
    return vocabStore.bookMapData.words.map(w => {
      const localStat = vocabStore.stats[activeTab.value][w.word]
      const typeMastery = w.byType[activeTab.value] ?? w.mastery
      const count = localStat?.count || 0
      const accuracy = localStat && localStat.count > 0
        ? Math.round((localStat.correctCount / localStat.count) * 100)
        : 0

      return {
        word: w.word,
        meaning: w.meaning,
        phonetic: '',
        mastery: typeMastery,
        count,
        accuracy,
        lastPracticeText: w.status === 'unpracticed'
          ? '未练习'
          : (localStat?.lastPractice ? formatTimeAgo(localStat.lastPractice) : STATUS_LABELS[w.status])
      }
    }).sort((a, b) => a.mastery - b.mastery)
  }

  return []
})

const wordList = computed(() => {
  if (activeFilter.value === 'all') return allWordList.value
  if (activeFilter.value === 'weak') {
    return allWordList.value.filter(item =>
      getMasteryLevel(item.mastery) === 'weak' || item.lastPracticeText === '未练习'
    )
  }
  return allWordList.value.filter(item => getMasteryLevel(item.mastery) === activeFilter.value)
})

const emptyText = computed(() => {
  if (allWordList.value.length === 0) {
    return `暂无词汇数据`
  }
  const filterLabel = filters.find(f => f.key === activeFilter.value)?.label || ''
  return `暂无「${filterLabel}」词汇`
})

const getTypeCount = (type: string) => {
  if (vocabStore.bookMapData) {
    return vocabStore.bookMapData.words.filter(w => (w.byType[type] ?? 0) > 0).length
  }
  return Object.keys(vocabStore.stats[type as TabKey]).length
}

const selectBook = async (code: string) => {
  vocabStore.setCurrentBook(code)
  await reloadMap()
}

const reloadMap = async () => {
  await vocabStore.loadBookMap(vocabStore.currentBookCode, activeTab.value)
}

const goToMap = () => {
  uni.navigateTo({
    url: `/pages/vocabulary-map/vocabulary-map?book=${vocabStore.currentBookCode}`
  })
}

watch(activeTab, () => {
  reloadMap()
})

const showWordDetail = (item: WordListItem) => {
  uni.showModal({
    title: item.word,
    content: `${item.phonetic}\n\n${item.meaning}\n\n掌握程度: ${getMasteryLabel(item.mastery)}\n练习 ${item.count} 次，正确率 ${item.accuracy}%\n\n${item.example || ''}`,
    showCancel: false
  })
}

onMounted(async () => {
  vocabStore.loadStats()
  vocabStore.loadTrainingRecords()
  vocabStore.loadSettings()
  await vocabStore.loadBooks()
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

.book-scroll {
  flex: 1;
  white-space: nowrap;
}

.book-chip {
  display: inline-block;
  padding: 14rpx 24rpx;
  margin-right: 12rpx;
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

.map-btn {
  padding: 14rpx 24rpx;
  background: #eef2ff;
  border-radius: 30rpx;
  font-size: 24rpx;
  color: #667eea;
  flex-shrink: 0;
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
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.filter-item {
  flex: 1;
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
