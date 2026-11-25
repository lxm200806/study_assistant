export interface SmartQueueCandidate {
  id: string
  order: number
  score: number
  isNew: boolean
  due: boolean
  weak: boolean
  recentWrong: boolean
  lapses: number
}

export interface SmartQueueOptions {
  count: number
  dailyNewRemaining: number
  newRatio?: number
  recentWrongRatio?: number
  leechCap?: number
  leechLapses?: number
}

export const SMART_NEW_RATIO = 0.3
export const SMART_RECENT_WRONG_RATIO = 0.2
export const SMART_LEECH_LAPSES = 3
export const SMART_LEECH_CAP = 3

/** FNV-1a，给同一天同一用户同一词一个稳定的微小扰动。 */
export function stableUnit(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 0x100000000
}

/**
 * 智能组卷配比：
 * - 新词不超过 30%，并受当天剩余新词额度限制；
 * - 最近错词不超过 20%；
 * - 到期/薄弱词优先填满其余名额（≥50%）；
 * - leech（累计遗忘 ≥3 次）每场最多 3 个，避免一场全是硬骨头。
 */
export function pickSmartQueue(candidates: SmartQueueCandidate[], options: SmartQueueOptions): string[] {
  const count = Math.max(0, Math.floor(options.count))
  if (count === 0) return []

  const newRatio = options.newRatio ?? SMART_NEW_RATIO
  const wrongRatio = options.recentWrongRatio ?? SMART_RECENT_WRONG_RATIO
  const leechCap = options.leechCap ?? SMART_LEECH_CAP
  const leechLapses = options.leechLapses ?? SMART_LEECH_LAPSES
  const dailyNewRemaining = Math.max(0, Math.floor(options.dailyNewRemaining))

  const rawNewQuota = count < 5 ? Math.min(1, count) : Math.floor(count * newRatio)
  const newQuota = Math.min(rawNewQuota, dailyNewRemaining)
  const wrongQuota = count < 5 ? 0 : Math.floor(count * wrongRatio)
  const weakTarget = Math.max(0, count - newQuota)

  const sorted = [...candidates].sort((a, b) => b.score - a.score || a.order - b.order)
  const selected: SmartQueueCandidate[] = []
  const used = new Set<string>()
  let leeches = 0
  let newTaken = 0

  const take = (candidate: SmartQueueCandidate): boolean => {
    if (used.has(candidate.id)) return false
    const isLeech = candidate.lapses >= leechLapses
    if (isLeech && leeches >= leechCap) return false
    used.add(candidate.id)
    selected.push(candidate)
    if (candidate.isNew) newTaken += 1
    if (isLeech) leeches += 1
    return true
  }

  for (const candidate of sorted) {
    if (selected.length >= wrongQuota) break
    if (!candidate.recentWrong) continue
    take(candidate)
  }

  for (const candidate of sorted) {
    if (selected.length >= weakTarget) break
    if (candidate.recentWrong) continue
    if (!candidate.due && !candidate.weak) continue
    take(candidate)
  }

  // 新词先只用本场的 30% 额度，非新词池不够时再在每天额度内补。
  const newLimit = Math.min(count, selected.length + newQuota)
  for (const candidate of sorted) {
    if (selected.length >= newLimit) break
    if (!candidate.isNew) continue
    take(candidate)
  }

  for (const candidate of sorted) {
    if (selected.length >= count) break
    if (candidate.isNew) continue
    take(candidate)
  }

  // 非新词池不够时才动用剩余新词额度，仍然尊重当天上限。
  if (selected.length < count && newTaken < dailyNewRemaining) {
    for (const candidate of sorted) {
      if (selected.length >= count || newTaken >= dailyNewRemaining) break
      if (!candidate.isNew) continue
      take(candidate)
    }
  }

  return selected.map(candidate => candidate.id)
}
