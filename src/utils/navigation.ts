const TAB_PAGES = new Set([
  '/pages/home/home',
  '/pages/vocabulary/vocabulary',
  '/pages/vocabulary-map/vocabulary-map',
  '/pages/mine/mine'
])

export function isTabPage(url: string): boolean {
  const path = url.split('?')[0]
  return TAB_PAGES.has(path)
}

export function openPage(url: string): void {
  const [path, query = ''] = url.split('?')
  if (isTabPage(path)) {
    if (query.includes('autoStart=1')) {
      uni.setStorageSync('trainingAutoStart', '1')
    }
    uni.switchTab({ url: path })
    return
  }
  uni.navigateTo({ url })
}

export function openMapTab(bookCode?: string): void {
  if (bookCode) {
    uni.setStorageSync('mapTabBook', bookCode)
  }
  uni.switchTab({ url: '/pages/vocabulary-map/vocabulary-map' })
}

export function consumeMapTabBook(): string | null {
  const code = uni.getStorageSync('mapTabBook')
  if (code) {
    uni.removeStorageSync('mapTabBook')
    return typeof code === 'string' ? code : null
  }
  return null
}

export function reLaunchPage(url: string): void {
  const [path] = url.split('?')
  if (isTabPage(path)) {
    uni.switchTab({ url: path })
    return
  }
  uni.reLaunch({ url })
}

export function consumeTrainingAutoStart(): boolean {
  const flag = uni.getStorageSync('trainingAutoStart')
  if (flag === '1') {
    uni.removeStorageSync('trainingAutoStart')
    return true
  }
  return false
}
