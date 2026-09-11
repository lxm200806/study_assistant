import { describe, expect, it } from 'vitest'
import { gradeAnswer, gradeCard, gradeCharJudge, gradeChoice, normalize } from './grade'
import { addDays, isMastered, schedule } from './sm2'
import { applyTodayMode, isRecitable, normalizeMode, resolveDefaultMode, reviewOutcome } from './study-modes'
import {
  energyToMinutes,
  fillGroupFields,
  minutesToEnergy,
  pointEnergy,
  validateCard
} from './cards'
import { KIND_LABEL, PLAN_CALENDAR_DAYS, PLAN_WARN_DAYS } from './constants'
import { looksLikeMeaning, makeCharJudgeCard } from './entries'
import { kidFeedback, progressStatus, weakKindRows } from './progress'
import { applyAttempt, computeMastery, decayMastery, entryIsDue, retestIntervalDays } from './mastery'
import {
  compareLearningEntries,
  courseSizeWarning,
  planCourseDays,
  planTodayGroups,
  sortLearningEntries,
  clusterEntries
} from './schedule'

describe('chinese grade', () => {
  it('strips punctuation', () => {
    expect(normalize('床前明月 光，')).toBe('床前明月光')
    expect(normalize(null)).toBe('')
  })

  it('scores exact dictation as 5', () => {
    const result = gradeAnswer(
      '床前明月光，疑是地上霜。举头望明月，低头思故乡。',
      '床前明月光，疑是地上霜。举头望明月，低头思故乡。'
    )
    expect(result.quality).toBe(5)
    expect(result.correct).toBe(true)
  })

  it('scores empty and typo as 1', () => {
    expect(gradeAnswer('', '己').quality).toBe(1)
    expect(gradeAnswer('守株侍兔', '守株待兔').quality).toBe(1)
  })

  it('grades judge and choice cards', () => {
    expect(gradeCharJudge('对', '对').quality).toBe(5)
    expect(gradeCharJudge('正确', '对').quality).toBe(5)
    expect(gradeChoice('做事认真', '做事认真').correct).toBe(true)
    expect(gradeCard({ question_type: 'char_judge', answer: '错' }, '错').correct).toBe(true)
    expect(gradeCard({ question_type: 'char_judge', answer: '对' }, '', true).correct).toBe(false)
    expect(gradeCard({ question_type: 'usage_judge', answer: '错' }, '错').correct).toBe(true)
    expect(gradeCard({ question_type: 'context_choice', answer: '一丝不苟' }, '一丝不苟').correct).toBe(true)
    expect(gradeCard({ question_type: 'spelling_choice', answer: '一丝不苟' }, '一丝不苟').correct).toBe(true)
    expect(gradeCard({ question_type: 'pinyin_choice', answer: 'yī sī bù gǒu' }, 'yī sī bù gǒu').correct).toBe(true)
  })
})

describe('chinese sm2', () => {
  it('schedules first pass to 1 day', () => {
    const next = schedule(null, 5, '2026-01-01')
    expect(next.n).toBe(1)
    expect(next.interval).toBe(1)
    expect(next.due).toBe(addDays('2026-01-01', 1))
  })

  it('resets on fail', () => {
    const next = schedule({ n: 3, ef: 2.5, interval: 15, lapses: 0 }, 1, '2026-01-01')
    expect(next.n).toBe(0)
    expect(next.lapses).toBe(1)
    expect(isMastered(next)).toBe(false)
  })

  it('marks mastered after long interval', () => {
    expect(isMastered({ n: 5, interval: 6 })).toBe(true)
    expect(isMastered({ n: 3, interval: 21 })).toBe(true)
  })
})

