import { useCallback, useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { listBooks, getQuizWords, submitQuizAnswers, completeSession, type Book, type QuizWord } from '@/api/client'
import { VOCAB_STORE, setCurrentBook, setStudySettings, getMeaningType } from '@/stores/vocabulary'
import { colors, spacing } from '@/theme'

function TrainingNavBack({ bookCode }: { bookCode: string }) {
  return (
    <View style={styles.navBar}>
      <Pressable onPress={() => router.push('/vocabulary')}><Text style={styles.backBtnText}>← 返回</Text></Pressable>
      <Text style={styles.navTitle}>阶段小测</Text>
    </View>
  )
}

function QuizProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100)
  return (
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
      <Text style={styles.progressText}>{current} / {total}</Text>
    </View>
  )
}

export default function QuizScreen() {
  const [books, setBooks] = useState<Book[]>([])
  const [questions, setQuestions] = useState<QuizWord[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [totalQ, setTotalQ] = useState(30)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [showExplanation, setShowExplanation] = useState(false)

  const question = questions[currentIdx]

  const loadQuiz = useCallback(async () => {
    setLoading(true)
    try {
      await VOCAB_STORE.loadState()
      const code = VOCAB_STORE.currentBook || 'ket'
      setCurrentBook(code); setStudySettings({ wordsPerGroup: 10, groupCount: 1 })

      const booksRes = await listBooks(); setBooks(booksRes.data || [])
      const r = await getQuizWords(code, 30)
      if (r.data?.length) {
        setQuestions(r.data); setTotalQ(r.data.length)
        setCurrentIdx(0); setSelectedAnswer(null); setDone(false)
        setScore({ correct: 0, total: 0 })
      }
    } catch (e) { Alert.alert('加载失败', (e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useFocusEffect(useCallback(() => { if (!done) loadQuiz() }, [done, loadQuiz]))

  const handleSelect = (text: string) => setSelectedAnswer(text)

  const handleSubmit = async () => {
    if (!question || !selectedAnswer) return
    const correct = question.options?.find(o => o.correct)?.text === selectedAnswer
    const newScore = { correct: score.correct + (correct ? 1 : 0), total: score.total + 1 }
    setScore(newScore)

    if (currentIdx < totalQ - 1) { setCurrentIdx(p => p + 1); setSelectedAnswer(null) }
    else { setDone(true); setShowExplanation(true) }
  }

  const goToMap = () => router.push(`/vocab-map?book=${VOCAB_STORE.currentBook}`)

  if (loading || !question) {
    return <View style={styles.loadingContainer}><Text style={{ fontSize: 48 }}>📝</Text><Text style={styles.loadingText}>{loading ? '加载中...' : '请选择词汇书'}</Text></View>
  }

  if (done) {
    const pct = Math.round((score.correct / score.total) * 100)
    return (
      <View style={styles.container}>
        <TrainingNavBack bookCode={VOCAB_STORE.currentBook} />
        <ScrollView contentContainerStyle={styles.doneContent}>
          <Text style={{ fontSize: 64, marginBottom: spacing.md }}>{pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪'}</Text>
          <Text style={styles.doneTitle}>{pct >= 80 ? '优秀！' : pct >= 60 ? '不错！' : '继续加油！'}</Text>
          <View style={styles.scoreCard}>
            <Text style={styles.scorePct}>{pct}%</Text>
            <Text style={styles.scoreDetail}>{score.correct} / {score.total}</Text>
          </View>

          {showExplanation && questions.map((q, i) => {
            const correctAns = q.options?.find(o => o.correct)?.text || ''
            return (
              <View key={i} style={styles.explainCard}>
                <Text style={styles.explainWord}>{q.word}</Text>
                <Text style={styles.explainCorrect}>正确答案: {correctAns}</Text>
                <Text style={styles.explainMeaning}>{q.meaning || q.phonetic || ''}</Text>
              </View>
            )
          })}

          <Pressable onPress={() => loadQuiz()} style={[styles.actionBtn, styles.actionBtnPrimary]}><Text style={styles.actionBtnText}>再来一次</Text></Pressable>
          <Pressable onPress={goToMap} style={[styles.actionBtn, styles.actionBtnSecondary]}><Text style={styles.actionBtnTextSecondary}>查看图谱</Text></Pressable>
        </ScrollView>
      </View>
    )
  }

  const correctAnswer = question.options?.find(o => o.correct)?.text || ''

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <TrainingNavBack bookCode={VOCAB_STORE.currentBook} />
      <QuizProgressBar current={currentIdx + 1} total={totalQ} />

      <ScrollView contentContainerStyle={styles.quizContent}>
        {/* Book switcher */}
        {books.length > 0 && (
          <View style={styles.bookSwitcher}>
            {books.slice(0, 5).map(b => (
              <Pressable key={b.code} onPress={() => { setCurrentBook(b.code); loadQuiz() }}
                style={[styles.bookChip, VOCAB_STORE.currentBook === b.code && styles.bookChipActive]}>
                <Text style={[styles.bookChipText]}>{b.code.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Question */}
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>{getMeaningType() === 'chinese' ? '哪个是以下释义对应的单词？' : 'Which word matches this definition?'}</Text>
          <Text style={styles.questionMeaning}>{question.meaning || question.phonetic || '暂无释义'}</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsGrid}>
          {question.options?.map((opt, i) => (
            <Pressable key={i} onPress={() => handleSelect(opt.text)}
              style={[styles.optionItem, selectedAnswer === opt.text && styles.optionSelected,
                done && correctAnswer === opt.text ? styles.optionCorrect : null]}>
              <Text style={[styles.optionText, selectedAnswer === opt.text && { color: colors.primary }]}>{opt.text}</Text>
            </Pressable>
          ))}
        </View>

        {/* Score preview */}
        <View style={styles.scorePreview}>
          <Text style={styles.scorePreviewLabel}>当前得分</Text>
          <Text style={styles.scorePreviewVal}>{score.correct} / {score.total}</Text>
        </View>
      </ScrollView>

      <Pressable disabled={!selectedAnswer} onPress={handleSubmit}
        style={[styles.submitBtn, !selectedAnswer && styles.btnDisabled]}>
        <Text style={styles.submitBtnText}>确认</Text>
      </Pressable>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 17, color: colors.muted, marginTop: spacing.md },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface },
  navTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  backBtnText: { fontSize: 14, color: colors.primary },
  progressBar: { height: 6, backgroundColor: colors.line, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  progressText: { position: 'absolute', right: spacing.sm, top: -spacing.xs, fontSize: 12, color: colors.muted },
  quizContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  bookSwitcher: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg, flexWrap: 'wrap' },
  bookChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.line },
  bookChipActive: { backgroundColor: '#eef2ff', borderColor: colors.primary },
  bookChipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  questionCard: { padding: spacing.xl, backgroundColor: colors.surface, borderRadius: 16, marginBottom: spacing.lg, alignItems: 'center' },
  questionLabel: { fontSize: 14, color: colors.muted, marginBottom: spacing.md },
  questionMeaning: { fontSize: 22, fontWeight: '600', color: colors.text, textAlign: 'center', lineHeight: 30 },
  optionsGrid: { gap: spacing.sm },
  optionItem: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 2, borderColor: colors.line, marginBottom: spacing.xs },
  optionSelected: { borderColor: colors.primary, backgroundColor: '#eef2ff' },
  optionCorrect: { borderColor: colors.accent, backgroundColor: '#f0fdf4' },
  optionText: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  scorePreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: '#eef2ff', borderRadius: 12, marginBottom: spacing.sm },
  scorePreviewLabel: { fontSize: 14, color: colors.muted },
  scorePreviewVal: { fontSize: 20, fontWeight: '700', color: colors.primary },
  submitBtn: { marginHorizontal: spacing.xl, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, marginBottom: spacing.md },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  doneContent: { padding: spacing.xl * 2, alignItems: 'center' },
  doneTitle: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  scoreCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg, borderWidth: 2, borderColor: colors.primary },
  scorePct: { fontSize: 56, fontWeight: '800', color: colors.primary },
  scoreDetail: { fontSize: 16, color: colors.muted },
  explainCard: { width: '100%', padding: spacing.md, backgroundColor: '#eef2ff', borderRadius: 12, marginBottom: spacing.xs },
  explainWord: { fontSize: 18, fontWeight: '700', color: colors.text },
  explainCorrect: { fontSize: 14, color: colors.accent, marginTop: 4 },
  explainMeaning: { fontSize: 13, color: colors.muted, marginTop: 2 },
  actionBtn: { width: '100%', height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  actionBtnText: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  actionBtnTextSecondary: { color: colors.text, fontSize: 17, fontWeight: '600' },
})
