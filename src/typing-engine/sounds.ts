/**
 * Mirror TypeWords app/core/hooks/sound.ts playback.
 * Default keyboard pack = 笔记本键盘 (ASCII: laptop-key.mp3).
 * Wrong = beep.wav only; correct finish = correct.wav; keystrokes = keyboard pack.
 *
 * H5 uses HTMLAudioElement; mp-weixin/App use uni InnerAudioContext.
 * Uni-app/Vite serves Chinese filenames as SPA HTML (404) — use ASCII copies only.
 */

import { isBrowserH5 } from '@/platform/runtime'

const SOUND_BASE = '/static/sound'

/** TypeWords setting default: keyboardSoundFile = '笔记本键盘' */
const KEY_SRC = `${SOUND_BASE}/key-sounds/laptop-key.mp3`
const BEEP_SRC = `${SOUND_BASE}/beep.wav`
const CORRECT_SRC = `${SOUND_BASE}/correct.wav`

type H5Pool = {
  list: HTMLAudioElement[]
  index: number
}

type NativePool = {
  list: UniApp.InnerAudioContext[]
  index: number
}

const h5Pools = new Map<string, H5Pool>()
const nativePools = new Map<string, NativePool>()
let h5Unlocked = false

function canUseH5Audio(): boolean {
  return isBrowserH5() && typeof Audio !== 'undefined'
}

function canUseNativeAudio(): boolean {
  return typeof uni !== 'undefined' && typeof uni.createInnerAudioContext === 'function'
}

function makeH5Audio(src: string): HTMLAudioElement {
  const el = new Audio(src)
  el.preload = 'auto'
  return el
}

/** TypeWords useSound.setAudio: N copies of each src for overlapping plays */
function ensureH5Pool(key: string, srcs: string[], copies: number): H5Pool | null {
  let pool = h5Pools.get(key)
  if (pool) return pool
  const list: HTMLAudioElement[] = []
  for (let i = 0; i < copies; i++) {
    for (const src of srcs) list.push(makeH5Audio(src))
  }
  pool = { list, index: 0 }
  h5Pools.set(key, pool)
  return pool
}

function ensureNativePool(key: string, srcs: string[], copies: number): NativePool | null {
  if (!canUseNativeAudio()) return null
  let pool = nativePools.get(key)
  if (pool) return pool
  const list: UniApp.InnerAudioContext[] = []
  for (let i = 0; i < copies; i++) {
    for (const src of srcs) {
      const audio = uni.createInnerAudioContext()
      audio.autoplay = false
      audio.loop = false
      audio.src = src
      list.push(audio)
    }
  }
  if (!list.length) return null
  pool = { list, index: 0 }
  nativePools.set(key, pool)
  return pool
}

/**
 * TypeWords useSound.play(volume 0–100):
 *   index++; el = list[index % length]; el.volume = volume/100; el.play()
 * No pause()/seek — that silences mp3 in Safari.
 */
function playFromH5Pool(key: string, srcs: string[], volumePercent: number, copies: number) {
  if (typeof Audio === 'undefined') return
  const pool = ensureH5Pool(key, srcs, copies)
  if (!pool?.list.length) return
  pool.index++
  const el = pool.list[pool.index % pool.list.length]
  if (!el) return
  try {
    el.volume = Math.min(1, Math.max(0, volumePercent / 100))
    void el.play().catch(() => {
      try {
        const one = makeH5Audio(srcs[0])
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

function playFromNativePool(
  key: string,
  srcs: string[],
  volumePercent: number,
  copies: number
) {
  if (!canUseNativeAudio()) return
  const pool = ensureNativePool(key, srcs, copies)
  if (!pool?.list.length) return
  pool.index++
  const audio = pool.list[pool.index % pool.list.length]
  if (!audio) return
  try {
    audio.volume = Math.min(1, Math.max(0, volumePercent / 100))
    // 同一个 context 复用时先 stop，避免上一段还没结束导致播放被忽略
    audio.stop()
    audio.play()
  } catch {
    // ignore
  }
}

function playFromPool(key: string, srcs: string[], volumePercent: number, copies: number) {
  if (canUseH5Audio()) {
    playFromH5Pool(key, srcs, volumePercent, copies)
    return
  }
  playFromNativePool(key, srcs, volumePercent, copies)
}

export function unlockTypingAudio() {
  if (canUseH5Audio()) {
    // TypeWords: single key file → 4 pool copies
    ensureH5Pool('key-laptop', [KEY_SRC], 4)
    ensureH5Pool('beep-wav', [BEEP_SRC], 1)
    ensureH5Pool('correct-wav', [CORRECT_SRC], 1)
    if (h5Unlocked) return
    const silent = new Audio(
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
    )
    silent.volume = 0.01
    void silent
      .play()
      .then(() => {
        h5Unlocked = true
      })
      .catch(() => {})
    return
  }

  // 小程序/App 由用户按键触发，不需要 H5 的静音解锁；先预热音频池
  ensureNativePool('key-laptop', [KEY_SRC], 4)
  ensureNativePool('beep-wav', [BEEP_SRC], 1)
  ensureNativePool('correct-wav', [CORRECT_SRC], 1)
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