describe('chinese study modes', () => {
  it('normalizes aliases', () => {
    expect(normalizeMode('筛选')).toBe('filter')
    expect(normalizeMode('测试')).toBe('test')
    expect(normalizeMode('learn')).toBe('learn')
  })

  it('defaults to learn unless review testing is enabled', () => {
    expect(resolveDefaultMode({ groups: [{ role: 'review' }], reviewEnergy: 16, newEnergy: 8 })).toBe('learn')
    expect(resolveDefaultMode({ groups: [{ role: 'review' }], reviewEnergy: 16, newEnergy: 8 }, true)).toBe('test')
    expect(resolveDefaultMode({ groups: [{ role: 'new' }], reviewEnergy: 0, newEnergy: 16 })).toBe('learn')
  })

  it('test mode never falls back to new cards', () => {
    const planned = applyTodayMode(
      { groups: [{ role: 'new', energy: 8, rows: [{}] }] },
      'test'
    )
    expect(planned.cards).toBe(0)
    expect(planned.groups).toEqual([])
  })

  it('blocks reveal in test mode', () => {
    const blocked = reviewOutcome('test', { quality: 5, correct: true }, true)
    expect(blocked.ok).toBe(false)
  })

  it('learn reveal uses quality 3', () => {
    const result = reviewOutcome('learn', { quality: 1, correct: false }, true)
    expect(result.ok).toBe(true)
    expect(result.quality).toBe(3)
    expect(result.update_sm2).toBe(true)
  })

  it('recite does not update sm2', () => {
    const result = reviewOutcome('recite', { quality: 5, correct: true }, false)
    expect(result.update_sm2).toBe(false)
  })

  it('recite mode zeros charged energy', () => {
    const planned = applyTodayMode(
      {
        groups: [{
          role: 'new',
          energy: 16,
          rows: [
            { kind: 'poem', question_type: 'recite' },
            { kind: 'idiom', question_type: 'recite' }
          ]
        }]
      },
      'recite'
    )
    expect(planned.energyCharged).toBe(false)
    expect(planned.newEnergy).toBe(0)
    expect(planned.reviewEnergy).toBe(0)
    expect(planned.cards).toBe(2)
    expect(isRecitable({ kind: 'idiom', question_type: 'recite' })).toBe(true)
    expect(isRecitable({ kind: 'idiom', question_type: 'usage_judge' })).toBe(false)
  })
})

