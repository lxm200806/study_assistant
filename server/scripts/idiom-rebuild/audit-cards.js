// 题卡发布前的机械质量检查。任何 error 都阻止同步数据库。
const { isPlausibleSyllable, loadCompiledPack, loadSource } = require('./idiom-files')
const pack = loadCompiledPack()
const { entries } = loadSource()

const errors = []
const warnings = []
const pointKeys = new Set()
const groups = new Map()
const difficulties = new Set(['primary', 'xiaoshengchu', 'junior'])
const categoryPattern = /教辅|常见成语|结构的成语|的成语$|有关的成语$/
const allowedQuestionTypes = new Set([
  'recite',
  'pinyin_choice',
  'spelling_choice',
  'meaning_choice',
  'context_choice',
  'usage_judge'
])

function parseOptions(point) {
  try {
    return typeof point.options === 'string' ? JSON.parse(point.options || '{}') : point.options || {}
  } catch {
    errors.push(`${point.key}: options 不是合法 JSON`)
    return {}
  }
}

for (const point of pack.points || []) {
  if (!point.key) errors.push('存在没有 key 的题卡')
  else if (pointKeys.has(point.key)) errors.push(`重复 key: ${point.key}`)
  else pointKeys.add(point.key)

  if (!difficulties.has(point.difficulty)) errors.push(`${point.key}: 难度无效 ${point.difficulty}`)
  if (!allowedQuestionTypes.has(point.question_type)) errors.push(`${point.key}: 题型无效 ${point.question_type}`)
  if (point.grade) errors.push(`${point.key}: 成语不应再设置年级`)
  if (typeof point.active !== 'boolean') errors.push(`${point.key}: 缺少 active 布尔标记`)
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
    if (point.difficulty === 'junior') errors.push(`${point.key}: 培优词条不应生成选意思题`)
  }

  if (point.question_type === 'spelling_choice') {
    const options = parseOptions(point)
    const choices = Array.isArray(options.choices) ? options.choices : []
    if (point.answer !== point.lemma) errors.push(`${point.key}: 易错字选择题答案必须是规范成语`)
    if (choices.length !== 4 || new Set(choices).size !== 4) errors.push(`${point.key}: 易错字题须有 4 个不同选项`)
    if (!choices.includes(point.answer)) errors.push(`${point.key}: 易错字题选项不含正确写法`)
    if (choices.some(choice => /甲/.test(choice) && !/甲/.test(point.lemma))) {
      errors.push(`${point.key}: 易错字题使用了占位字`)
    }
  }

  if (point.question_type === 'pinyin_choice') {
    const options = parseOptions(point)
    const choices = Array.isArray(options.choices) ? options.choices : []
    const entry = entries.get(point.entry_key)
    if (choices.length !== 4 || new Set(choices).size !== 4) errors.push(`${point.key}: 拼音题须有 4 个不同选项`)
    if (!choices.includes(point.answer)) errors.push(`${point.key}: 拼音题选项不含正确答案`)
    if (entry && point.answer !== entry.pinyin) errors.push(`${point.key}: 拼音答案与词条不一致`)
    if (!String(point.prompt || '').includes(point.lemma || '')) errors.push(`${point.key}: 拼音题未出示词条`)
    if (String(point.answer || '').split(/\s+/).length !== Array.from(point.lemma || '').length) {
      errors.push(`${point.key}: 拼音音节数与字数不一致`)
    }
    if (choices.some(choice => String(choice).split(/\s+/).some(item => !isPlausibleSyllable(item)))) {
      errors.push(`${point.key}: 拼音干扰项含不成立音节`)
    }
  }

  if (point.question_type === 'context_choice') {
    const options = parseOptions(point)
    const choices = Array.isArray(options.choices) ? options.choices : []
    if (!String(point.prompt || '').includes('____')) errors.push(`${point.key}: 语境题没有空缺`)
    if (String(point.prompt || '').includes(point.answer)) errors.push(`${point.key}: 语境题泄漏答案`)
    if (choices.length !== 4 || new Set(choices).size !== 4) errors.push(`${point.key}: 语境题须有 4 个不同选项`)
    if (!choices.includes(point.answer)) errors.push(`${point.key}: 语境题选项不含答案`)
    if (point.active === false) errors.push(`${point.key}: 下架词条不应有语境题`)
  }

  if (point.question_type === 'usage_judge') {
    const options = parseOptions(point)
    const display = String(options.display || '')
    const explanation = String(options.explanation || '')
    if (!['对', '错'].includes(point.answer)) errors.push(`${point.key}: 使用正误题答案须为对或错`)
    if (!display.includes(point.lemma)) errors.push(`${point.key}: 使用正误句未出现目标成语`)
    if (explanation.length < 6 || explanation.length > 40) errors.push(`${point.key}: 使用正误题解析长度不合适`)
    if (point.active === false) errors.push(`${point.key}: 下架词条不应有使用正误题`)
  }
}

for (const [entryKey, cards] of groups) {
  const types = new Set(cards.map(card => card.question_type))
  if (!types.has('spelling_choice')) errors.push(`${entryKey}: 缺易错字选择题`)
  if (!types.has('pinyin_choice')) errors.push(`${entryKey}: 缺拼音选择题`)
  if (!types.has('recite')) errors.push(`${entryKey}: 缺背诵题或可靠解释`)
  const difficulty = cards[0]?.difficulty
  if (cards.some(card => card.difficulty !== difficulty)) errors.push(`${entryKey}: 同一成语难度不一致`)
  if (difficulty !== 'junior' && (!types.has('recite') || !types.has('meaning_choice'))) {
    errors.push(`${entryKey}: 基础/拓展成语缺背诵或选意思题`)
  }
  if (cards[0]?.active !== false && difficulty !== 'junior' && (!types.has('context_choice') || !types.has('usage_judge'))) {
    errors.push(`${entryKey}: 上架的基础/拓展成语缺语境题或使用正误题`)
  }
  if (cards.some(card => card.active !== cards[0]?.active)) errors.push(`${entryKey}: 同一成语 active 不一致`)
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
