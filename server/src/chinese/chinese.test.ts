import { describe, expect, it } from 'vitest'
import { gradeAnswer, gradeCard, gradeCharJudge, gradeChoice, normalize } from './grade'
import { addDays, isMastered, schedule } from './sm2'
import { applyTodayMode, normalizeMode, resolveDefaultMode, reviewOutcome } from './study-modes'
import { fillGroupFields, planTodayGroups, pointEnergy, validateCard } from './cards'
import { looksLikeMeaning, makeCharJudgeCard } from './entries'
import { kidFeedback, progressStatus } from './progress'

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
    expect(normalizeMode('测试')).toBe('test')
    expect(normalizeMode('learn')).toBe('learn')
  })

  it('defaults to test when review is first', () => {
    expect(resolveDefaultMode({ groups: [{ role: 'review' }], reviewEnergy: 16, newEnergy: 8 })).toBe('test')
    expect(resolveDefaultMode({ groups: [{ role: 'new' }], reviewEnergy: 0, newEnergy: 16 })).toBe('learn')
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
      { groups: [{ role: 'new', energy: 16, rows: [{}] }, { role: 'review', energy: 8, rows: [{}] }] },
      'recite'
    )
    expect(planned.energyCharged).toBe(false)
    expect(planned.newEnergy).toBe(0)
    expect(planned.reviewEnergy).toBe(0)
  })
})

describe('chinese cards', () => {
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
