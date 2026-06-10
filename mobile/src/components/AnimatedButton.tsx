// Animated Button Component with press feedback
import { useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Pressable, StyleProp, ViewStyle, TextStyle } from 'react-native'

interface AnimatedButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  isLoading?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}

export default function AnimatedButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  isLoading = false,
  style,
  textStyle
}: AnimatedButtonProps) {
  const [isPressed, setIsPressed] = useState(false)

  const variants = useMemo(() => ({
    primary: {
      bg: '#3157D5',
      text: '#FFFFFF',
      pressedBg: '#203D9C'
    },
    secondary: {
      bg: '#F6F7F9',
      text: '#17202A',
      border: '#E1E5EA',
      pressedBg: '#E8EBEF'
    },
    danger: {
      bg: '#C0392B',
      text: '#FFFFFF',
      pressedBg: '#962d22'
    }
  }), [])

  const currentVariant = variants[variant]

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        {
          backgroundColor: pressed ? currentVariant.pressedBg : currentVariant.bg,
          opacity: (disabled || isLoading) ? 0.5 : 1
        },
        styles.container,
        style as ViewStyle
      ]}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loader} />
          <Text style={[styles.text, textStyle as TextStyle]}>Loading...</Text>
        </View>
      ) : (
        <Text style={[styles.text, textStyle as TextStyle]}>{title}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    paddingHorizontal: 32,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingContainer: {
    flexDirection: 'row',
    gap: 8
  },
  loader: {
    width: 24,
    height: 24,
    borderRadius: 50,
    borderStyle: 'solid',
    borderWidth: 3,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    animationDuration: '1s'
  },
  text: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF'
  }
})

