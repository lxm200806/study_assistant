<template>
  <!-- Chinese coverage stays simple -->
  <view v-if="userStore.isChinese" class="atlas-page">
    <view class="atlas-shell">
      <text class="eyebrow">覆盖</text>
      <text class="display">全库覆盖</text>
      <text class="lede">同一成语可出现在多册，全局词条不重复。</text>
      <view class="desk-card">
        <text>词条 {{ chineseCoverage.entryCount || 0 }} · 卡片 {{ chineseCoverage.total || 0 }}</text>
        <text class="lede-sm">已组课 {{ chineseCoverage.inCourse || 0 }} · 学过 {{ chineseCoverage.studiedEntries || chineseCoverage.studied || 0 }}</text>
      </view>
      <view v-for="item in chineseCoverage.byEntryGrade || chineseCoverage.byGrade || []" :key="item.grade" class="desk-card">
        <text>{{ item.grade }} · 词条 {{ item.entries || item.total }} · 已组课 {{ item.in_course || 0 }}</text>
      </view>
    </view>
  </view>

  <!-- English atlas — desktop web layout (词光图鉴) -->
  <view v-else class="atlas-page">
    <view class="atlas-shell">
      <header class="atlas-head">
        <view class="atlas-head-copy">
          <text class="eyebrow">图鉴 · {{ wordCountLabel }}</text>
          <text class="display">每个词，
都有一幅画。</text>
          <text class="lede">
            {{ ledeText }}
          </text>
          <view class="head-tools">
            <view class="scope-seg">
              <text :class="['seg', scope === 'book' ? 'is-on' : '']" @tap="switchScope('book')">本书</text>
              <text :class="['seg', scope === 'global' ? 'is-on' : '']" @tap="switchScope('global')">全局</text>
            </view>
            <view v-if="scope === 'book'" class="book-slot">
              <BookSwitcher compact :show-due="false" @change="onBookChange" />
            </view>
          </view>
        </view>
        <view class="search">
          <text class="search-ico">⌕</text>
          <input
            class="search-input"
            v-model="query"
            type="text"
            confirm-type="search"
            placeholder="搜索单词或中文释义"
            :adjust-position="false"
          />
          <text v-if="query" class="search-clear" @tap="query = ''">×</text>
        </view>
      </header>

      <view v-if="loading" class="state">加载中…</view>

      <template v-else-if="mapData">
        <view class="filters">
          <view class="chips">
            <text
              :class="['chip-btn', !topic ? 'is-on' : '']"
              @tap="topic = ''"
            >所有主题</text>
            <text
              v-for="t in topicOptions"
              :key="t.key"
              :class="['chip-btn', topic === t.key ? 'is-on' : '']"
              @tap="topic = topic === t.key ? '' : t.key"
            >{{ t.label }}</text>
          </view>

          <view class="coverage" v-if="scopeSummary.total">
            <text class="coverage-title">{{ scopeSummary.title }}</text>
            <text>共 {{ scopeSummary.total }} 词</text>
            <text>认识掌握 {{ scopeSummary.recognize }}（{{ scopeSummary.recognizeRate }}%）</text>
            <text>会写掌握 {{ scopeSummary.write }}（{{ scopeSummary.writeRate }}%）</text>
            <text>两项都掌握 {{ scopeSummary.both }}（{{ scopeSummary.bothRate }}%）</text>
            <text>在学 {{ scopeSummary.learning }}</text>
            <text>未练 {{ scopeSummary.fresh }}</text>
          </view>

          <view class="filters-row">
            <view class="segmented">
              <text
                v-for="s in statusOptions"
                :key="s.key"
                :class="['seg-btn', status === s.key ? 'is-on' : '']"
                @tap="status = s.key"
              >{{ s.label }}</text>
            </view>
            <text class="result-count">{{ resultLabel }}</text>
            <view class="segmented segmented-icons">
              <text :class="['ico', view === 'grid' ? 'is-on' : '']" @tap="view = 'grid'">▦</text>
              <text :class="['ico', view === 'list' ? 'is-on' : '']" @tap="view = 'list'">☰</text>
            </view>
          </view>
        </view>

        <WordHeatmapGrid
          :words="pagedWords"
          :view="view"
          @select="showWord"
        />

        <view v-if="pageCount > 1" class="pager">
          <text
            :class="['pager-btn', page <= 1 ? 'is-disabled' : '']"
            @tap="goPage(page - 1)"
          >上一页</text>
          <text class="pager-info">第 {{ page }} / {{ pageCount }} 页 · 每页 {{ PAGE_SIZE }} 词</text>
          <text
            :class="['pager-btn', page >= pageCount ? 'is-disabled' : '']"
            @tap="goPage(page + 1)"
          >下一页</text>
        </view>
      </template>

      <view v-else class="state">
        <text>{{ loadError || '暂无数据，请先登录并选择角色' }}</text>
        <text class="retry" @tap="loadMap">重试</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { onLoad, onShow, onHide } from '@dcloudio/uni-app'
