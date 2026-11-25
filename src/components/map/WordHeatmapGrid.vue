<template>
  <view>
    <!-- Grid view — 词光 tile layout -->
    <view v-if="view === 'grid'" class="vgrid">
      <view
        v-for="(word, index) in words"
        :key="word.wordId"
        :class="['tile', statusClass(word.status)]"
        @tap="emit('select', word)"
      >
        <view class="illo" :class="thumbOf(word.word) && !broken[word.word] ? 'has-art' : ''">
          <image
            v-if="thumbOf(word.word) && !broken[word.word]"
            class="illo-img"
            :src="thumbOf(word.word)!"
            mode="aspectFill"
            lazy-load
            @error="onThumbError(word.word)"
          />
          <view v-else class="plate" :style="{ '--hue': plateColor(word) }">
            <text class="plate-initial">{{ (word.word || '?').charAt(0).toUpperCase() }}</text>
            <text class="plate-word">{{ word.word }}</text>
          </view>
          <text class="tile-no">№ {{ String(index + 1).padStart(4, '0') }}</text>
        </view>
        <view class="tile-text">
          <text class="tile-word">{{ word.word }}</text>
          <text v-if="topicLabel(word)" class="tile-lv">{{ topicLabel(word) }}</text>
          <text class="tile-zh">{{ word.meaning || '—' }}</text>
        </view>
      </view>
    </view>

    <!-- List view — 词光: art · word · ipa · zh · status · speak -->
    <view v-else class="vlist">
      <view
        v-for="word in words"
        :key="word.wordId"
        class="row"
        @tap="emit('select', word)"
      >
        <view class="row-art">
          <image
            v-if="thumbOf(word.word) && !broken[word.word]"
            class="row-img"
            :src="thumbOf(word.word)!"
            mode="aspectFill"
            lazy-load
            @error="onThumbError(word.word)"
          />
          <view v-else class="row-plate" :style="{ background: plateColor(word) }">
            <text>{{ (word.word || '?').charAt(0).toUpperCase() }}</text>
          </view>
        </view>
        <text class="row-word">{{ word.word }}</text>
        <text class="row-ipa">{{ phoneticOf(word) }}</text>
        <text class="row-zh">{{ word.meaning || '—' }}</text>
        <text class="row-skill">{{ word.skillLabel || '' }}</text>
        <view :class="['row-dot', statusClass(word.status)]" />
        <view
          class="speak"
          :class="speakingId === word.wordId ? 'is-on' : ''"
          @tap.stop="playWord(word)"
        >
          <text class="speak-icon">♪</text>
        </view>
      </view>
    </view>

    <view v-if="!words.length" class="empty-atlas">
      <text>这片星域还没有词。换个筛选条件试试。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import type { MapWordEntry, MasteryStatus } from '@/types/map'
import { TOPIC_LABELS } from '@/types/map'
import {
  atlasThumbUrl,
  getAtlasIndex,
  resolveAtlasId,
  resolveAtlasIdSync
} from '@/utils/wordAtlas'
import { speakWord, unlockTtsPlayback } from '@/utils/tts'

withDefaults(
  defineProps<{
    words: MapWordEntry[]
    view?: 'grid' | 'list'
  }>(),
  { view: 'grid' }
)

const emit = defineEmits<{
  select: [word: MapWordEntry]
}>()

const atlasReady = ref(false)
const speakingId = ref('')
const broken = reactive<Record<string, boolean>>({})
const PLATE_HUES = ['#C4573A', '#7F9B77', '#D9A03A', '#5F7FA3', '#A86B8C', '#4E7C76']

function phoneticOf(word: MapWordEntry) {
  return word.phoneticUs || word.phonetic || word.phoneticUk || ''
}

async function playWord(word: MapWordEntry) {
  if (!word.word) return
  speakingId.value = word.wordId
  try {
    await unlockTtsPlayback()
    await speakWord(word.word)
  } catch {
    // ignore playback errors in atlas list
  } finally {
    if (speakingId.value === word.wordId) speakingId.value = ''
  }
}

function statusClass(status: MasteryStatus) {
  if (status === 'mastered') return 'is-mastered'
  if (status === 'learning' || status === 'unfamiliar') return 'is-learning'
  return ''
}

function thumbOf(word: string): string | null {
  if (!atlasReady.value) return null
  const id = resolveAtlasIdSync(word, getAtlasIndex())
  return atlasThumbUrl(id)
}

function onThumbError(word: string) {
  broken[word] = true
}

