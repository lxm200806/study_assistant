import { ENERGY_PER_MINUTE, KIND_LABEL } from './constants'

export const STATUS_EMPTY = 'empty'
export const STATUS_DONE = 'done'
export const STATUS_IDLE = 'idle'
export const STATUS_REMAINING = 'remaining'

export function trailingStreak(logs: Array<{ correct?: boolean }> | null | undefined): number {
  let streak = 0
  const rows = [...(logs || [])].reverse()
  for (const row of rows) {
    if (!row.correct) break
    streak += 1
  }
  return streak
}

export function accuracyPercent(attempts: number, correct: number): number | null {
  if (attempts <= 0) return null
  return Math.round((100 * correct) / attempts)
}

export function weakKindRows(counts: Record<string, { errors?: number; attempts?: number }> | null | undefined, limit = 3) {
  const rows = Object.entries(counts || {})
    .map(([kind, stats]) => ({
      kind,
      label: KIND_LABEL[kind as keyof typeof KIND_LABEL] || kind,
      errors: Number(stats.errors || 0),
      attempts: Number(stats.attempts || 0)
    }))
    .filter(item => item.errors > 0)
    .sort((a, b) => b.errors - a.errors || a.label.localeCompare(b.label, 'zh'))
  return rows.slice(0, limit)
}

export function remainingEnergyText(newEnergy: number, reviewEnergy: number): string {
  const energy = Math.max(0, Number(newEnergy || 0) + Number(reviewEnergy || 0))
  return energy ? `约 ${Math.max(1, Math.ceil(energy / ENERGY_PER_MINUTE))} 分钟` : ''
}

export function progressStatus(itemCount: number, remainingCards: number, practiced: number): string {
  if (Number(itemCount || 0) <= 0) return STATUS_EMPTY
  if (Number(remainingCards || 0) > 0) return STATUS_REMAINING
  if (Number(practiced || 0) > 0) return STATUS_DONE
  return STATUS_IDLE
}

export function studentCopy(status: string, newEnergy: number, reviewEnergy: number): [string, string] {
  const remaining = remainingEnergyText(newEnergy, reviewEnergy)
  if (status === STATUS_EMPTY) return ['这门课还没有知识点', '请先同步新词，或去组课生成一份。']
  if (status === STATUS_DONE) return ['今天练完了', '新学和复习都完成了，明天再来。真好。']
  if (status === STATUS_IDLE) {
    return ['今天没有要练的', '没有到期复习，也没有排进今日的新学卡。明天再来，或打开学习计划看看后面几天。']
  }
  if (remaining) return [`还需${remaining}`, '完成这些就达到今天的学习时长。先复习，再学新内容。']
  return ['还差几条', '继续写，写完就收工。']
}

export function parentCopy(
  status: string,
  practiced: number,
  accuracy: number | null,
  weakKinds: Array<{ label: string }>,
  newEnergy: number,
  reviewEnergy: number,
  mastered?: number | null,
  total?: number | null
): string {
  const remaining = remainingEnergyText(newEnergy, reviewEnergy)
  const weakText = (weakKinds || []).slice(0, 3).map(item => item.label).join('、')
  let sentence = ''
  if (status === STATUS_EMPTY) return '这门课还没有知识点，组课或同步后再看掌握情况。'
  if (practiced <= 0 && status === STATUS_IDLE) {
    sentence = '今天还没开始练，也没有到期复习或新学任务。'
  } else if (practiced <= 0) {
    sentence = '今天还没开始练。'
    if (remaining) sentence += `还需${remaining}。`
  } else if (status === STATUS_DONE) {
    sentence = `今天练完了。共练 ${practiced} 条`
    if (accuracy != null) sentence += `，正确率 ${accuracy}%`
    sentence += '。'
  } else {
    sentence = `今天已练 ${practiced} 条`
    if (accuracy != null) sentence += `，正确率 ${accuracy}%`
    sentence += remaining ? `。还需${remaining}。` : '。'
  }
  if (weakText && practiced) sentence += `相对容易错的是${weakText}。`
  if (total) sentence += `课内已掌握 ${Number(mastered || 0)} / ${Number(total)} 条。`
  return sentence
}

export function kidFeedback(mode: string, gradeResult: { chars?: Array<{ char?: string; ok?: boolean }>; correct?: boolean; quality?: number }, revealed = false, updateSm2 = true) {
  const chars = [...(gradeResult?.chars || [])]
  const wrong: string[] = []
  const seen = new Set<string>()
  for (const item of chars) {
    if (item.ok) continue
    const ch = String(item.char || '')
    if (!ch || seen.has(ch)) continue
    seen.add(ch)
    wrong.push(ch)
  }
  const correct = Boolean(gradeResult?.correct)
  const quality = Number(gradeResult?.quality || 1)
  const willRetry = Boolean(updateSm2) && quality < 3 && !revealed

  if (mode === 'recite') {
    if (correct) {
      return { title: '读得对', hint: '背诵只练读和听，不改下次出现的日子。', next: '继续下一题。', wrongChars: [] as string[] }
    }
    return { title: '再读一读', hint: '对照原文读顺就好，不必着急手写。', next: '继续下一题。', wrongChars: wrong }
  }
  if (mode === 'filter') {
    if (correct) {
      return { title: '先记成会', hint: '这个词条会从新学里拿掉，以后仍会偶尔抽查，不会永远不练。', next: '继续筛选下一题。', wrongChars: [] as string[] }
    }
    return { title: '放进新学', hint: '先当不会，后面按计划学。', next: '继续筛选下一题。', wrongChars: wrong }
  }
  if (revealed) {
    return {
      title: '看过答案了',
      hint: '先记住标准答案。这次记成「模糊」，比写错轻，下次还会再见面。',
      next: '下一题接着练。',
      wrongChars: [] as string[]
    }
  }
  if (correct) return { title: '全对！', hint: '写得很稳。', next: '下一题接着练。', wrongChars: [] as string[] }
  if (quality === 3) {
    return {
      title: '差不多对了',
      hint: wrong.length ? `大体对了，这几个字再记一下：${wrong.join('、')}。` : '大体对了，标红的字再看一眼。',
      next: '下一题接着练。',
      wrongChars: wrong
    }
  }
  return {
    title: '这题先记下',
    hint: wrong.length ? `不一样的字：${wrong.join('、')}。看清楚再写。` : '对照标准答案，把不一样的地方再写一遍。',
    next: willRetry ? '这题等会儿还会再练一次。' : '下一题接着练。',
    wrongChars: wrong
  }
}

