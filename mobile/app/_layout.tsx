import 'react-native-gesture-handler'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '@/auth/AuthContext'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </AppErrorBoundary>
  )
}
