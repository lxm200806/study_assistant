
import { View, Text, StyleSheet } from 'react-native'

interface TrainingAnalysisProps {
  analysis: {
    correct: number
    total: number
    accuracy: number
  }
  newlyCovered?: number
  dueCount?: number
}

export default function TrainingAnalysis({ analysis, newlyCovered = 0, dueCount = 0 }: TrainingAnalysisProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.statsTitle}>本组统计</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{analysis.correct}/{analysis.total}</Text>
          <Text style={styles.statLabel}>正确</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(analysis.accuracy)}%</Text>
          <Text style={styles.statLabel}>正确率</Text>
        </View>
      </View>
      
      {dueCount > 0 && (
        <View style={styles.dueCard}>
          <Text style={styles.dueText}>?? 复习提醒: {dueCount} 个词到期复习</Text>
        </View>
      )}
      
      {newlyCovered > 0 && (
        <View style={styles.newCard}>
          <Text style={styles.newText}>?? 新词覆盖: {newlyCovered} 个</Text>
        </View>
      )}
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
  statsTitle: {
    fontSize: 18,
    color: '#999',
    marginBottom: 16
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  statItem: {
    alignItems: 'center'
  },
  statValue: {
    fontSize: 40,
    fontWeight: '700',
    color: '#3157d5'
  },
  statLabel: {
    fontSize: 14,
    color: '#999'
  },
  dueCard: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff3e0',
    borderRadius: 8
  },
  dueText: {
    fontSize: 16,
    color: '#e65100'
  },
  newCard: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#eef2ff',
    borderRadius: 8
  },
  newText: {
    fontSize: 16,
    color: '#3157d5'
  }
})

