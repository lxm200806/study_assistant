/** 跨书核对队列（纯逻辑，便于单测）。 */

export interface RecheckCheck {
  wordId: string
  passed: boolean
  failStreak: number
}

export interface RecheckMeta {
  total: number
  remaining: number
  passed: number
  failed: number
  complete: boolean
}

/** 连续答错的权重远高于掌握度分数，保证刚核对失败的词优先重测。 */
const FAIL_STREAK_WEIGHT = 1000

/**
 * 从「本书内该技能练过的词」里挑出尚未核对通过的词。
 * 核对失败次数越多越靠前，同级再按薄弱度分数排序。
 */
export function pickRecheckCandidates<T extends { wordId: string }>(
  practicedWords: T[],
  checks: RecheckCheck[],
  scoreOf: (wordId: string) => number,
  count: number
): { selected: T[]; meta: RecheckMeta } {
  const checkMap = new Map(checks.map(check => [check.wordId, check]))

  const passed = practicedWords.filter(word => checkMap.get(word.wordId)?.passed === true).length
  const failed = practicedWords.filter(word => {
    const check = checkMap.get(word.wordId)
    return check != null && !check.passed && check.failStreak > 0
  }).length

  const candidates = practicedWords
    .filter(word => checkMap.get(word.wordId)?.passed !== true)
    .map(word => ({
      word,
      score:
        (checkMap.get(word.wordId)?.failStreak ?? 0) * FAIL_STREAK_WEIGHT + scoreOf(word.wordId)
    }))
    .sort((a, b) => b.score - a.score)

  return {
    selected: candidates.slice(0, Math.max(0, count)).map(candidate => candidate.word),
    meta: {
      total: practicedWords.length,
      remaining: candidates.length,
      passed,
      failed,
      complete: candidates.length === 0
    }
  }
}
