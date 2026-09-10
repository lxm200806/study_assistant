// 将旧库中未校准、已停用的短语移入档案，并补齐有效词条的缺失拼音。
const fs = require('fs')
const path = require('path')
const { CARD_FILES, entryPath, writePublishPack } = require('./idiom-files')

const idiomDir = path.dirname(entryPath)
const source = JSON.parse(fs.readFileSync(entryPath, 'utf8'))
if (!source.entries.some(entry => entry.active === false || !entry.pinyin || !entry.meaning)) {
  console.log('正式词条已无停用项或空拼音、空解释，无需再次处理')
  process.exit(0)
}
const version = Number(source.version || 1) + 1

const PINYIN = {
  万物复苏: 'wàn wù fù sū',
  五彩斑斓: 'wǔ cǎi bān lán',
  刀枪不入: 'dāo qiāng bù rù',
  各显神通: 'gè xiǎn shén tōng',
  名扬中外: 'míng yáng zhōng wài',
  哈哈大笑: 'hā hā dà xiào',
  囊萤夜读: 'náng yíng yè dú',
  天籁之音: 'tiān lài zhī yīn',
  天高云淡: 'tiān gāo yún dàn',
  天高地阔: 'tiān gāo dì kuò',
  奔流不息: 'bēn liú bù xī',
  妙笔生花: 'miào bǐ shēng huā',
  层林叠翠: 'céng lín dié cuì',
  层林尽染: 'céng lín jìn rǎn',
  形态各异: 'xíng tài gè yì',
  微风习习: 'wēi fēng xí xí',
  技高一筹: 'jì gāo yī chóu',
  果实累累: 'guǒ shí léi léi',
  漫天卷地: 'màn tiān juǎn dì',
  焦躁不安: 'jiāo zào bù ān',
  瑰丽无比: 'guī lì wú bǐ',
  百鸟争鸣: 'bǎi niǎo zhēng míng',
  秋风习习: 'qiū fēng xí xí',
  膀大腰圆: 'bǎng dà yāo yuán',
  金桂飘香: 'jīn guì piāo xiāng',
  泉水叮咚: 'quán shuǐ dīng dōng',
  冰雪融化: 'bīng xuě róng huà',
  清清楚楚: 'qīng qīng chǔ chǔ',
  兴旺发达: 'xīng wàng fā dá',
  火光冲天: 'huǒ guāng chōng tiān',
  笑容满面: 'xiào róng mǎn miàn',
  夏日炎炎: 'xià rì yán yán'
}

const archivedEntries = source.entries.filter(entry => entry.active === false)
const archivedKeys = new Set(archivedEntries.map(entry => entry.key))
const entries = source.entries
  .filter(entry => !archivedKeys.has(entry.key))
  .map(entry => ({ ...entry, pinyin: entry.pinyin || PINYIN[entry.lemma] || '' }))

const archivedCards = []
for (const [type, filename] of Object.entries(CARD_FILES)) {
  const filePath = path.join(idiomDir, filename)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const removed = data.cards.filter(card => archivedKeys.has(card.entry_key))
  archivedCards.push(...removed)
  data.version = version
  data.cards = data.cards.filter(card => !archivedKeys.has(card.entry_key))
  data.count = data.cards.length
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  console.log(`${type}: 保留 ${data.count}，归档 ${removed.length}`)
}

source.version = version
source.entries = entries
source.count = entries.length
fs.writeFileSync(entryPath, `${JSON.stringify(source, null, 2)}\n`, 'utf8')

const archivePath = path.join(idiomDir, 'archive', '停用待校准词条.json')
fs.mkdirSync(path.dirname(archivePath), { recursive: true })
fs.writeFileSync(archivePath, `${JSON.stringify({
  title: '停用待校准词条',
  version,
  count: archivedEntries.length,
  note: '不进入发布包。多数为普通四字短语、残缺表达、错写词或缺少可靠词典依据的条目。',
  entries: archivedEntries,
  cards: archivedCards
}, null, 2)}\n`, 'utf8')

const pack = writePublishPack()
console.log(JSON.stringify({
  version,
  entries: entries.length,
  cards: pack.points.length,
  archivedEntries: archivedEntries.length,
  archivedCards: archivedCards.length,
  missingPinyin: entries.filter(entry => !entry.pinyin).length,
  missingMeaning: entries.filter(entry => !entry.meaning).length
}, null, 2))
