<template>
  <view class="container">
    <view class="current-bar" v-if="currentBook">
      <view class="current-text">
        <text class="current-label">当前</text>
        <text class="current-name">{{ currentBook.name }}</text>
        <text class="current-meta">{{ currentBook.level }} · {{ currentBook.wordCount }} 词</text>
      </view>
    </view>

    <view class="filters">
      <view class="filter-row">
        <text class="filter-label">分类</text>
        <view class="chips">
          <text
            v-for="opt in categoryOptions"
            :key="opt.key"
            :class="['chip', category === opt.key ? 'on' : '']"
            @tap="category = opt.key"
          >{{ opt.label }}</text>
        </view>
      </view>
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
    </view>

    <view v-if="!bookGroups.length" class="empty">没有匹配的词书</view>
    <view v-for="group in bookGroups" :key="group.key" class="group">
      <text class="group-title">{{ group.title }}</text>
      <view class="books-grid">
        <view
          v-for="book in group.books"
          :key="book.id"
          :class="['book-card', isSelected(book.code) ? 'selected' : '', isLocked(book) ? 'locked' : '']"
          @tap="selectBook(book)"
        >
          <view class="book-top">
            <text class="book-name">{{ book.name }}</text>
            <text v-if="isSelected(book.code)" class="badge on">✓</text>
            <text v-else-if="isLocked(book)" class="badge lock">锁</text>
          </view>
          <text class="book-level">{{ book.level }}</text>
          <text class="book-count">{{ book.wordCount }} 词</text>
          <text class="book-desc">{{ book.description }}</text>
          <view class="book-actions" @tap.stop>
            <text
              v-if="book.code.startsWith('pep-') || book.code.startsWith('jt-')"
              class="map-link"
              @tap="goPepBook(book.code)"
            >练习</text>
            <text class="map-link" @tap="goToBookMap(book.code)">图谱</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">解释方式</text>
      <view class="options-group">
        <view
          :class="['option-item', vocabStore.meaningType === 'chinese' ? 'selected' : '']"
          @tap="setMeaningType('chinese')"
        >
          <text class="option-label">中文解释</text>
          <text class="option-desc">用中文解释单词含义</text>
          <view v-if="vocabStore.meaningType === 'chinese'" class="check-mark">✓</view>
        </view>
        <view
          :class="['option-item', vocabStore.meaningType === 'english' ? 'selected' : '']"
          @tap="setMeaningType('english')"
        >
          <text class="option-label">英文解释</text>
          <text class="option-desc">用英文解释，练英文思维</text>
          <view v-if="vocabStore.meaningType === 'english'" class="check-mark">✓</view>
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
import { useVocabularyStore, type MeaningType } from '@/stores/vocabulary'
import { openMapTab, openPage } from '@/utils/navigation'
import { isBookAccessible } from '@/composables/useTrainingStart'
import { rememberPrimaryBook } from '@/utils/primary-session'

const vocabStore = useVocabularyStore()

type BookItem = {
  id: string
  code: string
  name: string
  level: string
  description: string
  wordCount: number
  isFree?: boolean
}

const GROUP_DEFS: { key: string; title: string; codes: string[] }[] = [
  {
    key: 'pep',
    title: '人教 PEP',
    codes: [
      'pep-g3a-2024',
      'pep-g3b-2025',
      'pep-g4a-2025',
      'pep-g4b-2026',
      'pep-g5a-2026',
      'pep-g4b-legacy',
      'pep-g5a-legacy',
      'pep-g5b-legacy',
      'pep-g6a-legacy',
      'pep-g6b-legacy'
    ]
  },
  {
    key: 'jt',
    title: '人教精通',
    codes: [
      'jt-g3a-2024',
      'jt-g3b-2025',
      'jt-g4a-2025',
      'jt-g4b',
      'jt-g5a',
      'jt-g5b',
      'jt-g6a',
      'jt-g6b'
    ]
  },
  { key: 'mse', title: '剑桥 MSE', codes: ['mse-ket', 'mse-pet'] },
  { key: 'cn', title: '课标 · 考纲', codes: ['zhongkao', 'gaokao', 'cet4', 'cet6'] },
  { key: 'kew', title: '高频词 KEW', codes: ['kew1200', 'kew4500', 'kew7200'] }
]

const GRADE_ORDER = ['三年级', '四年级', '五年级', '六年级']

const category = ref('全部')
const grade = ref('全部')

const categoryOptions = computed(() => [
  { key: '全部', label: '全部' },
  ...GROUP_DEFS.map(g => ({ key: g.key, label: g.title }))
])

const gradeOptions = computed(() => ['全部', ...GRADE_ORDER])

function gradeOf(book: BookItem): string {
  const level = book.level || ''
  if (/三|g3/i.test(level) || /g3/i.test(book.code)) return '三年级'
  if (/四|g4/i.test(level) || /g4/i.test(book.code)) return '四年级'
  if (/五|g5/i.test(level) || /g5/i.test(book.code)) return '五年级'
  if (/六|g6/i.test(level) || /g6/i.test(book.code)) return '六年级'
  const m = level.match(/小学([三四五代六])/)
  if (m) {
    const map: Record<string, string> = {
      三: '三年级',
      四: '四年级',
      五: '五年级',
      六: '六年级'
    }
    return map[m[1]] || ''
  }
  return ''
}

