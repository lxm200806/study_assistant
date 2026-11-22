<template>
  <view class="desk">
    <view v-if="!unit" class="empty">未找到该单元</view>
    <template v-else>
      <view class="hero">
        <text class="eyebrow">{{ book?.name }}</text>
        <text class="title">{{ unit.title }}</text>
        <text class="lede">{{ unit.theme }} · {{ unit.words.length }} 词</text>
      </view>

      <view class="mode-bar">
        <text class="mode-label">课文来源</text>
        <view class="seg">
          <view
            :class="['seg-item', mode === 'authored' ? 'on' : '']"
            @tap="setMode('authored')"
          >自编</view>
          <view
            :class="['seg-item', mode === 'textbook' ? 'on' : '']"
            @tap="setMode('textbook')"
          >原文</view>
        </view>
      </view>

      <view class="actions">
        <button class="btn primary" @tap="startVocab">词汇练习</button>
        <button class="btn ghost" @tap="startPassage" :disabled="!articleId">课文练习</button>
      </view>

      <view class="section">
        <text class="section-title">{{ mode === 'textbook' ? '教材原文' : '自编课文' }}</text>
        <text class="section-note">
          <template v-if="mode === 'textbook'">
            <template v-if="activePassages.some(p => isReady(p))">
              本地已填入原文（个人课本库）；仓库不收录教材原文。
            </template>
            <template v-else>
              槽位已预留；正文需授权后写入本地文件，仓库不收录教材原文。
            </template>
          </template>
          <template v-else>自编口语短文，非教材原文</template>
        </text>

        <view v-if="!activePassages.length" class="empty-block">本单元暂无课文</view>
        <view v-for="passage in activePassages" :key="passage.key" class="passage">
          <view class="passage-head">
            <text class="passage-title">{{ passage.title }}</text>
            <text v-if="!isReady(passage)" class="badge">未填入</text>
          </view>
          <text class="passage-source">{{ passage.source }}</text>
          <view v-if="isReady(passage)" class="lines">
            <view v-for="(line, i) in passageLines(passage)" :key="i" class="line">
              <text class="en">{{ line.en }}</text>
              <text v-if="line.zh" class="zh">{{ line.zh }}</text>
            </view>
          </view>
          <text v-else class="empty-block">尚无正文。取得授权后填入本地原文文件即可在此显示并练习。</text>
        </view>
      </view>

      <view class="section">
        <text class="section-title">单词</text>
        <text class="section-note">本单元词表 {{ unit.words.length }} 个</text>
        <view class="word-list">
          <view v-for="item in unit.words" :key="item.word" class="word-row">
            <view class="word-main">
              <text class="word">{{ item.word }}</text>
              <text v-if="item.phonetic" class="phonetic">{{ item.phonetic }}</text>
            </view>
            <text class="meaning">{{ item.meaning || '—' }}</text>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useVocabularyStore } from '@/stores/vocabulary'
import { usePepTextMode } from '@/composables/usePepTextMode'
import { requireSubject } from '@/utils/subject'
import { openPage } from '@/utils/navigation'
import { getPepBook, type PepPassage } from '@/data/primary/load'

const vocabStore = useVocabularyStore()
const { mode, setMode } = usePepTextMode()
const code = ref('pep-g3a-2024')
const unitId = ref('')

const book = computed(() => getPepBook(code.value))
const unit = computed(() => book.value?.units.find(u => u.id === unitId.value) || null)

const activePassages = computed(() => {
  if (!unit.value) return [] as PepPassage[]
  return mode.value === 'textbook'
    ? unit.value.textbookPassages || []
    : unit.value.authoredPassages || unit.value.passages || []
})

const articleId = computed(() => {
  const ready = activePassages.value.find(p => isReady(p))
  return ready ? `builtin:${ready.key}` : ''
})

onLoad((query) => {
  code.value = String(query?.code || 'pep-g3a-2024')
  unitId.value = String(query?.id || query?.unit || '')
})

onShow(async () => {
  if (!(await requireSubject('english', 'student'))) return
  await vocabStore.loadBooks()
})

