import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/auth/AuthContext'
import { VOCAB_STORE } from '@/stores/vocabulary'
import { colors } from '@/theme'

export default function Index() {
  const { user, booting } = useAuth()

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  // If new user not onboarded -> onboarding flow
  if (!user?.username) {
    return <Redirect href={VOCAB_STORE.onboarded ? '/onboarding' : '/login'} />
  }

  return <Redirect href="/home" />
}
