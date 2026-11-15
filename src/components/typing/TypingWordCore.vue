<template>
  <view
    :class="['typing-core', shakeClass ? 'is-wrong' : '']"
    :style="{ fontSize: fontSize + 'px' }"
  >
    <!-- Dictation -->
    <view v-if="practiceType === 'Dictation'" class="dictation-wrap">
      <text
        v-if="!isWordMasked || showWordResult || showFullWord"
        class="letter reveal"
      >{{ target }}</text>
      <view
        class="dictation"
        :class="showWordResult ? (isWordCorrect ? 'right' : 'wrong') : ''"
        :style="{ minHeight: fontSize + 'px' }"
      >
        <template v-for="(ch, i) in [...input]" :key="'d' + i">
          <TypingSpace
            v-if="ch === ' '"
            :is-wrong="showWordResult ? !isWordCorrect : false"
            :is-wait="!showWordResult"
          />
          <text v-else class="l typed">{{ ch }}</text>
        </template>
      </view>
    </view>

    <!-- Follow / spell — inline flow like TypeWords (no flex wrap) -->
    <view v-else class="follow-line">
      <template v-if="wholeInputAttempt">
        <template v-for="(item, index) in inputCharacterStates" :key="'w' + index">
          <TypingSpace v-if="item.character === ' '" :is-wrong="!item.isCorrect" />
          <text v-else class="l" :class="item.isCorrect ? 'typed' : 'wrong-char'">{{ item.character }}</text>
        </template>
      </template>
      <template v-else>
        <template v-for="(ch, i) in [...input]" :key="'i' + i">
          <TypingSpace v-if="ch === ' '" :is-wrong="true" />
          <text v-else class="l typed">{{ ch }}</text>
        </template>
      </template>
      <TypingSpace v-if="wrong === ' '" :is-wrong="true" />
      <text v-else-if="wrong" class="l wrong-char">{{ wrong }}</text>
      <template v-if="isWordMasked && !showFullWord && !showWordResult">
        <template v-for="(ch, i) in [...displayRest]" :key="'m' + i">
          <TypingSpace v-if="ch === ' '" :is-wait="true" />
          <text v-else class="l mask">_</text>
        </template>
      </template>
      <template v-else>
        <template v-for="(ch, i) in [...displayRest]" :key="'r' + i">
          <TypingSpace v-if="ch === ' '" />
          <text v-else class="l rest">{{ ch }}</text>
        </template>
      </template>
    </view>

    <view class="tip-slot">
      <text class="tip">{{ tip || '\u00a0' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import TypingSpace from './TypingSpace.vue'
import { usePracticeWordTyping, type PracticeTypingSettings } from '@/typing-engine/usePracticeWordTyping'
import { WordPlayTrigger, WordPracticeType } from '@/typing-engine/types'
import { playTypingBeep, playTypingCorrect, playTypingKeyboard, unlockTypingAudio } from '@/typing-engine/sounds'
import { isBrowserH5 } from '@/utils/audio-recording'

const props = withDefaults(
  defineProps<{
    target: string
    practiceType: WordPracticeType
    isWordMasked?: boolean
    showWordResult?: boolean
    showFullWord?: boolean
    fontSize?: number
    active?: boolean
    keySound?: boolean
    settings?: Partial<PracticeTypingSettings>
  }>(),
  {
    isWordMasked: false,
    showWordResult: false,
    showFullWord: false,
    fontSize: 48,
    active: true,
    keySound: true
  }
)

const emit = defineEmits<{
  'update:showWordResult': [value: boolean]
  complete: [payload: { typed: string; correct: boolean }]
  wrong: []
  play: [trigger: WordPlayTrigger]
  notice: [message: string]
}>()

const defaultSettings: PracticeTypingSettings = {
  ignoreCase: true,
  repeatCount: 1,
  waitTimeForChangeWord: 420,
  spaceCooldownTime: 260,
  autoNextWord: true,
  inputWrongClear: false
}

const localShowResult = ref(props.showWordResult)
watch(() => props.showWordResult, v => { localShowResult.value = v })

const typing = usePracticeWordTyping({
  getTarget: () => props.target,
  getPracticeType: () => props.practiceType,
  getIsWordMasked: () => props.isWordMasked,
  getShowWordResult: () => localShowResult.value,
  getSettings: () => ({ ...defaultSettings, ...props.settings }),
  setShowWordResult: value => {
    localShowResult.value = value
    emit('update:showWordResult', value)
  },
  onComplete: () => {
    emit('complete', {
      typed: typing.input.value,
      correct: typing.isWordCorrect.value
    })
  },
  onWrong: () => emit('wrong'),
  onPlay: trigger => emit('play', trigger),
  onNotice: notice => {
    emit('notice', notice.type === 'delete-reinput' ? '按删除键重新输入' : '按空格继续')
  },
  playBeep: playTypingBeep,
  playCorrect: playTypingCorrect,
  playKeyboardAudio: () => {
    if (props.keySound) playTypingKeyboard()
  }
})

const {
  input,
  wrong,
  wholeInputAttempt,
  inputLock,
  inputCharacterStates,
  isWordCorrect,
  typeCharacter,
  backspace,
  reset,
  clearDeferredTimers
} = typing

const displayRest = computed(() => props.target.slice(input.value.length + wrong.value.length))

const shakeClass = computed(() =>
  !!(wrong.value || (wholeInputAttempt.value && inputLock.value && !isWordCorrect.value))
)

const tip = computed(() => {
  if (!props.active) return ''
  if (props.practiceType === WordPracticeType.Dictation && !localShowResult.value) {
    return '直接敲键盘；完成后按空格核对'
  }
  if (wholeInputAttempt.value && inputLock.value && !isWordCorrect.value) {
    return '有误：Backspace 修改，或空格记错并下一题'
  }
  if (isWordCorrect.value && inputLock.value && props.practiceType === WordPracticeType.Dictation) {
    return '正确，空格进入下一题'
  }
  return ''
})

function onKeyDown(event: KeyboardEvent) {
  if (!props.active || !isBrowserH5()) return
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
  unlockTypingAudio()
  if (event.key === 'Backspace') {
    event.preventDefault()
    backspace()
    return
  }
  if (event.key === 'Tab' || event.key === 'Escape' || event.key === 'Enter') return
  if (event.key.length !== 1 && event.code !== 'Space') return
  event.preventDefault()
  typeCharacter({ key: event.key, code: event.code, shiftKey: event.shiftKey })
}

watch(
  () => [props.target, props.practiceType] as const,
  () => reset(WordPlayTrigger.NewWord),
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
  clearDeferredTimers()
  if (isBrowserH5() && typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeyDown, true)
  }
})