function isReady(passage: PepPassage) {
  return !!(passage.ready || (passage.body || '').trim())
}

function passageLines(passage: PepPassage) {
  const en = passage.body.split(/\n+/).map(s => s.trim()).filter(Boolean)
  const zh = (passage.translation || '').split(/\n+/).map(s => s.trim()).filter(Boolean)
  return en.map((line, i) => ({ en: line, zh: zh[i] || '' }))
}

function startVocab() {
  if (!unit.value || !book.value) return
  // 不改认读/拼读的 currentBook；仅通过 URL 临时指定文章用书
  openPage(
    `/pages/recognition/recognition?autoStart=1&flow=unit&unit=${encodeURIComponent(unit.value.id)}&book=${encodeURIComponent(book.value.code)}`
  )
}

function startPassage() {
  if (!articleId.value || !book.value) {
    uni.showToast({
      title: mode.value === 'textbook' ? '原文尚未填入' : '暂无课文',
      icon: 'none'
    })
    return
  }
  openPage(
    `/pages/typing/typing?lane=article&article=${encodeURIComponent(articleId.value)}&autoStart=1&book=${encodeURIComponent(book.value.code)}`
  )
}
</script>

<style lang="scss" scoped>
.desk {
  min-height: 100vh;
  background: var(--pc-main-bg, #f4f1ea);
  color: var(--pc-text, #1f1a14);
  padding: 28px 22px 80px;
  max-width: 720px;
  margin: 0 auto;
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif;
}

.hero {
  margin-bottom: 16px;
}

.eyebrow {
  display: block;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--pc-text-3, #8a8175);
  margin-bottom: 8px;
}

.title {
  display: block;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.25;
  margin-bottom: 8px;
}

.lede,
.section-note,
.empty,
.empty-block,
.passage-source {
  display: block;
  font-size: 13px;
  color: var(--pc-text-2, #5c5348);
  line-height: 1.5;
}

.mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.mode-label {
  font-size: 14px;
  color: var(--pc-text-2, #5c5348);
}

.seg {
  display: flex;
  background: var(--pc-surface, rgba(31, 26, 20, 0.06));
  border-radius: 8px;
  padding: 3px;
}

.seg-item {
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 6px;
  color: var(--pc-text-2, #5c5348);

  &.on {
    background: var(--pc-solid, #1f1a14);
    color: var(--pc-solid-fg, #f4f1ea);
  }
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 28px;
}

.btn {
  margin: 0;
  padding: 0 18px;
  height: 36px;
  line-height: 36px;
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

  &.ghost {
    background: var(--pc-surface, rgba(31, 26, 20, 0.06));
    color: var(--pc-text, #1f1a14);
  }

  &[disabled] {
    opacity: 0.45;
  }
}

.section {
  padding-top: 8px;
  margin-bottom: 28px;
  border-top: 1px solid var(--pc-line, rgba(31, 26, 20, 0.1));
}

.section-title {
  display: block;
  margin-top: 18px;
  font-size: 18px;
  font-weight: 650;
}

.section-note {
  margin: 6px 0 14px;
}

.passage {
  margin-bottom: 22px;
}

.passage-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.passage-title {
  font-size: 16px;
  font-weight: 600;
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--pc-surface, rgba(31, 26, 20, 0.08));
  color: var(--pc-text-3, #8a8175);
}

.passage-source {
  margin-bottom: 12px;
}

.lines {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.line {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.en {
  font-size: 16px;
  line-height: 1.45;
}

.zh {
  font-size: 13px;
  color: var(--pc-text-2, #5c5348);
  line-height: 1.4;
}

.word-list {
  display: flex;
  flex-direction: column;
}

.word-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--pc-line, rgba(31, 26, 20, 0.08));
}

.word-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.word {
  font-size: 16px;
  font-weight: 600;
}

.phonetic {
  font-size: 12px;
  color: var(--pc-text-3, #8a8175);
}

.meaning {
  flex: 1;
  text-align: right;
  font-size: 14px;
  color: var(--pc-text-2, #5c5348);
  line-height: 1.4;
}
</style>
