// 题卡发布前的机械质量检查。任何 error 都阻止同步数据库。
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '../..')
const pack = JSON.parse(
  fs.readFileSync(path.join(root, 'data/chinese/raw/idioms/小学成语.json'), 'utf8')
)

const errors = []
const warnings = []
const pointKeys = new Set()
const groups = new Map()
const difficulties = new Set(['primary', 'xiaoshengchu', 'junior'])
const categoryPattern = /教辅|常见成语|结构的成语|的成语$|有关的成语$/

function parseOptions(point) {
  try {
    return typeof point.options === 'string' ? JSON.parse(point.options || '{}') : point.options || {}
  } catch {
    errors.push(`${point.key}: options 不是合法 JSON`)
    return {}
  }
}

function differenceCount(left, right) {
  const a = Array.from(left)
  const b = Array.from(right)
  if (a.length !== b.length) return Infinity
  return a.reduce((count, char, index) => count + (char === b[index] ? 0 : 1), 0)
}

for (const point of pack.points || []) {
  if (!point.key) errors.push('存在没有 key 的题卡')
  else if (pointKeys.has(point.key)) errors.push(`重复 key: ${point.key}`)
  else pointKeys.add(point.key)

  if (!difficulties.has(point.difficulty)) errors.push(`${point.key}: 难度无效 ${point.difficulty}`)
  if (!point.entry_key || !point.lemma) errors.push(`${point.key}: 缺 entry_key/lemma`)
  if (!groups.has(point.entry_key)) groups.set(point.entry_key, [])
  groups.get(point.entry_key).push(point)

  if (point.question_type === 'recite') {
    const hint = String(point.prompt || '').replace(/（四字）$/, '')
    if (categoryPattern.test(hint)) errors.push(`${point.key}: 仍以分类标签作为题目：${hint}`)
    if (hint.length < 4) warnings.push(`${point.key}: 释义过短：${hint}`)
    if (hint.length > 38) warnings.push(`${point.key}: 释义过长：${hint}`)
  }

  if (point.question_type === 'meaning_choice') {
    const options = parseOptions(point)
    const choices = Array.isArray(options.choices) ? options.choices : []
    if (choices.length !== 4 || new Set(choices).size !== 4) {
      errors.push(`${point.key}: 选项必须是 4 个不同释义`)
    }
    if (!choices.includes(point.answer)) errors.push(`${point.key}: 选项不含正确答案`)
    if (categoryPattern.test(String(point.answer || ''))) {
      errors.push(`${point.key}: 分类标签被当作答案：${point.answer}`)
    }
    if (point.difficulty === 'junior') errors.push(`${point.key}: 初中生僻词不应生成选意思题`)
  }

  if (point.question_type === 'char_judge') {
    const options = parseOptions(point)
    const display = String(options.display || '')
    if (!display) errors.push(`${point.key}: 字形判断缺 display`)
    if (/甲/.test(display) && !/甲/.test(point.lemma)) {
      errors.push(`${point.key}: 使用占位字制造错字：${display}`)
    }
    const differences = differenceCount(display, point.lemma)
    if (point.answer === '对' && differences !== 0) errors.push(`${point.key}: 标“对”但写法不同`)
    if (point.answer === '错' && differences !== 1) errors.push(`${point.key}: 错字题应只改一个字`)
  }
}

for (const [entryKey, cards] of groups) {
  const types = new Set(cards.map(card => card.question_type))
  if (!types.has('char_judge')) errors.push(`${entryKey}: 缺字形判断题`)
  const difficulty = cards[0]?.difficulty
  if (cards.some(card => card.difficulty !== difficulty)) errors.push(`${entryKey}: 同一成语难度不一致`)
  if (difficulty !== 'junior' && (!types.has('recite') || !types.has('meaning_choice'))) {
    errors.push(`${entryKey}: 小学/小升初成语缺默写或选意思题`)
  }
}

const stats = {}
for (const point of pack.points || []) {
  const key = `${point.difficulty}/${point.question_type}`
  stats[key] = (stats[key] || 0) + 1
}

console.log(JSON.stringify({
  cards: pack.points?.length || 0,
  idioms: groups.size,
  stats,
  errors: errors.length,
  warnings: warnings.length
}, null, 2))
if (warnings.length) console.log('WARNINGS\n' + warnings.slice(0, 50).join('\n'))
if (errors.length) {
  console.error('ERRORS\n' + errors.slice(0, 100).join('\n'))
  process.exit(1)
}
