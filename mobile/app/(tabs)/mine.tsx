import { useCallback, useEffect, useState } from 'react'
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/auth/AuthContext'
import { getApiBaseUrl } from '@/api/client'
import { VOCAB_STORE, setMeaningType, getMeaningType, isOnboarded, setOnboarded } from '@/stores/vocabulary'
import { clearTokens } from '@/api/client'
import { colors, spacing } from '@/theme'

interface SectionItem {
  icon: string
  label: string
  onPress?: () => void
  url?: string
}

export default function MineScreen() {
  const { user, signOut } = useAuth()
  const [meaningType, setMeaningTypeState] = useState(getMeaningType())
  const [notificationsOn, setNotificationsOn] = useState(true)
  const [darkMode, setDarkMode] = useState(false)

  const onSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const openUrl = async (url: string) => {
    try { await Linking.openURL(url) } catch {}
  }

  const settingsSections: Array<{ title: string; items: SectionItem[] }> = [
    {
      title: '学习设置',
      items: [
        { icon: '📚', label: '词汇书管理', onPress: () => router.push('/books') },
        { icon: '🎯', label: '每日目标设定', onPress: () => Alert.alert('每日目标', `当前目标：${VOCAB_STORE.getDailyGoal ? VOCAB_STORE._dailyGoal : 30} 词`) },
        { icon: '📊', label: '学习图谱', onPress: () => router.push('/vocab-map') },
      ],
    },
    {
      title: '解释方式',
      items: [
        {
          icon: meaningType === 'chinese' ? '🇨🇳' : '🌍',
          label: meaningType === 'chinese' ? '中文解释' : 'English Explanation',
          onPress: () => {
            const next = meaningType === 'chinese' ? 'english' : 'chinese'
            setMeaningType(next)
            setMeaningTypeState(next)
          },
        },
      ],
    },
    {
      title: '会员',
      items: [
        { icon: '👑', label: '开通会员', onPress: () => router.push('/membership') },
        { icon: '📜', label: '学习记录', onPress: () => Alert.alert('学习记录', '功能开发中，敬请期待') },
      ],
    },
    {
      title: '应用设置',
      items: [
        {
          icon: '🔔', label: '学习提醒',
          onPress: undefined,
        },
        { icon: '🌙', label: '深色模式', onPress: () => setDarkMode(!darkMode) },
        { icon: 'ℹ️', label: '关于我们', onPress: () => Alert.alert('学习助手 v0.1.0', 'React Native + Expo 客户端\n结合 AI 的智能词汇学习工具') },
      ],
    },
  ]

  // Fix notification switch
  const NotificationRow = () => (
    <View style={styles.settingRow}>
      <Text style={styles.settingIcon}>🔔</Text>
      <Text style={styles.settingLabel}>学习提醒</Text>
      <Switch value={notificationsOn} onValueChange={setNotificationsOn} trackColor={{ true: '#A5B4FC', false: '#e1e5ea' }} />
    </View>
  )

  const DarkModeRow = () => (
    <View style={styles.settingRow}>
      <Text style={styles.settingIcon}>🌙</Text>
      <Text style={styles.settingLabel}>深色模式</Text>
      <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ true: '#A5B4FC', false: '#e1e5ea' }} />
    </View>
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.username?.charAt(0)?.toUpperCase() || '学'}</Text>
        </View>
        <Text style={styles.username}>{user?.username || '学习者'}</Text>
        <Text style={styles.userRole}>学习助手用户</Text>
      </View>

      {/* Stats summary */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{VOCAB_STORE._words?.size || 0}</Text>
          <Text style={styles.statLbl}>已学词汇</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{VOCAB_STORE._statsMap ? Array.from(VOCAB_STORE._statsMap.values()).filter(w => w.mastery >= 4).length : 0}</Text>
          <Text style={styles.statLbl}>已掌握</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{VOCAB_STORE._bookProgress ? Math.round((VOCAB_STORE._bookProgress.masteredWords / (VOCAB_STORE._bookProgress.totalWords || 1)) * 100) : 0}%</Text>
          <Text style={styles.statLbl}>掌握率</Text>
        </View>
      </View>

      {/* Settings sections */}
      {settingsSections.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionContent}>
            {section.items.map((item, i) => (
              i === 0 && section.title === '应用设置' && item.icon === '🔔' ? (
                <NotificationRow key="notif" />
              ) : i === 1 && section.title === '应用设置' ? (
                <DarkModeRow key="darkmode" />
              ) : (
                <Pressable key={item.label} onPress={item.onPress} style={styles.settingRow}>
                  <Text style={styles.settingIcon}>{item.icon}</Text>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <Text style={styles.settingArrow}>›</Text>
                </Pressable>
              )
            ))}
          </View>
        </View>
      ))}

      {/* API info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>API 地址</Text>
        <Text style={styles.infoVal}>{getApiBaseUrl()}</Text>
      </View>

      {/* Migration status */}
      <View style={styles.migrationCard}>
        <Text style={styles.sectionTitle}>迁移状态</Text>
        <Text style={styles.migrationBody}>React Native + Expo Dev Build 客户端已建立。后续重点是 native audio layer、训练页面和发布流水线。</Text>
      </View>

      {/* Sign out */}
      <Pressable onPress={onSignOut} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>退出登录</Text>
      </Pressable>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl },
  profileCard: { alignItems: 'center', paddingTop: 64, paddingBottom: spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.surface },
  username: { marginTop: spacing.md, fontSize: 22, fontWeight: '700', color: colors.text },
  userRole: { marginTop: spacing.xs, fontSize: 14, color: colors.muted },
  statsRow: { flexDirection: 'row', marginHorizontal: spacing.xl, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: 16, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.line },
  statItem: { alignItems: 'center', flex: 1 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.line, marginHorizontal: spacing.sm },
  statVal: { fontSize: 24, fontWeight: '800', color: colors.primary },
  statLbl: { fontSize: 12, color: colors.muted, marginTop: spacing.xs },
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  sectionContent: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md },
  settingIcon: { fontSize: 24 },
  settingLabel: { flex: 1, fontSize: 16, color: colors.text },
  settingArrow: { fontSize: 20, color: colors.muted },
  infoCard: { marginHorizontal: spacing.xl, padding: spacing.lg, backgroundColor: '#eef2ff', borderRadius: 12, marginBottom: spacing.sm },
  infoLabel: { fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
  infoVal: { fontSize: 14, color: colors.text },
  migrationCard: { marginHorizontal: spacing.xl, padding: spacing.lg, backgroundColor: '#fff8e1', borderRadius: 12 },
  migrationBody: { fontSize: 14, color: '#92400e', lineHeight: 22 },
  logoutBtn: { marginHorizontal: spacing.xl, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2', borderRadius: 12, marginTop: spacing.md },
  logoutText: { color: colors.danger, fontSize: 17, fontWeight: '700' },
})
