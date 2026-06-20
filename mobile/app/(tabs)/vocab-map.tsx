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

/* ═══ Normalized helpers ═══ */

/** Get a consistent total from either book or global summary */
function getSummaryTotal(summary: VocabularyMapData['summary']): number {
  if (summary.totalUniqueWords) return summary.totalUniqueWords
  if (summary.mastered !== undefined && summary.unpracticed !== undefined) {
    return summary.mastered + summary.learning + summary.unfamiliar + summary.unpracticed
  }
  return Math.max(summary.mastered, 1) // fallback for unknown
}

/** Get the weak ratio [0-1] from a topic stat */
function getTopicWeakRatio(t: VocabularyMapData['byTopic'][number]): number {
  if (!t.wordCount) return 0
  return t.weakCount / t.wordCount
}

/* ═══ Components ═══ */

function MasteryRing({ summary }: { summary: VocabularyMapData['summary'] }) {
  if (!summary) return null

  const total = getSummaryTotal(summary)
  const mastered = summary.masteredWords ?? summary.mastered ?? 0
  const learning = summary.learning ?? 0
  const notStarted = summary.notStartedWords ?? summary.unpracticed ?? 0
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0

  return (
    <View style={styles.ringCard}>
      <View style={styles.ringContainer}>
        <Text style={styles.ringPct}>{pct}%</Text>
        <Text style={styles.ringLabel}>掌握率</Text>
      </View>
      <View style={styles.ringStats}>
        <View style={styles.ringStatItem}>
          <Text style={styles.ringStatVal}>{mastered}</Text>
          <Text style={styles.ringStatLbl}>已掌握</Text>
        </View>
        <View style={styles.ringDivider} />
        <View style={styles.ringStatItem}>
          <Text style={styles.ringStatVal}>{learning}</Text>
          <Text style={styles.ringStatLbl}>学习中</Text>
        </View>
        <View style={styles.ringDivider} />
        <View style={styles.ringStatItem}>
          <Text style={styles.ringStatVal}>{notStarted}</Text>
          <Text style={styles.ringStatLbl}>未学习</Text>
        </View>
      </View>
    </View>
  )
}

function CategoryBar({ items }: { items: VocabularyMapData['byContentType'] }) {
  if (!items || items.length === 0) return null
  const max = Math.max(...items.map(i => i.wordCount), 1)
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>词汇类型分布</Text>
      {items.slice(0, 8).map((item, i) => (
        <View key={i} style={styles.barRow}>
          <Text style={styles.barLabel} numberOfLines={1}>{item.label}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(item.wordCount / max) * 100}%` }]} />
          </View>
          <Text style={styles.barVal}>{item.wordCount}</Text>
        </View>
      ))}
    </View>
  )
}

function WeaknessChart({ topics }: { topics: VocabularyMapData['byTopic'] }) {
  if (!topics || topics.length === 0) return null
  const maxWeak = Math.max(...topics.map(t => t.weakCount), 1)

  const sorted = [...topics].sort((a, b) => b.weakCount - a.weakCount).slice(0, 10)

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>薄弱话题 Top 10</Text>
      {sorted.map((t, i) => {
        const weakRatio = getTopicWeakRatio(t)
        const barWidth = Math.max(5, (t.weakCount / maxWeak) * 100)
        return (
          <Pressable
            key={i}
            onPress={() => router.push(`/recognition?topic=${encodeURIComponent(t.topic)}&autoStart=1`)}
            style={[styles.weakRow, { marginBottom: i === sorted.length - 1 ? 0 : spacing.xs }]}
          >
            <Text style={styles.weakRank}>#{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.weakLabel}>{t.label || t.topic}</Text>
              <View style={[styles.weakTrack, { height: 6, marginTop: 2 }]}>
                <View style={[styles.weakFill, { width: `${barWidth}%`, backgroundColor: weakRatio > 0.5 ? '#ef4444' : '#f59e0b' }]} />
              </View>
            </View>
            <Text style={[styles.weakVal, { color: weakRatio > 0.5 ? '#dc2626' : '#d97706' }]}>
              {t.weakCount}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function HeatmapGrid({ words }: { words: VocabularyMapData['words'] }) {
  if (!words || words.length === 0) return null

  const display = words.slice(0, 80)
  const maxMastery = Math.max(...display.map(w => w.mastery), 1)

  const getHeatColor = (mastery: number): string => {
    const ratio = mastery / maxMastery
    if (ratio >= 0.8) return '#22c55e'      // mastered → green
    if (ratio >= 0.4) return '#a3e635'       // learning → lime
    if (ratio > 0)   return '#fbbf24'        // unfamiliar → amber
    return '#e5e7eb'                           // unpracticed → gray
  }

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>词汇热力图</Text>
        <Text style={styles.heatHint}>{words.length} 个词汇</Text>
      </View>
      <View style={styles.heatmapGrid}>
        {display.map((w, i) => (
          <Pressable
            key={`${w.wordId}-${i}`}
            onPress={() => router.push({ pathname: '/vocabulary', params: { wordId: w.wordId } })}
            style={[styles.heatCell, { backgroundColor: getHeatColor(w.mastery) }]}
          >
            <Text style={styles.heatWord}>{w.word}</Text>
          </Pressable>
        ))}
      </View>
    </>
  )
}

function BookInfo({ book }: { book?: { code: string; name: string; wordCount: number } }) {
  if (!book) return null
  return (
    <Text style={styles.bookTitle}>
      📖 {book.name} · {book.wordCount} 词
    </Text>
  )
}

/* ═══ Screen ═══ */

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
          <Pressable
            key={t.key}
            onPress={() => setScope(t.key)}
            style={[styles.scopeTab, scope === t.key && styles.scopeActive]}
          >
            <Text style={[styles.scopeText, scope === t.key && styles.scopeTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Book title (book scope only) */}
      {scope === 'book' && <BookInfo book={mapData?.book} />}

      {/* Loading */}
      {loading && (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[{ marginTop: spacing.sm, color: colors.muted }]}>加载中...</Text>
        </View>
      )}

      {/* Data content */}
      {!loading && mapData && (
        <>
          <MasteryRing summary={mapData.summary} />
          <CategoryBar items={mapData.byContentType} />
          <WeaknessChart topics={mapData.byTopic} />

          <HeatmapGrid words={mapData.words} />

          {/* Practice weak topics button */}
          {mapData.weakestTopics && mapData.weakestTopics.length > 0 && (
            <Pressable
              onPress={() => router.push(`/recognition?topic=${encodeURIComponent(mapData.weakestTopics[0])}&autoStart=1`)}
              style={styles.practiceBtn}
            >
              <Text style={styles.practiceBtnText}>练习薄弱环节</Text>
            </Pressable>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !mapData && (
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
  weakLabel: { fontSize: 14, color: colors.text, fontWeight: '500' },
  weakVal: { fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' },
  weakTrack: { flex: 1, height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  weakFill: { height: '100%', borderRadius: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  heatHint: { fontSize: 13, color: colors.muted },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  heatCell: { width: (280 - 6 * 4) / 7, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center', margin: 2 },
  heatWord: { fontSize: 11, color: '#fff', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  practiceBtn: { marginTop: spacing.xxl, paddingVertical: spacing.lg, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center' },
  practiceBtnText: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  emptyState: { padding: spacing.xxl * 2, alignItems: 'center' },
  emptyText: { fontSize: 16, color: colors.muted },
})
