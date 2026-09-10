// 按词条拼音生成四选一拼音题卡。干扰项只用多音字误读、调号和常见声韵母混淆。
const { loadCompiledPack, loadSource, writeSplitPack } = require('./idiom-files')

function main() {
  const pack = loadCompiledPack()
  const { entries } = loadSource()
  const existing = new Set(
    pack.points.filter(point => point.question_type === 'pinyin_choice').map(point => point.entry_key)
  )
  const extra = []
  for (const point of pack.points) {
    if (point.question_type !== 'recite') continue
    if (existing.has(point.entry_key)) continue
    const entry = entries.get(point.entry_key)
    if (!entry) throw new Error(`${point.entry_key}: 找不到词条，无法生成拼音题`)
    extra.push({
      ...point,
      key: `${point.key}:pinyin_choice`,
      prompt: `“${entry.lemma}”的正确拼音是？`,
      answer: entry.pinyin,
      question_type: 'pinyin_choice',
      audience: 'all',
      options: '',
      sub_group: 'pinyin_choice',
      sub_group_key: 'recite'
    })
  }

  const points = [...pack.points, ...extra]
  const published = writeSplitPack({
    ...pack,
    version: extra.length ? Number(pack.version || 1) + 1 : Number(pack.version || 1),
    count: points.length,
    points
  })
  const counts = {}
  for (const point of published.points) {
    const key = `${point.difficulty}/${point.question_type}`
    counts[key] = (counts[key] || 0) + 1
  }
  console.log(JSON.stringify({
    added: extra.length,
    cards: published.points.length,
    version: published.version,
    counts
  }, null, 2))
}

main()
