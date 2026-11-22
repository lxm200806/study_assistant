/**
 * PC 壳层主题 + 分层色板。
 * 层级说明见 doc/theme-layers.md；布局归属见 doc/pc-shell-layout.md
 */

export type ThemeGroup = 'day' | 'night'
export type OfficialThemeId = 'day-paper' | 'day-mist' | 'night-slate' | 'night-pine'

/** 分层色板：改主题时整层一起写到 CSS 变量 */
export type ThemePalette = {
  railBg: string
  mainBg: string
  surface1: string
  surface2: string
  solid: string
  accent: string
  accentSoft: string
  danger: string
  dangerSoft: string
  text: string
  text2: string
  text3: string
  onAccent: string
  onSolid: string
  border: string
  borderStrong: string
  shadow: string
  railText: string
  railMuted: string
  layered: boolean
}

export type CustomTheme = {
  id: string
  label: string
  railBg: string
  mainBg: string
}

export type OfficialTheme = {
  id: OfficialThemeId
  group: ThemeGroup
  label: string
  desc: string
  palette: ThemePalette
}

/** 日间米色：完整分层（认读原色）。夜间墨灰：低反差完整分层。其余有色板但标记 layered=false */
export const PC_OFFICIAL_THEMES: OfficialTheme[] = [
  {
    id: 'day-paper',
    group: 'day',
    label: '日间 · 米色',
    desc: '内容区认读米色；卡片/按钮全层适配',
    palette: {
      layered: true,
      railBg: '#e8eaed',
      mainBg: '#f4f1ea',
      surface1: '#efe6d6',
      surface2: '#fffdf8',
      solid: '#1f1a14',
      accent: '#0f6e6a',
      accentSoft: '#e7f3ef',
      danger: '#9a3b2f',
      dangerSoft: '#f8ebe6',
      text: '#1f1a14',
      text2: '#6d645b',
      text3: '#8a8175',
      onAccent: '#ffffff',
      onSolid: '#f4f1ea',
      border: 'rgba(31, 26, 20, 0.10)',
      borderStrong: '#cfc6b8',
      shadow: '0 18px 40px -18px rgba(26, 32, 53, 0.35)',
      railText: '#1f1a14',
      railMuted: '#8a8175'
    }
  },
  {
    id: 'day-mist',
    group: 'day',
    label: '日间 · 云灰',
    desc: '冷灰基底（分层待细调）',
    palette: {
      layered: false,
      railBg: '#e8eaed',
      mainBg: '#f3f4f6',
      surface1: '#e5e7eb',
      surface2: '#ffffff',
      solid: '#1f2937',
      accent: '#0f6e6a',
      accentSoft: '#e7f3ef',
      danger: '#9a3b2f',
      dangerSoft: '#f8ebe6',
      text: '#1f2937',
      text2: '#6b7280',
      text3: '#9ca3af',
      onAccent: '#ffffff',
      onSolid: '#f9fafb',
      border: 'rgba(31, 41, 55, 0.10)',
      borderStrong: '#d1d5db',
      shadow: '0 18px 40px -18px rgba(15, 23, 42, 0.28)',
      railText: '#1f2937',
      railMuted: '#6b7280'
    }
  },
  {
    id: 'night-slate',
    group: 'night',
    label: '夜间 · 墨灰',
    desc: '低反差：卡片略亮于底，按钮柔和青绿',
    palette: {
      layered: true,
      railBg: '#252a31',
      mainBg: '#2c323a',
      surface1: '#383f49',
      surface2: '#404854',
      solid: '#c5cbd3',
      accent: '#6b9f97',
      accentSoft: '#334842',
      danger: '#c4897e',
      dangerSoft: '#4a3532',
      text: '#e2e5ea',
      text2: '#a8b0ba',
      text3: '#7d8692',
      onAccent: '#ecf4f2',
      onSolid: '#2c323a',
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(255, 255, 255, 0.14)',
      shadow: '0 18px 40px -18px rgba(0, 0, 0, 0.45)',
      railText: '#e2e5ea',
      railMuted: '#8b939e'
    }
  },
  {
    id: 'night-pine',
    group: 'night',
    label: '夜间 · 松青',
    desc: '深青基底（分层待细调）',
    palette: {
      layered: false,
      railBg: '#17211f',
      mainBg: '#1e2a27',
      surface1: '#2a3834',
      surface2: '#334440',
      solid: '#c5d4ce',
      accent: '#6b9f97',
      accentSoft: '#2a403c',
      danger: '#c4897e',
      dangerSoft: '#3d2e2c',
      text: '#e4eeea',
      text2: '#a8b8b2',
      text3: '#7d9088',
      onAccent: '#ecf4f2',
      onSolid: '#1e2a27',
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(255, 255, 255, 0.14)',
      shadow: '0 18px 40px -18px rgba(0, 0, 0, 0.45)',
      railText: '#e4eeea',
      railMuted: '#8fa39a'
    }
  }
]

