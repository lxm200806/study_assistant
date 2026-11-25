export type RuntimePlatform = 'h5' | 'mp-weixin' | 'app' | 'unknown'

let cached: RuntimePlatform | null = null

function detectPlatform(): RuntimePlatform {
  try {
    const platform = String(import.meta.env?.UNI_PLATFORM || '')
    if (platform === 'h5' || platform === 'web') return 'h5'
    if (platform === 'mp-weixin') return 'mp-weixin'
    if (platform === 'app' || platform === 'app-plus') return 'app'
  } catch {
    // import.meta.env is unavailable in some runtimes
  }

  try {
    const info = uni.getSystemInfoSync?.()
    const uniPlatform = String(info?.uniPlatform || '')
    if (uniPlatform === 'web') return 'h5'
    if (uniPlatform === 'mp-weixin') return 'mp-weixin'
    if (uniPlatform === 'app') return 'app'
  } catch {
    // system info may not be ready yet
  }

  if (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia) return 'h5'
  return 'unknown'
}

export function getRuntimePlatform(): RuntimePlatform {
  if (!cached) cached = detectPlatform()
  return cached
}

export function isBrowserH5(): boolean {
  return getRuntimePlatform() === 'h5'
}

export function isMiniProgram(): boolean {
  return getRuntimePlatform() === 'mp-weixin'
}

export function isApp(): boolean {
  return getRuntimePlatform() === 'app'
}
