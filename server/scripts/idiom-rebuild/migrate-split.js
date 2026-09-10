// 一次性把旧版“词条和题卡混合文件”迁移为唯一词条文件和按题型拆分的题卡文件。
const fs = require('fs')
const { entryPath, writeSplitPack } = require('./idiom-files')

const legacy = JSON.parse(fs.readFileSync(entryPath, 'utf8'))
if (!Array.isArray(legacy.points)) {
  console.log('成语数据已经完成拆分，无需再次迁移')
  process.exit(0)
}

const pack = writeSplitPack(legacy)
console.log(JSON.stringify({
  entries: new Set(pack.points.map(point => point.entry_key)).size,
  cards: pack.points.length,
  version: pack.version
}, null, 2))
