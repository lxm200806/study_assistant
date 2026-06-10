// Page Transition Wrapper Component
import { Animated, StyleSheet, ViewStyle } from 'react-native'
import { useEffect, useRef } from 'react'

interface PageTransitionProps {
  children: React.ReactNode
  direction?: 'left' | 'right' | 'up' | 'down'
  duration?: number
}

export default function PageTransition({
  children,
  direction = 'left',
  duration = 300
}: PageTransitionProps) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateX = useRef(new Animated.Value(direction === 'right' ? -50 : direction === 'left' ? 50 : 0)).current
  const translateY = useRef(new Animated.Value(direction === 'up' ? 50 : direction === 'down' ? -50 : 0)).current

  useEffect(() => {
    // Fade in with slide animation
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: duration * 0.6,
        useNativeDriver: true
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: duration,
        useNativeDriver: false
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: duration,
        useNativeDriver: false
      })
    ]).start()
  }, [])

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [
            { translateX },
            { translateY }
          ]
        }
      ]}
    >
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  } as ViewStyle
})

