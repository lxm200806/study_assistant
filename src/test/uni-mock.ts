import { vi } from 'vitest'

export const uniStorage = new Map<string, unknown>()

export const uniMock = {
  getStorageSync: (key: string) => (uniStorage.has(key) ? uniStorage.get(key) : ''),
  setStorageSync: (key: string, value: unknown) => {
    uniStorage.set(key, value)
  },
  removeStorageSync: (key: string) => {
    uniStorage.delete(key)
  },
  showToast: vi.fn(),
  showModal: vi.fn(),
  reLaunch: vi.fn(),
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
  navigateBack: vi.fn(),
  hideTabBar: vi.fn(),
  showTabBar: vi.fn(),
  setTabBarItem: vi.fn(),
  addInterceptor: vi.fn(),
  getSystemInfoSync: () => ({
    uniPlatform: 'web',
    platform: 'web',
    windowWidth: 1200
  }),
  request: vi.fn()
}

export function installUniMock(): void {
  ;(globalThis as unknown as { uni: typeof uniMock }).uni = uniMock
}

export function resetUniMock(): void {
  uniStorage.clear()
  vi.clearAllMocks()
}
