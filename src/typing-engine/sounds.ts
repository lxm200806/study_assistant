/**
 * Mirror TypeWords app/core/hooks/sound.ts playback.
 * Default keyboard pack = 笔记本键盘 (ASCII: laptop-key.mp3).
 * Wrong = beep.wav only; correct finish = correct.wav; keystrokes = keyboard pack.
 *
 * Uni-app/Vite serves Chinese filenames as SPA HTML (404) — use ASCII copies only.
 */

const SOUND_BASE = '/static/sound'

/** TypeWords setting default: keyboardSoundFile = '笔记本键盘' */
const KEY_SRC = `${SOUND_BASE}/key-sounds/laptop-key.mp3`
const BEEP_SRC = `${SOUND_BASE}/beep.wav`
const CORRECT_SRC = `${SOUND_BASE}/correct.wav`

type Pool = {
  list: HTMLAudioElement[]
  index: number
}

const pools = new Map<string, Pool>()
let unlocked = false

function makeAudio(src: string): HTMLAudioElement {
  const el = new Audio(src)
  el.preload = 'auto'
  return el
}

/** TypeWords useSound.setAudio: N copies of each src for overlapping plays */
function ensurePool(key: string, srcs: string[], copies: number): Pool | null {
  if (typeof Audio === 'undefined') return null
  let pool = pools.get(key)
  if (pool) return pool
  const list: HTMLAudioElement[] = []
  for (let i = 0; i < copies; i++) {
    for (const src of srcs) list.push(makeAudio(src))
  }
  pool = { list, index: 0 }
  pools.set(key, pool)
  return pool
}

/**
 * TypeWords useSound.play(volume 0–100):
 *   index++; el = list[index % length]; el.volume = volume/100; el.play()
 * No pause()/seek — that silences mp3 in Safari.
 */
function playFromPool(key: string, srcs: string[], volumePercent: number, copies: number) {
  const pool = ensurePool(key, srcs, copies)
  if (!pool?.list.length) return
  pool.index++
  const el = pool.list[pool.index % pool.list.length]
  if (!el) return
  try {
    el.volume = Math.min(1, Math.max(0, volumePercent / 100))
    void el.play().catch(() => {
      try {
        const one = makeAudio(srcs[0])
        one.volume = el.volume
        void one.play().catch(() => {})
      } catch {
        // ignore
      }
    })
  } catch {
    // ignore
  }
}

export function unlockTypingAudio() {
  if (typeof Audio === 'undefined') return
  // TypeWords: single key file → 4 pool copies
  ensurePool('key-laptop', [KEY_SRC], 4)
  ensurePool('beep-wav', [BEEP_SRC], 1)
  ensurePool('correct-wav', [CORRECT_SRC], 1)
  if (unlocked) return
  const silent = new Audio(
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
  )
  silent.volume = 0.01
  void silent
    .play()
    .then(() => {
      unlocked = true
    })
    .catch(() => {})
}

/** Correct keystroke / backspace — TypeWords keyboardSound (笔记本键盘) */
export function playTypingKeyboard() {
  playFromPool('key-laptop', [KEY_SRC], 100, 4)
}

/** Wrong letter — TypeWords effectSound beep.wav (not the key click) */
export function playTypingBeep() {
  playFromPool('beep-wav', [BEEP_SRC], 100, 1)
}

/** Word finished correctly — TypeWords correct.wav */
export function playTypingCorrect() {
  playFromPool('correct-wav', [CORRECT_SRC], 100, 1)
}
