
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'

export default function TrainingFinishActions() {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.push('/vocab-map')} style={[styles.btn, styles.primaryBtn]}>
        <Text style={styles.btnText}>查看掌握分析</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/home')} style={[styles.btn, styles.secondaryBtn]}>
        <Text style={styles.btnText}>返回首页</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    marginTop: 20
  },
  btn: {
    width: '100%',
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
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e1e5ea'
  },
  btnText: {
    fontSize: 18,
    fontWeight: '700'
  }
})