import { consumeMapTabBook } from '@/utils/navigation'
import { useVocabularyStore } from '@/stores/vocabulary'
import { useUserStore } from '@/stores/user'
import { chineseAPI } from '@/utils/api'
import { applyAppShell, requireReadySession } from '@/utils/subject'
import type { MapWordEntry, MasteryStatus, VocabularyMapData } from '@/types/map'
import { STATUS_LABELS, TOPIC_LABELS } from '@/types/map'
import BookSwitcher from '@/components/BookSwitcher.vue'
import WordHeatmapGrid from '@/components/map/WordHeatmapGrid.vue'

type StatusFilter = 'all' | 'new' | 'learning' | 'mastered'
type ViewMode = 'grid' | 'list'

const PAGE_SIZE = 120

const vocabStore = useVocabularyStore()
const userStore = useUserStore()
const chineseCoverage = ref<any>({})
const scope = ref<'book' | 'global'>('book')
const selectedBook = ref(vocabStore.currentBookCode || 'mse-ket')
const loading = ref(false)
const loadError = ref('')
const query = ref('')
const topic = ref('')
const status = ref<StatusFilter>('all')
const view = ref<ViewMode>('grid')
const page = ref(1)

const statusOptions: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'new', label: '未学' },
  { key: 'learning', label: '学习中' },
  { key: 'mastered', label: '已掌握' }
]

const mapData = computed<VocabularyMapData | null>(() => {
  if (scope.value === 'global') return vocabStore.globalMapData
  return vocabStore.bookMapData
})

const wordCountLabel = computed(() => {
  const n = mapData.value?.words?.length || mapData.value?.book?.wordCount || 0
  return `${n.toLocaleString()} 词`
})

const ledeText = computed(() => {
  const book = mapData.value?.book?.name
  const topics = topicOptions.value.length
  const bits = [
    book ? `当前词书「${book}」` : '全部词书',
    topics ? `${topics} 个主题` : '',
    '下面一行数字跟着当前词书或主题变'
  ].filter(Boolean)
  return bits.join(' · ')
})

const topicOptions = computed(() => {
  const words = mapData.value?.words || []
  const keys = [...new Set(words.map(w => w.topic).filter(Boolean))] as string[]
  return keys.map(key => ({
    key,
    label: TOPIC_LABELS[key] || key
  }))
})

const scopeWords = computed(() => {
  const words = mapData.value?.words || []
  if (!topic.value) return words
  return words.filter((w) => w.topic === topic.value)
})

