<template>
  <view class="desk">
    <view v-if="!book" class="empty">未找到该册</view>
    <template v-else>
      <view class="hero">
        <view class="hero-top">
          <text class="eyebrow">{{ book.seriesLabel || '课本' }}</text>
          <text class="switch-book" @tap="openCatalog">换课本</text>
        </view>
        <text class="title">{{ book.shortLabel || book.level }}</text>
        <text class="lede">{{ book.name }}。点进单元可看课文与单词。</text>
      </view>

      <view class="mode-bar">
        <text class="mode-label">课文来源</text>
        <view class="seg">
          <view :class="['seg-item', mode === 'authored' ? 'on' : '']" @tap="setMode('authored')">自编</view>
          <view :class="['seg-item', mode === 'textbook' ? 'on' : '']" @tap="setMode('textbook')">原文</view>
        </view>
      </view>
      <text v-if="mode === 'textbook'" class="mode-hint">
        原文来自本机课本库（npm run kb:import）；未填入的单元不能开练。
      </text>

      <view v-for="unit in book.units" :key="unit.id" class="unit" @tap="openUnit(unit.id)">
        <view class="unit-head">
          <text class="unit-no">{{ unit.id.toUpperCase() }}</text>
          <view class="unit-copy">
            <text class="unit-title">{{ unit.title }}</text>
            <text class="unit-theme">
              {{ unit.theme }} · {{ unit.words.length }} 词 ·
              {{ passageCount(unit) }} 篇{{ mode === 'textbook' ? '原文' : '自编' }}
              <text v-if="mode === 'textbook' && !readyCount(unit)">（未填入）</text>
            </text>
          </view>
          <text class="chevron">›</text>
        </view>
        <view class="actions" @tap.stop>
          <button class="btn ghost" @tap="openUnit(unit.id)">查看内容</button>
          <button class="btn ghost" @tap="startPassage(unit)">课文练习</button>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { usePepTextMode } from '@/composables/usePepTextMode'
import { requireSubject } from '@/utils/subject'
import { openPage } from '@/utils/navigation'
import { getPepBook, type PepUnit } from '@/data/primary/load'
import { rememberPrimaryBook, rememberPrimaryUnit } from '@/utils/primary-session'

const { mode, setMode } = usePepTextMode()
const code = ref('pep-g3a-2024')
const book = computed(() => getPepBook(code.value))

onLoad((query) => {
  code.value = String(query?.code || 'pep-g3a-2024')
  rememberPrimaryBook(code.value)
})

onShow(async () => {
  if (!(await requireSubject('english', 'student'))) return
})

function activePassages(unit: PepUnit) {
  return mode.value === 'textbook' ? unit.textbookPassages || [] : unit.authoredPassages || unit.passages || []
}

function passageCount(unit: PepUnit) {
  return activePassages(unit).length
}

function readyCount(unit: PepUnit) {
  return activePassages(unit).filter(p => p.ready || !!(p.body || '').trim()).length
}

function openCatalog() {
  openPage('/pages/primary/index')
}

function openUnit(id: string) {
  rememberPrimaryUnit(code.value, id)
  openPage(`/pages/primary/unit?code=${encodeURIComponent(code.value)}&id=${encodeURIComponent(id)}`)
}

function startPassage(unit: PepUnit) {
  const list = activePassages(unit).filter(p => p.ready || !!(p.body || '').trim())
  if (!list.length) {
    uni.showToast({ title: mode.value === 'textbook' ? '原文尚未填入' : '暂无课文', icon: 'none' })
    return
  }
  rememberPrimaryUnit(code.value, unit.id)
  openPage(
    `/pages/typing/typing?lane=article&article=${encodeURIComponent(`builtin:${list[0].key}`)}&autoStart=1&book=${encodeURIComponent(code.value)}`
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
.hero { margin-bottom: 20px; }
.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.eyebrow {
  display: block;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--pc-text-3, #8a8175);
}
.switch-book {
  font-size: 13px;
  color: var(--pc-accent, #0f6e6a);
  cursor: pointer;
  flex: 0 0 auto;
}
.title { display:block; font-size:32px; font-weight:700; line-height:1.2; margin-bottom:8px; }
.lede, .mode-hint, .empty { display:block; font-size:14px; color:var(--pc-text-2,#5c5348); line-height:1.5; }
.mode-bar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
.mode-label { font-size:14px; color:var(--pc-text-2,#5c5348); }
.seg { display:flex; background:var(--pc-surface,rgba(31,26,20,0.06)); border-radius:8px; padding:3px; }
.seg-item { padding:6px 14px; font-size:13px; border-radius:6px; color:var(--pc-text-2,#5c5348); &.on { background:var(--pc-solid,#1f1a14); color:var(--pc-solid-fg,#f4f1ea); } }
.mode-hint { margin-bottom:18px; font-size:12px; }
.unit { padding:18px 0; border-top:1px solid var(--pc-line,rgba(31,26,20,0.1)); }
.unit-head { display:flex; gap:14px; align-items:flex-start; margin-bottom:14px; }
.unit-no { font-size:12px; letter-spacing:0.08em; color:var(--pc-text-3,#8a8175); padding-top:4px; min-width:28px; }
.unit-copy { flex:1; min-width:0; }
.unit-title { display:block; font-size:18px; font-weight:600; }
.unit-theme { display:block; margin-top:4px; font-size:13px; color:var(--pc-text-2,#5c5348); }
.chevron { font-size:22px; color:var(--pc-text-3,#8a8175); line-height:1.2; padding-top:2px; }
.actions { display:flex; gap:10px; flex-wrap:wrap; }
.btn { margin:0; padding:0 18px; height:36px; line-height:36px; font-size:14px; border-radius:8px; border:none;
  &::after { border:none; }
  &.primary { background:var(--pc-solid,#1f1a14); color:var(--pc-solid-fg,#f4f1ea); }
  &.ghost { background:var(--pc-surface,rgba(31,26,20,0.06)); color:var(--pc-text,#1f1a14); }
}
</style>