export const DEFAULT_THEME_ID: OfficialThemeId = 'day-paper'
const STORAGE_KEY = 'pc-shell-theme-v3'
const LEGACY_V2 = 'pc-shell-theme-v2'

export function normalizeHex(value: string, fallback: string): string {
  const v = (value || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase()
  }
  return fallback
}

export function getOfficialTheme(id: string): OfficialTheme | undefined {
  return PC_OFFICIAL_THEMES.find(t => t.id === id)
}

export function isOfficialThemeId(id: string): id is OfficialThemeId {
  return PC_OFFICIAL_THEMES.some(t => t.id === id)
}

function isDarkHex(hex: string): boolean {
  const h = normalizeHex(hex, '#ffffff').slice(1)
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 140
}

function mixHex(a: string, b: string, t: number): string {
  const pa = normalizeHex(a, '#888888').slice(1)
  const pb = normalizeHex(b, '#888888').slice(1)
  const ch = (i: number) => {
    const x = parseInt(pa.slice(i, i + 2), 16)
    const y = parseInt(pb.slice(i, i + 2), 16)
    return Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  }
  return `#${ch(0)}${ch(2)}${ch(4)}`
}

/** 自定义主题：由侧栏/内容底推导分层，避免夜间白卡片硬反差 */
export function derivePalette(railBg: string, mainBg: string): ThemePalette {
  const dark = isDarkHex(mainBg)
  if (dark) {
    return {
      layered: true,
      railBg,
      mainBg,
      surface1: mixHex(mainBg, '#ffffff', 0.08),
      surface2: mixHex(mainBg, '#ffffff', 0.14),
      solid: mixHex(mainBg, '#ffffff', 0.55),
      accent: '#6b9f97',
      accentSoft: mixHex(mainBg, '#6b9f97', 0.22),
      danger: '#c4897e',
      dangerSoft: mixHex(mainBg, '#c4897e', 0.22),
      text: '#e2e5ea',
      text2: '#a8b0ba',
      text3: '#7d8692',
      onAccent: '#ecf4f2',
      onSolid: mainBg,
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(255, 255, 255, 0.14)',
      shadow: '0 18px 40px -18px rgba(0, 0, 0, 0.45)',
      railText: '#e2e5ea',
      railMuted: '#8b939e'
    }
  }
  return {
    layered: true,
    railBg,
    mainBg,
    surface1: mixHex(mainBg, '#1f1a14', 0.08),
    surface2: mixHex(mainBg, '#ffffff', 0.55),
    solid: '#1f1a14',
    accent: '#0f6e6a',
    accentSoft: '#e7f3ef',
    danger: '#9a3b2f',
    dangerSoft: '#f8ebe6',
    text: '#1f1a14',
    text2: '#6d645b',
    text3: '#8a8175',
    onAccent: '#ffffff',
    onSolid: mainBg,
    border: 'rgba(31, 26, 20, 0.10)',
    borderStrong: '#cfc6b8',
    shadow: '0 18px 40px -18px rgba(26, 32, 53, 0.28)',
    railText: '#1f1a14',
    railMuted: '#8a8175'
  }
}

type StoredBundle = {
  activeId: string
  customs: CustomTheme[]
}

function readBundle(): StoredBundle {
  const fallback: StoredBundle = { activeId: DEFAULT_THEME_ID, customs: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredBundle>
      const customs = Array.isArray(parsed.customs)
        ? parsed.customs
            .filter(c => c && typeof c.id === 'string' && c.label)
            .map(c => ({
              id: String(c.id),
              label: String(c.label).slice(0, 20),
              railBg: normalizeHex(String(c.railBg || ''), '#e8eaed'),
              mainBg: normalizeHex(String(c.mainBg || ''), '#f4f1ea')
            }))
        : []
      const activeId = typeof parsed.activeId === 'string' ? parsed.activeId : DEFAULT_THEME_ID
      return { activeId, customs }
    }
    const v2 = localStorage.getItem(LEGACY_V2)
    if (v2) {
      const old = JSON.parse(v2) as { id?: string; railBg?: string; mainBg?: string }
      if (old.id === 'mist') return { activeId: 'day-mist', customs: [] }
      if (old.id === 'custom' && old.railBg && old.mainBg) {
        const id = `custom_${Date.now().toString(36)}`
        return {
          activeId: id,
          customs: [{
            id,
            label: '我的主题',
            railBg: normalizeHex(old.railBg, '#e8eaed'),
            mainBg: normalizeHex(old.mainBg, '#f4f1ea')
          }]
        }
      }
    }
  } catch {
    /* ignore */
  }
  return fallback
}

