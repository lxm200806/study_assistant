/**
 * Built-in typing passages for the keyboard practice page.
 *
 * "library-rain" is original text written for this app.
 * The Austen and Carroll excerpts are public domain (1813 and 1865).
 * PEP authored passages are original oral drills (not textbook text).
 * Textbook slots may be filled via *.local.json after licensing — do not commit copyrighted text.
 */
import fs from 'fs'
import path from 'path'

export type PassageKind = 'authored' | 'textbook' | 'builtin'

export interface BuiltinArticle {
  key: string
  title: string
  source: string
  body: string
  translation: string
  bookCode?: string
  unitId?: string
  kind?: PassageKind
}

const staticArticles: BuiltinArticle[] = [
  {
    key: 'library-rain',
    title: '雨天的图书馆',
    source: '原创练习短文',
    kind: 'builtin',
    body: [
      'The library window was open, and the room smelled like rain.',
      'Mina wrote each new word on a small card.',
      'She said the word once, then covered it and wrote it again.',
      'A bell rang, and the quiet room filled with footsteps.'
    ].join('\n'),
    translation: [
      '图书馆的窗户开着，屋里有雨的气味。',
      '米娜把每个生词写在一张小卡片上。',
      '她把单词读一遍，然后盖住，再写一遍。',
      '铃响了，安静的房间里响起脚步声。'
    ].join('\n')
  },
  {
    key: 'austen-truth',
    title: '一条公认的道理',
    source: '公有领域摘录：Jane Austen, Pride and Prejudice (1813)',
    kind: 'builtin',
    body: [
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
      'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
      'Mr. Bennet was among the earliest of those who waited on Mr. Bingley.',
      'He had always intended to visit him, though to the last always assuring his wife that he should not go.'
    ].join('\n'),
    translation: [
      '有一条公认的道理：凡是有钱的单身汉，总想娶位太太。',
      '这种单身汉初到一地，他的心思旁人并不清楚，可周围人家已经把这道理看得很牢，把他当成自家某个女儿的应得之人。',
      '班纳特先生是最早去拜访宾利先生的人之一。',
      '他一直打算去见他，可直到最后都对太太说自己不会去。'
    ].join('\n')
  },
  {
    key: 'alice-bank',
    title: '河岸上的爱丽丝',
    source: "公有领域摘录：Lewis Carroll, Alice's Adventures in Wonderland (1865)",
    kind: 'builtin',
    body: [
      'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.',
      'Once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it.',
      'What is the use of a book, thought Alice, without pictures or conversations?',
      'So she was considering in her own mind whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies.'
    ].join('\n'),
    translation: [
      '爱丽丝坐在河岸边姐姐身旁，闲得发慌，开始觉得很腻。',
      '她一两次偷眼去看姐姐读的书，可里面既没有图画，也没有对话。',
      '爱丽丝想，一本没有图画和对话的书有什么用呢？',
      '于是她心里盘算，做一条雏菊花链的乐趣，值不值得费事站起来去采雏菊。'
    ].join('\n')
  }
]

type RawPassage = {
  key: string
  title: string
  source: string
  body: string
  translation: string
  bookCode?: string
  unitId?: string
  kind?: PassageKind
}

function inferKind(file: string, passage: RawPassage): PassageKind {
  if (passage.kind === 'authored' || passage.kind === 'textbook' || passage.kind === 'builtin') {
    return passage.kind
  }
  if (file.includes('textbook')) return 'textbook'
  return 'authored'
}

function loadPassageBundles(): BuiltinArticle[] {
  const dir = path.join(__dirname, '../../data/vocabulary/passages')
  if (!fs.existsSync(dir)) return []

  const byKey = new Map<string, BuiltinArticle>()
  const files = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json') && !f.includes('.example.'))
    .sort((a, b) => {
      const al = a.includes('.local.') ? 1 : 0
      const bl = b.includes('.local.') ? 1 : 0
      return al - bl || a.localeCompare(b)
    })

  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as {
        passages?: RawPassage[]
      }
      for (const p of raw.passages || []) {
        if (!p?.key) continue
        const body = String(p.body || '').trim()
        // keep empty textbook slots out of typing library
        if (!body) continue
        byKey.set(p.key, {
          key: p.key,
          title: p.title,
          source: p.source,
          body: p.body,
          translation: p.translation || '',
          bookCode: p.bookCode,
          unitId: p.unitId,
          kind: inferKind(file, p)
        })
      }
    } catch (err) {
      console.warn(`[practice-articles] skip ${file}:`, err)
    }
  }
  return [...byKey.values()]
}

export const builtinArticles: BuiltinArticle[] = [...staticArticles, ...loadPassageBundles()]

const byKey = new Map(builtinArticles.map(article => [article.key, article]))

export function findBuiltinArticle(key: string): BuiltinArticle | undefined {
  return byKey.get(key)
}

export function listBuiltinArticles(filter?: { bookCode?: string; kind?: PassageKind }): BuiltinArticle[] {
  return builtinArticles.filter(a => {
    if (filter?.bookCode && a.bookCode && a.bookCode !== filter.bookCode) return false
    if (filter?.kind && (a.kind || 'builtin') !== filter.kind) return false
    return true
  })
}
