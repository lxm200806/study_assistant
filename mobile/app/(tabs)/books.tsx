import { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { listBooks, getBookDetail, type Book } from '@/api/client'
import { VOCAB_STORE, setMeaningType, getMeaningType } from '@/stores/vocabulary'
import { colors, spacing } from '@/theme'

export default function BooksScreen() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [meaningType, setMeaningTypeState] = useState(getMeaningType())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listBooks()
      setBooks(result.data || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const selectBook = (book: Book) => {
    VOCAB_STORE.currentBook = book.code
    Alert.alert('已选择', `${book.name}`)
  }

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} }>
      <Text style={styles.headerTitle}>选择词汇书</Text>
      <Text style={styles.headerSub}>选择适合您的词汇学习目标</Text>

      {VOCAB_STORE.currentBook && (
        <View style={styles.currentBookCard}>
          <Text style={styles.currentBookLabel}>当前词汇书</Text>
          <Text style={styles.currentBookName}>{books.find(b => b.code === VOCAB_STORE.currentBook)?.name || VOCAB_STORE.currentBook}</Text>
        </View>
      )}

      {loading ? (
        <View style={{ alignItems: 'center', padding: spacing.xxl }}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <View style={styles.bookList}>
          {books.map(book => (
            <Pressable key={book.code} onPress={() => selectBook(book)} style={[styles.bookCard, VOCAB_STORE.currentBook === book.code && styles.bookSelected]}>
              <Text style={styles.bookIcon}>&#x1F4D6;</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.bookName}>{book.name}</Text>
                <Text style={styles.bookLevel}>{book.level || ''}</Text>
                <Text style={styles.bookDesc}>{book.description || ''}</Text>
                <Text style={styles.bookMeta}>共 {book.wordCount || 0} 词</Text>
              </View>
              {VOCAB_STORE.currentBook === book.code && <Text style={styles.checkMark}>✓</Text>}
              <Pressable onPress={() => router.push(`/vocab-map?book=${book.code}`)} style={styles.mapLink}>
                <Text style={styles.mapLinkText}>掌握图谱</Text>
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>解释方式</Text>
        <Pressable onPress={() => { setMeaningTypeState('chinese'); setMeaningType('chinese') }} style={[styles.optionItem, meaningType === 'chinese' && styles.optionSelected]}>
          <Text style={styles.optionLabel}>中文解释</Text>
          <Text style={styles.optionDesc}>用中文解释单词含义</Text>
          {meaningType === 'chinese' && <Text style={styles.checkMarkSmall}>✓</Text>}
        </Pressable>
        <Pressable onPress={() => { setMeaningTypeState('english'); setMeaningType('english') }} style={[styles.optionItem, meaningType === 'english' && styles.optionSelected]}>
          <Text style={styles.optionLabel}>英文解释</Text>
          <Text style={styles.optionDesc}>用英文解释单词含义，提升英文思维</Text>
          {meaningType === 'english' && <Text style={styles.checkMarkSmall}>✓</Text>}
        </Pressable>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerTitle: { fontSize: 28, fontWeight: '700', color: colors.text, paddingTop: 64, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  headerSub: { fontSize: 15, color: colors.muted, paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  currentBookCard: { marginHorizontal: spacing.xl, padding: spacing.lg, borderRadius: 16, backgroundColor: colors.primary, marginBottom: spacing.lg },
  currentBookLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: spacing.xs },
  currentBookName: { fontSize: 20, fontWeight: '700', color: colors.surface },
  bookList: { paddingHorizontal: spacing.xl, gap: spacing.md },
  bookCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent' },
  bookSelected: { borderColor: colors.primary, backgroundColor: '#f0f4ff' },
  bookIcon: { fontSize: 36, marginRight: spacing.md },
  bookName: { fontSize: 18, fontWeight: '600', color: colors.text },
  bookLevel: { fontSize: 13, color: colors.primary, marginTop: 2 },
  bookDesc: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  bookMeta: { fontSize: 13, color: '#999', marginTop: spacing.xs },
  checkMark: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, color: colors.surface, textAlign: 'center', lineHeight: 32, fontSize: 18 },
  mapLink: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: '#eef2ff', borderRadius: 16, marginLeft: spacing.sm },
  mapLinkText: { fontSize: 12, color: colors.primary },
  section: { marginHorizontal: spacing.xl, marginTop: spacing.xxl, padding: spacing.lg, borderRadius: 16, backgroundColor: colors.surface },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  optionItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: 12, backgroundColor: '#f8f9fa', marginBottom: spacing.xs, borderWidth: 2, borderColor: 'transparent' },
  optionSelected: { borderColor: colors.primary, backgroundColor: '#eef2ff' },
  optionLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.text },
  optionDesc: { flex: 1, fontSize: 13, color: colors.muted },
  checkMarkSmall: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, color: colors.surface, textAlign: 'center', lineHeight: 24, fontSize: 14 },
})

