import path from 'path'

export type KewSeries = 'kew1200' | 'kew4500' | 'kew7200'

export const KEW_SERIES: KewSeries[] = ['kew1200', 'kew4500', 'kew7200']

export const SERVER_ROOT = path.join(__dirname, '../..')
export const KEW_ROOT = path.join(SERVER_ROOT, 'data/sources/kew')
export const BOOKS_DIR = path.join(SERVER_ROOT, 'data/vocabulary/books')
export const TMP_DIR = path.join(SERVER_ROOT, 'tmp')
export const REPORT_DIR = path.join(TMP_DIR, 'kew')

const BOOKS: Record<KewSeries, string[]> = {
  kew1200: ['kew1200-1', 'kew1200-2', 'kew1200-3'],
  kew4500: ['kew4500-1', 'kew4500-2', 'kew4500-3', 'kew4500-4'],
  kew7200: ['kew7200-1', 'kew7200-2', 'kew7200-3']
}

const LIST_SOURCE: Record<KewSeries, string> = {
  kew1200: 'kew-toc',
  kew4500: 'kew4500-word-lists',
  kew7200: 'kew7200-toc'
}

/** 全局义项表优先小学生校对；一书一例，进度按词形合并 */
const EDITOR: Record<KewSeries, string> = {
  kew1200: 'editor-elementary',
  kew4500: 'editor-series',
  kew7200: 'editor-series'
}

export interface KewSeriesLayout {
  series: KewSeries
  books: string[]
  listSource: string
  editor: string
  seriesDir: string
  unitsPath: string
  reportPath: string
  glossPath: (code: string) => string
  bookPath: (code: string) => string
  englishMeaningSource: (code: string) => string
}

export function isKewSeries(value: string): value is KewSeries {
  return KEW_SERIES.includes(value as KewSeries)
}

export function parseKewSeries(value: string): KewSeries {
  if (!isKewSeries(value)) {
    throw new Error(`未知套系: ${value}（可用: ${KEW_SERIES.join(', ')}）`)
  }
  return value
}

export function resolveKewSeriesArgs(argv: string[]): KewSeries[] {
  const args = argv.filter(
    arg => !arg.startsWith('--') && !arg.endsWith('.ts') && !/[\\/]/.test(arg)
  )
  if (!args.length) return [...KEW_SERIES]
  return args.map(parseKewSeries)
}

export function getKewLayout(series: KewSeries): KewSeriesLayout {
  const seriesDir = path.join(KEW_ROOT, series)
  return {
    series,
    books: BOOKS[series],
    listSource: LIST_SOURCE[series],
    editor: EDITOR[series],
    seriesDir,
    unitsPath: path.join(seriesDir, 'units.json'),
    reportPath: path.join(REPORT_DIR, `${series}-polish-report.json`),
    glossPath: code => path.join(seriesDir, `${code}-glosses.json`),
    bookPath: code => path.join(BOOKS_DIR, `${code}.json`),
    englishMeaningSource: code => (series === 'kew4500' ? LIST_SOURCE.kew4500 : EDITOR[series])
  }
}

export function seriesOfBook(code: string): KewSeries {
  const series = KEW_SERIES.find(item => code.startsWith(`${item}-`) || code === item)
  if (!series) throw new Error(`无法识别书号套系: ${code}`)
  return series
}
