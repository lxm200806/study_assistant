// 软下架缺少可靠释义或明确不是规范成语的词条；不删除题卡和学习记录。
const { loadCompiledPack, writeSplitPack } = require('./idiom-files')
const pack = loadCompiledPack()
const cardsByEntry = new Map()

for (const point of pack.points || []) {
  if (!cardsByEntry.has(point.entry_key)) cardsByEntry.set(point.entry_key, [])
  cardsByEntry.get(point.entry_key).push(point)
}

const curatedInactive = new Set([
  '渑池会面'
])

let inactiveEntries = 0
let inactiveCards = 0
for (const cards of cardsByEntry.values()) {
  const lemma = String(cards[0]?.lemma || '')
  const hasReliableMeaning = cards.some(card =>
    card.question_type === 'recite' || card.question_type === 'meaning_choice'
  )
  const active = hasReliableMeaning && !curatedInactive.has(lemma)
  if (!active) inactiveEntries += 1
  for (const card of cards) {
    card.active = active
    if (!active) inactiveCards += 1
  }
}

pack.version = Number(pack.version || 1) + 1
writeSplitPack(pack)
console.log(JSON.stringify({ inactiveEntries, inactiveCards }, null, 2))
