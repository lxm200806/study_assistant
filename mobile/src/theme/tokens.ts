// Theme tokens (merged)
import { ThemeColors, ThemeSpacing, ThemeBorderRadius, ThemeFontSize, ThemeFontWeight, ThemeShadows } from './types'

export const lightThemeColors: ThemeColors = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#17202A',
  muted: '#6F7A86',
  line: '#E1E5EA',
  primary: '#3157D5',
  primaryDark: '#203D9C',
  primaryLight: '#4d7cff',
  accent: '#14A37F',
  danger: '#C0392B',
  success: '#2e7d32',
  warning: '#e65100',
  info: '#0288d1'
}

export const darkThemeColors: ThemeColors = {
  bg: '#1a1a2e',
  surface: '#16213e',
  text: '#ffffff',
  muted: '#a0a0b0',
  line: '#3a3a5c',
  primary: '#4d7cff',
  primaryDark: '#3d6be6',
  primaryLight: '#6d9dff',
  accent: '#0db896',
  danger: '#ff6b6b',
  success: '#4caf50',
  warning: '#ff9800',
  info: '#2196f3'
}

export const spacing: ThemeSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
}

export const borderRadius: ThemeBorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999
}

export const fontSize: ThemeFontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  huge: 36
}

export const fontWeight: ThemeFontWeight = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800'
}

export const shadows: ThemeShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5
  }
}

