// Theme type definitions (merged)
export interface ThemeColors {
  bg: string
  surface: string
  text: string
  muted: string
  line: string
  primary: string
  primaryDark: string
  primaryLight: string
  accent: string
  danger: string
  success: string
  warning: string
  info: string
}

export interface ThemeSpacing {
  xs: number
  sm: number
  md: number
  lg: number
  xl: number
  xxl: number
}

export interface ThemeBorderRadius {
  sm: number
  md: number
  lg: number
  xl: number
  full: number
}

export interface ThemeFontSize {
  xs: number
  sm: number
  base: number
  lg: number
  xl: number
  xxl: number
  xxxl: number
  huge: number
}

export interface ThemeFontWeight {
  light: string
  normal: string
  medium: string
  semibold: string
  bold: string
  extrabold: string
}

export interface ThemeShadows {
  sm: object
  md: object
  lg: object
}

export interface ThemeConfig {
  colors: ThemeColors
  spacing: ThemeSpacing
  borderRadius: ThemeBorderRadius
  fontSize: ThemeFontSize
  fontWeight: ThemeFontWeight
  shadows: ThemeShadows
  isDark: boolean
}

export type ThemeName = 'light' | 'dark'