function rate(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

const scopeSummary = computed(() => {
  const words = scopeWords.value
  const total = words.length
  const recognize = words.filter((w) => (w.recognize ?? 0) >= 4).length
  const write = words.filter((w) => (w.write ?? 0) >= 4).length
  const both = words.filter((w) => w.status === 'mastered').length
  const learning = words.filter((w) => w.status === 'learning' || w.status === 'unfamiliar').length
  const fresh = words.filter((w) => w.status === 'unpracticed').length
  const topicLabel = topic.value ? (TOPIC_LABELS[topic.value] || topic.value) : ''
  const bookName = mapData.value?.book?.name
  const title = topicLabel || bookName || (scope.value === 'global' ? '全部词书' : '当前词书')
  return {
    title,
    total,
    recognize,
    write,
    both,
    learning,
    fresh,
    recognizeRate: rate(recognize, total),
    writeRate: rate(write, total),
    bothRate: rate(both, total)
  }
})

const filteredWords = computed(() => {
  const words = mapData.value?.words || []
  const q = query.value.trim().toLowerCase()
  return words.filter((w) => {
    if (topic.value && w.topic !== topic.value) return false
    if (status.value === 'new' && w.status !== 'unpracticed') return false
    if (status.value === 'learning' && w.status !== 'learning' && w.status !== 'unfamiliar') return false
    if (status.value === 'mastered' && w.status !== 'mastered') return false
    if (q) {
      const hay = `${w.word} ${w.meaning}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredWords.value.length / PAGE_SIZE)))

const pagedWords = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredWords.value.slice(start, start + PAGE_SIZE)
})

const resultLabel = computed(() => {
  const total = filteredWords.value.length
  if (!total) return '0 个结果'
  const start = (page.value - 1) * PAGE_SIZE + 1
  const end = Math.min(page.value * PAGE_SIZE, total)
  return `${start.toLocaleString()}–${end.toLocaleString()} / 共 ${total.toLocaleString()} 词`
})

watch([query, topic, status, scope, selectedBook], () => {
  page.value = 1
})

watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

function goPage(next: number) {
  if (next < 1 || next > pageCount.value) return
  page.value = next
  // PC 壳层只滚动 uni-main，window.scrollTo 在那里不起作用
  const scroller = typeof document !== 'undefined' ? document.querySelector('uni-main') : null
  if (scroller) {
    scroller.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    uni.pageScrollTo({ scrollTop: 0, duration: 300 })
  }
}

const loadMap = async () => {
  loading.value = true
  loadError.value = ''
  page.value = 1
  try {
    if (scope.value === 'global') {
      await vocabStore.loadGlobalMap()
    } else {
      await vocabStore.loadBookMap(selectedBook.value)
    }
    const data = scope.value === 'global' ? vocabStore.globalMapData : vocabStore.bookMapData
    if (!data) loadError.value = '图谱加载失败，请确认已选择角色'
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '图谱加载失败'
  } finally {
    loading.value = false
  }
}

const switchScope = async (next: 'book' | 'global') => {
  if (scope.value === next) return
  scope.value = next
  topic.value = ''
  page.value = 1
  await loadMap()
}

const onBookChange = async (code?: string) => {
  if (code) selectedBook.value = code
  topic.value = ''
  page.value = 1
  await loadMap()
}

const showWord = (word: MapWordEntry) => {
  const recognize = word.recognize == null ? '未练' : `${word.recognize}/5`
  const write = word.write == null ? '未练' : `${word.write}/5`
  uni.showModal({
    title: word.word,
    content: `${word.meaning}\n\n认识 ${recognize}\n会写 ${write}\n${word.skillLabel || STATUS_LABELS[word.status as MasteryStatus]}`,
    showCancel: false
  })
}

function enterDesktopChrome() {
  if (typeof uni.hideTabBar === 'function') {
    uni.hideTabBar({ animation: false })
  }
  uni.setNavigationBarColor({
    frontColor: '#000000',
    backgroundColor: '#f6f1e7'
  })
}

function leaveDesktopChrome() {
  applyAppShell()
}

onLoad((queryParams) => {
  if (queryParams?.scope === 'global') scope.value = 'global'
  if (queryParams?.book) selectedBook.value = queryParams.book as string
})

onShow(async () => {
  if (!(await requireReadySession())) return
  enterDesktopChrome()
  uni.setNavigationBarTitle({ title: userStore.isChinese ? '覆盖' : '图鉴' })
  if (userStore.isChinese) {
    try {
      chineseCoverage.value = await chineseAPI.coverage()
    } catch {
      chineseCoverage.value = {}
    }
    return
  }
  const bookFromTab = consumeMapTabBook()
  if (bookFromTab) {
    selectedBook.value = bookFromTab
    vocabStore.setCurrentBook(bookFromTab)
  }
  await loadMap()
})

onHide(() => {
  leaveDesktopChrome()
})

onMounted(async () => {
  if (!(await requireReadySession())) return
  if (userStore.isChinese) return
  // onShow 已负责拉取图鉴数据，这里只做一次性初始化，避免首屏重复请求
  await vocabStore.loadBooks()
  vocabStore.loadSettings()
})
</script>

<style lang="scss" scoped>
.atlas-page {
  --atlas-paper: var(--pc-main-bg, #f6f1e7);
  --atlas-card: #fffdf8;
  --atlas-ink: #1a2035;
  --atlas-ink-2: #434b65;
  --atlas-ink-3: #7a7d8a;
  --atlas-line: rgba(26, 32, 53, 0.1);
  --atlas-line-strong: rgba(26, 32, 53, 0.15);
  --atlas-serif: "Songti SC", "STSong", "Noto Serif SC", Georgia, serif;
  --atlas-sans: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", "Microsoft YaHei", sans-serif;
  --gutter: 28px;

  min-height: 100vh;
  background: var(--atlas-paper);
  color: var(--atlas-ink);
  font-family: var(--atlas-sans);
  padding-bottom: 80px;
}

.atlas-shell {
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: 28px var(--gutter) 64px;
  box-sizing: border-box;
}

.atlas-head {
  display: grid;
  gap: 22px;
  align-items: end;
  margin-bottom: 22px;
}

@media (min-width: 900px) {
  .atlas-head {
    grid-template-columns: 1fr 380px;
  }
}

.eyebrow {
  display: block;
  font: 600 11.5px/1.2 var(--atlas-sans);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--atlas-ink-3);
  margin-bottom: 12px;
}

.display {
  display: block;
  font-family: var(--atlas-serif);
  font-weight: 600;
  font-size: clamp(30px, 4.6vw, 52px);
  line-height: 1.12;
  letter-spacing: -0.02em;
  white-space: pre-line;
}

.lede {
  display: block;
  color: var(--atlas-ink-2);
  font-size: 16px;
  margin-top: 12px;
  max-width: 56ch;
  line-height: 1.55;
}

.lede-sm {
  display: block;
  margin-top: 8px;
  color: var(--atlas-ink-3);
  font-size: 14px;
}

.head-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
}

.scope-seg,
.segmented {
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  background: #eee7d9;
  border-radius: 999px;
  border: 1px solid var(--atlas-line);
}

.seg,
.seg-btn,
.ico {
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--atlas-ink-3);
  line-height: 32px;
  white-space: nowrap;
}

.seg.is-on,
.seg-btn.is-on,
.ico.is-on {
  background: var(--atlas-card);
  color: var(--atlas-ink);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(30, 38, 64, 0.06);
}

.segmented-icons .ico {
  width: 36px;
  padding: 0;
  text-align: center;
}

.book-slot {
  flex: 1;
  min-width: 220px;
  max-width: 420px;
}

.book-slot :deep(.book-switcher) {
  margin-bottom: 0;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--atlas-card);
  border: 1px solid var(--atlas-line-strong);
  box-shadow: none;
}

.book-slot :deep(.book-icon) {
  display: none;
}

.book-slot :deep(.book-name) {
  font-size: 14px;
  color: var(--atlas-ink);
}

.book-slot :deep(.book-meta) {
  font-size: 12px;
  margin-top: 2px;
}

.book-slot :deep(.switch-hint) {
  font-size: 12px;
  color: var(--atlas-ink-3);
}

.search {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 8px 0 18px;
  background: var(--atlas-card);
  border: 1px solid var(--atlas-line-strong);
  border-radius: 999px;
  color: var(--atlas-ink-3);
  box-shadow: 0 1px 2px rgba(30, 38, 64, 0.06);
  box-sizing: border-box;
}

.search-ico {
  font-size: 18px;
  opacity: 0.7;
}

.search-input {
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 16px;
  color: var(--atlas-ink);
  min-width: 0;
  height: 48px;
}

.search-clear {
  width: 32px;
  height: 32px;
  line-height: 30px;
  text-align: center;
  border-radius: 50%;
  font-size: 20px;
  color: var(--atlas-ink-3);
}

.filters {
  display: grid;
  gap: 12px;
  margin-bottom: 22px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 2px 0;
}

.chip-btn {
  display: inline-block;
  height: 34px;
  line-height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--atlas-line-strong);
  background: var(--atlas-card);
  color: var(--atlas-ink-2);
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
}

.chip-btn.is-on {
  background: var(--atlas-ink);
  border-color: var(--atlas-ink);
  color: var(--atlas-paper);
}

.coverage {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 16px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--atlas-card, #fffdf8);
  border: 1px solid var(--atlas-line, rgba(31, 26, 20, 0.08));
  color: var(--atlas-ink-2, #3d4f4d);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.coverage-title {
  font-weight: 650;
  color: var(--atlas-ink, #1f1a14);
}

.filters-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.result-count {
  margin-left: auto;
  color: var(--atlas-ink-3);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.desk-card {
  margin-top: 16px;
  padding: 18px 20px;
  border-radius: 16px;
  background: var(--atlas-card);
  border: 1px solid var(--atlas-line);
  box-shadow: 0 1px 2px rgba(30, 38, 64, 0.05);
}

.state {
  text-align: center;
  padding: 80px 24px;
  color: var(--atlas-ink-3);
  font-size: 15px;
}

.retry {
  display: inline-block;
  margin-top: 16px;
  color: #c4573a;
  font-weight: 600;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: 28px;
  padding: 16px 0 8px;
}

.pager-btn {
  min-width: 88px;
  height: 36px;
  line-height: 34px;
  text-align: center;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--atlas-line-strong);
  background: var(--atlas-card);
  color: var(--atlas-ink);
  font-size: 13.5px;
  font-weight: 600;
}

.pager-btn.is-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.pager-info {
  color: var(--atlas-ink-3);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
</style>
