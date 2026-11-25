<template>
  <!-- TypeWords article/sentence layout: word tokens + Space between (nextSpace) -->
  <view class="passage" :style="{ fontSize: fontSize + 'px' }">
    <span class="sentence">
      <span
        v-for="(word, w) in words"
        :key="w"
        class="word"
        :class="[isWrote(w) ? 'wrote' : '', isCurrent(w) ? 'is-current' : '']"
      >
        <span class="word-wrap">
          <template v-if="!(isCurrent(w) && state.isSpace)">
            <template v-for="(seg, si) in currentSegments(word)" :key="si">
              <span v-if="seg.type === 'right'" class="input-right">{{ seg.val }}</span>
              <span v-else-if="seg.type === 'wrong'" class="input-wrong">{{ seg.val }}</span>
              <TypingSpace v-else-if="seg.type === 'space'" :is-wrong="true" />
              <span
                v-else-if="seg.type === 'rest'"
                :class="['word-end', isDictation && (isCurrent(w) || !isWrote(w)) ? 'hide' : '']"
              >{{ seg.val }}</span>
              <span v-else-if="seg.type === 'done'" :class="isWrote(w) && !isCurrent(w) ? 'wrote' : ''">{{ seg.val }}</span>
            </template>
          </template>
          <span
            v-else
            :class="['word-end', isDictation ? 'hide' : '']"
          >{{ word.word }}</span>
        </span>
        <TypingSpace
          v-if="word.nextSpace"
          class="gap-space"
          :is-wrong="false"
          :is-wait="isCurrent(w) && state.isSpace"
          :is-shake="isCurrent(w) && state.isSpace && !!state.wrong"
        />
      </span>
    </span>
    <!-- 固定高度，避免提示显隐时单词上下跳动 -->
    <view class="tip-slot">
      <text class="tip">{{ tip || '\u00a0' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import TypingSpace from './TypingSpace.vue'
import { useTokenTypingFlow } from '@/typing-engine/useTokenTypingFlow'
import type { TypingToken } from '@/typing-engine/parse-tokens'
import { unlockTypingAudio } from '@/typing-engine/sounds'
import { isBrowserH5 } from '@/platform/runtime'

const props = withDefaults(
  defineProps<{
    target: string
    fontSize?: number
    active?: boolean
    keySound?: boolean
    isDictation?: boolean
  }>(),
  {
    fontSize: 32,
    active: true,
    keySound: true,
    isDictation: false
  }
)

const emit = defineEmits<{
  complete: [payload: { typed: string; correct: boolean }]
  wrong: []
}>()

const flow = useTokenTypingFlow({
  getTarget: () => props.target,
  ignoreCase: true,
  ignoreSymbol: true,
  // getter so settings toggle stays live (do not snapshot at setup)
  getKeySound: () => props.keySound,
  onComplete: payload => emit('complete', payload),
  onWrong: () => emit('wrong')
})

const { state, words, reset, onTyping, isCurrent, isWrote } = flow

const tip = computed(() => {
  if (!props.active || state.isEnd) return ''
  if (state.isSpace) return '词已打完：按空格进入下一词（或直接打下一词字母）'
  return ''
})

function currentSegments(word: TypingToken) {
  const input = word.input || ''
  const target = word.word
  if (
    input.length === target.length
    && input.toLowerCase() === target.toLowerCase()
  ) {
    return [{ type: 'done' as const, val: input }]
  }
  // Same segmentation as TypeWords TypingArticleWord / TypingWord
  type Seg =
    | { type: 'right' | 'wrong' | 'rest' | 'done'; val: string }
    | { type: 'space'; val?: string }
  const segs: Seg[] = []
  let right = ''
  let wrongBuf = ''
  for (let i = 0; i < input.length; i++) {
    const k = input[i]
    if (k === ' ') {
      right = wrongBuf = ''
      segs.push({ type: 'space' })
      continue
    }
    const ok = k.toLowerCase() === (target[i] || '').toLowerCase()
    if (ok) {
      right += k
      wrongBuf = ''
      const last = segs[segs.length - 1]
      if (last?.type === 'right') last.val = right
      else segs.push({ type: 'right', val: right })
    } else {
      wrongBuf += k
      right = ''
      const last = segs[segs.length - 1]
      if (last?.type === 'wrong') last.val = wrongBuf
      else segs.push({ type: 'wrong', val: wrongBuf })
    }
  }
  if (input.length < target.length) {
    segs.push({ type: 'rest', val: target.slice(input.length) })
  }
  if (!input.length) {
    return [{ type: 'rest' as const, val: target }]
  }
  return segs
}

function onKeyDown(event: KeyboardEvent) {
  if (!props.active || !isBrowserH5()) return
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
  unlockTypingAudio()
  onTyping(event)
}

watch(
  () => props.target,
  () => reset(),
  { immediate: true }
)

watch(
  () => props.active,
  active => {
    if (!isBrowserH5() || typeof window === 'undefined') return
    if (active) window.addEventListener('keydown', onKeyDown, true)
    else window.removeEventListener('keydown', onKeyDown, true)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (isBrowserH5() && typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeyDown, true)
  }
})
</script>

<style scoped lang="scss">
.passage {
  position: relative;
  width: 100%;
  text-align: left;
  font-family: Palatino, 'Palatino Linotype', 'Iowan Old Style', Georgia, 'Songti SC', serif;
  color: #1f1a14;
  line-height: 1.7;
}

.sentence {
  display: inline;
  word-break: keep-all;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}

.word {
  display: inline;
}

.word-wrap {
  display: inline;
  position: relative;
}

.wrote {
  color: #9ca3af;
}

.input-right {
  color: rgb(22, 163, 74);
}

.input-wrong {
  color: rgba(220, 38, 38, 0.85);
}

.word-end.hide {
  opacity: 0;
}

.gap-space {
  /* waiting slot sits between words — TypeWords article */
}

.tip-slot {
  margin-top: 14px;
  min-height: 1.4em;
  text-align: center;
}

.tip {
  display: block;
  font-size: 13px;
  line-height: 1.4;
  color: #8a8175;
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", sans-serif;
  text-align: center;
}
</style>