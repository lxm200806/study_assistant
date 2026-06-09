import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { VOCAB_STORE, setMeaningType, getMeaningType, type MeaningType } from '@/stores/vocabulary'
import { listVocabulary, getBookProgress, submitPractice, type WordEntry } from '@/api/client'
import { colors, spacing } from '@/theme'

const TABS = [
  { key: 'listening', label: '听力', icon: '🎧' },
  { key: 'speaking', label: '口语', icon: '🎙️' },
  { key: 'reading', label: '阅读', icon: '📖' },
  { key: 'writing', label: '写作', icon: '✍️' },
] as const

type TabKey = typeof TABS[number]['key']

const FILTERS = [
  { key: 'all' as const, label: '全部' },
  { key: 'mastered' as const, label: '已掌握' },
  { key: 'learning' as const, label: '学习中' },
  { key: 'weak' as const, label: '需加强' },
]

function getMasteryLabel(mastery?: number): string {
  if (!mastery || mastery === 0) return '未学习'
  if (mastery >= 4) return '已掌握'
  if (mastery >= 2) return '学习中'
  return '需加强'
}

function getMasteryLevel(mastery?: number): string {
  if (!mastery || mastery === 0) return 'notStarted'
  if (mastery >= 4) return 'mastered'
  if (mastery >= 2) return 'learning'
  return 'weak'
}

function getMasteryCount(type: TabKey): number {
  const statsMap = VOCAB_STORE._statsMap
  if (!statsMap) return 0
  let count = 0
  statsMap.forEach(w => {
    if (w.type === type || true) count++
  })
  return count
}

