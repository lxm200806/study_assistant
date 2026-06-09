import { useCallback, useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router'
import { listBooks, loadBookSession, submitPractice, getSessionReview, completeSession, playTts, type Book } from '@/api/client'
import { VOCAB_STORE, setCurrentBook, setStudySettings, getMeaningType, getStudySettings } from '@/stores/vocabulary'
import { colors, spacing } from '@/theme'

interface WordItem extends Book {
  word: string
  phonetic?: string
  meaning?: string
}

function TrainingNavBack({ bookCode }: { bookCode: string }) {
  return (
    <View style={styles.navBar}>
      <Pressable onPress={() => router.replace(`/books`)} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← 返回词汇书</Text>
      </Pressable>
      <Text style={styles.navTitle}>{bookCode.toUpperCase()}</Text>
    </View>
  )
}

function TrainingProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100)
  return (
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
      <Text style={styles.progressText}>{current} / {total}</Text>
    </View>
  )
}

export default function RecognitionScreen() {
  const params = useLocalSearchParams()
  const autoStart = params.autoStart === '1' || params.autoStart === 1
  const topicParam = params.topic as string | undefined

  const [books, setBooks] = useState<Book[]>([])
  const [words, setWords] = useState<WordItem[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [totalWords, setTotalWords] = useState(10)
  const [showMeaning, setShowMeaning] = useState(false)
  const [loading, setLoading] = useState(!autoStart)
  const [done, setDone] = useState(false)
  const [sessionWordIds, setSessionWordIds] = useState<string[]>([])

  const currentWord = words[currentIdx]

  const loadWords = useCallback(async () => {
    setLoading(true)
    try {
      await VOCAB_STORE.loadState()
      const bookCode = VOCAB_STORE.currentBook || 'ket'
      setCurrentBook(bookCode)
      setStudySettings({ wordsPerGroup: getMeaningType() === 'english' ? 10 : 10, groupCount: 1 })

      // Load books for switcher
      const booksRes = await listBooks()
      setBooks(booksRes.data || [])

      // Load session vocabulary
      const type = 'recognition'
      const r = await loadBookSession(bookCode, 10, 'coverage', type, topicParam)
      const data = r.data as { words: WordItem[]; progress: any } | undefined
      if (data?.words) {
        setWords(data.words)
        setTotalWords(data.words.length)
        setCurrentIdx(0)
        setShowMeaning(false)
        setDone(false)
        setSessionWordIds(data.words.map(w => w.wordId || w.code || w.word))
      }
    } catch (e) {
      const err = e as Error
      if (err.message.includes('BOOK_LOCKED')) {
        Alert.alert('会员专属', '该词汇书需要开通会员')
        router.replace('/membership')
      } else {
        Alert.alert('加载失败', err.message)
      }
    } finally { setLoading(false) }
  }, [topicParam])

  useFocusEffect(
    useCallback(() => {
      if (autoStart || !done) loadWords()
    }, [autoStart, done, loadWords])
  )

  const handleAnswer = async (correct: boolean) => {
    if (!currentWord) return

    // Update stats
    VOCAB_STORE.updateWord(currentWord.word, correct ? 1 : -1, correct)

    // Submit practice result
    try {
      await submitPractice(currentWord.wordId || currentWord.code || 'unknown', 'recognition', correct)
    } catch {}

    if (currentIdx < totalWords - 1) {
      setCurrentIdx(prev => prev + 1)
      setShowMeaning(false)
    } else {
      setDone(true)
      try { await completeSession(VOCAB_STORE.currentBook, sessionWordIds) } catch {}
      VOCAB_STORE.saveState()
    }
  }

  const speakWord = async () => {
    if (currentWord?.word) {
      try { await playTts(currentWord.word) } catch {}
    }
  }

  const skipToBookSelection = () => router.replace('/books')
  const startAnotherSession = () => loadWords()
  const goToMap = () => router.push(`/vocab-map?book=${VOCAB_STORE.currentBook}`)
  const goToReview = () => router.replace('/vocabulary')

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>📖</Text>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    )
  }

  if (done) {
    return (
      <View style={styles.container}>
        <TrainingNavBack bookCode={VOCAB_STORE.currentBook} />
        <ScrollView contentContainerStyle={styles.doneContent}>
          <Text style={{ fontSize: 64, marginBottom: spacing.md }}>🎉</Text>
          <Text style={styles.doneTitle}>练习完成！</Text>
          <Text style={styles.doneSubtitle}>本次共 {totalWords} 个词汇</Text>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statVal}>{words.filter(w => VOCAB_STORE.getWordMastery(w.word) >= 4).length}</Text>
              <Text style={styles.statLbl}>已掌握</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statVal}>{words.length}</Text>
              <Text style={styles.statLbl}>总词数</Text>
            </View>
          </View>

          <Pressable onPress={startAnotherSession} style={[styles.actionBtn, styles.actionBtnPrimary]}>
            <Text style={styles.actionBtnText}>再来一组</Text>
          </Pressable>
          <Pressable onPress={goToMap} style={[styles.actionBtn, styles.actionBtnSecondary]}>
            <Text style={styles.actionBtnTextSecondary}>查看图谱</Text>
          </Pressable>
          <Pressable onPress={goToReview} style={[styles.actionBtn, styles.actionBtnSecondary]}>
            <Text style={styles.actionBtnTextSecondary}>回顾词汇</Text>
          </Pressable>
        </ScrollView>
      </View>
    )
  }

  if (!currentWord) {
    return (
      <View style={styles.container}>
        <TrainingNavBack bookCode={VOCAB_STORE.currentBook} />
        <View style={styles.errorContent}>
          <Text style={{ fontSize: 64, marginBottom: spacing.lg }}>😕</Text>
          <Text style={styles.errorText}>暂无词汇，请返回选择词汇书</Text>
          <Pressable onPress={() => router.replace('/books')} style={[styles.actionBtn, styles.actionBtnPrimary]}>
            <Text style={styles.actionBtnText}>返回选书</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <TrainingNavBack bookCode={VOCAB_STORE.currentBook} />
      <TrainingProgressBar current={currentIdx + 1} total={totalWords} />

      <ScrollView contentContainerStyle={styles.trainingContent}>
        {/* Book switcher */}
        {books.length > 0 && (
          <View style={styles.bookSwitcher}>
            {books.slice(0, 5).map(b => (
              <Pressable key={b.code} onPress={() => { setCurrentBook(b.code); loadWords() }}
                style={[styles.bookChip, VOCAB_STORE.currentBook === b.code && styles.bookChipActive]}>
                <Text style={[styles.bookChipText, VOCAB_STORE.currentBook === b.code && { color: colors.primary }]}>{b.code.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Word display */}
        <View style={styles.wordCard}>
          <Text style={styles.wordText}>{currentWord.word}</Text>
          {currentWord.phonetic && <Text style={styles.wordPhonetic}>{currentWord.phonetic}</Text>}
          <Pressable onPress={speakWord} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
            <Text style={styles.speakText}>听发音</Text>
          </Pressable>
        </View>

        {/* Show meaning toggle */}
        {!showMeaning ? (
          <Pressable onPress={() => setShowMeaning(true)} style={styles.showBtn}>
            <Text style={styles.showBtnText}>显示释义</Text>
          </Pressable>
        ) : (
          <View style={[styles.meaningCard, getMeaningType() === 'english' ? styles.meaningEng : null]}>
            <Text style={styles.meaningLabel}>{getMeaningType() === 'chinese' ? '中文释义' : 'English Definition'}</Text>
            <Text style={styles.meaningText}>{currentWord.meaning || '暂无释义'}</Text>
          </View>
        )}
      </ScrollView>

      {/* Answer buttons */}
      {showMeaning && (
        <View style={styles.answerBar}>
          <Pressable onPress={() => handleAnswer(false)} style={[styles.answerBtn, styles.answerWrong]}>
            <Text style={styles.answerBtnText}>不认识</Text>
          </Pressable>
          <Pressable onPress={() => handleAnswer(true)} style={[styles.answerBtn, styles.answerCorrect]}>
            <Text style={styles.answerBtnText}>认识</Text>
          </Pressable>
        </View>
      )}

      {/* Meaning modal (for quick review) */}
      <Modal visible={showMeaning} transparent animationType="fade" onRequestClose={() => {}}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMeaning(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalWord}>{currentWord.word}</Text>
            {currentWord.phonetic && <Text style={styles.modalPhonetic}>{currentWord.phonetic}</Text>}
            <Text style={styles.meaningLabel}>释义</Text>
            <Text style={styles.modalMeaning}>{currentWord.meaning || '暂无释义'}</Text>
            <Pressable onPress={() => { setShowMeaning(false) }} style={[styles.actionBtn, styles.actionBtnPrimary, { marginTop: spacing.lg }]}>
              <Text style={styles.actionBtnText}>知道了</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 17, color: colors.muted },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface },
  backBtn: { paddingVertical: spacing.xs },
  backBtnText: { fontSize: 14, color: colors.primary },
  navTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  progressBar: { height: 6, backgroundColor: colors.line, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  progressText: { position: 'absolute', right: spacing.sm, top: -spacing.xs, fontSize: 12, color: colors.muted },
  trainingContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  bookSwitcher: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg, flexWrap: 'wrap' },
  bookChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.line },
  bookChipActive: { backgroundColor: '#eef2ff', borderColor: colors.primary },
  bookChipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  wordCard: { alignItems: 'center', padding: spacing.xxl, backgroundColor: colors.surface, borderRadius: 16, marginBottom: spacing.lg },
  wordText: { fontSize: 42, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  wordPhonetic: { fontSize: 18, color: colors.muted, fontStyle: 'italic', marginBottom: spacing.md },
  speakBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: '#eef2ff', borderRadius: 20 },
  speakIcon: { fontSize: 18 },
  speakText: { fontSize: 13, color: colors.primary },
  showBtn: { alignItems: 'center', paddingVertical: spacing.lg, backgroundColor: colors.surface, borderRadius: 12 },
  showBtnText: { fontSize: 17, color: colors.primary, fontWeight: '600' },
  meaningCard: { backgroundColor: '#eef2ff', borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
  meaningEng: { backgroundColor: '#f0fdf4' },
  meaningLabel: { fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
  meaningText: { fontSize: 18, color: colors.text, fontWeight: '500', lineHeight: 26 },
  answerBar: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface },
  answerBtn: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  answerCorrect: { backgroundColor: colors.accent },
  answerWrong: { backgroundColor: '#fde8e8' },
  answerBtnText: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  doneContent: { padding: spacing.xl * 2, alignItems: 'center' },
  doneTitle: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  doneSubtitle: { fontSize: 15, color: colors.muted, marginBottom: spacing.xxl },
  statRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.xxl },
  statCard: { alignItems: 'center' },
  statVal: { fontSize: 36, fontWeight: '800', color: colors.primary },
  statLbl: { fontSize: 13, color: colors.muted },
  actionBtn: { width: '100%', height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  actionBtnText: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  actionBtnTextSecondary: { color: colors.text, fontSize: 17, fontWeight: '600' },
  errorContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  errorText: { fontSize: 16, color: colors.muted, marginBottom: spacing.lg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalContent: { width: '85%', backgroundColor: colors.surface, borderRadius: 20, padding: spacing.xxl, alignItems: 'center' },
  modalWord: { fontSize: 36, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  modalPhonetic: { fontSize: 16, color: colors.muted, fontStyle: 'italic', marginBottom: spacing.md },
  modalMeaning: { fontSize: 20, color: colors.text, fontWeight: '500', lineHeight: 28 },
})
