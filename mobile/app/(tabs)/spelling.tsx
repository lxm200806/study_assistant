import { useCallback, useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { listBooks, loadBookSession, submitPractice, completeSession, playTts, type Book } from '@/api/client'
import { VOCAB_STORE, setCurrentBook, getMeaningType, setStudySettings } from '@/stores/vocabulary'
import { colors, spacing } from '@/theme'

interface WordItem extends Book { word: string; phonetic?: string; meaning?: string }

function TrainingNavBack({ bookCode }: { bookCode: string }) {
  return (
    <View style={styles.navBar}>
      <Pressable onPress={() => router.push('/vocabulary')}><Text style={styles.backBtnText}>← 返回</Text></Pressable>
      <Text style={styles.navTitle}>拼写训练</Text>
    </View>
  )
}

export default function SpellingScreen() {
  const [books, setBooks] = useState<Book[]>([])
  const [words, setWords] = useState<WordItem[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [totalWords, setTotalWords] = useState(10)
  const [input, setInput] = useState('')
  const [showMeaning, setShowMeaning] = useState(false)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)

  const currentWord = words[currentIdx]

  const loadWords = useCallback(async () => {
    setLoading(true)
    try {
      await VOCAB_STORE.loadState()
      const code = VOCAB_STORE.currentBook || 'ket'
      setCurrentBook(code)
      setStudySettings({ wordsPerGroup: 10, groupCount: 1 })
      const booksRes = await listBooks(); setBooks(booksRes.data || [])

      const r = await loadBookSession(code, 10, 'coverage', 'spelling')
      const data = r.data as { words: WordItem[] } | undefined
      if (data?.words) {
        setWords(data.words); setTotalWords(data.words.length)
        setCurrentIdx(0); setInput(''); setShowMeaning(false)
        setFeedback(null); setDone(false)
      }
    } catch (e) { Alert.alert('加载失败', (e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useFocusEffect(useCallback(() => { if (!done) loadWords() }, [done, loadWords]))

  const playAndStart = async () => {
    setInput(''); setShowMeaning(false); setFeedback(null)
    if (currentWord?.word) await playTts(currentWord.word)
  }

  const checkAnswer = () => {
    if (!currentWord || !input.trim()) return
    const correct = input.trim().toLowerCase() === currentWord.word.toLowerCase()
    VOCAB_STORE.updateWord(currentWord.word, correct ? 1 : -1, correct)
    setFeedback(correct ? 'correct' : 'wrong')

    // Submit practice result
    submitPractice(currentWord.wordId || currentWord.code || 'unknown', 'spelling', correct).catch(() => {})

    if (currentIdx < totalWords - 1) {
      setTimeout(() => { setCurrentIdx(p => p + 1); setInput(''); setShowMeaning(false); setFeedback(null) }, 1200)
    } else { setDone(true) }
  }

  const showHint = () => {
    if (!currentWord) return
    setShowMeaning(true)
  }

  if (loading || !currentWord) {
    return <View style={styles.loadingContainer}><Text style={{ fontSize: 48 }}>✍️</Text><Text style={styles.loadingText}>{loading ? '加载中...' : '请选择词汇书'}</Text></View>
  }

  if (done) {
    return (
      <View style={styles.container}>
        <TrainingNavBack bookCode={VOCAB_STORE.currentBook} />
        <ScrollView contentContainerStyle={styles.doneContent}>
          <Text style={{ fontSize: 64, marginBottom: spacing.md }}>✍️</Text>
          <Text style={styles.doneTitle}>拼写练习完成！</Text>
          <Pressable onPress={() => loadWords()} style={[styles.actionBtn, styles.actionBtnPrimary]}><Text style={styles.actionBtnText}>再来一组</Text></Pressable>
          <Pressable onPress={() => router.push(`/vocab-map?book=${VOCAB_STORE.currentBook}`)} style={[styles.actionBtn, styles.actionBtnSecondary]}><Text style={styles.actionBtnTextSecondary}>查看图谱</Text></Pressable>
        </ScrollView>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <TrainingNavBack bookCode={VOCAB_STORE.currentBook} />

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

        {/* Play button */}
        <View style={styles.playCard}>
          <Pressable onPress={playAndStart} style={styles.playBtn}>
            <Text style={{ fontSize: 64 }}>🔊</Text>
          </Pressable>
          <Text style={styles.playHint}>点击听发音，然后拼写</Text>
        </View>

        {/* Meaning hint */}
        {showMeaning && (
          <View style={styles.hintCard}>
            <Text style={styles.meaningLabel}>{getMeaningType() === 'chinese' ? '中文释义' : 'Definition'}</Text>
            <Text style={styles.meaningText}>{currentWord.meaning || currentWord.description || '暂无'}</Text>
            <Pressable onPress={() => setShowMeaning(false)}><Text style={styles.hintClose}>隐藏</Text></Pressable>
          </View>
        )}

        {/* Input */}
        <TextInput value={input} onChangeText={setInput} placeholder="请输入拼写..." autoFocus
          onSubmitEditing={checkAnswer}
          style={[styles.input, feedback === 'correct' ? styles.inputCorrect : feedback === 'wrong' ? styles.inputWrong : null]} />

        <Pressable onPress={checkAnswer} disabled={!input.trim()} style={[styles.checkBtn, !input.trim() && styles.btnDisabled]}>
          <Text style={styles.checkBtnText}>{feedback === 'correct' ? '正确！' : '检查拼写'}</Text>
        </Pressable>

        {feedback === 'wrong' && (
          <Text style={styles.wrongFeedback}>正确答案: <Text style={{ fontWeight: '700' }}>{currentWord.word}</Text></Text>
        )}

        <Pressable onPress={showHint} style={styles.hintBtn}><Text style={styles.hintBtnText}>💡 提示释义</Text></Pressable>
      </ScrollView>

      {/* Meaning Modal */}
      <Modal visible={showMeaning} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMeaning(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalLabel}>释义</Text>
            <Text style={styles.modalMeaning}>{currentWord.meaning || currentWord.description || '暂无'}</Text>
            {currentWord.phonetic && <Text style={styles.modalPhonetic}>{currentWord.phonetic}</Text>}
          </View>
        </Pressable>
      </Modal>
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
  trainingContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  bookSwitcher: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg, flexWrap: 'wrap' },
  bookChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.line },
  bookChipActive: { backgroundColor: '#eef2ff', borderColor: colors.primary },
  bookChipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  playCard: { alignItems: 'center', marginBottom: spacing.xl },
  playBtn: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  playHint: { marginTop: spacing.md, fontSize: 15, color: colors.muted },
  hintCard: { backgroundColor: '#fff8e1', borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
  meaningLabel: { fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
  meaningText: { fontSize: 17, color: colors.text, fontWeight: '500' },
  hintClose: { fontSize: 13, color: colors.primary, marginTop: spacing.sm },
  input: { height: 56, paddingHorizontal: spacing.lg, borderRadius: 12, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, fontSize: 24, textAlign: 'center', letterSpacing: 4, marginBottom: spacing.md },
  inputCorrect: { borderColor: colors.accent, backgroundColor: '#f0fdf4' },
  inputWrong: { borderColor: '#e74c3c', backgroundColor: '#fef2f2' },
  checkBtn: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, marginBottom: spacing.md },
  btnDisabled: { opacity: 0.5 },
  checkBtnText: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  wrongFeedback: { textAlign: 'center', fontSize: 15, color: '#e74c3c', marginBottom: spacing.md },
  hintBtn: { alignItems: 'center', paddingVertical: spacing.md },
  hintBtnText: { fontSize: 15, color: colors.primary },
  doneContent: { padding: spacing.xl * 2, alignItems: 'center' },
  doneTitle: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.xl },
  actionBtn: { width: '100%', height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  actionBtnText: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  actionBtnTextSecondary: { color: colors.text, fontSize: 17, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalContent: { width: '85%', backgroundColor: colors.surface, borderRadius: 20, padding: spacing.xxl },
  modalLabel: { fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
  modalMeaning: { fontSize: 20, color: colors.text, fontWeight: '500', lineHeight: 28 },
  modalPhonetic: { fontSize: 16, color: colors.muted, fontStyle: 'italic', marginTop: spacing.sm },
})
