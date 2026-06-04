<template>
  <view class="container">
    <view class="header">
      <view class="scope-tabs">
        <view
          :class="['scope-tab', scope === 'book' ? 'active' : '']"
          @tap="switchScope('book')"
        >
          <text>本书图谱</text>
        </view>
        <view
          :class="['scope-tab', scope === 'global' ? 'active' : '']"
          @tap="switchScope('global')"
        >
          <text>全局图谱</text>
        </view>
      </view>

      <view v-if="scope === 'book'" class="book-picker">
        <BookSwitcher @change="onBookChange" />
      </view>
    </view>

    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>

    <view v-else-if="mapData" class="map-content">
      <view v-if="scope === 'global' && mapData.summary.totalUniqueWords" class="global-banner">
        <text class="global-stat">总词汇 {{ mapData.summary.totalUniqueWords }}</text>
        <text class="global-stat">已掌握 {{ mapData.summary.masteredWords }}</text>
      </view>

      <view v-if="mapData.book" class="book-title">
        <text>{{ mapData.book.name }} · {{ mapData.book.wordCount }} 词</text>
      </view>

      <MasterySummaryRing :summary="mapData.summary" />

      <CategoryBarChart
        v-if="mapData.byContentType.length > 0"
        :items="mapData.byContentType"
      />

      <TopicWeaknessChart
        v-if="mapData.byTopic.length > 0"
        :topics="mapData.byTopic"
        :weakest-topics="mapData.weakestTopics"
        @practice="startTopicTraining"
      />

      <view class="section-header">
        <text class="section-title">词格热力图</text>
      </view>
      <WordHeatmapGrid :words="mapData.words" />
    </view>

    <view v-else class="empty">
      <text>暂无数据，请先登录并开始训练</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { consumeMapTabBook } from '@/utils/navigation'
import { useVocabularyStore } from '@/stores/vocabulary'
import type { VocabularyMapData } from '@/types/map'
import BookSwitcher from '@/components/BookSwitcher.vue'
import MasterySummaryRing from '@/components/map/MasterySummaryRing.vue'
import CategoryBarChart from '@/components/map/CategoryBarChart.vue'
import TopicWeaknessChart from '@/components/map/TopicWeaknessChart.vue'
import WordHeatmapGrid from '@/components/map/WordHeatmapGrid.vue'

const vocabStore = useVocabularyStore()
const scope = ref<'book' | 'global'>('book')
const selectedBook = ref(vocabStore.currentBookCode || 'ket')
const loading = ref(false)

const mapData = computed<VocabularyMapData | null>(() => {
  if (scope.value === 'global') return vocabStore.globalMapData
  return vocabStore.bookMapData
})

const loadMap = async () => {
  loading.value = true
  try {
    if (scope.value === 'global') {
      await vocabStore.loadGlobalMap()
    } else {
      await vocabStore.loadBookMap(selectedBook.value)
    }
  } finally {
    loading.value = false
  }
}

const switchScope = async (newScope: 'book' | 'global') => {
  scope.value = newScope
  await loadMap()
}

const selectBook = async (code: string) => {
  selectedBook.value = code
  vocabStore.setCurrentBook(code)
  await loadMap()
}

const onBookChange = async (code?: string) => {
  if (code) selectedBook.value = code
  await loadMap()
}

const startTopicTraining = (topic: string) => {
  vocabStore.setSessionTopic(topic)
  vocabStore.setStudySettings({ wordsPerGroup: 10, groupCount: 1, sessionMode: 'smart' })
  uni.navigateTo({ url: `/pages/recognition/recognition?autoStart=1&topic=${topic}` })
}

onLoad((query) => {
  if (query?.scope === 'global') scope.value = 'global'
  if (query?.book) selectedBook.value = query.book as string
})

onShow(async () => {
  const bookFromTab = consumeMapTabBook()
  if (bookFromTab) {
    selectedBook.value = bookFromTab
    vocabStore.setCurrentBook(bookFromTab)
    await loadMap()
  }
})

onMounted(async () => {
  await vocabStore.loadBooks()
  vocabStore.loadSettings()
  await loadMap()
})
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
  padding-bottom: 120rpx;
}

.header {
  margin-bottom: 20rpx;
}

.scope-tabs {
  display: flex;
  background: white;
  border-radius: 16rpx;
  padding: 8rpx;
  margin-bottom: 20rpx;
}

.scope-tab {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #666;

  &.active {
    background: #667eea;
    color: white;
  }
}

.book-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.book-chip {
  padding: 14rpx 24rpx;
  background: white;
  border-radius: 30rpx;
  font-size: 24rpx;
  color: #666;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

  &.active {
    background: #eef2ff;
    color: #667eea;
    font-weight: 500;
  }
}

.global-banner {
  display: flex;
  justify-content: space-around;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.global-stat {
  font-size: 28rpx;
  color: white;
  font-weight: 500;
}

.book-title {
  margin-bottom: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.section-header {
  margin-bottom: 12rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.loading, .empty {
  text-align: center;
  padding: 100rpx 40rpx;
  color: #999;
  font-size: 28rpx;
}
</style>
