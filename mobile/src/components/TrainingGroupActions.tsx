
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface TrainingGroupActionsProps {
  onNextGroup: () => void
  onFinish: () => void
}

export default function TrainingGroupActions({ onNextGroup, onFinish }: TrainingGroupActionsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onNextGroup} style={[styles.btn, styles.secondaryBtn]}>
        <Text style={styles.btnText}>下一组</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onFinish} style={[styles.btn, styles.primaryBtn]}>
        <Text style={styles.btnText}>完成本组</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20
  },
  btn: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryBtn: {
    backgroundColor: '#3157d5'
  },
  secondaryBtn: {
    backgroundColor: '#f0f0f0'
  },
  btnText: {
    fontSize: 18,
    fontWeight: '700'
  }
})

