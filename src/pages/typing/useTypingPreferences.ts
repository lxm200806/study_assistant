import { onUnmounted, ref, type Ref } from 'vue'
import { isBrowserH5 } from '@/platform/runtime'
import { setTtsGender } from '@/utils/tts'
import {
  loadAutoExample,
  loadAutoSpeak,
  loadKeySound,
  loadShortcuts,
  loadTtsGender,
  saveAutoExample,
  saveAutoSpeak,
  saveKeySound,
  saveShortcuts,
  saveTtsGender,
  type ShortcutAction,
  type TtsGender
} from '@/utils/typing'
import type { Stage } from './typing.types'

interface Options {
  stage: Ref<Stage>
  suspendKeys: Ref<boolean>
  onReplay: () => void
  onExample: () => void
  onFavorite: () => void
  onMastered: () => void
  onHint: () => void
  onToggleAccent: () => void
}

const shortcutRows: Array<{ action: ShortcutAction; label: string }> = [
  { action: 'replay', label: '发音' },
  { action: 'example', label: '例句' },
  { action: 'favorite', label: '收藏' },
  { action: 'mastered', label: '已掌握' },
  { action: 'hint', label: '提示' },
  { action: 'accent', label: '切换英美' },
  { action: 'sound', label: '按键轻响' }
]

/** 快捷键、发音、键音、音色等设置；H5 负责绑定全局键盘快捷键。 */
export function useTypingPreferences(options: Options) {
  const isH5 = isBrowserH5()
  const shortcuts = ref(loadShortcuts())
  const keySound = ref(loadKeySound())
  const autoSpeak = ref(loadAutoSpeak())
  const autoExample = ref(loadAutoExample())
  const ttsGender = ref<TtsGender>(loadTtsGender())
  const capturing = ref<ShortcutAction | null>(null)

  setTtsGender(ttsGender.value)

  function hotkeyLabel(action: ShortcutAction) {
    const key = (shortcuts.value[action] || '').toUpperCase()
    return key ? `⌥${key}` : ''
  }

  function toggleSound() {
    keySound.value = !keySound.value
    saveKeySound(keySound.value)
  }

  function toggleAutoSpeak() {
    autoSpeak.value = !autoSpeak.value
    saveAutoSpeak(autoSpeak.value)
  }

  function toggleAutoExample() {
    autoExample.value = !autoExample.value
    saveAutoExample(autoExample.value)
  }

  function setGender(gender: TtsGender) {
    if (ttsGender.value === gender) return
    ttsGender.value = gender
    saveTtsGender(gender)
    setTtsGender(gender)
  }

  function runShortcut(action: ShortcutAction) {
    if (action === 'replay') options.onReplay()
    else if (action === 'example') options.onExample()
    else if (action === 'favorite') options.onFavorite()
    else if (action === 'mastered') options.onMastered()
    else if (action === 'hint') options.onHint()
    else if (action === 'accent') options.onToggleAccent()
    else if (action === 'sound') toggleSound()
  }

  /** Mac Option produces symbols in event.key; use event.code (KeyR → r). */
  function letterFromEvent(event: KeyboardEvent): string | null {
    if (event.code.startsWith('Key') && event.code.length === 4) {
      return event.code.slice(3).toLowerCase()
    }
    if (event.code.startsWith('Digit') && event.code.length === 6) {
      return event.code.slice(5)
    }
    if (/^[a-z0-9]$/i.test(event.key)) return event.key.toLowerCase()
    return null
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!isH5 || options.suspendKeys.value || event.isComposing) return
    const letter = letterFromEvent(event)
    if (capturing.value && letter) {
      event.preventDefault()
      shortcuts.value = { ...shortcuts.value, [capturing.value]: letter }
      saveShortcuts(shortcuts.value)
      capturing.value = null
      return
    }
    // Mac: Option = altKey. Ctrl also accepted for convenience.
    if (
      (event.altKey || event.ctrlKey) &&
      !event.metaKey &&
      !event.repeat &&
      options.stage.value === 'practice' &&
      letter
    ) {
      const action = (Object.keys(shortcuts.value) as ShortcutAction[]).find(
        name => shortcuts.value[name] === letter
      )
      if (action) {
        event.preventDefault()
        runShortcut(action)
      }
    }
  }

  if (isH5 && typeof window !== 'undefined') {
    // capture so Option/Ctrl shortcuts work even if children listen first
    window.addEventListener('keydown', onKeyDown, true)
  }

  onUnmounted(() => {
    if (isH5 && typeof window !== 'undefined') {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  })

  return {
    shortcuts,
    keySound,
    autoSpeak,
    autoExample,
    ttsGender,
    capturing,
    shortcutRows,
    hotkeyLabel,
    toggleSound,
    toggleAutoSpeak,
    toggleAutoExample,
    setGender
  }
}
