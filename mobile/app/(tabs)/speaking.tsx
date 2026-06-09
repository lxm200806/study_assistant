import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { listBooks, loadBookSession, submitPractice, completeSession, playTts, assessSpeech, type Book } from '@/api/client'
import { usePushToTalk } from '@/voice/usePushToTalk'
import { VOCAB_STORE, setCurrentBook, setStudySettings } from '@/stores/vocabulary'
import { colors, spacing } from '@/theme'

interface WordItem extends Book { word: string; phonetic?: string; meaning?: string }

function TrainingNavBack({ bookCode }: { bookCode: string }) {
  return (
    <View style={styles.navBar}>
      <Pressable onPress={() => router.push('/vocabulary')}><Text style={styles.backBtnText}>← 返回</Text></Pressable>
      <Text style={styles.navTitle}>口语训练</Text>
    </View>
  )
}

export default function SpeakingScreen() {
  const [books, setBooks] = useState<Book[]>([])
  const [words, setWords] = useState<WordItem[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [totalWords, setTotalWords] = useState(10)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [showMeaning, setShowMeaning] = useState(false)

  const voice = usePushToTalk()
  const audioUriRef = useRef<string | null>(null)
  const currentWord = words[currentIdx]

  const loadWords = useCallback(async () => {
    setLoading(true)
    try {
      await VOCAB_STORE.loadState()
      const code = VOCAB_STORE.currentBook || 'ket'
      setCurrentBook(code); setStudySettings({ wordsPerGroup: 10, groupCount: 1 })

      const booksRes = await listBooks(); setBooks(booksRes.data || [])
      const r = await loadBookSession(code, 10, 'coverage', 'speaking')
      const data = r.data as { words: WordItem[] } | undefined
      if (data?.words) {
        setWords(data.words); setTotalWords(data.words.length)
        setCurrentIdx(0); setShowMeaning(false); setDone(false)
      }
    } catch (e) { Alert.alert('加载失败', (e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useFocusEffect(useCallback(() => { if (!done) loadWords() }, [done, loadWords]))

  const playReference = async () => {
    if (currentWord?.word) await playTts(currentWord.word)
  }

  const handleMicPressIn = async () => {
    try { await voice.start(); audioUriRef.current = null } catch { Alert.alert('无法开始录音', '请允许麦克风权限') }
  }

  const handleMicPressOut = async () => {
    try {
      const uri = await voice.stop()
      if (uri) {
        // In production: upload audio to ASR or assess endpoint
        audioUriRef.current = uri
        // For demo, simulate assessment result
        setTimeout(() => handleAssessmentResult(true), 500)
      }
    } catch (e) { Alert.alert('录音失败', (e as Error).message) }
  }

  const handleAssessmentResult = async (isCorrect: boolean) => {
    if (!currentWord) return

    // In production, use assessSpeech with the audio base64
    // For now, just submit practice
    VOCAB_STORE.updateWord(currentWord.word, isCorrect ? 1 : -1, isCorrect)
    await submitPractice(currentWord.wordId || currentWord.code || 'unknown', 'speaking', isCorrect).catch(() => {})

    if (currentIdx < totalWords - 1) {
      setCurrentIdx(p => p + 1); setShowMeaning(false)
    } else {
      setDone(true)
      try { await completeSession(VOCAB_STORE.currentBook, words.map(w => w.wordId || w.code || w.word)) } catch {}
    }
  }

  const goToMap = () => router.push(`/vocab-map?book=${VOCAB_STORE.currentBook}`)
  const startAnother = () => loadWords()

  if (loading || !currentWord) {
    return <View style={styles.loadingContainer}><Text style={{ fontSize: 48 }}>🎤</Text><Text style={styles.loadingText}>{loading ? '加载中...' : '请选择词汇书'}</Text></View>
  }

  if (done) {
    return (
      <View style={styles.container}>
        <TrainingNavBack bookCode={VOCAB_STORE.currentBook} />
        <ScrollView contentContainerStyle={styles.doneContent}>
          <Text style={{ fontSize: 64, marginBottom: spacing.md }}>🎤</Text>
          <Text style={styles.doneTitle}>口语练习完成！</Text>
          <Pressable onPress={startAnother} style={[styles.actionBtn, styles.actionBtnPrimary]}><Text style={styles.actionBtnText}>再来一组</Text></Pressable>
          <Pressable onPress={goToMap} style={[styles.actionBtn, styles.actionBtnSecondary]}><Text style={styles.actionBtnTextSecondary}>查看图谱</Text></Pressable>
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
                style={[styles.bookChip, VOCAB_STORE.currentWord === b.code && styles.bookChipActive]}>
                <Text style={[styles.bookChipText]}>{b.code.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Word + play reference */}
        <View style={styles.wordCard}>
          <Text style={styles.wordText}>{currentWord.word}</Text>
          {currentWord.phonetic && <Text style={styles.wordPhonetic}>{currentWord.phonetic}</Text>}
          <Pressable onPress={playReference} style={styles.playRefBtn}>
            <Text style={{ fontSize: 40 }}>🔊</Text>
            <Text style={styles.playRefText}>听标准发音</Text>
          </Pressable>
        </View>

        {/* Meaning */}
        {showMeaning && (
          <View style={styles.meaningCard}>
            <Text style={styles.meaningLabel}>释义</Text>
            <Text style={styles.meaningText}>{currentWord.meaning || currentWord.description || '暂无'}</Text>
            <Pressable onPress={() => setShowMeaning(false)}><Text style={styles.hintClose}>隐藏</Text></Pressable>
          </View>
        )}

        {/* Voice input area */}
        <View style={styles.voiceArea}>
          <Pressable onPressIn={handleMicPressIn} onPressOut={handleMicPressOut}
            style={[styles.micButton, voice.isRecording && styles.micActive]}>
            <Text style={{ fontSize: 40 }}>{voice.isRecording ? '🎙️' : '🎤'}</Text>
          </Pressable>
          <Text style={styles.voiceHint}>{voice.isRecording ? '正在录音，松开结束' : '按住麦克风跟读'}</Text>
        </View>

        <Pressable onPress={() => setShowMeaning(true)} style={styles.showBtn}><Text style={styles.showBtnText}>💡 显示释义</Text></Pressable>
      </ScrollView>

      {/* Meaning Modal */}
      <Modal visible={showMeaning} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMeaning(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalLabel}>释义</Text>
            <Text style={styles.modalMeaning}>{currentWord.meaning || currentWord.description || '暂无'}</Text>
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
  wordCard: { alignItems: 'center', padding: spacing.xxl, backgroundColor: colors.surface, borderRadius: 16, marginBottom: spacing.lg },
  wordText: { fontSize: 42, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  wordPhonetic: { fontSize: 18, color: colors.muted, fontStyle: 'italic', marginBottom: spacing.md },
  playRefBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, backgroundColor: '#eef2ff', borderRadius: 20 },
  playRefText: { fontSize: 14, color: colors.primary },
  meaningCard: { backgroundColor: '#eef2ff', borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
  meaningLabel: { fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
  meaningText: { fontSize: 17, color: colors.text, fontWeight: '500' },
  hintClose: { fontSize: 13, color: colors.primary, marginTop: spacing.sm },
  voiceArea: { alignItems: 'center', padding: spacing.xl, backgroundColor: colors.surface, borderRadius: 16, marginBottom: spacing.md },
  micButton: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  micActive: { backgroundColor: colors.primary, transform: [{ scale: 1.05 }] },
  voiceHint: { marginTop: spacing.md, fontSize: 14, color: colors.muted },
  showBtn: { alignItems: 'center', paddingVertical: spacing.lg },
  showBtnText: { fontSize: 15, color: colors.primary },
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
})
