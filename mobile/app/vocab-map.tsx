
import { ref, computed, onMounted } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { VOCAB_STORE } from '@/stores/vocabulary'

export default function VocabMapScreen() {
  const [scope, setScope] = ref<'book' | 'global'>('book')
  const [loading, setLoading] = ref(false)
  const [selectedBook, setSelectedBook] = ref(VOCAB_STORE.currentBook || 'ket')

  const loadMap = async () => {
    setLoading(true)
    try {
      // TODO: 调用后端 API 获取图谱数据
      console.log('Loading map for scope:', scope.value, 'book:', selectedBook.value)
    } finally {
      setLoading(false)
    }
  }

  const switchScope = (newScope: 'book' | 'global') => {
    setScope(newScope)
    if (newScope === 'book' && !selectedBook.value) {
      setSelectedBook(VOCAB_STORE.currentBook || 'ket')
    }
    loadMap()
  }

  return (
    <ScrollView style={styles.container}>
      {/* Scope Tabs */}
      <View style={styles.scopeTabs}>
        <TouchableOpacity
          style={[styles.scopeTab, scope.value === 'book' && styles.scopeTabActive]}
          onPress={() => switchScope('book')}
        >
          <Text style={styles.scopeTabText}>本图谱</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.scopeTab, scope.value === 'global' && styles.scopeTabActive]}
          onPress={() => switchScope('global')}
        >
          <Text style={styles.scopeTabText}>全局图谱</Text>
        </TouchableOpacity>
      </View>

      {/* Book Picker */}
      {scope.value === 'book' && (
        <View style={styles.bookPicker}>
          <Text style={styles.label}>选择词书:</Text>
          <View style={styles.booksRow}>
            <TouchableOpacity
              style={[styles.bookChip, selectedBook.value === 'ket' && styles.bookChipActive]}
              onPress={() => { setSelectedBook('ket'); switchScope('book') }}
            >
              <Text>KET</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bookChip, selectedBook.value === 'pet' && styles.bookChipActive]}
              onPress={() => { setSelectedBook('pet'); switchScope('book') }}
            >
              <Text>PET</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loading State */}
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size='large' color='#3157d5' />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      )}

      {/* Content */}
      {!loading && (
        <View style={styles.content}>
          <Text style={styles.title}>
            {scope.value === 'global' ? '全局词图' : selectedBook.value.toUpperCase()}
          </Text>

          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>掌握度统计</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>已掌握</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>学习中</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/home')}
          >
            <Text style={styles.btnText}>返回首页</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7f9'
  },
  scopeTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    margin: 16
  },
  scopeTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  scopeTabActive: {
    backgroundColor: '#3157d5'
  },
  scopeTabText: {
    fontSize: 16,
    color: '#999'
  },
  bookPicker: {
    padding: 16
  },
  label: {
    fontSize: 14,
    color: '#6f7a86',
    marginBottom: 8
  },
  booksRow: {
    flexDirection: 'row',
    gap: 8
  },
  bookChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e1e5ea'
  },
  bookChipActive: {
    backgroundColor: '#3157d5',
    borderColor: '#3157d5'
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6f7a86'
  },
  content: {
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#17202a',
    marginBottom: 16
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 18,
    color: '#999',
    marginBottom: 12
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  statItem: {
    alignItems: 'center'
  },
  statValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#3157d5'
  },
  statLabel: {
    fontSize: 14,
    color: '#999'
  },
  actionBtn: {
    width: '100%',
    height: 56,
    backgroundColor: '#3157d5',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnText: {
    color: '#fff',
    fontSize: 18
  }
})

