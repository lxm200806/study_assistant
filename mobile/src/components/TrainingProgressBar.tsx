
import { View, Text, StyleSheet } from 'react-native'

interface TrainingProgressBarProps {
  current: number
  total: number
}

export default function TrainingProgressBar({ current, total }: TrainingProgressBarProps) {
  const pct = Math.round((current / total) * 100)
  
  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: \\%\ }]} />
      </View>
      <Text style={styles.progressText}>{current} / {total}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    height: 6,
    backgroundColor: '#e1e5ea',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 20
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 3
  },
  progressText: {
    position: 'absolute',
    right: 8,
    top: -16,
    fontSize: 14,
    color: '#6f7a86'
  }
})

