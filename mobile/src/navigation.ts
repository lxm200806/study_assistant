// Navigation utilities
const TAB_PAGES = new Set([
  '/home',
  '/vocabulary',
  '/vocab-map',
  '/mine'
])

export function isTabPage(url: string): boolean {
  const path = url.split('?')[0]
  return TAB_PAGES.has(path)
}

export function openPage(url: string): void {
  const [path, query = ''] = url.split('?')
  if (isTabPage(path)) {
    if (query.includes('autoStart=1')) {
      // Handle autoStart flag for training
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('trainingAutoStart', '1')
      }
    }
    // Use router for Expo Router
    const { router } = require('expo-router')
    router.switchTab(path)
  } else {
    const { router } = require('expo-router')
    router.navigate(path)
  }
}

export function openMapTab(bookCode?: string): void {
  if (bookCode) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mapTabBook', bookCode)
    }
  }
  const { router } = require('expo-router')
  router.switchTab('/vocab-map')
}

export function consumeMapTabBook(): string | null {
  if (typeof localStorage !== 'undefined') {
    const code = localStorage.getItem('mapTabBook')
    if (code) {
      localStorage.removeItem('mapTabBook')
      return typeof code === 'string' ? code : null
    }
  }
  return null
}

export function consumeTrainingAutoStart(): boolean {
  if (typeof localStorage !== 'undefined') {
    const flag = localStorage.getItem('trainingAutoStart')
    if (flag === '1') {
      localStorage.removeItem('trainingAutoStart')
      return true
    }
  }
  return false
}