describe('chinese cards', () => {
  it('converts minutes to internal work units', () => {
    expect(minutesToEnergy(15)).toBe(60)
    expect(energyToMinutes(60)).toBe(15)
  })

  it('uses one daily budget with review before new work', () => {
    const planned = planTodayGroups(
      [
        { id: 'review', kind: 'idiom', question_type: 'recite', answer: '复习词', last: '2026-01-01', due: '2026-01-01' },
        { id: 'new', kind: 'idiom', question_type: 'recite', answer: '新词' }
      ],
      new Set(),
      '2026-01-02',
      5,
      0,
      0
    )
    expect(planned.groups[0].role).toBe('review')
    expect(planned.targetMinutes).toBe(5)
  })

  it('deducts spent time and allows a five minute extension', () => {
    const rows = [{ id: 'new', kind: 'poem', question_type: 'recite', answer: '床前明月光，疑是地上霜。' }]
    expect(planTodayGroups(rows, new Set(), '2026-01-01', 5, 20, 0).cards).toBe(0)
    expect(planTodayGroups(rows, new Set(), '2026-01-01', 5, 20, 5).cards).toBe(1)
  })

  it('serializes recognizable knowledge points and minute estimates', () => {
    const plan = planCourseDays([
      { id: 'idiom', group_key: 'idiom:阿谀奉承', kind: 'idiom', lemma: '阿谀奉承', prompt: '用好听的话讨好别人（四字）', question_type: 'recite' }
    ], 10)
    expect(plan.dailyMinutes).toBe(10)
    expect(plan.days[0].cards[0].knowledgePoint).toBe('阿谀奉承')
    expect(plan.days[0].cards[0].estimatedMinutes).toBeGreaterThan(0)
  })

  it('does not treat idiom categories as definitions', () => {
    expect(looksLikeMeaning({ prompt: '小学教辅常见成语（四字）' })).toBe(false)
    expect(looksLikeMeaning({ prompt: '描写春天的成语（四字）' })).toBe(false)
    expect(looksLikeMeaning({ prompt: '形容做事认真细致（四字）' })).toBe(true)
  })

  it('never creates placeholder-character spelling questions', () => {
    const card = makeCharJudgeCard({ key: 'idiom-test', lemma: '阿谀奉承', answer: '阿谀奉承' })
    const options = JSON.parse(String(card.options || '{}'))
    expect(options.display).not.toMatch(/[甲乙丙丁戊己庚辛]/)
    if (options.display === '阿谀奉承') expect(card.answer).toBe('对')
  })

  it('validates kinds and zi length', () => {
    expect(validateCard('zi', '写这个字', '己')).toBeNull()
    expect(validateCard('zi', '写这个字', '已经')).toContain('一个字')
    expect(validateCard('idiom', '提示', '一丝不苟', 'dictation', '一丝不苟')).toBeNull()
    expect(validateCard('idiom', '提示', '过', 'dictation', '过')).toContain('成语')
  })

  it('validates new exam-style card answers', () => {
    expect(validateCard('idiom', '他做事____。', '一丝不苟', 'context_choice', '一丝不苟')).toBeNull()
    expect(validateCard('idiom', '正确写法是？', '一丝不苟', 'spelling_choice', '一丝不苟')).toBeNull()
    expect(validateCard('idiom', '这个句子使用是否恰当', '错', 'usage_judge', '一丝不苟')).toBeNull()
    expect(validateCard('idiom', '这个句子使用是否恰当', '不知道', 'usage_judge', '一丝不苟')).toContain('对或错')
  })

  it('assigns poem energy by length', () => {
    expect(pointEnergy({ kind: 'poem', question_type: 'recite', answer: '鹅鹅鹅曲项向天歌' })).toBe(16)
    expect(pointEnergy({ kind: 'zi', question_type: 'dictation', answer: '己' })).toBe(1)
  })

  it('fills group keys from entry', () => {
    const filled = fillGroupFields({
      key: 'g1s-poem-yongge',
      kind: 'poem',
      level: 'L1',
      prompt: '默写咏鹅',
      answer: '鹅鹅鹅'
    })
    expect(filled.entry_key).toBe('g1s-poem-yongge')
    expect(filled.group_key).toBe('g1s-poem-yongge')
  })

  it('plans review before new cards', () => {
    const planned = planTodayGroups(
      [
        { id: '1', kind: 'zi', last: null, prompt: '新', answer: '新' },
        { id: '2', kind: 'zi', last: '2026-01-01', due: '2026-01-02', prompt: '旧', answer: '旧' }
      ],
      new Set(),
      '2026-01-02',
      30,
      30
    )
    expect(planned.groups[0].role).toBe('review')
    expect(planned.reviewEnergy).toBeGreaterThan(0)
  })

  it('does not silently cap a small course estimate', () => {
    const plan = planCourseDays([
      { id: 'idiom', group_key: 'idiom:阿谀奉承', entry_key: 'idiom:阿谀奉承', kind: 'idiom', lemma: '阿谀奉承', prompt: '用好听的话讨好别人（四字）', question_type: 'recite' }
    ], 10)
    expect(plan.truncated).toBe(false)
    expect(plan.estimatedDays).toBe(plan.calendarDays)
    expect(plan.rawDayCount).toBe(plan.estimatedDays)
    expect(plan.warning).toBe('')
  })

  it('paces a full idiom set around 360 days instead of thousands', () => {
    const rows = Array.from({ length: 1800 }, (_, index) => ({
      id: `i${index}`,
      entry_key: `idiom:词${index}`,
      group_key: `idiom:词${index}`,
      kind: 'idiom',
      lemma: `词${index}`,
      difficulty: 'primary',
      question_type: 'recite',
      prompt: `提示${index}`,
      answer: `词${index}`
    }))
    const plan = planCourseDays(rows, 15)
    expect(plan.newPerDay).toBe(5)
    expect(plan.estimatedDays).toBe(360)
    expect(plan.estimatedDays).toBeLessThan(500)
    expect(plan.calendarDays).toBeLessThanOrEqual(PLAN_CALENDAR_DAYS)
    expect(plan.rawDayCount).toBe(360)
  })

  it('orders new idioms easy and in-text first', () => {
    const sorted = sortLearningEntries(clusterEntries([
      { id: '1', entry_key: 'idiom:培优', kind: 'idiom', lemma: '叱咤风云', difficulty: 'junior', tags: '成语', question_type: 'recite' },
      { id: '2', entry_key: 'idiom:基础课文', kind: 'idiom', lemma: '一丝不苟', difficulty: 'primary', tags: '成语;课文;课内必背', question_type: 'recite' },
      { id: '3', entry_key: 'idiom:拓展', kind: 'idiom', lemma: '一叶知秋', difficulty: 'xiaoshengchu', tags: '成语;日积月累', question_type: 'recite' }
    ]))
    expect(sorted.map(item => item.lemma)).toEqual(['一丝不苟', '一叶知秋', '叱咤风云'])
    expect(compareLearningEntries(sorted[0], sorted[1])).toBeLessThan(0)
  })

  it('warns only when the entry-based plan is far beyond a school year', () => {
    const rows = Array.from({ length: 1800 }, (_, index) => ({
      id: `i${index}`,
      entry_key: `idiom:词${index}`,
      kind: 'idiom',
      lemma: `词${index}`,
      difficulty: 'primary',
      question_type: 'recite'
    }))
    const ok = planCourseDays(rows, 15)
    expect(ok.warning).toBe('')
    const warning = courseSizeWarning({
      estimatedDays: PLAN_WARN_DAYS + 40,
      calendarDays: 90,
      dailyMinutes: 10,
      pointCount: 8000,
      entryCount: 1800,
      newPerDay: 3,
      truncated: true
    })
    expect(warning).toMatch(/约需|规模较大/)
    expect(warning).toMatch(/难度/)
  })

  it('labels idiom as 成语 for parents and meta', () => {
    expect(KIND_LABEL.idiom).toBe('成语')
    expect(weakKindRows({ idiom: { errors: 3, attempts: 4 } })[0].label).toBe('成语')
  })
})

