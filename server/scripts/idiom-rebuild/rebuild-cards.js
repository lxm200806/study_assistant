// 用校对后的释义重建成语题卡。运行前先执行 build-worksheet.js 并完成 reviewed/*.json。
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { loadCompiledPack, writeSplitPack } = require('./idiom-files')

const root = path.join(__dirname, '../..')
const workDir = path.join(__dirname, 'work')
const reviewedDir = path.join(workDir, 'reviewed')

// 北京、天津六年级/小升初公开试卷中出现过的典型误写。
// 只复用错字模式，不复制整道受版权保护的试题。
const EXAM_MISSPELLINGS = {
  万象更新: '万像更新',
  见微知著: '见微知箸',
  不可思议: '不可思义',
  迫不及待: '迫不急待',
  心平气和: '心平气河',
  墨守成规: '默守成规',
  甘拜下风: '甘败下风',
  直截了当: '直接了当'
}

const MEANING_OVERRIDES = {
  围魏救赵: '比喻攻打对方后方，迫使其撤兵解围'
}

function stableInt(text) {
  return parseInt(crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 8), 16)
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function cleanExplanation(text) {
  const raw = String(text || '').replace(/[”“"]/g, '').replace(/～/g, '').trim()
  if (!raw) return ''
  const parts = raw.split(/[。；;]/).map(item => item.trim()).filter(Boolean)
  const markers = ['比喻', '形容', '指', '表示', '意思是', '常用来', '多用来']
  const useful = parts.filter(part => markers.some(marker => part.includes(marker)))
  return (useful.length ? useful[useful.length - 1] : parts[parts.length - 1]).trim()
}

function makeHomophoneIndex(dictionary) {
  const charsBySyllable = new Map()
  const charFrequency = new Map()
  for (const item of dictionary) {
    const chars = Array.from(String(item.word || ''))
    const syllables = String(item.pinyin || '').trim().split(/\s+/)
    if (chars.length !== syllables.length) continue
    chars.forEach((char, index) => {
      const syllable = syllables[index]
      if (!charsBySyllable.has(syllable)) charsBySyllable.set(syllable, new Set())
      charsBySyllable.get(syllable).add(char)
      charFrequency.set(char, (charFrequency.get(char) || 0) + 1)
    })
  }
  return { charsBySyllable, charFrequency }
}

function makeJudge(word, pinyin, homophones) {
  // 约三分之一展示正确写法，避免学生形成“每题必错”的策略。
  if (stableInt(`${word}:judge-correct`) % 3 === 0) return { display: word, answer: '对' }
  if (EXAM_MISSPELLINGS[word]) return { display: EXAM_MISSPELLINGS[word], answer: '错' }
  const chars = Array.from(word)
  const syllables = String(pinyin || '').trim().split(/\s+/)
  if (chars.length !== syllables.length) return { display: word, answer: '对' }

  const candidates = []
  chars.forEach((char, index) => {
    const alternatives = [...(homophones.charsBySyllable.get(syllables[index]) || [])]
      .filter(other => other !== char && !chars.includes(other) && !'甲乙丙丁戊己庚'.includes(other))
      .sort((a, b) =>
        (homophones.charFrequency.get(b) || 0) - (homophones.charFrequency.get(a) || 0) ||
        a.localeCompare(b, 'zh')
      )
    if (alternatives.length) candidates.push({ index, alternatives })
  })
  if (!candidates.length) return { display: word, answer: '对' }
  const picked = candidates[stableInt(`${word}:judge-position`) % candidates.length]
  chars[picked.index] = picked.alternatives[stableInt(`${word}:judge-char`) % Math.min(5, picked.alternatives.length)]
  return { display: chars.join(''), answer: '错' }
}

function meaningShape(meaning) {
  const prefix = ['比喻', '形容', '指', '表示'].find(item => meaning.startsWith(item)) || '其他'
  return { prefix, length: Array.from(meaning).length }
}

function makeChoices(entry, pool) {
  const target = meaningShape(entry.meaning)
  const ranked = pool
    .filter(item => item.word !== entry.word && item.meaning !== entry.meaning)
    .map(item => {
      const shape = meaningShape(item.meaning)
      const prefixPenalty = shape.prefix === target.prefix ? 0 : 30
      const lengthPenalty = Math.abs(shape.length - target.length)
      // 固定散列打破同分，保证每次重建结果稳定。
      const jitter = stableInt(`${entry.word}:${item.word}`) % 13
      return { item, score: prefixPenalty + lengthPenalty + jitter }
    })
    .sort((a, b) => a.score - b.score)

  const distractors = []
  for (const candidate of ranked) {
    if (distractors.some(item => item.meaning === candidate.item.meaning)) continue
    distractors.push(candidate.item)
    if (distractors.length === 3) break
  }
  const choices = [entry.meaning, ...distractors.map(item => item.meaning)]
  return choices.sort((a, b) => stableInt(`${entry.word}:choice:${a}`) - stableInt(`${entry.word}:choice:${b}`))
}

function main() {
  const pack = loadCompiledPack()
  const reviewedExamCards = pack.points.filter(point =>
    ['context_choice', 'usage_judge'].includes(point.question_type)
  )
  const worksheet = readJson(path.join(workDir, 'worksheet.json'))
  const dictionary = readJson(path.join(root, 'data/sources/idiom-xinhua.json'))
  const dictionaryMap = new Map(dictionary.map(item => [item.word, item]))
  const sourceByWord = new Map()
  for (const point of pack.points) {
    const word = String(point.lemma || (point.question_type === 'recite' ? point.answer : '') || '').trim()
    if (word && (!sourceByWord.has(word) || point.question_type === 'recite')) sourceByWord.set(word, point)
  }

  const reviewedFiles = fs.existsSync(reviewedDir)
    ? fs.readdirSync(reviewedDir).filter(name => name.endsWith('-reviewed.json')).sort()
    : []
  const reviewed = new Map()
  for (const name of reviewedFiles) {
    for (const row of readJson(path.join(reviewedDir, name))) {
      if (!row.word || !row.meaning || !['primary', 'xiaoshengchu', 'junior'].includes(row.difficulty)) {
        throw new Error(`${name} 中有无效记录：${JSON.stringify(row)}`)
      }
      if (reviewed.has(row.word)) throw new Error(`重复校对词条：${row.word}`)
      reviewed.set(row.word, row)
    }
  }

  const targets = worksheet.filter(row => row.difficulty !== 'junior')
  const missingReviews = targets.filter(row => !reviewed.has(row.word))
  if (missingReviews.length) {
    throw new Error(`仍缺 ${missingReviews.length} 条校对结果：${missingReviews.slice(0, 10).map(row => row.word).join('、')}`)
  }

  const entries = worksheet.map(row => {
    const review = reviewed.get(row.word)
    const dictMeaning = cleanExplanation(dictionaryMap.get(row.word)?.explanation)
    const meaning = String(MEANING_OVERRIDES[row.word] || review?.meaning || row.existingGloss || dictMeaning || '').trim()
    return {
      ...row,
      meaning,
      difficulty: review?.difficulty || 'junior',
      pinyin: dictionaryMap.get(row.word)?.pinyin || row.pinyin || ''
    }
  })

  const choicePool = entries.filter(item =>
    item.difficulty !== 'junior' &&
    item.meaning &&
    Array.from(item.meaning).length >= 4
  )
  const pools = new Map([
    ['primary', choicePool.filter(item => item.difficulty === 'primary')],
    ['xiaoshengchu', choicePool.filter(item => item.difficulty === 'xiaoshengchu')]
  ])
  const homophones = makeHomophoneIndex(dictionary)
  const points = []

  for (const entry of entries) {
    const base = sourceByWord.get(entry.word)
    if (!base) throw new Error(`找不到原始题卡：${entry.word}`)
    const common = {
      ...base,
      difficulty: entry.difficulty,
      tags: String(base.tags || '')
    }

    // 没有可靠释义的培优词不生成含糊的背诵/释义题，仅保留易错字选择。
    if (entry.meaning) {
      points.push({
        ...common,
        prompt: `${entry.meaning}（四字）`,
        answer: entry.word,
        question_type: 'recite',
        audience: entry.difficulty === 'primary' ? 'all' : 'upper',
        options: '',
        sub_group: 'recite',
        sub_group_key: 'recite'
      })
    }

    if (entry.pinyin) {
      points.push({
        ...common,
        key: `${base.key}:pinyin_choice`,
        prompt: `“${entry.word}”的正确拼音是？`,
        answer: entry.pinyin,
        question_type: 'pinyin_choice',
        audience: 'all',
        options: '',
        sub_group: 'pinyin_choice',
        sub_group_key: 'recite'
      })
    }

    const judge = makeJudge(entry.word, entry.pinyin, homophones)
    points.push({
      ...common,
      key: `${base.key}:char_judge`,
      prompt: '下面的成语写法对不对？',
      answer: judge.answer,
      question_type: 'char_judge',
      audience: entry.difficulty === 'junior' ? 'upper' : 'all',
      options: JSON.stringify({ display: judge.display }),
      sub_group: 'char_judge',
      sub_group_key: 'recite'
    })

    if (entry.difficulty !== 'junior' && entry.meaning) {
      const choices = makeChoices(entry, pools.get(entry.difficulty) || choicePool)
      if (choices.length !== 4) throw new Error(`${entry.word} 的选项不足 4 个`)
      points.push({
        ...common,
        key: `${base.key}:meaning_choice`,
        prompt: `「${entry.word}」的意思是？`,
        answer: entry.meaning,
        question_type: 'meaning_choice',
        audience: entry.difficulty === 'primary' ? 'all' : 'upper',
        options: JSON.stringify({ choices }),
        sub_group: 'meaning_choice',
        sub_group_key: 'recite'
      })
    }
  }

  // 二期考试型题卡经过逐题人工/模型二审，重建基础卡时原样保留。
  const activeCommonWords = new Set(entries
    .filter(entry => entry.difficulty !== 'junior')
    .map(entry => entry.word))
  points.push(...reviewedExamCards.filter(card =>
    card.active !== false && activeCommonWords.has(card.lemma)
  ))

  const output = { ...pack, version: Number(pack.version || 1) + 1, count: points.length, points }
  const published = writeSplitPack(output)

  const counts = {}
  for (const point of published.points) {
    const key = `${point.difficulty}/${point.question_type}`
    counts[key] = (counts[key] || 0) + 1
  }
  console.log('重建完成', published.points.length, counts)
  console.log('已写入唯一词条、分题型题卡和发布包')
}

main()
