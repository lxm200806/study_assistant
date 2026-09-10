// 根据公开词典和教育资料交叉核验拼音；不复制释义、例句或词典编排。
const fs = require('fs')
const path = require('path')
const { CARD_FILES, entryPath, writePublishPack } = require('./idiom-files')

const idiomDir = path.dirname(entryPath)
const source = JSON.parse(fs.readFileSync(entryPath, 'utf8'))

// 从 chinese-xinhua 抓取数据中发现并经网络交叉核对后确认的错误。
const CORRECTIONS = {
  勤学苦练: { before: 'qín xué kǔ zh', after: 'qín xué kǔ liàn' },
  一帆风顺: { before: 'yī fán fēng shùn', after: 'yī fān fēng shùn' },
  大步流星: { before: 'dǎ bù liú xīng', after: 'dà bù liú xīng' },
  风云变幻: { before: 'fēng yún bià huàn', after: 'fēng yún biàn huàn' },
  愁眉不展: { before: 'chóu méi bù zhān', after: 'chóu méi bù zhǎn' },
  单枪匹马: { before: 'dān qiāng pí mǎ', after: 'dān qiāng pǐ mǎ' },
  葬身鱼腹: { before: 'zàng shēn yū fù', after: 'zàng shēn yú fù' },
  味同嚼蜡: { before: 'wèi tóng jiáo cù', after: 'wèi tóng jiáo là' },
  惊心动魄: { before: 'jīng xīng dòng pò', after: 'jīng xīn dòng pò' },
  畏首畏尾: { before: 'wèi shǒ wèi wěi', after: 'wèi shǒu wèi wěi' },
  简明扼要: { before: 'jiǎn míng é yào', after: 'jiǎn míng è yào' },
  约法三章: { before: 'yuè fǎ sān zhāng', after: 'yuē fǎ sān zhāng' },
  与世无争: { before: 'yú shì wú zhēng', after: 'yǔ shì wú zhēng' },
  有的放矢: { before: 'yǒu dǐ fàng shǐ', after: 'yǒu dì fàng shǐ' },
  耳濡目染: { before: 'ěr rǔ mù rǎn', after: 'ěr rú mù rǎn' },
  约定俗成: { before: 'yuè dìng sú chéng', after: 'yuē dìng sú chéng' },
  草船借箭: { before: 'cǎo chuǎn jiè jiàn', after: 'cǎo chuán jiè jiàn' },
  进退两难: { before: 'jìn tuì liǎng nán', after: 'jìn tuì liǎng nán' },
  金石为开: { before: 'jīn shí wèi kāi', after: 'jīn shí wéi kāi' },
  一针见血: { before: 'yī zhēn jiàn xiě', after: 'yī zhēn jiàn xuè' }
}

// 原始抓取词典未收录，已按公开词典、教材资料和单字规范读音交叉核对。
const SUPPLEMENTAL = [
  '万物复苏', '五彩斑斓', '刀枪不入', '各显神通', '名扬中外', '哈哈大笑',
  '囊萤夜读', '天籁之音', '天高云淡', '天高地阔', '奔流不息', '妙笔生花',
  '层林叠翠', '层林尽染', '形态各异', '微风习习', '技高一筹', '果实累累',
  '漫天卷地', '焦躁不安', '瑰丽无比', '百鸟争鸣', '秋风习习', '膀大腰圆',
  '金桂飘香', '泉水叮咚', '冰雪融化', '清清楚楚', '兴旺发达', '火光冲天',
  '笑容满面', '夏日炎炎'
]

const reviewed = new Set([...Object.keys(CORRECTIONS), ...SUPPLEMENTAL])
const changes = []
for (const entry of source.entries) {
  const corrected = CORRECTIONS[entry.lemma]
  if (corrected && entry.pinyin !== corrected.after) {
    changes.push({ lemma: entry.lemma, before: entry.pinyin, after: corrected.after })
    entry.pinyin = corrected.after
  }
  entry.pinyin_review = reviewed.has(entry.lemma)
    ? 'web-cross-checked-2026-09-11'
    : 'chinese-xinhua-unverified'
}

source.version = Math.max(11, Number(source.version || 1) + (changes.length ? 1 : 0))
fs.writeFileSync(entryPath, `${JSON.stringify(source, null, 2)}\n`, 'utf8')

for (const filename of Object.values(CARD_FILES)) {
  const filePath = path.join(idiomDir, filename)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  data.version = source.version
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

const recordPath = path.join(idiomDir, '拼音核验记录.json')
fs.writeFileSync(recordPath, `${JSON.stringify({
  reviewed_at: '2026-09-11',
  scope: '仅核对规范书写和拼音，不复制第三方释义或题卡',
  status_note: 'web-cross-checked 表示公开网络多来源交叉核对，不等于《新华成语词典》第2版官方授权核验。',
  sources: [
    'https://dict.idioms.moe.edu.tw/',
    'https://pedia.cloud.edu.tw/',
    'https://www.zdic.net/',
    'https://www.hanyuguoxue.com/',
    'https://baike.baidu.com/'
  ],
  corrected: Object.entries(CORRECTIONS).map(([lemma, item]) => ({ lemma, ...item })),
  supplemental: SUPPLEMENTAL
}, null, 2)}\n`, 'utf8')

const pack = writePublishPack()
console.log(JSON.stringify({
  version: source.version,
  corrected: changes.length,
  webCrossChecked: reviewed.size,
  remainingUnverified: source.entries.length - reviewed.size,
  cards: pack.points.length
}, null, 2))
