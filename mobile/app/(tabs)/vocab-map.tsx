import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { loadBookMap, loadGlobalMap, type VocabularyMapData } from '@/api/client'
import { VOCAB_STORE } from '@/stores/vocabulary'
import { colors, spacing } from '@/theme'

const SCOPE_TABS = [
  { key: 'book' as const, label: '本书图谱' },
  { key: 'global' as const, label: '全局图谱' },
]

function MasteryRing({ summary }: { summary: VocabularyMapData['summary'] }) {
  if (!summary) return null
  const total = summary.totalUniqueWords || 1
  const pct = Math.round((summary.masteredWords / total) * 100)

  return (
    <View style={styles.ringCard}>
      <View style={styles.ringContainer}>
        <Text style={styles.ringPct}>{pct}%</Text>
        <Text style={styles.ringLabel}>掌握率</Text>
      </View>
      <View style={styles.ringStats}>
        <View style={styles.ringStatItem}>
          <Text style={styles.ringStatVal}>{summary.masteredWords}</Text>
          <Text style={styles.ringStatLbl}>已掌握</Text>
        </View>
        <View style={styles.ringDivider} />
        <View style={styles.ringStatItem}>
          <Text style={styles.ringStatVal}>{summary.learningWords || 0}</Text>
          <Text style={styles.ringStatLbl}>学习中</Text>
        </View>
        <View style={styles.ringDivider} />
        <View style={styles.ringStatItem}>
          <Text style={styles.ringStatVal}>{summary.notStartedWords || 0}</Text>
          <Text style={styles.ringStatLbl}>未学习</Text>
        </View>
      </View>
    </View>
  )
}