describe('chinese mastery', () => {
  it('scores 0-100, rises with correct answers, and decays if idle', () => {
    let score = 0
    score = applyAttempt(score, { correct: true, quality: 5, isNew: true, placement: true })
    expect(score).toBeGreaterThanOrEqual(80)
    const later = computeMastery([{ correct: true, quality: 5, placement: true, day: '2026-01-01' }], '2026-01-01', '2026-03-01')
    expect(later).toBeLessThan(score)
    expect(decayMastery(80, 21)).toBeCloseTo(40, 0)
  })

  it('does not treat skipped calendar days as extra failures', () => {
    const afterBinge = computeMastery([
      { correct: true, quality: 4, day: '2026-01-01' },
      { correct: true, quality: 4, day: '2026-01-01' },
      { correct: true, quality: 4, day: '2026-01-01' }
    ], '2026-01-01', '2026-01-02')
    const afterGap = computeMastery([
      { correct: true, quality: 4, day: '2026-01-01' },
      { correct: true, quality: 4, day: '2026-01-01' },
      { correct: true, quality: 4, day: '2026-01-01' }
    ], '2026-01-01', '2026-01-04')
    expect(afterBinge).toBeGreaterThan(40)
    expect(afterGap).toBeLessThan(afterBinge)
    expect(afterGap).toBeGreaterThan(20)
  })

  it('still retests high-mastery entries after a long interval', () => {
    expect(retestIntervalDays(90)).toBeGreaterThanOrEqual(21)
    const rows = [{ id: '1', last: '2026-01-01', due: '2026-01-22', n: 4, interval: 21, entry_key: 'idiom:会' }]
    expect(entryIsDue(rows, '2026-01-02', 90)).toBe(false)
    expect(entryIsDue(rows, '2026-02-10', 90)).toBe(true)
  })
})

describe('chinese filter mode', () => {
  it('builds a short placement queue and keeps review-before-new in learn mode', () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      id: `n${index}`,
      entry_key: `idiom:${index}`,
      kind: 'idiom',
      lemma: `词${index}`,
      question_type: 'meaning_choice',
      prompt: '意思',
      answer: `词${index}`
    }))
    const filtered = planTodayGroups(rows, new Set(), '2026-01-01', 15, 0, 0, 'filter')
    expect(filtered.groups.length).toBeGreaterThan(0)
    expect(filtered.groups.length).toBeLessThanOrEqual(12)
    expect(filtered.groups.every(group => group.rows.length === 1)).toBe(true)
  })

  it('blocks reveal in filter mode and treats a pass as placement', () => {
    expect(reviewOutcome('filter', { quality: 5, correct: true }, true).ok).toBe(false)
    const pass = reviewOutcome('filter', { quality: 5, correct: true }, false)
    expect(pass.update_sm2).toBe(true)
    expect(pass.quality).toBe(5)
  })
})

describe('chinese progress copy', () => {
  it('uses remaining status', () => {
    expect(progressStatus(10, 3, 1)).toBe('remaining')
    expect(progressStatus(10, 0, 4)).toBe('done')
  })

  it('gives kid feedback for reveal', () => {
    const text = kidFeedback('learn', { quality: 3, correct: false, chars: [] }, true, true)
    expect(text.title).toBe('看过答案了')
  })
})
