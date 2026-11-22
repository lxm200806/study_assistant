<template>
  <view class="container">
    <view class="hero">
      <text class="title">主题</text>
      <text class="sub">官方不可改色。米色 / 墨灰已全层适配（卡片、按钮、选中态）；可新增自定义</text>
    </view>

    <view class="section">
      <text class="section-title">日间</text>
      <view class="preset-grid">
        <view
          v-for="preset in dayThemes"
          :key="preset.id"
          :class="['preset-card', activeId === preset.id ? 'is-on' : '']"
          @tap="pick(preset.id)"
        >
          <view class="preview">
            <view class="preview-rail" :style="{ background: preset.palette.railBg }" />
            <view class="preview-main" :style="{ background: preset.palette.mainBg }">
              <view class="preview-card" :style="{ background: preset.palette.surface2 }" />
            </view>
          </view>
          <text class="preset-name">{{ preset.label }}</text>
          <text class="preset-desc">{{ preset.desc }}</text>
          <text class="preset-lock">{{ preset.palette.layered ? '官方 · 全层适配' : '官方 · 基底（分层待细调）' }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">夜间</text>
      <view class="preset-grid">
        <view
          v-for="preset in nightThemes"
          :key="preset.id"
          :class="['preset-card', activeId === preset.id ? 'is-on' : '']"
          @tap="pick(preset.id)"
        >
          <view class="preview">
            <view class="preview-rail" :style="{ background: preset.palette.railBg }" />
            <view class="preview-main" :style="{ background: preset.palette.mainBg }">
              <view class="preview-card" :style="{ background: preset.palette.surface2 }" />
            </view>
          </view>
          <text class="preset-name">{{ preset.label }}</text>
          <text class="preset-desc">{{ preset.desc }}</text>
          <text class="preset-lock">{{ preset.palette.layered ? '官方 · 全层适配' : '官方 · 基底（分层待细调）' }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">我的主题</text>
      <text class="section-hint">自建侧栏色 + 内容区色，可选用或删除</text>

      <view v-if="customs.length" class="custom-list">
        <view
          v-for="item in customs"
          :key="item.id"
          :class="['custom-row', activeId === item.id ? 'is-on' : '']"
        >
          <view class="custom-main" @tap="pick(item.id)">
            <view class="mini-swatch">
              <view class="swatch-rail" :style="{ background: item.railBg }" />
              <view class="swatch-main" :style="{ background: item.mainBg }" />
            </view>
            <view class="custom-meta">
              <text class="custom-name">{{ item.label }}</text>
              <text class="custom-hex">{{ item.railBg }} · {{ item.mainBg }}</text>
            </view>
          </view>
          <text class="custom-del" @tap.stop="remove(item.id)">删除</text>
        </view>
      </view>
      <text v-else class="empty">还没有自定义主题</text>

      <view class="add-box">
        <text class="add-title">新增自定义</text>
        <input class="name-input" type="text" maxlength="20" placeholder="名称" :value="draftLabel" @input="onLabel" />
        <view class="color-row">
          <text class="color-label">左侧标签栏</text>
          <view class="color-controls">
            <input class="color-input" type="color" :value="draftRail" @input="onDraftRail" />
            <input class="hex-input" type="text" maxlength="7" :value="draftRail" @blur="onDraftRailHex" />
          </view>
        </view>
        <view class="color-row">
          <text class="color-label">右侧内容区</text>
          <view class="color-controls">
            <input class="color-input" type="color" :value="draftMain" @input="onDraftMain" />
            <input class="hex-input" type="text" maxlength="7" :value="draftMain" @blur="onDraftMainHex" />
          </view>
        </view>
        <view class="live-preview">
          <view class="live-rail" :style="{ background: draftRail }" />
          <view class="live-main" :style="{ background: draftMain }">
            <view class="live-card" />
          </view>
        </view>
        <view class="add-btn" @tap="add">添加并应用</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  PC_OFFICIAL_THEMES,
  addCustomTheme,
  getThemeBundle,
  normalizeHex,
  removeCustomTheme,
  selectTheme,
  type CustomTheme
} from '@/utils/pc-theme'

const dayThemes = PC_OFFICIAL_THEMES.filter(t => t.group === 'day')
const nightThemes = PC_OFFICIAL_THEMES.filter(t => t.group === 'night')

const activeId = ref('day-paper')
const customs = ref<CustomTheme[]>([])
const draftLabel = ref('我的主题')
const draftRail = ref('#ebe4d8')
const draftMain = ref('#f4f1ea')

function refresh() {
  const bundle = getThemeBundle()
  activeId.value = bundle.activeId
  customs.value = bundle.customs
}

function pick(id: string) {
  const resolved = selectTheme(id)
  activeId.value = resolved.id
  uni.showToast({ title: `已应用「${resolved.label}」`, icon: 'none' })
}

function remove(id: string) {
  uni.showModal({
    title: '删除主题',
    content: '确定删除这个自定义主题？',
    success: (res) => {
      if (!res.confirm) return
      const { bundle, resolved } = removeCustomTheme(id)
      customs.value = bundle.customs
      activeId.value = resolved.id
    }
  })
}

function add() {
  const { bundle, resolved } = addCustomTheme({
    label: draftLabel.value,
    railBg: draftRail.value,
    mainBg: draftMain.value
  })
  customs.value = bundle.customs
  activeId.value = resolved.id
  uni.showToast({ title: '已添加并应用', icon: 'none' })
}

function eventValue(e: { detail?: { value?: string }; target?: { value?: string } }, fallback: string) {
  return e.detail?.value || e.target?.value || fallback
}

function onLabel(e: any) {
  draftLabel.value = eventValue(e, draftLabel.value)
}
function onDraftRail(e: any) {
  draftRail.value = normalizeHex(eventValue(e, draftRail.value), draftRail.value)
}
function onDraftMain(e: any) {
  draftMain.value = normalizeHex(eventValue(e, draftMain.value), draftMain.value)
}
function onDraftRailHex(e: any) {
  draftRail.value = normalizeHex(eventValue(e, draftRail.value), draftRail.value)
}
function onDraftMainHex(e: any) {
  draftMain.value = normalizeHex(eventValue(e, draftMain.value), draftMain.value)
}

onShow(() => refresh())
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  padding: 28rpx 28rpx 80rpx;
  box-sizing: border-box;
}

