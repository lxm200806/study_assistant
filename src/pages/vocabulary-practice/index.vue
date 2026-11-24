<template>
  <view class="hub">
    <view class="hero">
      <text class="eyebrow">英语 · 词汇练习</text>
      <text class="title">词汇练习</text>
      <text class="lede">按记忆曲线安排复习。词汇书与文章练习各自独立，换书或练课文都不会改变这里的进度。</text>
    </view>

    <view v-if="!hasChosen" class="first-card">
      <text class="first-title">第一次使用，先选一本词汇书</text>
      <text class="first-desc">选好后会记住这本书和进度，下次直接从这里继续。</text>
      <button class="btn primary" @tap="pickBook">选择词汇书</button>
    </view>

    <template v-else>
      <view class="book-card">
        <view class="book-info">
          <text class="book-name">{{ book?.name || '当前词汇书' }}</text>
          <text class="book-meta">
            {{ book?.level || '' }}<template v-if="book"> · {{ book.wordCount }} 词</template>
          </text>
          <text class="book-progress">{{ progressText }}</text>
        </view>
        <text class="swap" @tap="changeBook">换词书</text>
      </view>

      <view class="modes">
        <view
          :class="['mode-card', lastMode === 'recognition' ? 'is-last' : '']"
          @tap="start('recognition')"
        >
          <view class="mode-top">
            <text class="mode-name">认读练习</text>
            <text v-if="lastMode === 'recognition'" class="last-tag">上次</text>
          </view>
          <text class="mode-desc">先学后测，认词义、听音辨词，按记忆曲线复习到期词。</text>
          <text class="mode-go">进入 ›</text>
        </view>

        <view
          :class="['mode-card', lastMode === 'typing' ? 'is-last' : '']"
          @tap="start('typing')"
        >
          <view class="mode-top">
            <text class="mode-name">拼读练习</text>
            <text v-if="lastMode === 'typing'" class="last-tag">上次</text>
          </view>
          <text class="mode-desc">键盘拼写，先跟写再自测，练手写与听写，同样按记忆曲线复习。</text>
          <text class="mode-go">进入 ›</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useVocabularyStore } from '@/stores/vocabulary'
import { requireSubject } from '@/utils/subject'
import { openPage } from '@/utils/navigation'

type PracticeMode = 'recognition' | 'typing'

const MODE_KEY = 'vocabPracticeMode'

const vocabStore = useVocabularyStore()
const hasChosen = ref(false)
const lastMode = ref<PracticeMode | ''>('')

const book = computed(() => vocabStore.getCurrentBook)
const progressText = computed(() => {
  const progress = vocabStore.bookProgress
  if (!progress?.wordCount) return '还没有学习进度'
  const pct = Math.round((progress.practicedCount / progress.wordCount) * 100)
  const due = vocabStore.dueCount?.dueCount || 0
  const dueText = due ? ` · 到期 ${due}` : ''
  return `已学 ${progress.practicedCount}/${progress.wordCount}（${pct}%）${dueText}`
})

onShow(async () => {
  if (!(await requireSubject('english', 'student'))) return
  hasChosen.value = !!readChosenBook()
  lastMode.value = readLastMode()
  vocabStore.loadSettings()
  await vocabStore.loadBooks()
  if (!hasChosen.value) return
  await vocabStore.loadBookProgress()
  await vocabStore.loadDueCount(vocabStore.currentBookCode, 'reading')
})

function readChosenBook() {
  const raw = uni.getStorageSync('currentBookCode')
  return typeof raw === 'string' ? raw.trim() : ''
}

function readLastMode(): PracticeMode | '' {
  const raw = uni.getStorageSync(MODE_KEY)
  return raw === 'recognition' || raw === 'typing' ? raw : ''
}

function pickBook() {
  uni.setStorageSync('pickVocabularyBook', '1')
  uni.switchTab({ url: '/pages/books/books' })
}

function changeBook() {
  uni.setStorageSync('pickVocabularyBook', '1')
  uni.switchTab({ url: '/pages/books/books' })
}

function start(mode: PracticeMode) {
  if (!hasChosen.value) {
    uni.showToast({ title: '请先选择词汇书', icon: 'none' })
    pickBook()
    return
  }
  uni.setStorageSync(MODE_KEY, mode)
  lastMode.value = mode
  openPage(mode === 'recognition' ? '/pages/recognition/recognition' : '/pages/typing/typing')
}
</script>

<style scoped lang="scss">
.hub {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 28px 22px 80px;
  max-width: 720px;
  margin: 0 auto;
  background: var(--pc-main-bg, #f4f1ea);
  color: var(--pc-text, #1f1a14);
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif;
}

.hero {
  margin-bottom: 20px;
}

.eyebrow {
  display: block;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--pc-text-3, #8a8175);
  margin-bottom: 8px;
}

.title {
  display: block;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 8px;
}

.lede,
.first-desc,
.book-meta,
.book-progress,
.mode-desc {
  display: block;
  font-size: 14px;
  line-height: 1.55;
  color: var(--pc-text-2, #5c5348);
}

.first-card,
.book-card,
.mode-card {
  background: var(--pc-surface-2, #fff);
  border: 1px solid var(--pc-line, rgba(31, 26, 20, 0.1));
  border-radius: 14px;
}

.first-card {
  padding: 24px 20px;
}

.first-title {
  display: block;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
}

.first-desc {
  margin-bottom: 16px;
}

.book-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  margin-bottom: 16px;
}

.book-info {
  min-width: 0;
}

.book-name {
  display: block;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
}

.book-meta {
  margin-top: 4px;
  font-size: 13px;
}

.book-progress {
  margin-top: 6px;
  font-size: 13px;
  color: var(--pc-accent, #0f6e6a);
}

.swap {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--pc-accent, #0f6e6a);
  cursor: pointer;
  padding: 4px 0;
}

.modes {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mode-card {
  padding: 20px;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.mode-card.is-last {
  border-color: var(--pc-accent, #0f6e6a);
}

.mode-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.mode-name {
  font-size: 18px;
  font-weight: 600;
}

.last-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--pc-accent-soft, #e7f3ef);
  color: var(--pc-accent, #0f6e6a);
}

.mode-go {
  display: block;
  margin-top: 10px;
  font-size: 13px;
  color: var(--pc-accent, #0f6e6a);
}

.btn {
  margin: 0;
  padding: 0 18px;
  height: 38px;
  line-height: 38px;
  font-size: 14px;
  border-radius: 8px;
  border: none;

  &::after {
    border: none;
  }

  &.primary {
    background: var(--pc-solid, #1f1a14);
    color: var(--pc-solid-fg, #f4f1ea);
  }
}
</style>
