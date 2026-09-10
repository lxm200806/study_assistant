// 把逐题审核后的语境题、使用正误题追加到 raw pack。
const fs = require('fs')
const path = require('path')
const { loadCompiledPack, writeSplitPack } = require('./idiom-files')

const reviewDir = path.join(__dirname, 'work/exam-reviewed')
const batchDir = path.join(__dirname, 'work/exam-batches')
const pack = loadCompiledPack()
const baseByWord = new Map(
  pack.points
    .filter(point => point.question_type === 'recite')
    .map(point => [point.lemma, point])
)
const validWords = new Set(baseByWord.keys())
const activeDifficultyByWord = new Map(
  [...baseByWord.values()]
    .filter(point => point.active !== false)
    .map(point => [point.lemma, point.difficulty])
)
const reviews = new Map()
const allowedChoicesByWord = new Map()

for (const name of fs.readdirSync(batchDir).filter(item => item.endsWith('.json')).sort()) {
  for (const row of JSON.parse(fs.readFileSync(path.join(batchDir, name), 'utf8'))) {
    allowedChoicesByWord.set(row.word, new Set([
      row.word,
      ...(row.candidateWords || []).map(item => item.word)
    ]))
  }
}

function usageAnswerLabel(value) {
  if (value === true || value === 'true' || value === '对') return '对'
  if (value === false || value === 'false' || value === '错') return '错'
  return ''
}

for (const name of fs.readdirSync(reviewDir).filter(item => item.endsWith('-reviewed.json')).sort()) {
  const rows = JSON.parse(fs.readFileSync(path.join(reviewDir, name), 'utf8'))
  for (const row of rows) {
    if (!row.word || reviews.has(row.word)) throw new Error(`${name}: 词条缺失或重复 ${row.word}`)
    if (!baseByWord.has(row.word)) throw new Error(`${name}: 未知词条 ${row.word}`)
    if (!String(row.contextPrompt || '').includes('____')) throw new Error(`${name}: ${row.word} 语境题没有空缺`)
    if (!Array.isArray(row.contextChoices) || row.contextChoices.length !== 4 || new Set(row.contextChoices).size !== 4) {
      throw new Error(`${name}: ${row.word} 的语境选项无效`)
    }
    if (!row.contextChoices.includes(row.word)) throw new Error(`${name}: ${row.word} 的语境选项不含答案`)
    if (row.contextChoices.some(word => !validWords.has(word))) throw new Error(`${name}: ${row.word} 使用了词库外选项`)
    const allowedChoices = allowedChoicesByWord.get(row.word) || new Set()
    if (row.contextChoices.some(word => !allowedChoices.has(word))) {
      throw new Error(`${name}: ${row.word} 使用了该题候选池外选项`)
    }
    const difficulty = activeDifficultyByWord.get(row.word)
    if (row.contextChoices.some(word => activeDifficultyByWord.get(word) !== difficulty)) {
      throw new Error(`${name}: ${row.word} 使用了不同难度或已下架的选项`)
    }
    row.usageAnswer = usageAnswerLabel(row.usageAnswer)
    if (!row.usageAnswer) throw new Error(`${name}: ${row.word} 使用正误答案无效`)
    if (!String(row.usageSentence || '').includes(row.word)) throw new Error(`${name}: 使用正误句未出现 ${row.word}`)
    if (String(row.usageExplanation || '').trim().length < 6) throw new Error(`${name}: ${row.word} 缺少解析`)
    reviews.set(row.word, row)
  }
}

const expected = [...baseByWord.values()].filter(point =>
  point.active !== false && ['primary', 'xiaoshengchu'].includes(point.difficulty)
).length
if (reviews.size !== expected) throw new Error(`审核结果应有 ${expected} 条，实际 ${reviews.size} 条`)

pack.points = pack.points.filter(point => !['context_choice', 'usage_judge'].includes(point.question_type))
for (const review of reviews.values()) {
  const base = baseByWord.get(review.word)
  const common = {
    ...base,
    audience: base.difficulty === 'primary' ? 'all' : 'upper',
    active: true
  }
  pack.points.push({
    ...common,
    key: `${base.key}:context_choice`,
    prompt: review.contextPrompt,
    answer: review.word,
    question_type: 'context_choice',
    options: JSON.stringify({ choices: review.contextChoices }),
    sub_group: 'context_choice',
    sub_group_key: 'recite'
  })
  pack.points.push({
    ...common,
    key: `${base.key}:usage_judge`,
    prompt: '下面句子中的成语使用是否恰当？',
    answer: review.usageAnswer,
    question_type: 'usage_judge',
    options: JSON.stringify({
      display: review.usageSentence,
      explanation: review.usageExplanation
    }),
    sub_group: 'usage_judge',
    sub_group_key: 'recite'
  })
}

pack.count = pack.points.length
pack.version = Number(pack.version || 1) + 1
writeSplitPack(pack)
console.log(JSON.stringify({ reviewedEntries: reviews.size, cards: pack.points.length }, null, 2))
