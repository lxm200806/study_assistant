
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { VOCAB_STORE } from '@/stores/vocabulary'

interface BookSwitcherProps {
  compact?: boolean
  trainingType?: string
}

export default function BookSwitcher({ compact = false, trainingType }: BookSwitcherProps) {
  const books = VOCAB_STORE.getBooks() || []
  const currentBook = VOCAB_STORE.getCurrentBook

  if (books.length === 0) return null

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={styles.label}>训练: {trainingType || 'unknown'}</Text>
        <Text style={styles.bookName}>{currentBook?.name || books[0].name}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>当前词书</Text>
      <Text style={styles.bookName}>{currentBook?.name || '请选择词书'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16
  },
  compactContainer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center'
  },
  label: {
    fontSize: 14,
    color: '#999'
  },
  bookName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#17202a'
  }
})

