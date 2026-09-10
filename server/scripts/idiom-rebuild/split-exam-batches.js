// 为语境选择和使用正误题准备逐题创作批次。
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { loadCompiledPack } = require('./idiom-files')

const pack = loadCompiledPack()
const outDir = path.join(__dirname, 'work/exam-batches')
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

function stableInt(text) {
  return parseInt(crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 8), 16)
}

const recites = pack.points.filter(point =>
  point.active !== false &&
  point.question_type === 'recite' &&
  ['primary', 'xiaoshengchu'].includes(point.difficulty)
)
const byDifficulty = new Map()
for (const point of recites) {
  if (!byDifficulty.has(point.difficulty)) byDifficulty.set(point.difficulty, [])
  byDifficulty.get(point.difficulty).push(point)
}

const rows = recites.map(point => {
  const pool = byDifficulty.get(point.difficulty) || []
  const candidateWords = pool
    .filter(other => other.lemma !== point.lemma)
    .sort((a, b) => stableInt(`${point.lemma}:${a.lemma}`) - stableInt(`${point.lemma}:${b.lemma}`))
    .slice(0, 16)
    .map(other => ({
      word: other.lemma,
      meaning: String(other.prompt || '').replace(/（四字）$/, '')
    }))
  return {
    word: point.lemma,
    meaning: String(point.prompt || '').replace(/（四字）$/, ''),
    difficulty: point.difficulty,
    source: point.source,
    candidateWords
  }
})

const size = 100
let batches = 0
for (let start = 0; start < rows.length; start += size) {
  batches += 1
  const name = `exam-${String(batches).padStart(2, '0')}.json`
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(rows.slice(start, start + size), null, 1), 'utf8')
}
console.log(JSON.stringify({ entries: rows.length, batches }, null, 2))
