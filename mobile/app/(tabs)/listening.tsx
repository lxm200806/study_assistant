import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Audio } from 'expo-av'
import { useFocusEffect, router } from 'expo-router'
import { listBooks, loadBookSession, submitPractice, completeSession, type Book } from '@/api/client'
import { VOCAB_STORE, setCurrentBook, setStudySettings } from '@/stores/vocabulary'
import { colors, spacing } from '@/theme'

interface WordItem extends Book { word: string; phonetic?: string; meaning?: string }

function TrainingNavBack({ bookCode }: { bookCode: string }) {
  return (
    <View style={styles.navBar}>
      <Pressable onPress={() => router.push('/vocabulary')}><Text style={styles.backBtnText}>← 返回</Text></Pressable>
      <Text style={styles.navTitle}>听力训练</Text>
    </View>
  )
}

export default function ListeningScreen() {
  const [books, setBooks] = useState<Book[]>([])
  const [words, setWords] = useState<WordItem[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [totalWords, setTotalWords] = useState(10)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [showMeaning, setShowMeaning] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)

  const soundRef = useRef<Audio.Sound | null>(null)
  const currentWord = words[currentIdx]

  const loadWords = useCallback(async () => {
    setLoading(true)
    try {
      await VOCAB_STORE.loadState()
      const code = VOCAB_STORE.currentBook || 'ket'
      setCurrentBook(code); setStudySettings({ wordsPerGroup: 10, groupCount: 1 })

      const booksRes = await listBooks(); setBooks(booksRes.data || [])
      const r = await loadBookSession(code, 10, 'coverage', 'listening')
      const data = r.data as { words: WordItem[] } | undefined
      if (data?.words) {
        setWords(data.words); setTotalWords(data.words.length)
        setCurrentIdx(0); setShowMeaning(false); setDone(false)
      }
    } catch (e) { Alert.alert('加载失败', (e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useFocusEffect(useCallback(() => { if (!done) loadWords() }, [done, loadWords]))

  const playAudio = async () => {
    // In production: fetch audio from server for currentWord.word
    // For now, simulate by playing TTS API
    Alert.alert('听力播放', `正在播放 "${currentWord?.word}" 的音频\n(需配置后端 TTS 服务)`, [{ text: '知道了' }])
  }

  const handleAnswer = async (correct: boolean) => {
    if (!currentWord) return
    VOCAB_STORE.updateWord(currentWord.word, correct ? 1 : -1, correct)
    await submitPractice(currentWord.wordId || currentWord.code || 'unknown', 'listening', correct).catch(() => {})

    if (currentIdx < totalWords - 1) { setCurrentIdx(p => p + 1); setShowMeaning(false) }
    else { setDone(true); try { await completeSession(VOCAB_STORE.currentBook, words.map(w => w.wordId || w.code || w.word)) } catch {} }
  }

  if (loading || !currentWord) {
    return <View style={styles.loadingContainer}><Text style={{ fontSize: 48 }}>👂</Text><Text style={styles.loadingText}>{loading ? '加载中...' : '请选择词汇书'}</Text></View>
  }

  if (done) {
    return (
      <View style={styles.container}>
        <TrainingNavBack bookCode={VOCAB_STORE.currentBook} />
        <ScrollView contentContainerStyle={styles.doneContent}>
          <Text style={{ fontSize: 64, marginBottom: spacing.md }}>👂</Text>
          <Text style={styles.doneTitle}>听力练习完成！</Text>
          <Pressable onPress={() => loadWords()} style={[styles.actionBtn, styles.actionBtnPrimary]}><Text style={styles.actionBtnText}>再来一组</Text></Pressable>
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
                <Text style={[styles.bookChipText]}>{b.code.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Audio player */}
        <View style={styles.audioCard}>
          <Pressable onPress={playAudio} style={styles.playBtnLarge}>
            <Text style={{ fontSize: 72 }}>👂</Text>
          </Pressable>
          <Text style={styles.audioHint}>点击播放音频，选择你听到的单词</Text>
        </View>

        {/* Meaning (optional help) */}
        {showMeaning && (
          <View style={styles.meaningCard}>
            <Text style={styles.meaningLabel}>提示（释义）</Text>
            <Text style={styles.meaningText}>{currentWord.meaning || currentWord.description || '暂无'}</Text>
            <Pressable onPress={() => setShowMeaning(false)}><Text style={styles.hintClose}>隐藏</Text></Pressable>
          </View>
        )}

        {/* Answer options (multiple choice simulation) */}
        <View style={styles.answerGrid}>
          {currentWord.word && [
            currentWord.word,
            'apple', 'beautiful', 'challenge'
          ].slice(0, 4).map((opt, i) => (
            <Pressable key={i} onPress={() => handleAnswer(opt === currentWord.word)} style={[styles.answerOption]}>
              <Text style={styles.answerOptionText}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => setShowMeaning(true)} style={styles.showBtn}><Text style={styles.showBtnText}>💡 显示提示</Text></Pressable>
      </ScrollView>

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
  audioCard: { alignItems: 'center', marginBottom: spacing.xl },
  playBtnLarge: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  audioHint: { marginTop: spacing.md, fontSize: 15, color: colors.muted },
  meaningCard: { backgroundColor: '#eef2ff', borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
  meaningLabel: { fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
  meaningText: { fontSize: 17, color: colors.text, fontWeight: '500' },
  hintClose: { fontSize: 13, color: colors.primary, marginTop: spacing.sm },
  answerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  answerOption: { flex: 1, minWidth: '45%', paddingVertical: spacing.lg, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 2, borderColor: colors.line, alignItems: 'center' },
  answerOptionText: { fontSize: 17, fontWeight: '600', color: colors.text },
  showBtn: { alignItems: 'center', paddingVertical: spacing.lg },
  showBtnText: { fontSize: 15, color: colors.primary },
  doneContent: { padding: spacing.xl * 2, alignItems: 'center' },
  doneTitle: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.xl },
  actionBtn: { width: '100%', height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnText: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalContent: { width: '85%', backgroundColor: colors.surface, borderRadius: 20, padding: spacing.xxl },
  modalLabel: { fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
  modalMeaning: { fontSize: 20, color: colors.text, fontWeight: '500', lineHeight: 28 },
})
