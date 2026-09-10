// 合并二审后的选择题选项和字形判断题。
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '../..')
const packPath = path.join(root, 'data/chinese/raw/idioms/小学成语.json')
const reviewDir = path.join(__dirname, 'work/card-reviewed')
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'))
const reviews = new Map()

for (const name of fs.readdirSync(reviewDir).filter(name => name.endsWith('-reviewed.json')).sort()) {
  const rows = JSON.parse(fs.readFileSync(path.join(reviewDir, name), 'utf8'))
  for (const row of rows) {
    if (!row.word || reviews.has(row.word)) throw new Error(`${name}: 词条缺失或重复 ${row.word}`)
    if (!Array.isArray(row.choices) || row.choices.length !== 4 || new Set(row.choices).size !== 4) {
      throw new Error(`${name}: ${row.word} 的 choices 无效`)
    }
    if (!row.choices.includes(row.answer)) throw new Error(`${name}: ${row.word} 选项不含答案`)
    if (!['对', '错'].includes(row.judgeAnswer)) throw new Error(`${name}: ${row.word} judgeAnswer 无效`)
    reviews.set(row.word, row)
  }
}

const expected = pack.points.filter(point => point.question_type === 'meaning_choice').length
if (reviews.size !== expected) throw new Error(`二审结果应有 ${expected} 条，实际 ${reviews.size} 条`)

for (const point of pack.points) {
  const review = reviews.get(point.lemma)
  if (!review) continue
  if (point.question_type === 'meaning_choice') {
    if (review.answer !== point.answer) throw new Error(`${point.lemma}: 二审不得修改正确答案`)
    point.options = JSON.stringify({ choices: review.choices })
  } else if (point.question_type === 'char_judge') {
    point.answer = review.judgeAnswer
    point.options = JSON.stringify({ display: review.judgeDisplay })
  }
}

pack.version = Number(pack.version || 1) + 1
fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')
console.log('已合并二审', reviews.size)