export default function VocabularyScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('listening')
  const [activeFilter, setActiveFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [words, setWords] = useState<WordEntry[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [detailWord, setDetailWord] = useState<WordEntry | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const PAGE_SIZE = 40

  const loadWords = useCallback(async () => {
    setLoading(true)
    try {
      await VOCAB_STORE.loadState()
      const r = await listVocabulary(currentPage, PAGE_SIZE)
      setWords(r.data || [])
      // Estimate total pages (server doesn't return total in this API; use word count / page size)
      setTotalPages(Math.max(1, Math.ceil((r.data?.length || 0) > 0 ? 1 : 1)))
    } catch { setWords([]); setTotalPages(1) }
    finally { setLoading(false) }
  }, [currentPage])

  useEffect(() => { loadWords() }, [loadWords])

  // Stats summary
  const statsMap = VOCAB_STORE._statsMap
  const currentStats = useMemo(() => {
    const allWords = Array.from(statsMap?.values() || [])
    return {
      total: allWords.length,
      mastered: allWords.filter(w => w.mastery >= 4).length,
      learning: allWords.filter(w => w.mastery > 0 && w.mastery < 4).length,
      weak: allWords.filter(w => w.mastery <= 1).length,
    }
  }, [statsMap])

  // Filtered & paginated list
  const filteredList = useMemo(() => {
    let list = Array.from(statsMap?.values() || [])
    if (activeFilter === 'mastered') list = list.filter(w => w.mastery >= 4)
    else if (activeFilter === 'learning') list = list.filter(w => w.mastery > 0 && w.mastery < 4)
    else if (activeFilter === 'weak') list = list.filter(w => w.mastery <= 1)
    return list
  }, [statsMap, activeFilter])

  const paginatedList = filteredList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const displayTotalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE))

  useEffect(() => { setCurrentPage(1) }, [activeTab, activeFilter])

  const handleWordTap = (word: WordEntry) => { setDetailWord(word); setShowDetail(true) }

  const handleSpeakWord = async () => {
    if (!detailWord) return
    try {
      const baseUrl = require('expo-constants').default?.expoConfig?.extra?.apiBaseUrl || 'http://127.0.0.1:3004/api'
      await fetch(`${baseUrl}/tts/play`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: detailWord.word }),
      })
    } catch {}
  }

  const goToBook = () => router.push('/books')
  const goToMap = () => router.push('/vocab-map')
  const goToTraining = (tab: string) => {
    const routes: Record<string, string> = { listening: '/listening', speaking: '/speaking', reading: '/vocabulary', writing: '/spelling' }
    router.push(routes[tab] || '/')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadWords()}>
        <View style={styles.tabRow}>
          {TABS.map(t => (
            <Pressable key={t.key} onPress={() => setActiveTab(t.key)}
              style={[styles.tabItem, activeTab === t.key && styles.tabActive]}>
              <Text style={{ fontSize: 28, marginBottom: 4 }}>{t.icon}</Text>
              <Text style={[styles.tabLabel, activeTab === t.key && { color: colors.surface }]}>{t.label}</Text>
              {getMasteryCount(t.key) > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{getMasteryCount(t.key)}</Text></View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Stats summary */}
        <View style={styles.statsCard}>
          {Object.entries(currentStats).map(([key, val]) => (
            <View key={key} style={[styles.statItem, statsMap && Object.keys(statsMap).length === 0 ? null : styles.divider]}>
              <Text style={styles.statVal}>{val}</Text>
              <Text style={styles.statLbl}>{key === 'total' ? '累计学习' : key === 'mastered' ? '已掌握' : key === 'learning' ? '学习中' : '需加强'}</Text>
            </View>
          ))}
        </View>

        {/* Filters */}
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <Pressable key={f.key} onPress={() => setActiveFilter(f.key)}
              style={[styles.filterItem, activeFilter === f.key && styles.filterActive]}>
              <Text style={[styles.filterLabel, activeFilter === f.key && { color: colors.surface }]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Word list */}
        {filteredList.length > 0 ? (
          filteredList.slice(0, PAGE_SIZE).map(word => (
            <Pressable key={word.word} onPress={() => handleWordTap(word)} style={styles.wordCard}>
              <View style={styles.wordHeader}>
                <View style={styles.wordTitleRow}>
                  <Text style={styles.wordText}>{word.word}</Text>
                  <Text style={[styles.levelBadge, `level-${getMasteryLevel(word.mastery)}`]}>{getMasteryLabel(word.mastery)}</Text>
                </View>
                <View style={styles.starsRow}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Text key={i} style={[styles.star, (word.mastery || 0) > i && styles.starActive]}>{'★'}</Text>
                  ))}
                </View>
              </View>
              <View style={styles.wordInfo}>
                {word.phonetic ? <Text style={styles.phonetic}>{word.phonetic}</Text> : null}
                <Text style={styles.meaning}>{word.meaning || '暂无释义'}</Text>
              </View>
              <View style={styles.wordFooter}>
                <Text style={styles.practiceCount}>练习 {word.count || 0} 次</Text>
                <Text style={styles.lastPractice}>{word.type || ''}</Text>
              </View>
            </Pressable>
          ))
        ) : loading ? (
          <View style={{ alignItems: 'center', padding: spacing.xxl }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 64, marginBottom: spacing.md }}>📖</Text>
            <Text style={styles.emptyText}>暂无词汇数据</Text>
            <Text style={styles.emptyHint}>开始训练来积累词汇吧</Text>
          </View>
        )}

        {/* Pagination */}
        {displayTotalPages > 1 && (
          <View style={styles.paginationRow}>
            <Pressable onPress={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              style={[styles.pageBtn, currentPage <= 1 && styles.pageDisabled]}>
              <Text>上一页</Text>
            </Pressable>
            <Text style={styles.pageInfo}>第 {currentPage} / {displayTotalPages} 页（共 {filteredList.length} 词）</Text>
            <Pressable onPress={() => setCurrentPage(p => Math.min(displayTotalPages, p + 1))} disabled={currentPage >= displayTotalPages}
              style={[styles.pageBtn, currentPage >= displayTotalPages && styles.pageDisabled]}>
              <Text>下一页</Text>
            </Pressable>
          </View>
        )}

        {/* Bottom action buttons */}
        <View style={styles.bottomActions}>
          <Pressable onPress={goToBook} style={[styles.bottomBtn, styles.btnPrimary]}><Text style={styles.bottomBtnText}>📚 词汇书管理</Text></Pressable>
          <Pressable onPress={goToMap} style={[styles.bottomBtn, styles.btnSecondary]}><Text style={styles.bottomBtnTextSecondary}>📊 学习图谱</Text></Pressable>
        </View>
      </RefreshControl>}
    </ScrollView>

    {/* Word detail modal */}
    <Modal visible={showDetail} transparent animationType="fade" onRequestClose={() => setShowDetail(false)}>
      {detailWord && (
        <Pressable style={styles.modalOverlay} onPress={() => setShowDetail(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalWord}>{detailWord.word}</Text>
            {detailWord.phonetic && <Text style={styles.modalPhonetic}>{detailWord.phonetic}</Text>}
            <Text style={styles.meaningLabel}>{getMeaningType() === 'chinese' ? '中文释义' : 'Definition'}</Text>
            <Text style={styles.modalMeaning}>{detailWord.meaning || '暂无释义'}</Text>
            <View style={styles.detailStats}>
              <Text style={styles.detailStatText}>掌握度: {getMasteryLabel(detailWord.mastery)}</Text>
              <Text style={styles.detailStatText}>练习次数: {detailWord.count || 0}</Text>
            </View>
            <Pressable onPress={handleSpeakWord} style={[styles.actionBtn, styles.actionBtnPrimary, { marginTop: spacing.md }]}>
              <Text style={styles.actionBtnText}>🔊 播放发音</Text>
            </Pressable>
            <Pressable onPress={() => setShowDetail(false)} style={[styles.actionBtn, styles.actionBtnSecondary]}>
              <Text style={styles.actionBtnTextSecondary}>关闭</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  tabRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, padding: spacing.xs, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: 12, flexDirection: 'column' },
  tabActive: { backgroundColor: colors.primary },
  tabLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  badge: { position: 'absolute', top: 4, right: 10, backgroundColor: '#fde8e8', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, color: colors.danger, fontWeight: '700' },
  statsCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  statItem: { flex: 1, alignItems: 'center' },
  divider: { borderRightWidth: 1, borderRightColor: colors.line, paddingHorizontal: spacing.sm },
  statVal: { fontSize: 28, fontWeight: '800', color: colors.primary },
  statLbl: { fontSize: 12, color: colors.muted, marginTop: 4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  filterItem: { flex: 1, minWidth: 90, alignItems: 'center', paddingVertical: spacing.xs, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  wordCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.line },
  wordHeader: { marginBottom: spacing.sm },
  wordTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordText: { fontSize: 22, fontWeight: '700', color: colors.text },
  levelBadge: { fontSize: 11, paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: 12, fontWeight: '600' },
  starsRow: { flexDirection: 'row', gap: 3, marginTop: spacing.xs },
  star: { fontSize: 16, color: '#ddd' },
  starActive: { color: '#ffc107' },
  wordInfo: { marginBottom: spacing.sm },
  phonetic: { fontSize: 14, color: colors.muted, fontStyle: 'italic', marginBottom: 4 },
  meaning: { fontSize: 16, color: colors.text, fontWeight: '500' },
  wordFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  practiceCount: { fontSize: 12, color: '#999' },
  lastPractice: { fontSize: 12, color: '#999' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 20, fontWeight: '600', color: colors.muted },
  emptyHint: { fontSize: 14, color: '#bbb', marginTop: spacing.sm },
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, marginBottom: spacing.xl },
  pageBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, backgroundColor: colors.primary, borderRadius: 16 },
  pageDisabled: { opacity: 0.4 },
  pageInfo: { fontSize: 13, color: colors.muted },
  bottomActions: { gap: spacing.sm },
  bottomBtn: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  bottomBtnText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
  bottomBtnTextSecondary: { color: colors.text, fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalContent: { width: '85%', backgroundColor: colors.surface, borderRadius: 20, padding: spacing.xxl },
  modalWord: { fontSize: 36, fontWeight: '800', color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
  modalPhonetic: { fontSize: 16, color: colors.muted, fontStyle: 'italic', marginBottom: spacing.md, textAlign: 'center' },
  meaningLabel: { fontSize: 12, color: colors.muted, marginBottom: spacing.xs },
  modalMeaning: { fontSize: 18, color: colors.text, fontWeight: '500', lineHeight: 26, marginBottom: spacing.md },
  detailStats: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md },
  detailStatText: { fontSize: 14, color: '#999' },
  actionBtn: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginBottom: spacing.sm },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnSecondary: { backgroundColor: '#f0f0f0' },
  actionBtnText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
  actionBtnTextSecondary: { color: colors.text, fontSize: 16, fontWeight: '600' },
})
