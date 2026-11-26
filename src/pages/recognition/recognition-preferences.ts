import { getStored, setStored } from '@/platform/storage'

export type RecogMode = 'zh' | 'en' | 'listen'

export const RECOG_MODE_ORDER: RecogMode[] = ['zh', 'en', 'listen']

export const RECOG_MODES: Array<{ key: RecogMode; label: string }> = [
  { key: 'zh', label: '汉语' },
  { key: 'en', label: '英语' },
  { key: 'listen', label: '听音' }
]

const ENABLED_KEY = 'recog-enabled-modes'
const AUTO_SKIP_KEY = 'recog-auto-skip'

function toModeList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function normalizeRecogModes(value: unknown): RecogMode[] {
  const list = toModeList(value)
  const selected = RECOG_MODE_ORDER.filter(key => list.includes(key))
  return selected.length ? selected : [...RECOG_MODE_ORDER]
}

export function loadEnabledRecogModes(): RecogMode[] {
  return normalizeRecogModes(getStored<unknown>(ENABLED_KEY))
}

export function saveEnabledRecogModes(modes: RecogMode[]): void {
  setStored(ENABLED_KEY, normalizeRecogModes(modes))
}

export function loadAutoSkip(): boolean {
  const raw = getStored<unknown>(AUTO_SKIP_KEY)
  return !(raw === '0' || raw === false || raw === 0)
}

export function saveAutoSkip(on: boolean): void {
  setStored(AUTO_SKIP_KEY, on ? '1' : '0')
}
