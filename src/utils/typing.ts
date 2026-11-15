export type LiveKind = 'ok' | 'bad' | 'pending' | 'extra'
export type ShortcutAction = 'replay' | 'favorite' | 'mastered' | 'hint' | 'accent' | 'sound'

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  replay: 'r',
  favorite: 'f',
  mastered: 'm',
  hint: 'h',
  accent: 'a',
  sound: 'k'
}

const SHORTCUT_KEY = 'typingShortcuts'
const SOUND_KEY = 'typingKeySound'
const AUTO_SPEAK_KEY = 'typingAutoSpeak'
const WORD_MODES_KEY = 'typingEnabledWordModes'
const CASCADE_KEY = 'typingWordCascade'

/** Scaffolding order: easy → hard */
export const WORD_MODE_ORDER = ['follow', 'self', 'recall', 'dictation'] as const
export type PersistedWordMode = (typeof WORD_MODE_ORDER)[number]
export type WordCascadeStyle = 'per-word' | 'per-group'

export function normalizeTyped(text: string): string {
  return text
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function answersMatch(expected: string, typed: string, kind: 'word' | 'sentence'): boolean {
  if (kind === 'word') {
    const strip = (value: string) => normalizeTyped(value).replace(/[^a-z0-9' -]/g, '')
    return strip(expected) === strip(typed) && strip(expected).length > 0
  }
  const left = normalizeTyped(expected)
  return left.length > 0 && left === normalizeTyped(typed)
}

export function liveMarks(expected: string, typed: string): Array<{ ch: string; kind: LiveKind }> {
  const exp = [...expected]
  const got = [...typed]
  const marks: Array<{ ch: string; kind: LiveKind }> = exp.map((ch, index) => {
    if (index >= got.length) return { ch, kind: 'pending' as const }
    const same = ch.toLowerCase() === got[index].toLowerCase()
    return { ch, kind: same ? 'ok' as const : 'bad' as const }
  })
  if (got.length > exp.length) {
    for (const ch of got.slice(exp.length)) marks.push({ ch, kind: 'extra' })
  }
  return marks
}

export function loadShortcuts(): Record<ShortcutAction, string> {
  const saved = uni.getStorageSync(SHORTCUT_KEY)
  const next = { ...DEFAULT_SHORTCUTS }
  if (saved && typeof saved === 'object') {
    for (const key of Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[]) {
      const value = String((saved as Record<string, string>)[key] || '').toLowerCase()
      if (/^[a-z0-9]$/.test(value)) next[key] = value
    }
  }
  return next
}

export function saveShortcuts(shortcuts: Record<ShortcutAction, string>) {
  uni.setStorageSync(SHORTCUT_KEY, shortcuts)
}

export function loadKeySound(): boolean {
  const saved = uni.getStorageSync(SOUND_KEY)
  if (saved === '0' || saved === false) return false
  if (saved === '1' || saved === true) return true
  return true
}

export function saveKeySound(enabled: boolean) {
  uni.setStorageSync(SOUND_KEY, enabled ? '1' : '0')
}

/** Default on — speak each new word/sentence like TypeWords wordSound */
export function loadAutoSpeak(): boolean {
  const saved = uni.getStorageSync(AUTO_SPEAK_KEY)
  if (saved === '0' || saved === false) return false
  if (saved === '1' || saved === true) return true
  return true
}

export function saveAutoSpeak(enabled: boolean) {
  uni.setStorageSync(AUTO_SPEAK_KEY, enabled ? '1' : '0')
}

/** Default: all four modes selected */
export function loadEnabledWordModes(): PersistedWordMode[] {
  const saved = uni.getStorageSync(WORD_MODES_KEY)
  if (Array.isArray(saved)) {
    const picked = WORD_MODE_ORDER.filter(mode => saved.includes(mode))
    if (picked.length) return [...picked]
  }
  return [...WORD_MODE_ORDER]
}

export function saveEnabledWordModes(modes: PersistedWordMode[]) {
  const picked = WORD_MODE_ORDER.filter(mode => modes.includes(mode))
  uni.setStorageSync(WORD_MODES_KEY, picked.length ? picked : ['follow'])
}

/** Default: one word through all selected modes, then next word */
export function loadWordCascade(): WordCascadeStyle {
  const saved = uni.getStorageSync(CASCADE_KEY)
  return saved === 'per-group' ? 'per-group' : 'per-word'
}

export function saveWordCascade(style: WordCascadeStyle) {
  uni.setStorageSync(CASCADE_KEY, style)
}

let clickContext: AudioContext | null = null

export function playKeyClick() {
  if (typeof window === 'undefined') return
  const Ctx = window.AudioContext
    || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return
  if (!clickContext) clickContext = new Ctx()
  const ctx = clickContext
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = 190
  gain.gain.setValueAtTime(0.025, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.028)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.03)
}