export function summarizeLogs(logs: Array<{ point_id?: unknown; pointId?: unknown; quality?: number; correct?: boolean; kind?: string }> | null | undefined) {
  const rows = [...(logs || [])]
  const attempts = rows.length
  const correct = rows.filter(row => row.correct).length
  const practicedIds = new Set(rows.map(row => row.point_id ?? row.pointId).filter(id => id != null))
  const doneIds = new Set(
    rows.filter(row => Number(row.quality || 0) >= 3).map(row => row.point_id ?? row.pointId).filter(id => id != null)
  )
  const kindCounts: Record<string, { attempts: number; errors: number }> = {}
  for (const row of rows) {
    const kind = row.kind || ''
    if (!kind) continue
    const stats = kindCounts[kind] || (kindCounts[kind] = { attempts: 0, errors: 0 })
    stats.attempts += 1
    if (!row.correct) stats.errors += 1
  }
  return {
    todayAttempts: attempts,
    todayCorrect: correct,
    todayPracticed: practicedIds.size,
    todayDoneCount: doneIds.size,
    todayStreak: trailingStreak(rows),
    todayAccuracy: accuracyPercent(attempts, correct),
    weakKinds: weakKindRows(kindCounts)
  }
}

export function buildProgress(
  planned: { cards?: number; tasks?: number; newEnergy?: number; reviewEnergy?: number; newBudget?: number; reviewBudget?: number; dailyMinutes?: number; targetMinutes?: number; spentMinutes?: number; remainingMinutes?: number } | null | undefined,
  logs: Array<{ point_id?: unknown; pointId?: unknown; quality?: number; correct?: boolean; kind?: string }> | null | undefined,
  itemCount = 0,
  mastered?: number | null,
  total?: number | null
) {
  const logStats = summarizeLogs(logs)
  const remainingCards = Number(planned?.cards || 0)
  const remainingTasks = Number(planned?.tasks || 0)
  const newEnergy = Number(planned?.newEnergy || 0)
  const reviewEnergy = Number(planned?.reviewEnergy || 0)
  const newBudget = Number(planned?.newBudget || 30)
  const reviewBudget = Number(planned?.reviewBudget || 30)
  const status = progressStatus(itemCount, remainingCards, logStats.todayPracticed)
  const [title, hint] = studentCopy(status, newEnergy, reviewEnergy)
  const summary = parentCopy(
    status,
    logStats.todayPracticed,
    logStats.todayAccuracy,
    logStats.weakKinds,
    newEnergy,
    reviewEnergy,
    mastered,
    total
  )
  const energyFilled = remainingCards <= 0 && Number(itemCount || 0) > 0
  return {
    status,
    title,
    hint,
    summary,
    ...logStats,
    remainingNewEnergy: newEnergy,
    remainingReviewEnergy: reviewEnergy,
    remainingCards,
    remainingTasks,
    dailyMinutes: Number(planned?.dailyMinutes || 0),
    targetMinutes: Number(planned?.targetMinutes || planned?.dailyMinutes || 0),
    spentMinutes: Number(planned?.spentMinutes || 0),
    remainingMinutes: Number(planned?.remainingMinutes || 0),
    newBudget,
    reviewBudget,
    todayDone: status === STATUS_DONE || (energyFilled && logStats.todayPracticed > 0),
    energyFilled
  }
}

export function masteryCounts(
  items: Array<{ kind?: string; study_count?: number; review_count?: number; error_count?: number; mastered?: boolean; last?: unknown }> | null | undefined
) {
  const rows = [...(items || [])]
  let mastered = 0
  let learning = 0
  let unseen = 0
  const kindCounts: Record<string, { attempts: number; errors: number }> = {}
  for (const item of rows) {
    const kind = item.kind || ''
    if (kind) {
      const stats = kindCounts[kind] || (kindCounts[kind] = { attempts: 0, errors: 0 })
      stats.attempts += Number(item.study_count || 0) + Number(item.review_count || 0)
      stats.errors += Number(item.error_count || 0)
    }
    if (item.mastered) mastered += 1
    else if (item.last) learning += 1
    else unseen += 1
  }
  return {
    total: rows.length,
    mastered,
    learning,
    unseen,
    weakKinds: weakKindRows(kindCounts)
  }
}
