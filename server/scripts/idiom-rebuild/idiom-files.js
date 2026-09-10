const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '../..')
const idiomDir = path.join(root, 'data/chinese/raw/idioms')
const entryPath = path.join(idiomDir, '小学成语.json')
const generatedDir = path.join(idiomDir, 'generated')
const publishPath = path.join(generatedDir, '小学成语_发布包.json')
const dictionaryPath = path.join(root, 'data/sources/idiom-xinhua.json')

const CARD_FILES = {
  recite: '小学成语_题卡_背诵.json',
  pinyin_choice: '小学成语_题卡_拼音.json',
  spelling_choice: '小学成语_题卡_易错字选择.json',
  meaning_choice: '小学成语_题卡_语义理解.json',
  context_choice: '小学成语_题卡_语境选择.json',
  usage_judge: '小学成语_题卡_使用正误.json'
}
const CARD_TITLES = {
  recite: '背诵',
  pinyin_choice: '拼音选择',
  spelling_choice: '易错字选择',
  meaning_choice: '语义理解',
  context_choice: '语境选择',
  usage_judge: '使用正误'
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function stableInt(text) {
  return parseInt(crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 8), 16)
}

function parseOptions(value) {
  if (value && typeof value === 'object') return value
  try {
    return JSON.parse(String(value || '') || '{}')
  } catch {
    return {}
  }
}

