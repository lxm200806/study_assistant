/** MD 目录 → 词书 code / 元数据（空册次不登记） */

export type KbBookMeta = {
  rel: string
  code: string
  name: string
  level: string
  shortLabel: string
  series: 'pep' | 'jt'
  seriesLabel: string
  grade: string
  term: string
  year: number
  /** 已有速声词表的新教材，导入时不覆盖 units */
  preserveUnits?: boolean
}

export const KB_BOOKS: KbBookMeta[] = [
  {
    rel: '人教版-PEP/03上-2024秋',
    code: 'pep-g3a-2024',
    name: '人教 PEP 三上（2024）',
    level: '小学三上',
    shortLabel: '三上',
    series: 'pep',
    seriesLabel: '人教 PEP',
    grade: '三年级',
    term: '上',
    year: 2024,
    preserveUnits: true
  },
  {
    rel: '人教版-PEP/03下-2025春',
    code: 'pep-g3b-2025',
    name: '人教 PEP 三下（2025）',
    level: '小学三下',
    shortLabel: '三下',
    series: 'pep',
    seriesLabel: '人教 PEP',
    grade: '三年级',
    term: '下',
    year: 2025,
    preserveUnits: true
  },
  {
    rel: '人教版-PEP/04上-2025秋',
    code: 'pep-g4a-2025',
    name: '人教 PEP 四上（2025）',
    level: '小学四上',
    shortLabel: '四上',
    series: 'pep',
    seriesLabel: '人教 PEP',
    grade: '四年级',
    term: '上',
    year: 2025,
    preserveUnits: true
  },
  // 新教材四下/五上仍用速声词表；MD 无对应文字层
  {
    rel: '',
    code: 'pep-g4b-2026',
    name: '人教 PEP 四下（2026）',
    level: '小学四下',
    shortLabel: '四下',
    series: 'pep',
    seriesLabel: '人教 PEP',
    grade: '四年级',
    term: '下',
    year: 2026,
    preserveUnits: true
  },
  {
    rel: '',
    code: 'pep-g5a-2026',
    name: '人教 PEP 五上（2026）',
    level: '小学五上',
    shortLabel: '五上',
    series: 'pep',
    seriesLabel: '人教 PEP',
    grade: '五年级',
    term: '上',
    year: 2026,
    preserveUnits: true
  },
  {
    rel: '人教版-PEP/04下',
    code: 'pep-g4b-legacy',
    name: '人教 PEP 四下（旧版）',
    level: '小学四下',
    shortLabel: '四下·旧',
    series: 'pep',
    seriesLabel: '人教 PEP',
    grade: '四年级',
    term: '下',
    year: 2013
  },
  {
    rel: '人教版-PEP/05上',
    code: 'pep-g5a-legacy',
    name: '人教 PEP 五上（旧版）',
    level: '小学五上',
    shortLabel: '五上·旧',
    series: 'pep',
    seriesLabel: '人教 PEP',
    grade: '五年级',
    term: '上',
    year: 2013
  },
  {
    rel: '人教版-PEP/05下',
    code: 'pep-g5b-legacy',
    name: '人教 PEP 五下（旧版）',
    level: '小学五下',
    shortLabel: '五下·旧',
    series: 'pep',
    seriesLabel: '人教 PEP',
    grade: '五年级',
    term: '下',
    year: 2013
  },
  {
    rel: '人教版-PEP/06上',
    code: 'pep-g6a-legacy',
    name: '人教 PEP 六上（旧版）',
    level: '小学六上',
    shortLabel: '六上·旧',
    series: 'pep',
    seriesLabel: '人教 PEP',
    grade: '六年级',
    term: '上',
    year: 2013
  },
  {
    rel: '人教版-PEP/06下',
    code: 'pep-g6b-legacy',
    name: '人教 PEP 六下（旧版）',
    level: '小学六下',
    shortLabel: '六下·旧',
    series: 'pep',
    seriesLabel: '人教 PEP',
    grade: '六年级',
    term: '下',
    year: 2013
  },
  {
    rel: '人教版-精通/03上-2024秋',
    code: 'jt-g3a-2024',
    name: '人教精通 三上（2024）',
    level: '小学三上',
    shortLabel: '三上',
    series: 'jt',
    seriesLabel: '人教精通',
    grade: '三年级',
    term: '上',
    year: 2024
  },
  {
    rel: '人教版-精通/03下-2025春',
    code: 'jt-g3b-2025',
    name: '人教精通 三下（2025）',
    level: '小学三下',
    shortLabel: '三下',
    series: 'jt',
    seriesLabel: '人教精通',
    grade: '三年级',
    term: '下',
    year: 2025
  },
  {
    rel: '人教版-精通/04上-2025秋',
    code: 'jt-g4a-2025',
    name: '人教精通 四上（2025）',
    level: '小学四上',
    shortLabel: '四上',
    series: 'jt',
    seriesLabel: '人教精通',
    grade: '四年级',
    term: '上',
    year: 2025
  },
  {
    rel: '人教版-精通/04下',
    code: 'jt-g4b',
    name: '人教精通 四下',
    level: '小学四下',
    shortLabel: '四下',
    series: 'jt',
    seriesLabel: '人教精通',
    grade: '四年级',
    term: '下',
    year: 2013
  },
  {
    rel: '人教版-精通/05上',
    code: 'jt-g5a',
    name: '人教精通 五上',
    level: '小学五上',
    shortLabel: '五上',
    series: 'jt',
    seriesLabel: '人教精通',
    grade: '五年级',
    term: '上',
    year: 2013
  },
  {
    rel: '人教版-精通/05下',
    code: 'jt-g5b',
    name: '人教精通 五下',
    level: '小学五下',
    shortLabel: '五下',
    series: 'jt',
    seriesLabel: '人教精通',
    grade: '五年级',
    term: '下',
    year: 2013
  },
  {
    rel: '人教版-精通/06上',
    code: 'jt-g6a',
    name: '人教精通 六上',
    level: '小学六上',
    shortLabel: '六上',
    series: 'jt',
    seriesLabel: '人教精通',
    grade: '六年级',
    term: '上',
    year: 2013
  },
  {
    rel: '人教版-精通/06下',
    code: 'jt-g6b',
    name: '人教精通 六下',
    level: '小学六下',
    shortLabel: '六下',
    series: 'jt',
    seriesLabel: '人教精通',
    grade: '六年级',
    term: '下',
    year: 2013
  }
]

export const KB_BOOK_CODES = KB_BOOKS.map(b => b.code)
