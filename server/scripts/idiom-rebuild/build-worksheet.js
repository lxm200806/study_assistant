// 生成成语整改工作表：合并词典释义、拼音、词频、教材出处，给出初判难度
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '../..')
const packPath = path.join(root, 'data/chinese/raw/idioms/小学成语.json')
const workDir = path.join(__dirname, 'work')

const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'))
const dict = JSON.parse(fs.readFileSync(path.join(root, 'data/sources/idiom-xinhua.json'), 'utf8'))
const dictMap = new Map(dict.map(item => [item.word, item]))

const freq = new Map()
for (const line of fs.readFileSync(path.join(root, 'data/sources/thuocl-chengyu.txt'), 'utf8').split(/\r?\n/)) {
  const [word, count] = line.trim().split(/\s+/)
  if (word && count) freq.set(word, Number(count))
}

const CATEGORY = /教辅|常见成语|结构的成语|的成语$|有关的成语$/
const MEANING_MARKERS = ['比喻', '形容', '指', '表示', '意思是', '常用来', '多用来']

// 词典释义里常带「苟苟且，马虎。」这类逐字训诂，取真正解释整体词义的句子
function cleanExplanation(text) {
  const raw = String(text || '')
    .replace(/[”“"]/g, '')
    .replace(/～/g, '')
    .trim()
  if (!raw) return ''
  const parts = raw.split(/[。；;]/).map(s => s.trim()).filter(Boolean)
  if (!parts.length) return ''
  const meaningful = parts.filter(part => MEANING_MARKERS.some(marker => part.includes(marker)))
  const picked = meaningful.length ? meaningful[meaningful.length - 1] : parts[parts.length - 1]
  return picked.replace(/^亦作.*$/, '').trim()
}

function difficultyOf(entry) {
  if (entry.textbook) return 'primary'
  if (entry.freq >= 4000) return 'primary'
  if (entry.freq >= 900) return 'xiaoshengchu'
  return 'junior'
}

const recite = pack.points.filter(p => p.question_type === 'recite')
const rows = recite.map(point => {
  const word = String(point.answer || '').trim()
  const info = dictMap.get(word)
  const existingGloss = CATEGORY.test(String(point.prompt).replace('（四字）', ''))
    ? ''
    : String(point.prompt).replace(/（四字）$/, '').trim()
  const entry = {
    key: point.key,
    word,
    pinyin: info?.pinyin || '',
    category: String(point.prompt).replace(/（四字）$/, '').trim(),
    existingGloss,
    dictGloss: cleanExplanation(info?.explanation),
    dictRaw: String(info?.explanation || '').replace(/[”“"]/g, '').trim(),
    source: point.source || '',
    grade: point.grade || '',
    level: point.level || '',
    textbook: /部编/.test(point.source || ''),
    freq: freq.get(word) || 0
  }
  entry.difficulty = difficultyOf(entry)
  return entry
})

fs.mkdirSync(workDir, { recursive: true })
fs.writeFileSync(path.join(workDir, 'worksheet.json'), JSON.stringify(rows, null, 1), 'utf8')

const counts = rows.reduce((acc, row) => ((acc[row.difficulty] = (acc[row.difficulty] || 0) + 1), acc), {})
const noGloss = rows.filter(row => !row.dictGloss && !row.existingGloss)
console.log('成语', rows.length, '难度分布', counts)
console.log('需人工补释义（词典未收录且原本无释义）', noGloss.length)
console.log('其中小学/小升初档', noGloss.filter(r => r.difficulty !== 'junior').length)
console.log('样例', rows.filter(r => r.difficulty === 'xiaoshengchu').slice(0, 5).map(r => [r.word, r.freq, r.dictGloss]))
console.log('待改写（小学+小升初）', rows.filter(r => r.difficulty !== 'junior').length)
