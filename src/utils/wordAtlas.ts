/**
 * Word Atlas (词光) illustration lookup.
 * Source files live in assets/atlas/. H5 serves/copies them under /static/atlas;
 * mini-program and App load them from VITE_ASSET_BASE (CDN/OSS).
 * Only thumbs + word-to-id are vendored; full img/audio stay in word-atlas if needed later.
 */

import { loadJsonAsset, tryAssetUrl } from '@/platform/assets'

const ATLAS_INDEX_PATH = 'static/atlas/word-to-id.json'
const ATLAS_THUMB_PREFIX = 'static/atlas/thumb'

let wordToId: Record<string, string> | null = null
let loading: Promise<Record<string, string>> | null = null
let loadWarningShown = false

function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '')
}

function normalizeAtlasKey(word: string): string {
  return stripDiacritics(word || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function loadWordToId(): Promise<Record<string, string>> {
  if (wordToId) return wordToId
  if (loading) return loading
  loading = (async () => {
    try {
      const data = await loadJsonAsset<Record<string, string>>(ATLAS_INDEX_PATH)
      wordToId = data && typeof data === 'object' ? data : {}
    } catch (error) {
      // 非 H5 未配置 VITE_ASSET_BASE，或 CDN 不可达：图鉴降级为占位符
      if (!loadWarningShown) {
        loadWarningShown = true
        console.warn('[atlas] 图鉴索引加载失败，已降级为占位符', error)
      }
      wordToId = {}
    }
    return wordToId
  })()
  return loading
}

/** Warm the id map early (e.g. when opening 图谱). */
export function preloadWordAtlasIndex(): void {
  void loadWordToId()
}

export function resolveAtlasIdSync(word: string, map: Record<string, string> | null = wordToId): string | null {
  const raw = (word || '').trim()
  if (!raw || !map) return null
  const lower = raw.toLowerCase()
  if (map[lower]) return map[lower]
  const key = normalizeAtlasKey(raw)
  if (key && map[key]) return map[key]
  const compact = key.replace(/-/g, '')
  if (compact && map[compact]) return map[compact]
  return null
}

export async function resolveAtlasId(word: string): Promise<string | null> {
  const map = await loadWordToId()
  return resolveAtlasIdSync(word, map)
}

export function atlasThumbUrl(id: string | null | undefined): string | null {
  if (!id) return null
  return tryAssetUrl(`${ATLAS_THUMB_PREFIX}/${id}.webp`)
}

export async function getAtlasThumbUrl(word: string): Promise<string | null> {
  return atlasThumbUrl(await resolveAtlasId(word))
}

export function getAtlasIndex(): Record<string, string> | null {
  return wordToId
}
