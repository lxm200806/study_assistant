import prisma from '../prisma/client'

const vocabularyData = [
  { word: 'apple', meaning: '苹果', phonetic: '/ˈæpl/', exampleSentence: 'I eat an apple every day.' },
  { word: 'banana', meaning: '香蕉', phonetic: '/bəˈnænə/', exampleSentence: 'Bananas are yellow.' },
  { word: 'cat', meaning: '猫', phonetic: '/kæt/', exampleSentence: 'The cat is sleeping.' },
  { word: 'dog', meaning: '狗', phonetic: '/dɒɡ/', exampleSentence: 'I have a pet dog.' },
  { word: 'elephant', meaning: '大象', phonetic: '/ˈelɪfənt/', exampleSentence: 'Elephants are very big.' },
  { word: 'flower', meaning: '花', phonetic: '/ˈflaʊər/', exampleSentence: 'The flower is beautiful.' },
  { word: 'garden', meaning: '花园', phonetic: '/ˈɡɑːdn/', exampleSentence: 'She plants flowers in the garden.' },
  { word: 'house', meaning: '房子', phonetic: '/haʊs/', exampleSentence: 'This is my house.' },
  { word: 'island', meaning: '岛屿', phonetic: '/ˈaɪlənd/', exampleSentence: 'We visited a tropical island.' },
  { word: 'jungle', meaning: '丛林', phonetic: '/ˈdʒʌŋɡl/', exampleSentence: 'Many animals live in the jungle.' },
  { word: 'kitchen', meaning: '厨房', phonetic: '/ˈkɪtʃɪn/', exampleSentence: 'Mom is cooking in the kitchen.' },
  { word: 'library', meaning: '图书馆', phonetic: '/ˈlaɪbrəri/', exampleSentence: 'I study in the library.' },
  { word: 'mountain', meaning: '山', phonetic: '/ˈmaʊntən/', exampleSentence: 'We climbed the mountain.' },
  { word: 'notebook', meaning: '笔记本', phonetic: '/ˈnəʊtbʊk/', exampleSentence: 'I write notes in my notebook.' },
  { word: 'orange', meaning: '橙子', phonetic: '/ˈɒrɪndʒ/', exampleSentence: 'Oranges are rich in vitamin C.' },
  { word: 'penguin', meaning: '企鹅', phonetic: '/ˈpeŋɡwɪn/', exampleSentence: 'Penguins live in Antarctica.' },
  { word: 'question', meaning: '问题', phonetic: '/ˈkwestʃən/', exampleSentence: 'Do you have any questions?' },
  { word: 'rabbit', meaning: '兔子', phonetic: '/ˈræbɪt/', exampleSentence: 'The rabbit has long ears.' },
  { word: 'sunshine', meaning: '阳光', phonetic: '/ˈsʌnʃaɪn/', exampleSentence: 'The sunshine is warm.' },
  { word: 'teacher', meaning: '老师', phonetic: '/ˈtiːtʃər/', exampleSentence: 'My teacher is very kind.' },
  { word: 'umbrella', meaning: '雨伞', phonetic: '/ʌmˈbrelə/', exampleSentence: 'Take an umbrella with you.' },
  { word: 'vegetable', meaning: '蔬菜', phonetic: '/ˈvedʒtəbl/', exampleSentence: 'Eat more vegetables.' },
  { word: 'water', meaning: '水', phonetic: '/ˈwɔːtər/', exampleSentence: 'Drink more water.' },
  { word: 'yellow', meaning: '黄色', phonetic: '/ˈjeləʊ/', exampleSentence: 'Yellow is my favorite color.' },
  { word: 'zebra', meaning: '斑马', phonetic: '/ˈzebrə/', exampleSentence: 'Zebras have black and white stripes.' }
]

export async function initVocabulary() {
  try {
    const existingCount = await prisma.vocabulary.count()
    
    if (existingCount === 0) {
      console.log('Initializing vocabulary data...')
      
      await prisma.vocabulary.createMany({
        data: vocabularyData
      })
      
      console.log('Vocabulary initialized successfully!')
    }
  } catch (error) {
    console.error('Error initializing vocabulary:', error)
  }
}