function writeBundle(bundle: StoredBundle) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle))
  } catch {
    /* ignore */
  }
}

export type ResolvedTheme = {
  id: string
  label: string
  official: boolean
  group?: ThemeGroup
  palette: ThemePalette
}

export function resolveTheme(activeId?: string, customs?: CustomTheme[]): ResolvedTheme {
  const bundle = { activeId: activeId ?? readBundle().activeId, customs: customs ?? readBundle().customs }
  const official = getOfficialTheme(bundle.activeId)
  if (official) {
    return {
      id: official.id,
      label: official.label,
      official: true,
      group: official.group,
      palette: official.palette
    }
  }
  const custom = bundle.customs.find(c => c.id === bundle.activeId)
  if (custom) {
    return {
      id: custom.id,
      label: custom.label,
      official: false,
      group: isDarkHex(custom.mainBg) ? 'night' : 'day',
      palette: derivePalette(custom.railBg, custom.mainBg)
    }
  }
  const d = getOfficialTheme(DEFAULT_THEME_ID)!
  return { id: d.id, label: d.label, official: true, group: d.group, palette: d.palette }
}

const CSS_MAP: Array<[keyof ThemePalette, string]> = [
  ['railBg', '--pc-rail-bg'],
  ['mainBg', '--pc-main-bg'],
  ['surface1', '--pc-surface-1'],
  ['surface2', '--pc-surface-2'],
  ['solid', '--pc-solid'],
  ['accent', '--pc-accent'],
  ['accentSoft', '--pc-accent-soft'],
  ['danger', '--pc-danger'],
  ['dangerSoft', '--pc-danger-soft'],
  ['text', '--pc-text'],
  ['text2', '--pc-text-2'],
  ['text3', '--pc-text-3'],
  ['onAccent', '--pc-on-accent'],
  ['onSolid', '--pc-on-solid'],
  ['border', '--pc-border'],
  ['borderStrong', '--pc-border-strong'],
  ['shadow', '--pc-shadow'],
  ['railText', '--pc-rail-text'],
  ['railMuted', '--pc-rail-muted']
]

export function applyPcTheme(theme: ResolvedTheme = resolveTheme()) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const p = theme.palette
  root.setAttribute('data-pc-theme', theme.id)
  root.setAttribute('data-pc-theme-group', theme.group || (isDarkHex(p.mainBg) ? 'night' : 'day'))
  root.setAttribute('data-pc-theme-layered', p.layered ? '1' : '0')
  for (const [key, cssVar] of CSS_MAP) {
    root.style.setProperty(cssVar, String(p[key]))
  }
  root.style.setProperty('--pc-rail-border', p.border)
  root.style.setProperty('--pc-rail-hover', `color-mix(in srgb, ${p.railBg} 86%, ${p.text})`)
  root.style.setProperty('--pc-rail-on', `color-mix(in srgb, ${p.railBg} 74%, ${p.text})`)
  root.style.setProperty('--atlas-paper', p.mainBg)
}

export function getThemeBundle(): StoredBundle {
  return readBundle()
}

export function selectTheme(id: string) {
  const bundle = readBundle()
  const ok = isOfficialThemeId(id) || bundle.customs.some(c => c.id === id)
  if (!ok) return resolveTheme(bundle.activeId, bundle.customs)
  bundle.activeId = id
  writeBundle(bundle)
  const resolved = resolveTheme(bundle.activeId, bundle.customs)
  applyPcTheme(resolved)
  return resolved
}

export function addCustomTheme(input: { label: string; railBg: string; mainBg: string }) {
  const bundle = readBundle()
  const id = `custom_${Date.now().toString(36)}`
  const theme: CustomTheme = {
    id,
    label: (input.label || '自定义').trim().slice(0, 20) || '自定义',
    railBg: normalizeHex(input.railBg, '#e8eaed'),
    mainBg: normalizeHex(input.mainBg, '#f4f1ea')
  }
  bundle.customs.push(theme)
  bundle.activeId = id
  writeBundle(bundle)
  const resolved = resolveTheme(bundle.activeId, bundle.customs)
  applyPcTheme(resolved)
  return { bundle, resolved }
}

export function removeCustomTheme(id: string) {
  const bundle = readBundle()
  bundle.customs = bundle.customs.filter(c => c.id !== id)
  if (bundle.activeId === id) bundle.activeId = DEFAULT_THEME_ID
  writeBundle(bundle)
  const resolved = resolveTheme(bundle.activeId, bundle.customs)
  applyPcTheme(resolved)
  return { bundle, resolved }
}

export function readStoredPcTheme(): ResolvedTheme {
  return resolveTheme()
}