function stringifyOptions(value) {
  if (!value || (typeof value === 'object' && !Object.keys(value).length)) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function cleanMeaning(text) {
  return String(text || '').replace(/（四字）$/, '').trim()
}

function loadDictionary() {
  if (!fs.existsSync(dictionaryPath)) return []
  return readJson(dictionaryPath)
}

function plainSyllable(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function buildCharacterIndex(dictionary) {
  const exact = new Map()
  const plain = new Map()
  const curated = new Map()
  const frequency = new Map()
  for (const item of dictionary) {
    const chars = Array.from(String(item.word || ''))
    const syllables = String(item.pinyin || '').trim().split(/\s+/)
    if (chars.length !== syllables.length) continue
    chars.forEach((char, index) => {
      const syllable = syllables[index]
      const simple = plainSyllable(syllable)
      if (!exact.has(syllable)) exact.set(syllable, new Set())
      if (!plain.has(simple)) plain.set(simple, new Set())
      exact.get(syllable).add(char)
      plain.get(simple).add(char)
      frequency.set(char, (frequency.get(char) || 0) + 1)
    })
  }
  return { exact, plain, curated, frequency }
}

function addReviewedConfusables(index, points) {
  for (const point of points || []) {
    if (point.question_type !== 'char_judge') continue
    const word = Array.from(String(point.lemma || ''))
    const display = Array.from(String(parseOptions(point.options).display || ''))
    if (word.length !== display.length) continue
    const changed = word.map((char, position) => ({ char, other: display[position] })).filter(item => item.char !== item.other)
    if (changed.length !== 1) continue
    const { char, other } = changed[0]
    if (!index.curated.has(char)) index.curated.set(char, new Set())
    index.curated.get(char).add(other)
  }
}

const CONFUSABLES = {
  己: ['已'], 已: ['己'], 未: ['末'], 末: ['未'], 土: ['士'], 士: ['土'],
  入: ['人'], 人: ['入'], 天: ['夭'], 大: ['太'], 太: ['大'], 干: ['千'], 千: ['干'],
  辩: ['辨', '辫'], 辨: ['辩', '辫'], 辫: ['辨', '辩'], 即: ['既'], 既: ['即'],
  侯: ['候'], 候: ['侯'], 蓝: ['篮'], 篮: ['蓝'], 厉: ['历'], 历: ['厉'],
  坐: ['座'], 座: ['坐'], 象: ['像'], 像: ['象'], 做: ['作'], 作: ['做'],
  那: ['哪'], 哪: ['那'], 到: ['道'], 道: ['到'], 必: ['心'], 心: ['必'],
  成: ['城'], 城: ['成'], 不: ['步'], 步: ['不'], 无: ['天'], 有: ['友'],
  言: ['信'], 信: ['言'], 清: ['青'], 青: ['清'], 秀: ['绣'], 自: ['字'],
  语: ['悟'], 春: ['椿'], 回: ['徊'], 地: ['第'], 万: ['方'], 物: ['勿'],
  复: ['覆'], 覆: ['复'], 苏: ['酥'], 带: ['戴'], 戴: ['带']
}

function spellingChoices(word, pinyin, preferredWrong = '', index = buildCharacterIndex(loadDictionary())) {
  const choices = new Set([word])
  const add = value => {
    const candidate = String(value || '').trim()
    if (candidate && candidate !== word && Array.from(candidate).length === Array.from(word).length) choices.add(candidate)
  }
  add(preferredWrong)

  const chars = Array.from(word)
  const syllables = String(pinyin || '').trim().split(/\s+/)
  const addFromIndex = source => {
    chars.forEach((char, position) => {
      const alternatives = [...(source.get(source === index.exact ? syllables[position] : plainSyllable(syllables[position])) || [])]
        .filter(other => other !== char && !chars.includes(other) && !'甲乙丙丁戊庚'.includes(other))
        .sort((a, b) => (index.frequency.get(b) || 0) - (index.frequency.get(a) || 0) || a.localeCompare(b, 'zh'))
      for (const other of alternatives.slice(0, 4)) {
        const changed = [...chars]
        changed[position] = other
        add(changed.join(''))
      }
    })
  }
  if (syllables.length === chars.length) {
    addFromIndex(index.exact)
    if (choices.size < 4) addFromIndex(index.plain)
  }
  if (choices.size < 4) {
    chars.forEach((char, position) => {
      const alternatives = [...(index.curated.get(char) || []), ...(CONFUSABLES[char] || [])]
      for (const other of alternatives) {
        const changed = [...chars]
        changed[position] = other
        add(changed.join(''))
      }
    })
  }
  if (choices.size < 4) {
    for (let left = 0; left < chars.length - 1; left++) {
      for (let right = left + 1; right < chars.length; right++) {
        if (chars[left] === chars[right]) continue
        const changed = [...chars]
        ;[changed[left], changed[right]] = [changed[right], changed[left]]
        add(changed.join(''))
      }
    }
  }
  if (choices.size < 4) throw new Error(`${word}: 无法生成 3 个可靠的易错字选项`)
  return [...choices]
    .slice(0, 4)
    .sort((a, b) => stableInt(`${word}:spelling:${a}`) - stableInt(`${word}:spelling:${b}`))
}

const TONE_MARKS = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  ü: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ']
}
const PINYIN_INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']
const FINAL_SWAPS = [
  ['ang', 'an'], ['an', 'ang'],
  ['eng', 'en'], ['en', 'eng'],
  ['ing', 'in'], ['in', 'ing'],
  ['iang', 'ian'], ['ian', 'iang'],
  ['uang', 'uan'], ['uan', 'uang'],
  ['ong', 'eng'], ['eng', 'ong'],
  ['ao', 'ou'], ['ou', 'ao'],
  ['ai', 'ei'], ['ei', 'ai'],
  ['iu', 'ou'], ['ie', 'üe']
]
const INITIAL_SWAPS = [
  ['zh', 'z'], ['z', 'zh'],
  ['ch', 'c'], ['c', 'ch'],
  ['sh', 's'], ['s', 'sh'],
  ['n', 'l'], ['l', 'n']
]
const POLYPHONE_READINGS = {
  兴: ['xīng', 'xìng'], 长: ['cháng', 'zhǎng'], 为: ['wéi', 'wèi'], 重: ['chóng', 'zhòng'],
  好: ['hǎo', 'hào'], 行: ['xíng', 'háng'], 发: ['fā', 'fà'], 倒: ['dǎo', 'dào'],
  血: ['xuè', 'xiě'], 塞: ['sāi', 'sài', 'sè'], 省: ['shěng', 'xǐng'], 中: ['zhōng', 'zhòng'],
  传: ['chuán', 'zhuàn'], 调: ['tiáo', 'diào'], 将: ['jiāng', 'jiàng'], 没: ['méi', 'mò'],
  散: ['sǎn', 'sàn'], 数: ['shù', 'shǔ'], 卷: ['juǎn', 'juàn'], 累: ['léi', 'lěi', 'lèi'],
  宁: ['níng', 'nìng'], 强: ['qiáng', 'qiǎng'], 少: ['shǎo', 'shào'], 恶: ['è', 'wù'],
  朝: ['zhāo', 'cháo'], 间: ['jiān', 'jiàn'], 便: ['biàn', 'pián'], 济: ['jì', 'jǐ'],
  称: ['chēng', 'chèn'], 乐: ['lè', 'yuè'], 差: ['chā', 'chà', 'chāi'], 应: ['yīng', 'yìng'],
  当: ['dāng', 'dàng'], 处: ['chǔ', 'chù'],   空: ['kōng', 'kòng'], 干: ['gān', 'gàn'],
  禁: ['jīn', 'jìn'], 奔: ['bēn', 'bèn'], 藏: ['cáng', 'zàng'], 降: ['jiàng', 'xiáng'],
  角: ['jiǎo', 'jué'], 壳: ['ké', 'qiào'], 露: ['lù', 'lòu'], 落: ['luò', 'là'],
  曲: ['qū', 'qǔ'], 舍: ['shě', 'shè'], 载: ['zài', 'zǎi'], 种: ['zhǒng', 'zhòng'],
  与: ['yǔ', 'yù'], 只: ['zhī', 'zhǐ'], 要: ['yào', 'yāo'], 着: ['zháo', 'zhuó', 'zhe'],
  分: ['fēn', 'fèn'], 更: ['gēng', 'gèng'], 还: ['hái', 'huán'], 会: ['huì', 'kuài'],
  看: ['kàn', 'kān'], 量: ['liáng', 'liàng'], 难: ['nán', 'nàn'],
  炮: ['pào', 'páo'], 仆: ['pú', 'pū'], 奇: ['qí', 'jī'], 亲: ['qīn', 'qìng'],
  宿: ['sù', 'xiǔ'], 削: ['xuē', 'xiāo'], 咽: ['yàn', 'yè'], 饮: ['yǐn', 'yìn'],
  扎: ['zhā', 'zhá'], 涨: ['zhǎng', 'zhàng'], 正: ['zhèng', 'zhēng']
}

function toneOf(syllable) {
  for (const marks of Object.values(TONE_MARKS)) {
    for (let tone = 1; tone <= 4; tone++) {
      if (syllable.includes(marks[tone])) return tone
    }
  }
  return 0
}

function bareSyllable(syllable) {
  let text = String(syllable || '')
  for (const marks of Object.values(TONE_MARKS)) {
    for (let tone = 1; tone <= 4; tone++) text = text.split(marks[tone]).join(marks[0])
  }
  return text
}

function applyTone(bare, tone) {
  const chars = Array.from(bare)
  let index = chars.findIndex(char => char === 'a' || char === 'o' || char === 'e')
  if (index < 0) {
    const i = chars.lastIndexOf('i')
    const u = Math.max(chars.lastIndexOf('u'), chars.lastIndexOf('ü'))
    index = Math.max(i, u)
  }
  if (index < 0) return bare
  const marks = TONE_MARKS[chars[index]]
  if (!marks || !tone) return bare
  chars[index] = marks[tone]
  return chars.join('')
}

function splitBareSyllable(bare) {
  for (const initial of PINYIN_INITIALS) {
    if (bare.startsWith(initial) && bare.length > initial.length) {
      return { initial, final: bare.slice(initial.length) }
    }
  }
  return { initial: '', final: bare }
}

let knownBareSyllables = null

function loadKnownBareSyllables() {
  if (knownBareSyllables) return knownBareSyllables
  const bare = new Set()
  const add = value => {
    const text = String(value || '').trim()
    if (text) bare.add(bareSyllable(text))
  }
  for (const item of loadDictionary()) {
    for (const syllable of String(item.pinyin || '').split(/\s+/)) add(syllable)
  }
  if (fs.existsSync(entryPath)) {
    for (const entry of readJson(entryPath).entries || []) {
      for (const syllable of String(entry.pinyin || '').split(/\s+/)) add(syllable)
    }
  }
  knownBareSyllables = bare
  return knownBareSyllables
}

function isPlausibleSyllable(syllable) {
  const text = String(syllable || '').trim()
  return Boolean(text) && loadKnownBareSyllables().has(bareSyllable(text))
}

function mutateSyllable(syllable) {
  const variants = new Set()
  const tone = toneOf(syllable) || 1
  const bare = bareSyllable(syllable)
  const { initial, final } = splitBareSyllable(bare)
  for (let nextTone = 1; nextTone <= 4; nextTone++) {
    if (nextTone !== tone) variants.add(applyTone(bare, nextTone))
  }
  for (const [from, to] of INITIAL_SWAPS) {
    if (initial === from) variants.add(applyTone(`${to}${final}`, tone))
  }
  for (const [from, to] of FINAL_SWAPS) {
    if (final === from) variants.add(applyTone(`${initial}${to}`, tone))
  }
  if ((initial === 'n' || initial === 'l') && final.startsWith('ü')) {
    variants.add(applyTone(`${initial}u${final.slice(1)}`, tone))
  }
  return [...variants].filter(item => item && item !== syllable && isPlausibleSyllable(item))
}

function pinyinChoices(word, pinyin) {
  const correct = String(pinyin || '').trim()
  const syllables = correct.split(/\s+/).filter(Boolean)
  const chars = Array.from(word)
  if (!correct || syllables.length !== chars.length) {
    throw new Error(`${word}: 无法按字生成拼音选项`)
  }
  const preferred = []
  const candidates = new Set()
  const add = (value, important = false) => {
    const text = String(value || '').trim()
    if (!text || text === correct || text.split(/\s+/).length !== syllables.length) return
    if (important && !preferred.includes(text)) preferred.push(text)
    candidates.add(text)
  }

  chars.forEach((char, index) => {
    for (const reading of POLYPHONE_READINGS[char] || []) {
      if (reading === syllables[index] || !isPlausibleSyllable(reading)) continue
      const next = [...syllables]
      next[index] = reading
      add(next.join(' '), true)
    }
  })

  syllables.forEach((syllable, index) => {
    for (const variant of mutateSyllable(syllable)) {
      const next = [...syllables]
      next[index] = variant
      add(next.join(' '))
    }
  })

  if (candidates.size < 3) {
    for (let left = 0; left < syllables.length; left++) {
      for (const leftVariant of mutateSyllable(syllables[left]).slice(0, 2)) {
        for (let right = left + 1; right < syllables.length; right++) {
          for (const rightVariant of mutateSyllable(syllables[right]).slice(0, 2)) {
            const next = [...syllables]
            next[left] = leftVariant
            next[right] = rightVariant
            add(next.join(' '))
          }
        }
      }
    }
  }

  const ranked = [...candidates]
    .filter(item => !preferred.includes(item))
    .sort((a, b) => stableInt(`${word}:pinyin:${a}`) - stableInt(`${word}:pinyin:${b}`))
  const chosen = [...preferred, ...ranked].slice(0, 3)
  if (chosen.length < 3) throw new Error(`${word}: 无法生成 3 个可靠的拼音干扰项`)
  return [correct, ...chosen].sort((a, b) => stableInt(`${word}:pinyin-choice:${a}`) - stableInt(`${word}:pinyin-choice:${b}`))
}

function entryFromCards(cards, dictionaryMap, previous) {
  const first = cards[0]
  const lemma = String(first.lemma || '').trim()
  const recite = cards.find(card => card.question_type === 'recite')
  const meaningCard = cards.find(card => card.question_type === 'meaning_choice')
  const dictionary = dictionaryMap.get(lemma) || {}
  return {
    key: String(first.entry_key || `idiom:${lemma}`),
    lemma,
    pinyin: String(previous?.pinyin || dictionary.pinyin || '').trim(),
    pinyin_review: String(previous?.pinyin_review || 'chinese-xinhua-unverified'),
    meaning: cleanMeaning(previous?.meaning || recite?.prompt || meaningCard?.answer || ''),
    tags: String(first.tags || previous?.tags || '').trim(),
    source: String(first.source || previous?.source || '').trim(),
    difficulty: String(first.difficulty || previous?.difficulty || 'junior'),
    active: cards.some(card => card.active !== false)
  }
}

function cardFromPoint(point, entry, characterIndex) {
  const type = point.question_type === 'char_judge' ? 'spelling_choice' : point.question_type
  const card = {
    key: String(point.key || '').trim(),
    entry_key: entry.key,
    prompt: String(point.prompt || '').trim(),
    answer: String(point.answer || '').trim(),
    question_type: type,
    audience: 'all',
    options: stringifyOptions(point.options)
  }
  if (type === 'spelling_choice') {
    const oldOptions = parseOptions(point.options)
    card.prompt = `“${entry.lemma}”的正确写法是？`
    card.answer = entry.lemma
    card.options = JSON.stringify({
      choices: spellingChoices(entry.lemma, entry.pinyin, oldOptions.display, characterIndex)
    })
  }
  if (type === 'pinyin_choice') {
    card.prompt = `“${entry.lemma}”的正确拼音是？`
    card.answer = entry.pinyin
    card.options = JSON.stringify({
      choices: pinyinChoices(entry.lemma, entry.pinyin)
    })
  }
  return card
}

function writeSplitPack(pack) {
  const dictionary = loadDictionary()
  const dictionaryMap = new Map(dictionary.map(item => [String(item.word || ''), item]))
  const characterIndex = buildCharacterIndex(dictionary)
  addReviewedConfusables(characterIndex, pack.points)
  const previousData = fs.existsSync(entryPath) ? readJson(entryPath) : {}
  const previousEntries = new Map((previousData.entries || []).map(entry => [entry.key, entry]))
  const groups = new Map()
  for (const point of pack.points || []) {
    const entryKey = String(point.entry_key || `idiom:${point.lemma || ''}`)
    if (!groups.has(entryKey)) groups.set(entryKey, [])
    groups.get(entryKey).push(point)
  }

  const entries = []
  const cardsByType = new Map(Object.keys(CARD_FILES).map(type => [type, []]))
  for (const [entryKey, points] of groups) {
    const entry = entryFromCards(points, dictionaryMap, previousEntries.get(entryKey))
    entries.push(entry)
    for (const point of points) {
      const card = cardFromPoint(point, entry, characterIndex)
      if (!cardsByType.has(card.question_type)) throw new Error(`${card.key}: 不支持题型 ${card.question_type}`)
      cardsByType.get(card.question_type).push(card)
    }
  }

  const version = Number(pack.version || previousData.version || 1)
  writeJson(entryPath, {
    title: '小学成语词条',
    version,
    count: entries.length,
    tiers: { primary: '基础', xiaoshengchu: '拓展', junior: '培优' },
    entries
  })
  for (const [type, filename] of Object.entries(CARD_FILES)) {
    const cards = cardsByType.get(type) || []
    writeJson(path.join(idiomDir, filename), {
      title: `小学成语题卡·${CARD_TITLES[type]}`,
      version,
      question_type: type,
      count: cards.length,
      cards
    })
  }
  return writePublishPack()
}

function loadSource() {
  const source = readJson(entryPath)
  if (!Array.isArray(source.entries)) {
    throw new Error(`${entryPath} 仍是旧版混合文件，请先执行 migrate-split.js`)
  }
  const entries = new Map()
  const lemmas = new Set()
  const tiers = new Set(['primary', 'xiaoshengchu', 'junior'])
  for (const entry of source.entries) {
    if (!entry.key || !entry.lemma) throw new Error('成语词条缺少 key 或 lemma')
    if (entries.has(entry.key)) throw new Error(`重复成语词条：${entry.key}`)
    if (lemmas.has(entry.lemma)) throw new Error(`重复成语名称：${entry.lemma}`)
    if (!tiers.has(entry.difficulty)) throw new Error(`${entry.key}: 分层无效 ${entry.difficulty}`)
    if (entry.grade || entry.level || entry.audience) throw new Error(`${entry.key}: 词条只能按基础/拓展/培优分层，不能设置年级`)
    if (!String(entry.pinyin || '').trim()) throw new Error(`${entry.key}: 缺少拼音`)
    if (!String(entry.meaning || '').trim()) throw new Error(`${entry.key}: 缺少解释`)
    const syllables = String(entry.pinyin).trim().split(/\s+/)
    if (syllables.length !== Array.from(entry.lemma).length) throw new Error(`${entry.key}: 拼音音节数与字数不一致`)
    if (syllables.some(item => !/[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(item))) {
      throw new Error(`${entry.key}: 拼音含无韵母音节 ${entry.pinyin}`)
    }
    if (!['web-cross-checked-2026-09-11', 'chinese-xinhua-unverified'].includes(entry.pinyin_review)) {
      throw new Error(`${entry.key}: 缺少拼音核验状态`)
    }
    entries.set(entry.key, entry)
    lemmas.add(entry.lemma)
  }
  if (Number(source.count) !== entries.size) {
    throw new Error(`词条 count=${source.count}，实际=${entries.size}`)
  }

  const cards = []
  const keys = new Set()
  for (const [type, filename] of Object.entries(CARD_FILES)) {
    const filePath = path.join(idiomDir, filename)
    if (!fs.existsSync(filePath)) continue
    const data = readJson(filePath)
    if (data.question_type !== type) throw new Error(`${filename}: 顶层题型应为 ${type}`)
    if (Number(data.count) !== (data.cards || []).length) {
      throw new Error(`${filename}: count=${data.count}，实际=${(data.cards || []).length}`)
    }
    for (const card of data.cards || []) {
      if (card.question_type !== type) throw new Error(`${card.key}: 题型与文件 ${type} 不一致`)
      if (!entries.has(card.entry_key)) throw new Error(`${card.key}: 引用了不存在的词条 ${card.entry_key}`)
      if (!card.key || keys.has(card.key)) throw new Error(`题卡 key 缺失或重复：${card.key}`)
      keys.add(card.key)
      cards.push(card)
    }
  }
  return { source, entries, cards }
}

function compileSource() {
  const { source, entries, cards } = loadSource()
  const points = cards.map(card => {
    const entry = entries.get(card.entry_key)
    return {
      key: card.key,
      kind: 'idiom',
      prompt: card.prompt,
      answer: card.answer,
      tags: entry.tags || '',
      source: entry.source || '',
      lemma: entry.lemma,
      question_type: card.question_type,
      audience: card.audience || 'all',
      sub_group: card.question_type,
      entry_key: entry.key,
      options: stringifyOptions(card.options),
      group: entry.key,
      group_key: entry.key,
      difficulty: entry.difficulty,
      sub_group_key: 'recite',
      active: entry.active !== false
    }
  })
  return {
    title: '小学成语',
    version: Number(source.version || 1),
    count: points.length,
    points
  }
}

function writePublishPack() {
  const pack = compileSource()
  writeJson(publishPath, pack)
  return pack
}

function loadCompiledPack() {
  return compileSource()
}

module.exports = {
  CARD_FILES,
  entryPath,
  publishPath,
  isPlausibleSyllable,
  loadCompiledPack,
  loadSource,
  pinyinChoices,
  spellingChoices,
  writePublishPack,
  writeSplitPack
}
