<template>
  <view class="container">
    <view class="hero">
      <text class="hero-title">文章</text>
      <text class="hero-desc">按年级、版本筛选课本，进入单元练词汇与课文。</text>
    </view>

    <view class="filters">
      <view class="filter-row">
        <text class="filter-label">年级</text>
        <view class="chips">
          <text
            v-for="opt in gradeOptions"
            :key="opt"
            :class="['chip', grade === opt ? 'on' : '']"
            @tap="grade = opt"
          >{{ opt }}</text>
        </view>
      </view>
      <view class="filter-row">
        <text class="filter-label">版本</text>
        <view class="chips">
          <text
            v-for="opt in seriesOptions"
            :key="opt.key"
            :class="['chip', series === opt.key ? 'on' : '']"
            @tap="series = opt.key"
          >{{ opt.label }}</text>
        </view>
      </view>
    </view>

    <view v-if="!filteredBooks.length" class="empty">没有匹配的课本</view>
    <view v-else class="books-grid">
      <view
        v-for="item in filteredBooks"
        :key="item.code"
        class="book-card"
        @tap="openBook(item.code)"
      >
        <view class="book-top">
          <text class="book-name">{{ item.name }}</text>
          <text class="badge">{{ item.seriesLabel }}</text>
        </view>
        <text class="book-level">{{ item.grade }}{{ item.term }} · {{ item.year }}</text>
        <text class="book-count">{{ item.unitCount }} 单元 · {{ item.wordCount }} 词</text>
        <view class="book-actions">
          <text class="map-link">进入练习 ›</text>
        </view>
      </view>
    </view>

    <view class="bottom-space"></view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { requireSubject } from '@/utils/subject'
import { openPage } from '@/utils/navigation'
import { listPepBooks } from '@/data/primary/load'

const books = listPepBooks()
const grade = ref('全部')
const series = ref('全部')

const GRADE_ORDER = ['三年级', '四年级', '五年级', '六年级']

const gradeOptions = computed(() => {
  const set = new Set(books.map(b => b.grade).filter(Boolean))
  const ordered = GRADE_ORDER.filter(g => set.has(g))
  const rest = [...set].filter(g => !GRADE_ORDER.includes(g)).sort((a, b) => a.localeCompare(b, 'zh'))
  return ['全部', ...ordered, ...rest]
})

const seriesOptions = computed(() => {
  const map = new Map<string, string>()
  for (const b of books) {
    if (b.series) map.set(b.series, b.seriesLabel || b.series)
  }
  return [
    { key: '全部', label: '全部' },
    ...[...map.entries()].map(([key, label]) => ({ key, label }))
  ]
})

const filteredBooks = computed(() =>
  books.filter(b => {
    if (grade.value !== '全部' && b.grade !== grade.value) return false
    if (series.value !== '全部' && b.series !== series.value) return false
    return true
  })
)

onShow(async () => {
  await requireSubject('english', 'student')
})

function openBook(code: string) {
  openPage(`/pages/primary/book?code=${encodeURIComponent(code)}`)
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: var(--pc-main-bg, #f4f1ea);
  padding: 24rpx 24rpx 0;
  box-sizing: border-box;
}

.hero {
  margin: 8rpx 4rpx 20rpx;
}

.hero-title {
  display: block;
  font-size: 36rpx;
  font-weight: 650;
  color: var(--pc-text, #333);
  margin-bottom: 8rpx;
}

.hero-desc {
  display: block;
  font-size: 24rpx;
  color: var(--pc-text-3, #888);
  line-height: 1.45;
}

.filters {
  margin: 0 4rpx 22rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.filter-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.filter-label {
  flex-shrink: 0;
  width: 64rpx;
  padding-top: 8rpx;
  font-size: 22rpx;
  color: var(--pc-text-3, #888);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  flex: 1;
}

.chip {
  font-size: 22rpx;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: var(--pc-surface-2, #fff);
  color: var(--pc-text-2, #555);
  border: 2rpx solid transparent;
}

.chip.on {
  background: var(--pc-accent-soft, #e7f3ef);
  color: var(--pc-accent, #0f6e6a);
  border-color: var(--pc-accent, #0f6e6a);
  font-weight: 600;
}

.empty {
  padding: 48rpx 12rpx;
  text-align: center;
  font-size: 26rpx;
  color: var(--pc-text-3, #888);
}

.books-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.book-card {
  width: calc(50% - 8rpx);
  box-sizing: border-box;
  background: var(--pc-surface-2, #fff);
  border-radius: 16rpx;
  padding: 22rpx 20rpx 18rpx;
  border: 2rpx solid transparent;
}

.book-top {
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
  margin-bottom: 6rpx;
}

.book-name {
  flex: 1;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--pc-text, #333);
  line-height: 1.3;
}

.badge {
  flex-shrink: 0;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
  line-height: 1.4;
  background: var(--pc-accent-soft, #e7f3ef);
  color: var(--pc-accent, #0f6e6a);
}

.book-level {
  font-size: 22rpx;
  color: var(--pc-accent, #0f6e6a);
  display: block;
  margin-bottom: 4rpx;
}

.book-count {
  font-size: 22rpx;
  color: var(--pc-text-3, #888);
  display: block;
  margin-bottom: 8rpx;
}

.book-actions {
  margin-top: 12rpx;
}

.map-link {
  font-size: 22rpx;
  color: var(--pc-accent, #0f6e6a);
  padding: 6rpx 0;
}

.bottom-space {
  height: 140rpx;
}
</style>