.hero { margin-bottom: 28rpx; }

.title {
  display: block;
  font-size: 40rpx;
  font-weight: 650;
  color: var(--pc-text, #243028);
  margin-bottom: 8rpx;
}

.sub {
  display: block;
  font-size: 26rpx;
  color: var(--pc-text-2, #6b7280);
  line-height: 1.4;
}

.section {
  background: var(--pc-surface-2);
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--pc-shadow);
  border: 1px solid var(--pc-border);
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--pc-text);
  margin-bottom: 16rpx;
}

.section-hint {
  display: block;
  font-size: 24rpx;
  color: var(--pc-text-3);
  margin: -8rpx 0 20rpx;
}

.preset-grid {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}

.preset-card {
  width: calc(50% - 8rpx);
  box-sizing: border-box;
  border: 2rpx solid transparent;
  border-radius: 16rpx;
  padding: 14rpx;
  background: var(--pc-surface-1);
}

.preset-card.is-on {
  border-color: var(--pc-accent);
  background: var(--pc-accent-soft);
}

.preview {
  display: flex;
  height: 120rpx;
  border-radius: 12rpx;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.preview-rail { width: 34%; }
.preview-main {
  flex: 1;
  padding: 16rpx;
  box-sizing: border-box;
}

.preview-card {
  height: 100%;
  border-radius: 8rpx;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.preview-card.dark {
  background: rgba(255, 255, 255, 0.08);
}

.preset-name {
  display: block;
  margin-top: 12rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--pc-text);
}

.preset-desc {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--pc-text-2);
  line-height: 1.35;
}

.preset-lock {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  color: var(--pc-text-3);
}

.custom-list { margin-bottom: 20rpx; }

.custom-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: var(--pc-surface-1);
  margin-bottom: 10rpx;
  border: 2rpx solid transparent;
}

.custom-row.is-on {
  border-color: var(--pc-accent);
  background: var(--pc-accent-soft);
}

.custom-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.mini-swatch {
  width: 64rpx;
  height: 40rpx;
  border-radius: 8rpx;
  overflow: hidden;
  display: flex;
  border: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.swatch-rail { width: 38%; }
.swatch-main { flex: 1; }

.custom-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--pc-text);
}

.custom-hex {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: var(--pc-text-3);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.custom-del {
  font-size: 24rpx;
  color: var(--pc-danger);
  padding: 8rpx 10rpx;
  flex-shrink: 0;
}

.empty {
  display: block;
  font-size: 24rpx;
  color: var(--pc-text-3);
  margin-bottom: 16rpx;
}

.add-box {
  margin-top: 8rpx;
  padding-top: 8rpx;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.add-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--pc-text);
  margin: 12rpx 0 16rpx;
}

.name-input {
  height: 64rpx;
  padding: 0 16rpx;
  margin-bottom: 12rpx;
  border-radius: 12rpx;
  border: 1px solid var(--pc-border-strong);
  background: var(--pc-surface-1);
  color: var(--pc-text);
  font-size: 26rpx;
}

.color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 12rpx 0;
}

.color-label {
  font-size: 26rpx;
  color: var(--pc-text);
}

.color-controls {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.color-input {
  width: 56rpx;
  height: 56rpx;
  padding: 0;
  border: none;
  background: transparent;
}

.hex-input {
  width: 160rpx;
  height: 56rpx;
  padding: 0 12rpx;
  border-radius: 10rpx;
  border: 1px solid var(--pc-border-strong);
  background: var(--pc-surface-1);
  color: var(--pc-text);
  font-size: 24rpx;
}

.live-preview {
  display: flex;
  height: 120rpx;
  margin: 12rpx 0 20rpx;
  border-radius: 12rpx;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.live-rail { width: 30%; }
.live-main {
  flex: 1;
  padding: 16rpx;
  box-sizing: border-box;
}

.live-card {
  height: 100%;
  border-radius: 8rpx;
  background: var(--pc-surface-2);
}

.add-btn {
  text-align: center;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 14rpx;
  background: var(--pc-accent);
  color: var(--pc-on-accent);
  font-size: 28rpx;
  font-weight: 600;
}
</style>
