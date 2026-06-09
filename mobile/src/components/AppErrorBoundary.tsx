import { Component, ReactNode, ErrorInfo } from 'react'
import { Alert, StyleSheet, Text, View, Pressable } from 'react-native'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] Uncaught error:', error, errorInfo.componentStack)
    Alert.alert(
      '应用错误',
      `出现了一个意外错误。\n\n${error.message}`,
      [{ text: '关闭' }]
    )
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <View style={styles.container}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>应用出现异常</Text>
            <Text style={styles.message}>{this.state.error?.message || '未知错误'}</Text>
            <Pressable onPress={() => this.setState({ hasError: false, error: null })} style={styles.retryBtn}>
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          </View>
        )
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f7f9', padding: 32 },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#17202a', marginBottom: 8 },
  message: { fontSize: 15, color: '#6f7a86', textAlign: 'center', marginBottom: 24 },
  retryBtn: { paddingVertical: 16, paddingHorizontal: 32, backgroundColor: '#3157d5', borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})

export default AppErrorBoundary
