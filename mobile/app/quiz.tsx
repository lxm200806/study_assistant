
import { ref, computed } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { VOCAB_STORE } from '@/stores/vocabulary'

export default function QuizScreen() {
  const [started, setStarted] = ref(false)
  const [finished, setFinished] = ref(false)
  const [words, setWords] = ref([])
  const [currentIndex, setCurrentIndex] = ref(0)
  const [options, setOptions] = ref([])
  const [selected, setSelected] = ref(-1)
  const [showAnswer, setShowAnswer] = ref(false)

  const startQuiz = async () => {
    if (!VOCAB_STORE.currentBook) return
    setStarted(true)
    
    // TODO: 调用 quiz API 获取题目
    // const res = await getQuizWords(VOCAB_STORE.currentBook, 30)
    // setWords(res.data || [])
    
    // Mock data for now
    setWords([
      { id: '1', word: 'apple', meaning: '苹果' },
      { id: '2', word: 'banana', meaning: '香蕉' }
    ])
    setOptions(['apple', 'banana', 'orange', 'grape'])
  }

  const selectOption = (i: number) => {
    if (showAnswer.value) return
    setSelected(i)
    setShowAnswer(true)
    
    // TODO: 记录答案
  }

  const nextQuestion = () => {
    if (currentIndex.value >= words.value.length - 1) {
      setFinished(true)
      return
    }
    setCurrentIndex(prev => prev + 1)
    setSelected(-1)
    setShowAnswer(false)
  }

  // Show start screen
  if (!started && !finished) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.startScreen}>
          <Text style={styles.icon}>??</Text>
          <Text style={styles.title}>阶段模拟测试</Text>
          <Text style={styles.desc}>30题限时四选一，检验掌握程度（不更新复习计划）</Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={startQuiz}
          >
            <Text style={styles.btnText}>开始测试</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  // Show result screen
  if (finished) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.resultScreen}>
          <Text style={styles.icon}>??</Text>
          <Text style={styles.title}>测试完成</Text>
          <Text style={styles.score}>2/2 · 100%</Text>
          
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/vocab-map')}
          >
            <Text style={styles.btnText}>查看掌握分析</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/home')}
          >
            <Text style={styles.btnText}>返回首页</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  // Show quiz screen
  return (
    <ScrollView style={styles.container}>
      <View style={styles.quizHeader}>
        <Text>{currentIndex.value + 1} / {words.value.length}</Text>
        <Text>60s</Text>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionLabel}>请选择正确的英文单词</Text>
        <Text style={styles.questionWord}>{words.value[currentIndex.value]?.word || '...'}</Text>
        <Text style={styles.questionHint}>{words.value[currentIndex.value]?.meaning || '释义'}</Text>
      </View>

      <View style={styles.options}>
        {options.value.map((opt: string, i: number) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.option,
              selected === i && styles.selected,
              showAnswer && getOptionClass(i)
            ]}
            onPress={() => selectOption(i)}
          >
            <Text>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {showAnswer && (
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={nextQuestion}
        >
          <Text style={styles.btnText}>下一题</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const getOptionClass = (i: number) => {
  // TODO: 判断正确/错误样式
  return ''
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  startScreen: {
    alignItems: 'center',
    padding: 60
  },
  resultScreen: {
    alignItems: 'center',
    padding: 60
  },
  icon: {
    fontSize: 100,
    marginBottom: 30
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: '#17202a'
  },
  desc: {
    fontSize: 20,
    color: '#6f7a86',
    textAlign: 'center',
    marginVertical: 20
  },
  startBtn: {
    backgroundColor: '#3157d5',
    paddingHorizontal: 40,
    paddingVertical: 24,
    borderRadius: 40
  },
  resultBtn: {
    backgroundColor: '#3157d5',
    width: '100%',
    paddingVertical: 24,
    borderRadius: 40,
    marginTop: 16
  },
  primaryBtn: {
    backgroundColor: '#3157d5',
    width: '100%',
    paddingVertical: 24,
    borderRadius: 40,
    marginBottom: 16
  },
  secondaryBtn: {
    backgroundColor: '#f5f5f5',
    color: '#17202a',
    width: '100%',
    paddingVertical: 24,
    borderRadius: 40
  },
  btnText: {
    color: '#fff',
    fontSize: 20
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    marginHorizontal: 20,
    marginTop: 20,
    textAlign: 'center'
  },
  questionLabel: {
    fontSize: 18,
    color: '#6f7a86'
  },
  questionWord: {
    fontSize: 32,
    fontWeight: '700',
    color: '#17202a',
    marginTop: 16
  },
  questionHint: {
    fontSize: 16,
    color: '#6f7a86',
    marginTop: 8
  },
  options: {
    marginHorizontal: 20,
    marginTop: 24
  },
  option: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12
  },
  selected: {
    borderColor: '#3157d5',
    borderWidth: 2
  },
  nextBtn: {
    backgroundColor: '#3157d5',
    width: '100%',
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 20,
    borderRadius: 12
  }
})

