// 把基础/拓展题卡切成二审批次，重点检查选择题歧义和错别字真实性。
const fs = require('fs')
const path = require('path')
const { loadCompiledPack } = require('./idiom-files')

const pack = loadCompiledPack()
const outDir = path.join(__dirname, 'work/card-review')
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

const byEntry = new Map()
for (const point of pack.points) {
  if (!byEntry.has(point.entry_key)) byEntry.set(point.entry_key, [])
  byEntry.get(point.entry_key).push(point)
}

const rows = []
for (const cards of byEntry.values()) {
  const choice = cards.find(card => card.question_type === 'meaning_choice')
  if (!choice) continue
  const spelling = cards.find(card => card.question_type === 'spelling_choice')
  const options = JSON.parse(choice.options || '{}')
  const spellingOptions = JSON.parse(spelling?.options || '{}')
  rows.push({
    word: choice.lemma,
    difficulty: choice.difficulty,
    answer: choice.answer,
    choices: options.choices,
    spellingAnswer: spelling?.answer || choice.lemma,
    spellingChoices: spellingOptions.choices || []
  })
}

const size = 100
let batches = 0
for (let start = 0; start < rows.length; start += size) {
  batches += 1
  const name = `cards-${String(batches).padStart(2, '0')}.json`
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(rows.slice(start, start + size), null, 1), 'utf8')
}
console.log('待二审题组', rows.length, '批次', batches)
