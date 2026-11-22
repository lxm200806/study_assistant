import { computed, ref } from 'vue'

export type PepTextMode = 'authored' | 'textbook'

const STORAGE_KEY = 'pep-g3a-text-mode'

function readStored(): PepTextMode {
  try {
    const v = uni.getStorageSync(STORAGE_KEY)
    if (v === 'textbook' || v === 'authored') return v
  } catch {
    /* ignore */
  }
  return 'authored'
}

const mode = ref<PepTextMode>(readStored())

export function usePepTextMode() {
  const isTextbook = computed(() => mode.value === 'textbook')
  const label = computed(() => (mode.value === 'textbook' ? '教材原文' : '自编课文'))

  function setMode(next: PepTextMode) {
    mode.value = next
    try {
      uni.setStorageSync(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  function toggle() {
    setMode(mode.value === 'authored' ? 'textbook' : 'authored')
  }

  return { mode, isTextbook, label, setMode, toggle }
}
