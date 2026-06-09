import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { authRegister, saveTokens, type AuthUser } from '@/api/client'
import { colors, spacing } from '@/theme'

export default function RegisterScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!username.trim()) e.username = '请输入用户名'
    else if (username.length < 3) e.username = '用户名至少需要3个字符'
    if (!password) e.password = '请输入密码'
    else if (password.length < 6) e.password = '密码至少需要6个字符'
    if (!confirmPassword) e.confirmPassword = '请确认密码'
    else if (confirmPassword !== password) e.confirmPassword = '两次输入的密码不一致'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const result = await authRegister(username.trim(), password)
      if (result.accessToken && result.refreshToken) {
        await saveTokens(result.accessToken, result.refreshToken)
      }
      const user = result.user || (result.data as AuthUser)
      Alert.alert('注册成功', '请登录', [
        { text: '去登录', onPress: () => router.replace('/login') },
      ])
    } catch (error) {
      Alert.alert('注册失败', (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const isValid = username.trim() && password && confirmPassword && password === confirmPassword

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logoChar}>学</Text>
        <Text style={styles.title}>学习助手</Text>
        <Text style={styles.subtitle}>创建新账号</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>用户名</Text>
        <TextInput value={username} onChangeText={setUsername} placeholder="请输入用户名" autoCapitalize="none" autoCorrect={false} style={[styles.input, errors.username && styles.inputError]} />
        {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}

        <Text style={styles.label}>密码</Text>
        <TextInput value={password} onChangeText={setPassword} placeholder="请输入密码" secureTextEntry style={[styles.input, errors.password && styles.inputError]} />
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        <Text style={styles.label}>确认密码</Text>
        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="请再次输入密码" secureTextEntry style={[styles.input, errors.confirmPassword && styles.inputError]} />
        {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

        <Pressable disabled={loading || !isValid} onPress={onSubmit} style={[styles.button, (loading || !isValid) && styles.buttonDisabled]}>
          <Text style={styles.buttonText}>{loading ? '注册中...' : '注 册'}</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/login')} style={styles.loginLink}>
          <Text style={styles.linkText}>已有账号？</Text>
          <Text style={[styles.linkText, { color: colors.primary }]}>立即登录</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', paddingTop: 80, paddingBottom: spacing.xxl, marginBottom: spacing.xl },
  logoChar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, color: colors.surface, textAlign: 'center', lineHeight: 64, fontSize: 34, fontWeight: '800' },
  title: { marginTop: spacing.lg, fontSize: 30, fontWeight: '800', color: colors.text },
  subtitle: { marginTop: spacing.sm, fontSize: 15, color: colors.muted },
  form: { paddingHorizontal: spacing.xl },
  label: { marginTop: spacing.md, fontSize: 14, color: colors.muted },
  input: { height: 52, paddingHorizontal: spacing.lg, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, fontSize: 16, color: colors.text },
  inputError: { borderColor: colors.danger },
  errorText: { fontSize: 12, color: colors.danger, marginTop: spacing.xs },
  button: { height: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xxl, borderRadius: 8, backgroundColor: colors.primary },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: colors.surface, fontWeight: '700', fontSize: 17 },
  loginLink: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md, gap: 4 },
  linkText: { fontSize: 14, color: colors.muted },
})
