// Theme utility hooks
import { useMemo } from 'react'
import { getThemeConfig, useTheme } from './context'

// Hook to get current theme values
export function useThemeValues() {
  const { isDark } = useTheme()
  
  return useMemo(() => getThemeConfig(isDark), [isDark])
}

// Hook for responsive spacing
export function useResponsiveSpacing() {
  const { spacing, borderRadius } = useThemeValues()
  
  return { spacing, borderRadius }
}

// Hook for colors by status
export function useStatusColors() {
  const { colors } = useThemeValues()
  
  return {
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    info: colors.info
  }
}

// Hook for button styles
export function useButtonStyle(isPrimary: boolean, isDisabled?: boolean) {
  const { colors, borderRadius, shadows } = useThemeValues()
  
  return useMemo(() => ({
    container: {
      backgroundColor: isPrimary ? colors.primary : colors.surface,
      borderWidth: isPrimary ? 0 : 1,
      borderColor: colors.line,
      borderRadius: borderRadius.md,
      shadowColor: shadows.md.shadowColor,
      shadowOffset: shadows.md.shadowOffset,
      shadowOpacity: shadows.md.shadowOpacity,
      shadowRadius: shadows.md.shadowRadius,
      elevation: shadows.md.elevation,
      opacity: isDisabled ? 0.5 : 1
    },
    text: {
      color: isPrimary ? colors.surface : colors.text
    }
  }), [isPrimary, isDisabled, colors, borderRadius, shadows])
}

