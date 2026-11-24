import { ref } from 'vue'

/** Routes that stay full-bleed, without the PC rail. */
export const PC_BARE_PAGES = new Set([
  '/pages/login/login',
  '/pages/register/register',
  '/pages/onboarding/onboarding',
  '/pages/family/roles'
])

/** These pages already have their own title, so the mobile nav bar is hidden on PC. */
export const PC_CHROMELESS_PAGES = new Set([
  '/pages/home/home',
  '/pages/vocabulary-practice/index',
  '/pages/typing/typing',
  '/pages/recognition/recognition',
  '/pages/vocabulary-map/vocabulary-map',
  '/pages/vocabulary/vocabulary',
  '/pages/mine/mine',
  '/pages/books/books',
  '/pages/primary/index',
  '/pages/primary/book',
  '/pages/primary/unit',
  '/pages/primary/pep-g3a',
  '/pages/primary/pep-g3a-unit',
  '/pages/theme/theme',
  '/pages/family/students',
  '/pages/membership/membership',
  '/pages/admin/admin'
])

export const PC_RAIL_WIDE = '224px'
export const PC_RAIL_NARROW = '72px'
export const PC_MIN_WIDTH = 768

export const pcPath = ref('')
export const pcQuery = ref('')

const listeners = new Set<() => void>()
let installed = false

export function isWidePc(): boolean {
  return typeof window !== 'undefined' && window.innerWidth >= PC_MIN_WIDTH
}

export function readPcPath(): string {
  if (typeof location !== 'undefined') {
    let raw = location.hash || ''
    if (raw.startsWith('#')) raw = raw.slice(1)
    const path = raw.split('?')[0]
    if (path && path !== '/') return path.startsWith('/') ? path : `/${path}`
  }
  try {
    const pages = getCurrentPages()
    const last = pages[pages.length - 1] as { route?: string } | undefined
    if (last?.route) return last.route.startsWith('/') ? last.route : `/${last.route}`
  } catch {
    /* getCurrentPages is unavailable before the first page mounts */
  }
  return ''
}

export function readPcQuery(): string {
  if (typeof location === 'undefined') return ''
  let raw = location.hash || ''
  if (raw.startsWith('#')) raw = raw.slice(1)
  return raw.split('?')[1] || ''
}

export function isBarePath(path = pcPath.value): boolean {
  return !path || PC_BARE_PAGES.has(path)
}

export function syncPcRoute() {
  if (typeof document === 'undefined') return
  const path = readPcPath()
  pcPath.value = path
  pcQuery.value = readPcQuery()
  const wide = isWidePc()
  const chromeless = wide && !!path && PC_CHROMELESS_PAGES.has(path)
  // PC + 有侧栏：锁死壳层，只让 uni-main 滚动（避免左栏跟着页面滚）
  const shell = wide && !isBarePath(path)
  document.documentElement.classList.toggle('pc-chromeless', chromeless)
  document.documentElement.classList.toggle('pc-shell', shell)
}

export function applyRailWidth(wide: boolean) {
  if (typeof document === 'undefined') return
  if (!isWidePc() || isBarePath()) return
  const width = wide ? PC_RAIL_WIDE : PC_RAIL_NARROW
  const api = uni as typeof uni & {
    setLeftWindowStyle?: (style: { width: string }) => void
  }
  api.setLeftWindowStyle?.({ width })
  document.documentElement.style.setProperty('--window-left', width)
}

export function installPcRouteSync(onChange?: () => void) {
  if (typeof window === 'undefined') return
  if (onChange) listeners.add(onChange)
  const run = () => {
    syncPcRoute()
    listeners.forEach((fn) => fn())
  }
  if (!installed) {
    installed = true
    window.addEventListener('hashchange', run)
    window.addEventListener('popstate', run)
    window.addEventListener('resize', run)
    const methods = ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab', 'navigateBack'] as const
    methods.forEach((name) => {
      uni.addInterceptor(name, {
        complete() {
          setTimeout(run, 0)
        }
      })
    })
  }
  run()
}
