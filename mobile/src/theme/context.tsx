// Theme Context for theme switching
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { lightThemeColors, darkThemeColors, spacing, borderRadius, fontSize, fontWeight, shadows } from './tokens'

interface ThemeContextType {
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false)

  // Check system preference on mount
  useEffect(() => {
    try {
      const saved = localStorage?.getItem('theme')
      if (saved === 'dark') setIsDark(true)
      else if (saved === 'light') setIsDark(false)
      else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setIsDark(true)
      }
    } catch {}
  }, [])

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev
      try {
        localStorage?.setItem('theme', next ? 'dark' : 'light')
      } catch {}
      return next
    })
  }

  const value = { isDark, toggleTheme }
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}

// Theme configuration object
export const getThemeConfig = (isDark: boolean) => ({
  colors: isDark ? darkThemeColors : lightThemeColors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  isDark
})