defineExpose({
  isWordRight: () => isWordCorrect.value,
  getTyped: () => input.value,
  reset: () => reset(WordPlayTrigger.ResetSameWord)
})
</script>

<style scoped lang="scss">
.typing-core {
  position: relative;
  width: 100%;
  text-align: center;
  font-family: Palatino, 'Palatino Linotype', 'Iowan Old Style', Georgia, 'Songti SC', serif;
  color: #1f1a14;
  line-height: 1.25;

  &.is-wrong {
    animation: tw-shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }
}

@keyframes tw-shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
}

/* Inline flow — critical so spaces do not wrap as flex items */
.follow-line,
.dictation {
  display: inline;
  white-space: pre-wrap;
  word-break: normal;
  overflow-wrap: break-word;
}

.dictation-wrap {
  text-align: center;
}

.dictation {
  display: inline-block;
  min-width: 7em;
  border-bottom: 2px solid #9ca3af;
  padding-bottom: 4px;
  margin-top: 8px;
  text-align: left;
  white-space: pre-wrap;
}

.dictation.wrong { border-color: rgba(220, 38, 38, 0.7); }
.dictation.right { border-color: rgb(22, 163, 74); }

.reveal {
  display: block;
  width: 100%;
  opacity: 0.9;
  margin-bottom: 4px;
  white-space: pre-wrap;
}

.l {
  display: inline;
  white-space: pre;
}

.typed { color: rgb(22, 163, 74); }
.wrong-char { color: rgba(220, 38, 38, 0.85); }
.rest { color: #1f1a14; }
.mask { color: #94a3b8; }
.letter { color: #94a3b8; }

.tip-slot {
  margin-top: 16px;
  min-height: 1.4em;
}

.tip {
  display: block;
  font-size: 13px;
  line-height: 1.4;
  color: #8a8175;
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", sans-serif;
}
</style>