function CategoryBar({ items }: { items: VocabularyMapData['byContentType'] }) {
  if (!items || items.length === 0) return null
  const max = Math.max(...items.map(i => i.count), 1)
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>词汇类型分布</Text>
      {items.slice(0, 8).map((item, i) => (
        <View key={i} style={styles.barRow}>
          <Text style={styles.barLabel} numberOfLines={1}>{item.category}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(item.count / max) * 100}%` }]} />
          </View>
          <Text style={styles.barVal}>{item.count}</Text>
        </View>
      ))}
    </View>
  )
}

function WeaknessChart({ topics, weakest }: { topics: VocabularyMapData['byTopic']; weakest: VocabularyMapData['weakestTopics'] }) {
  if (!topics || topics.length === 0) return null
  const sorted = [...topics].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 10)

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>薄弱话题 Top 10</Text>
      {sorted.map((t, i) => (
        <Pressable key={i} onPress={() => router.push(`/recognition?topic=${encodeURIComponent(t.topic)}&autoStart=1`)} style={styles.weakRow}>
          <Text style={styles.weakRank}>#{i + 1}</Text>
          <Text style={styles.weakLabel}>{t.topic || '未分类'}</Text>
          <View style={styles.weakTrack}>
            <View style={[styles.weakFill, { width: `${Math.max(5, (t.score / 5) * 100)}%` }]} />
          </View>
        </Pressable>
      ))}
    </View>
  )
}

function HeatmapGrid({ words }: { words: VocabularyMapData['words'] }) {
  if (!words || words.length === 0) return null
  const display = words.slice(0, 80)

  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>词汇热力图</Text>
      <Text style={styles.heatHint}>{words.length} 个词汇</Text>
    </View>
  )
}

export default function VocabularyMapScreen() {
  const [scope, setScope] = useState<'book' | 'global'>('book')
  const [loading, setLoading] = useState(false)
  const [mapData, setMapData] = useState<VocabularyMapData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (scope === 'global') {
        const r = await loadGlobalMap()
        setMapData(r.data || null)
      } else {
        const code = VOCAB_STORE.currentBook || 'ket'
        const r = await loadBookMap(code)
        setMapData(r.data || null)
      }
    } catch { setMapData(null) }
    finally { setLoading(false) }
  }, [scope])

  useEffect(() => { load() }, [load])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Scope tabs */}
      <View style={styles.scopeRow}>
        {SCOPE_TABS.map(t => (
          <Pressable key={t.key} onPress={() => setScope(t.key)} style={[styles.scopeTab, scope === t.key && styles.scopeActive]}>
            <Text style={[styles.scopeText, scope === t.key && styles.scopeTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Global banner */}
      {scope === 'global' && mapData?.summary.totalUniqueWords ? (
        <View style={styles.globalBanner}>
          <Text style={styles.globalStat}>总词汇: {mapData.summary.totalUniqueWords}</Text>
          <Text style={styles.globalStat}>已掌握: {mapData.summary.masteredWords}</Text>
        </View>
      ) : null}

      {/* Book title */}
      {mapData?.book ? (
        <Text style={styles.bookTitle}>{mapData.book.name} · {mapData.book.wordCount} 词</Text>
      ) : null}

      {loading ? (
        <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ marginTop: spacing.md, color: colors.muted }}>加载中...</Text>
        </View>
      ) : mapData ? (
        <>
          <MasteryRing summary={mapData.summary} />
          <CategoryBar items={mapData.byContentType} />
          <WeaknessChart topics={mapData.byTopic} weakest={mapData.weakestTopics} />

          {/* Heatmap */}
          {mapData.words && mapData.words.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>词汇热力图</Text>
                <Text style={styles.heatHint}>{mapData.words.length} 个词汇</Text>
              </View>
              <View style={styles.heatmapGrid}>
                {mapData.words.slice(0, 80).map((w, i) => (
                  <View key={i} style={[styles.heatCell, { opacity: 0.2 + (w.mastery || 0) * 0.16 }]} >
                    <Text style={styles.heatWord}>{w.word}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Practice weak topics button */}
          {mapData.weakestTopics && mapData.weakestTopics.length > 0 && (
            <Pressable onPress={() => router.push(`/recognition?topic=${encodeURIComponent(mapData.weakestTopics[0].topic)}&autoStart=1`)} style={styles.practiceBtn}>
              <Text style={styles.practiceBtnText}>练习薄弱环节</Text>
            </Pressable>
          )}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 64, marginBottom: spacing.md }}>📊</Text>
          <Text style={styles.emptyText}>暂无数据，请先登录并开始训练</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  scopeRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: spacing.xs, marginBottom: spacing.md },
  scopeTab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: 10 },
  scopeActive: { backgroundColor: colors.primary },
  scopeText: { fontSize: 14, color: colors.muted },
  scopeTextActive: { color: colors.surface, fontWeight: '700' },
  globalBanner: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: colors.primary, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  globalStat: { fontSize: 14, color: colors.surface, fontWeight: '600' },
  bookTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  ringCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md },
  ringContainer: { alignItems: 'center', marginBottom: spacing.md },
  ringPct: { fontSize: 48, fontWeight: '800', color: colors.primary },
  ringLabel: { fontSize: 13, color: colors.muted },
  ringStats: { flexDirection: 'row', justifyContent: 'space-around' },
  ringStatItem: { alignItems: 'center', flex: 1 },
  ringStatVal: { fontSize: 24, fontWeight: '700', color: colors.text },
  ringStatLbl: { fontSize: 12, color: colors.muted, marginTop: 2 },
  ringDivider: { width: 1, height: 32, backgroundColor: colors.line, marginHorizontal: spacing.sm },
  chartCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md },
  chartTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  barLabel: { width: 80, fontSize: 13, color: '#666' },
  barTrack: { flex: 1, height: 12, backgroundColor: '#f0f0f0', borderRadius: 6, overflow: 'hidden', marginHorizontal: spacing.sm },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 6 },
  barVal: { width: 30, fontSize: 13, color: colors.text, fontWeight: '600', textAlign: 'right' },
  weakRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  weakRank: { width: 24, fontSize: 12, color: '#999' },
  weakLabel: { flex: 1, fontSize: 14, color: colors.text },
  weakTrack: { width: 120, height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  weakFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  heatHint: { fontSize: 13, color: colors.muted },
  heatmapGrid: { flexDirection: 'flex-wrap', gap: spacing.xs, flexWrap: 'wrap' },
  heatCell: { width: (280 - 8 * 6) / 6, height: 36, backgroundColor: '#eef2ff', borderRadius: 6, alignItems: 'center', justifyContent: 'center', margin: 2 },
  heatWord: { fontSize: 11, color: colors.text },
  practiceBtn: { marginTop: spacing.xxl, paddingVertical: spacing.lg, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center' },
  practiceBtnText: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  emptyState: { padding: spacing.xxl * 2, alignItems: 'center' },
  emptyText: { fontSize: 16, color: colors.muted },
})
