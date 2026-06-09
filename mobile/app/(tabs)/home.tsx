import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { listBooks, loadDailyStats, type Book } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { VOCAB_STORE, getMeaningType, setMeaningType } from '@/stores/vocabulary'
import { colors, spacing } from '@/theme'

export default function HomeScreen() {
  const { user } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [dailyStats, setDailyStats] = useState<{ date: string; wordCount: number; goal: number; streak: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [booksRes, dailyRes] = await Promise.all([
        listBooks(),
        loadDailyStats().catch(() => ({ data: null })),
      ])
      setBooks(booksRes.data || [])
      if (dailyRes.data) setDailyStats(dailyRes.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const progressPct = dailyStats ? Math.min(100, Math.round((dailyStats.wordCount / dailyStats.goal) * 100)) : 0

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      {/* Greeting */}
      <Text style={styles.eyebrow}>你好，{user?.username || '学习者'}</Text>
      <Text style={styles.title}>今天从哪里开始？</Text>

      {/* Daily goal progress */}
      {dailyStats && (
        <View style={styles.dailyCard}>
          <View style={styles.dailyHeader}>
            <Text style={styles.dailyTitle}>今日目标</Text>
            <Text style={styles.dailyPct}>{progressPct}%</Text>
          </View>
          <View style={styles.dailyBarTrack}>
            <View style={[styles.dailyBarFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={styles.dailyMeta}>
            <Text style={styles.dailyMetaText}>{dailyStats.wordCount} / {dailyStats.goal} 词</Text>
            <Text style={styles.streakBadge}>🔥 {dailyStats.streak} 天连学</Text>
          </View>
        </View>
      )}

      {/* Quick actions grid */}
      <View style={styles.quickGrid}>
        <Pressable style={styles.quickItem} onPress={() => router.push('/chat')}>
          <Text style={styles.quickIcon}>💬</Text>
          <Text style={styles.quickTitle}>AI 陪聊</Text>
          <Text style={styles.quickSub}>自然对话、用词挑战、情景练习</Text>
        </Pressable>

        <Pressable style={styles.quickItem} onPress={() => router.push('/recognition')}>
          <Text style={styles.quickIcon}>📖</Text>
          <Text style={styles.quickTitle}>认读训练</Text>
          <Text style={styles.quickSub}>看词选义，巩固记忆</Text>
        </Pressable>

        <Pressable style={styles.quickItem} onPress={() => router.push('/spelling')}>
          <Text style={styles.quickIcon}>✍️</Text>
          <Text style={styles.quickTitle}>拼写训练</Text>
          <Text style={styles.quickSub}>听音拼写，强化输出</Text>
        </Pressable>

        <Pressable style={styles.quickItem} onPress={() => router.push('/listening')}>
          <Text style={styles.quickIcon}>👂</Text>
          <Text style={styles.quickTitle}>听力训练</Text>
          <Text style={styles.quickSub}>听音选词，提升语感</Text>
        </Pressable>

        <Pressable style={styles.quickItem} onPress={() => router.push('/speaking')}>
          <Text style={styles.quickIcon}>🎤</Text>
          <Text style={styles.quickTitle}>口语训练</Text>
          <Text style={styles.quickSub}>跟读发音，AI 评分</Text>
        </Pressable>

        <Pressable style={styles.quickItem} onPress={() => router.push('/quiz')}>
          <Text style={styles.quickIcon}>📝</Text>
          <Text style={styles.quickTitle}>阶段小测</Text>
          <Text style={styles.quickSub}>30 题测试，检验成果</Text>
        </Pressable>

        <Pressable style={styles.quickItem} onPress={() => router.push('/vocab-map')}>
          <Text style={styles.quickIcon}>📊</Text>
          <Text style={styles.quickTitle}>学习图谱</Text>
          <Text style={styles.quickSub}>掌握度可视化分析</Text>
        </Pressable>

        <Pressable style={styles.quickItem} onPress={() => router.push('/books')}>
          <Text style={styles.quickIcon}>📚</Text>
          <Text style={styles.quickTitle}>词汇书管理</Text>
          <Text style={styles.quickSub}>切换词汇书、设置解释方式</Text>
        </Pressable>
      </View>

      {/* Book list */}
      <Text style={styles.sectionTitle}>词汇书</Text>
      {loading && books.length === 0 ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={styles.bookList}>
          {books.map(book => (
            <Pressable key={book.code} onPress={() => router.push(`/vocabulary?book=${book.code}`)} style={styles.bookItem}>
              <View>
                <Text style={styles.bookName}>{book.name}</Text>
                <Text style={styles.bookMeta}>{book.wordCount || 0} 个词 · {book.level || '通用'}</Text>
              </View>
              <View style={styles.bookCodeBadge}>
                <Text style={styles.bookCode}>{book.code.toUpperCase()}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Meaning type toggle */}
      <View style={styles.meaningToggle}>
        <Text style={styles.toggleLabel}>解释方式</Text>
        <View style={styles.toggleRow}>
          <Pressable onPress={() => setMeaningType('chinese')}
            style={[styles.toggleChip, getMeaningType() === 'chinese' && styles.toggleActive]}>
            <Text style={[styles.toggleChipText, getMeaningType() === 'chinese' && { color: colors.surface }]}>中文</Text>
          </Pressable>
          <Pressable onPress={() => setMeaningType('english')}
            style={[styles.toggleChip, getMeaningType() === 'english' && styles.toggleActive]}>
            <Text style={[styles.toggleChipText, getMeaningType() === 'english' && { color: colors.surface }]}>English</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingTop: 64 },
  eyebrow: { color: colors.muted, fontSize: 15 },
  title: { marginTop: spacing.sm, marginBottom: spacing.xl, color: colors.text, fontSize: 30, fontWeight: '800' },
  dailyCard: { backgroundColor: colors.primary, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.xl },
  dailyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dailyTitle: { fontSize: 17, fontWeight: '700', color: colors.surface },
  dailyPct: { fontSize: 24, fontWeight: '800', color: '#A5B4FC' },
  dailyBarTrack: { height: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 5, overflow: 'hidden', marginTop: spacing.sm },
  dailyBarFill: { height: '100%', backgroundColor: colors.surface, borderRadius: 5 },
  dailyMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  dailyMetaText: { fontSize: 14, color: '#DDE5FF' },
  streakBadge: { fontSize: 14, color: '#FCD34D' },
  quickGrid: { gap: spacing.sm, marginBottom: spacing.xl },
  quickItem: { padding: spacing.lg, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  quickIcon: { fontSize: 32, marginBottom: spacing.xs },
  quickTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  quickSub: { marginTop: spacing.xs, color: colors.muted, fontSize: 13 },
  sectionTitle: { marginTop: spacing.xxl, marginBottom: spacing.md, color: colors.text, fontSize: 20, fontWeight: '800' },
  bookList: { gap: spacing.sm },
  bookItem: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  bookName: { fontSize: 17, fontWeight: '700', color: colors.text },
  bookMeta: { marginTop: spacing.xs, color: colors.muted, fontSize: 13 },
  bookCodeBadge: { backgroundColor: '#eef2ff', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 8 },
  bookCode: { fontSize: 13, fontWeight: '700', color: colors.primary },
  meaningToggle: { marginTop: spacing.xxl, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg, borderRadius: 20, backgroundColor: '#f0f0f0' },
  toggleActive: { backgroundColor: colors.primary },
  toggleChipText: { fontSize: 15, fontWeight: '600', color: colors.muted },
})