function plateColor(word: MapWordEntry) {
  const seed = (word.word || word.wordId || '').length + (word.topic || '').length
  return PLATE_HUES[seed % PLATE_HUES.length]
}

function topicLabel(word: MapWordEntry) {
  if (!word.topic) return ''
  const label = TOPIC_LABELS[word.topic] || word.topic
  return label.slice(0, 2)
}

onMounted(async () => {
  await resolveAtlasId('library')
  atlasReady.value = !!getAtlasIndex()
})
</script>

<style lang="scss" scoped>
.vgrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
}

@media (min-width: 560px) {
  .vgrid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 28rpx;
  }
}

@media (min-width: 900px) {
  .vgrid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.tile {
  display: flex;
  flex-direction: column;
  text-align: left;
  padding: 10rpx;
  border-radius: 36rpx;
  background: var(--atlas-card, #fffdf8);
  border: 1px solid var(--atlas-line, rgba(26, 32, 53, 0.1));
  box-shadow: 0 1px 2px rgba(30, 38, 64, 0.05), 0 18px 40px -24px rgba(30, 38, 64, 0.22);
}

.illo {
  position: relative;
  margin: 0;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 28rpx;
  background: #ece3d2;
}

.illo-img {
  width: 100%;
  height: 100%;
  display: block;
}

.plate {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 24rpx;
  background: radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--hue) 18%, transparent), transparent 70%), #efe7d8;
}

.plate-initial {
  font-size: 64rpx;
  font-weight: 700;
  color: var(--hue);
  font-family: var(--atlas-serif);
}

.plate-word {
  font-size: 22rpx;
  color: var(--hue);
  opacity: 0.85;
  text-align: center;
}

.tile-no {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  z-index: 2;
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
  font-size: 18rpx;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #434b65;
  background: rgba(251, 248, 242, 0.88);
}

.tile.is-learning .illo::before,
.tile.is-mastered .illo::before {
  content: '';
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  z-index: 2;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #cb922c;
  box-shadow: 0 0 0 4rpx #fbf8f2;
}

.tile.is-mastered .illo::before {
  background: #6a8c63;
}

.tile-text {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  column-gap: 12rpx;
  padding: 16rpx 10rpx 6rpx;
  min-width: 0;
}

.tile-word {
  font-family: var(--atlas-serif);
  font-weight: 600;
  font-size: 32rpx;
  line-height: 1.2;
  color: var(--atlas-ink, #1a2035);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tile-zh {
  grid-column: 1 / -1;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--atlas-ink-3, #7a7d8a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-lv {
  font-size: 18rpx;
  font-weight: 700;
  color: #5f88a8;
  background: #dde8f0;
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
}

.vlist {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.row {
  display: grid;
  grid-template-columns: 48px minmax(90px, 180px) minmax(0, 140px) 1fr auto 12px 36px;
  align-items: center;
  gap: 14px;
  padding: 6px 10px;
  border-radius: 14px;
  background: transparent;
  min-height: 60px;
  box-sizing: border-box;
}

.row:active {
  background: rgba(26, 32, 53, 0.04);
}

.row-art {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  overflow: hidden;
  background: #ece3d2;
}

.row-img,
.row-plate {
  width: 100%;
  height: 100%;
}

.row-plate {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 16px;
}

.row-word {
  font-family: var(--atlas-serif);
  font-weight: 600;
  font-size: 17px;
  color: var(--atlas-ink, #1a2035);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-ipa {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--atlas-ink-3, #7a7d8a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-zh {
  font-size: 13.5px;
  color: var(--atlas-ink-3, #7a7d8a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-skill {
  font-size: 12px;
  color: #0f6e6a;
  white-space: nowrap;
}

.row-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: transparent;
  justify-self: center;
}

.row-dot.is-learning {
  background: #cb922c;
}

.row-dot.is-mastered {
  background: #6a8c63;
}

.speak {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--atlas-ink-2, #434b65);
  background: transparent;
  transition: background 0.15s, color 0.15s;
}

.speak:hover,
.speak.is-on {
  background: #f5ddd1;
  color: #c4573a;
}

.speak-icon {
  font-size: 15px;
  line-height: 1;
}

@media (max-width: 720px) {
  .row {
    grid-template-columns: 44px minmax(70px, 1fr) minmax(0, 1.2fr) auto 10px 34px;
  }
  .row-ipa {
    display: none;
  }
}

.empty-atlas {
  text-align: center;
  padding: 120rpx 40rpx;
  color: var(--atlas-ink-3, #7a7d8a);
  font-size: 28rpx;
}
</style>
