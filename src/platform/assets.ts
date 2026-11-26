import { isBrowserH5 } from './runtime'

const REMOTE_BASE =
  (import.meta.env.VITE_ASSET_BASE as string | undefined)?.trim().replace(/\/+$/, '') || ''

export function hasRemoteAssetBase(): boolean {
  return REMOTE_BASE.length > 0
}

/**
 * 把逻辑资源路径解析成当前平台可加载的 URL：
 * - 配置 VITE_ASSET_BASE 时，所有平台统一走 CDN/OSS；
 * - 未配置时只有 H5 使用同源路径（H5 构建会把 assets/atlas 拷进 /static/atlas）；
 * - 小程序/App 没有同源静态目录，未配置时抛错，由调用方降级为占位符。
 */
export function assetUrl(path: string): string {
  const clean = path.replace(/^\/+/, '')
  if (REMOTE_BASE) return `${REMOTE_BASE}/${clean}`
  if (isBrowserH5()) return `/${clean}`
  throw new Error('非 H5 平台需要配置 VITE_ASSET_BASE 才能加载远程资源')
}

export function tryAssetUrl(path: string): string | null {
  try {
    return assetUrl(path)
  } catch {
    return null
  }
}

/**
 * 加载 JSON 资源：H5 用 fetch，小程序/App 用 uni.request。
 * 小程序需要在后台把资源域名加入 request 合法域名。
 */
export async function loadJsonAsset<T>(path: string): Promise<T> {
  const url = assetUrl(path)

  if (isBrowserH5() && typeof fetch === 'function') {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`资源加载失败: ${response.status}`)
    return (await response.json()) as T
  }

  if (typeof uni === 'undefined' || typeof uni.request !== 'function') {
    throw new Error('当前环境不支持加载远程资源')
  }

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      timeout: 15_000,
      success: res => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`资源加载失败: ${res.statusCode}`))
          return
        }
        try {
          const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          resolve(data as T)
        } catch {
          reject(new Error('资源 JSON 解析失败'))
        }
      },
      fail: error => reject(new Error(error.errMsg || '资源加载失败'))
    })
  })
}
