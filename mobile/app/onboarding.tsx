import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { listBooks, type Book } from '@/api/client'
import { VOCAB_STORE, setOnboarded, setDailyGoal, setStudySettings, setCurrentBook } from '@/stores/vocabulary'
import { authOnboard } from '@/api/auth'
import { colors, spacing } from '@/theme'

const GOAL_OPTIONS = [20, 30, 50]

type OnboardStep = 'book' | 'goal' | 'trial'

export default function OnboardingScreen() {
  const [step, setStep] = useState<OnboardStep>('book')
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBook, setSelectedBook] = useState('ket')
  const [dailyGoal, setDailyGoal] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listBooks().then(r => setBooks(r.data || [])).finally(() => setLoading(false))
  }, [])

  const nextStep = () => {
    if (step === 'book') {
      setCurrentBook(selectedBook)
      setStep('goal')
    } else if (step === 'goal') {
      setDailyGoal(dailyGoal)
      setStudySettings({ wordsPerGroup: 10, groupCount: 1 })
      setStep('trial')
    }
  }

  const finish = async () => {
    try { await authOnboard() } catch {}
    setOnboarded(true)
    router.replace('/home')
  }

  const startTrial = async () => {
    setCurrentBook(selectedBook)
    setStudySettings({ wordsPerGroup: 10, groupCount: 1, sessionMode: 'smart' })
    try { await authOnboard() } catch {}
    setOnboarded(true)
    router.replace('/recognition')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {(['book', 'goal', 'trial'] as OnboardStep[]).map((s, i) => (
          <View key={s} style={[styles.dot, step === s && styles.dotActive]} />
        ))}
      </View>

      {step === 'book' && (
        <>
          <Text style={styles.title}>选择考试目标</Text>
          <Text style={styles.subtitle}>我们将为你推荐对应的词汇书</Text>
          {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> : (
            <View style={styles.bookList}>
              {books.map(book => (
                <Pressable key={book.code} onPress={() => setSelectedBook(book.code)} style={[styles.bookItem, selectedBook === book.code && styles.bookItemSelected]}>
                  <Text style={styles.bookName}>{book.name}</Text>
                  <Text style={styles.bookLevel}>{book.level || ''} · {book.wordCount || 0}词</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {step === 'goal' && (
        <>
          <Text style={styles.title}>设定每日目标</Text>
          <Text style={styles.subtitle}>坚持小目标，更容易养成习惯</Text>
          <View style={styles.goalRow}>
            {GOAL_OPTIONS.map(n => (
              <Pressable key={n} onPress={() => setDailyGoal(n)} style={[styles.goalItem, dailyGoal === n && styles.goalItemSelected]}>
                <Text style={[styles.goalNum, dailyGoal === n && { color: colors.primary }]}>{n}</Text>
                <Text style={styles.goalLabel}>词/天</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {step === 'trial' && (
        <>
          <Text style={styles.title}>来体验 10 词体验课</Text>
          <Text style={styles.subtitle}>快速感受智能推荐训练</Text>
          <View style={styles.trialCard}>
            <Text style={styles.trialIcon}>&#x1F4D6;</Text>
            <Text style={styles.trialBook}>{books.find(b => b.code === selectedBook)?.name || selectedBook}</Text>
            <Text style={styles.trialDesc}>10 词 · 约 3 分钟</Text>
          </View>
        </>
      )}

      {/* Buttons */}
      <View style={styles.btnRow}>
        {step !== 'book' && <Pressable onPress={() => setStep('book' as OnboardStep)}><Text style={styles.backBtn}>上一步</Text></Pressable>}
        <Pressable disabled={loading} onPress={nextStep} style={[styles.nextBtn, loading && styles.btnDisabled]}>
          <Text style={styles.nextBtnText}>{step === 'trial' ? '开始体验' : '下一步'}</Text>
        </Pressable>
      </View>

      {step === 'trial' && (
        <>
          <Pressable onPress={() => startTrial()} style={[styles.startTrialBtn, styles.mt12]}>
            <Text style={styles.startTrialText}>开始体验</Text>
          </Pressable>
          <Pressable onPress={finish} style={styles.skipLink}>
            <Text style={styles.skipText}>跳过，直接进入</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef2ff' },
  content: { padding: spacing.xl, paddingTop: 60, alignItems: 'center' },
  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 60 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#ddd' },
  dotActive: { width: 40, backgroundColor: colors.primary, borderRadius: 8 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: spacing.xxl },
  bookList: { width: '100%', gap: spacing.md, marginBottom: spacing.xxl },
  bookItem: { padding: spacing.lg, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent' },
  bookItemSelected: { borderColor: colors.primary, backgroundColor: '#eef2ff' },
  bookName: { fontSize: 18, fontWeight: '600', color: colors.text },
  bookLevel: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  goalRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xxl, width: '100%' },
  goalItem: { flex: 1, padding: spacing.xl, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent', alignItems: 'center' },
  goalItemSelected: { borderColor: colors.primary, backgroundColor: '#eef2ff' },
  goalNum: { fontSize: 36, fontWeight: '700', color: colors.muted },
  goalLabel: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  trialCard: { width: '100%', padding: spacing.xxl, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', marginBottom: spacing.xl },
  trialIcon: { fontSize: 64, marginBottom: spacing.md },
  trialBook: { fontSize: 20, fontWeight: '600', color: colors.text },
  trialDesc: { fontSize: 14, color: colors.muted, marginTop: spacing.sm },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: spacing.md, gap: spacing.md },
  nextBtn: { flex: 2, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.primary },
  btnDisabled: { opacity: 0.5 },
  nextBtnText: { color: colors.surface, fontWeight: '700', fontSize: 16 },
  backBtn: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#eee' },
  startTrialBtn: { width: '100%', height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.accent, marginTop: spacing.xl },
  startTrialText: { color: colors.surface, fontWeight: '700', fontSize: 16 },
  skipLink: { marginTop: spacing.md },
  skipText: { fontSize: 14, color: colors.muted, textDecorationLine: 'underline' },
})



