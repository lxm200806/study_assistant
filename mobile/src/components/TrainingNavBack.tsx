
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'

interface TrainingNavBackProps {
  bookCode: string
}

export default function TrainingNavBack({ bookCode }: TrainingNavBackProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.replace('/books')} style={styles.backBtn}>
        <Text style={styles.backBtnText}>¡û ·µ»Ø´Ê»ãÊé</Text>
      </TouchableOpacity>
      <Text style={styles.navTitle}>{bookCode.toUpperCase()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff'
  },
  backBtn: {
    paddingVertical: 4
  },
  backBtnText: {
    fontSize: 16,
    color: '#3157d5'
  },
  navTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#17202a'
  }
})

