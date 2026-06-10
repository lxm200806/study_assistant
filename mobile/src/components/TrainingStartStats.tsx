
import { View, Text, StyleSheet } from 'react-native'

interface TrainingStartStatsProps {
  total: number
  mastered: number
}

export default function TrainingStartStats({ total, mastered }: TrainingStartStatsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>±¾´Î¿ÉÑµÁ·</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>´Ê</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{mastered}</Text>
          <Text style={styles.statLabel}>ÕÆÎÕ</Text>
        </View>
      </View>
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
  title: {
    fontSize: 18,
    color: '#999',
    marginBottom: 12
  },
  statsRow: {
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
  }
})

