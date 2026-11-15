/** Word Atlas (词光) illustration lookup — thumbs live at /static/atlas/thumb/{id}.webp */

let wordToId: Record<string, string> | null = null
let loading: Promise<Record<string, string>> | null = null

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
  loading = new Promise((resolve) => {
    const finish = (map: Record<string, string>) => {
      wordToId = map
      resolve(map)
    }
    // H5 / Vite: uni-app serves src/static at /static/; public/ also at /
    if (typeof fetch === 'function') {
      const tryUrls = ['/static/atlas/word-to-id.json', '/atlas/word-to-id.json']
      ;(async () => {
        for (const url of tryUrls) {
          try {
            const r = await fetch(url)
            if (!r.ok) continue
            const data = await r.json()
            if (data && typeof data === 'object') {
              finish(data as Record<string, string>)
              return
            }
          } catch {
            // try next
          }
        }
        finish({})
      })()
      return
    }
    finish({})
  })
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
  // uni-app: files under src/static are served from /static/
  return `/static/atlas/thumb/${id}.webp`
}

export async function getAtlasThumbUrl(word: string): Promise<string | null> {
  return atlasThumbUrl(await resolveAtlasId(word))
}

export function getAtlasIndex(): Record<string, string> | null {
  return wordToId
}
