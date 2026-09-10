// 合并唯一词条和各题型题卡，生成供发布/同步使用的兼容数据包。
const { writePublishPack } = require('./idiom-files')

const pack = writePublishPack()
const counts = {}
for (const point of pack.points) {
  counts[point.question_type] = (counts[point.question_type] || 0) + 1
}

console.log(JSON.stringify({
  entries: new Set(pack.points.map(point => point.entry_key)).size,
  cards: pack.points.length,
  counts,
  version: pack.version
}, null, 2))
