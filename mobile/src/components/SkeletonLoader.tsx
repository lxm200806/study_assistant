// Skeleton Loader Component for loading states
import { View, StyleSheet, Animated } from 'react-native'
import { useEffect } from 'react'

interface SkeletonLoaderProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: object
}

export function SkeletonCard({ style }: { style?: object }) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, styles.shortLine]} />
      <View style={[styles.skeletonLine, styles.shortLine]} />
    </View>
  )
}

export function SkeletonButton({ width = '100%', height = 56 }: { width?: number | string; height?: number } = {}) {
  return (
    <View style={[styles.button, { width, height }]}>
      <View style={styles.skeletonLine} />
    </View>
  )
}

export function SkeletonText({ 
  width = '80%', 
  height = 24,
  marginBottom = 16
}: { width?: number | string; height?: number; marginBottom?: number } = {}) {
  return (
    <View style={[styles.text, { width, height, marginBottom }]}>
      <View style={styles.skeletonLine} />
    </View>
  )
}

export function SkeletonCircle({ size = 64 }: { size?: number } = {}) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={styles.skeletonLine} />
    </View>
  )
}

// Styles
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F6F7F9',
    padding: 16,
    borderRadius: 12,
    gap: 8
  },
  button: {
    backgroundColor: '#F6F7F9',
    borderRadius: 12,
    overflow: 'hidden'
  },
  text: {
    backgroundColor: '#F6F7F9',
    borderRadius: 4,
    overflow: 'hidden'
  },
  circle: {
    backgroundColor: '#F6F7F9',
    overflow: 'hidden'
  },
  skeletonLine: {
    height: 12,
    borderRadius: 4,
    width: '80%',
    backgroundColor: '#E1E5EA',
    animationDuration: '1s'
  },
  shortLine: {
    width: '60%'
  }
})

