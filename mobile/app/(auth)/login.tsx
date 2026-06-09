import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/auth/AuthContext'
import { colors, spacing } from '@/theme'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('请输入账号和密码')
      return
    }

    setLoading(true)
    try {
      await signIn(username.trim(), password)
      router.replace('/home')
    } catch (error) {
      Alert.alert('登录失败', (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>学</Text>
        <Text style={styles.title}>学习助手</Text>
        <Text style={styles.subtitle}>词汇学习、训练和 AI 陪聊</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>用户名</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          placeholder="请输入用户名"
          style={styles.input}
        />

        <Text style={styles.label}>密码</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="请输入密码"
          secureTextEntry
          style={styles.input}
        />

        <Pressable disabled={loading} onPress={onSubmit} style={[styles.button, loading && styles.buttonDisabled]}>
          <Text style={styles.buttonText}>{loading ? '登录中...' : '登录'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 64,
    color: colors.surface,
    backgroundColor: colors.primary,
    fontSize: 34,
    fontWeight: '800'
  },
  title: {
    marginTop: spacing.lg,
    fontSize: 30,
    fontWeight: '800',
    color: colors.text
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    color: colors.muted
  },
  form: {
    gap: spacing.sm
  },
  label: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.muted
  },
  input: {
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    fontSize: 16,
    color: colors.text
  },
  button: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  buttonDisabled: {
    opacity: 0.65
  },
  buttonText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 17
  }
})
