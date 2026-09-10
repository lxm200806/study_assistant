// 把待改写的成语切成批次，供逐条人工/模型改写
const fs = require('fs')
const path = require('path')

const workDir = path.join(__dirname, 'work')
const rows = JSON.parse(fs.readFileSync(path.join(workDir, 'worksheet.json'), 'utf8'))
const targets = rows.filter(row => row.difficulty !== 'junior')

const batchDir = path.join(workDir, 'batches')
fs.rmSync(batchDir, { recursive: true, force: true })
fs.mkdirSync(batchDir, { recursive: true })

const SIZE = 101
let index = 0
for (let start = 0; start < targets.length; start += SIZE) {
  index += 1
  const slice = targets.slice(start, start + SIZE).map(row => ({
    词条: row.word,
    拼音: row.pinyin,
    词典释义: row.dictRaw || '（词典未收录）',
    出处: row.source,
    词频: row.freq,
    初判难度: row.difficulty === 'primary' ? '小学' : '小升初'
  }))
  const name = `batch-${String(index).padStart(2, '0')}.json`
  fs.writeFileSync(path.join(batchDir, name), JSON.stringify(slice, null, 1), 'utf8')
}
console.log('待改写', targets.length, '批次', index, '目录', batchDir)