function matchBook(book: BookItem): boolean {
  if (grade.value !== '全部' && gradeOf(book) !== grade.value) return false
  return true
}

const bookGroups = computed(() => {
  const byCode = new Map(vocabStore.books.map(b => [b.code, b as BookItem]))
  const used = new Set<string>()
  const defs =
    category.value === '全部' ? GROUP_DEFS : GROUP_DEFS.filter(d => d.key === category.value)

  const groups = defs
    .map(def => {
      const books = def.codes
        .map(code => byCode.get(code))
        .filter((b): b is BookItem => !!b)
        .filter(matchBook)
      books.forEach(b => used.add(b.code))
      return { key: def.key, title: def.title, books }
    })
    .filter(g => g.books.length > 0)

  if (category.value === '全部') {
    const rest = (vocabStore.books as BookItem[]).filter(b => !used.has(b.code)).filter(matchBook)
    if (rest.length) groups.push({ key: 'other', title: '其他', books: rest })
  }
  return groups
})

const currentBook = computed(() => vocabStore.getCurrentBook)

const isSelected = (code: string) => vocabStore.currentBookCode === code
const isLocked = (book: BookItem) => !isBookAccessible(book.code, book.isFree)

const selectBook = (book: BookItem) => {
  if (isLocked(book)) {
    uni.showModal({
      title: '词书未解锁',
      content: `「${book.name}」需开通会员，免费用户可使用 KET 词书。`,
      confirmText: '了解会员',
      cancelText: '取消',
      success: (modal) => {
        if (modal.confirm) {
          uni.navigateTo({ url: '/pages/membership/membership' })
        }
      }
    })
    return
  }
  if (book.code === vocabStore.currentBookCode) return
  const prev = vocabStore.getCurrentBook
  const prevName = prev?.name || '当前词书'
  uni.showModal({
    title: '切换词汇练习词书？',
    content: `从「${prevName}」改为「${book.name}」？`,
    confirmText: '确认',
    cancelText: '取消',
    success: (modal) => {
      if (!modal.confirm) return
      vocabStore.setCurrentBook(book.code)
      uni.showToast({ title: `已选择 ${book.name}`, icon: 'success' })
    }
  })
}

const goToBookMap = (code: string) => {
  openMapTab(code)
}

const goPepBook = (code: string) => {
  // 只打开文章课本，不改认读/拼读用的 currentBook
  rememberPrimaryBook(code)
  openPage(`/pages/primary/book?code=${encodeURIComponent(code)}`)
}

const setMeaningType = (type: MeaningType) => {
  vocabStore.setMeaningType(type)
  uni.showToast({
    title: type === 'chinese' ? '已切换为中文解释' : '已切换为英文解释',
    icon: 'success'
  })
}

onShow(async () => {
  if (!(await requireSubject('english', 'any'))) return
  vocabStore.loadBooks()
  vocabStore.loadSettings()
})
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: var(--pc-main-bg, #f4f1ea);
  padding: 24rpx 24rpx 0;
  box-sizing: border-box;
}

.current-bar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16rpx;
  padding: 22rpx 28rpx;
  margin-bottom: 28rpx;
}

.current-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.75);
  margin-right: 12rpx;
}

.current-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  margin-right: 16rpx;
}

.current-meta {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.85);
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
  margin-bottom: 20rpx;
}

.group {
  margin-bottom: 28rpx;
}

.group-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #666;
  display: block;
  margin: 0 4rpx 16rpx;
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
  position: relative;

  &.selected {
    border-color: var(--pc-accent, #0f6e6a);
    background: var(--pc-accent-soft, #e7f3ef);
  }

  &.locked {
    opacity: 0.72;
  }
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

  &.on {
    background: var(--pc-accent, #0f6e6a);
    color: var(--pc-on-accent, #fff);
  }

  &.lock {
    background: var(--pc-surface-1, #f0f0f0);
    color: var(--pc-text-3, #999);
  }
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

.book-desc {
  font-size: 22rpx;
  color: var(--pc-text-3, #999);
  display: block;
  line-height: 1.35;
  min-height: 60rpx;
  overflow: hidden;
}

.book-actions {
  margin-top: 12rpx;
}

.map-link {
  font-size: 22rpx;
  color: var(--pc-accent, #0f6e6a);
  padding: 6rpx 0;
}

.section {
  background: var(--pc-surface-2, #fff);
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  border: 1px solid var(--pc-border, transparent);
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--pc-text, #333);
  display: block;
  margin-bottom: 20rpx;
}

.options-group {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 22rpx;
  background: var(--pc-surface-1, #f8f9fa);
  border-radius: 14rpx;
  border: 2rpx solid transparent;

  &.selected {
    background: var(--pc-accent-soft, #e7f3ef);
    border-color: var(--pc-accent, #0f6e6a);
  }
}

.option-label {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--pc-text, #333);
  margin-right: 12rpx;
  flex-shrink: 0;
}

.option-desc {
  flex: 1;
  font-size: 24rpx;
  color: var(--pc-text-3, #999);
}

.check-mark {
  width: 36rpx;
  height: 36rpx;
  background: var(--pc-accent, #0f6e6a);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pc-on-accent, #fff);
  font-size: 22rpx;
  flex-shrink: 0;
}

.bottom-space {
  height: 140rpx;
}
</style>
