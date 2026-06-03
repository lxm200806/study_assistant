/**
 * 训练选择题：确保选项释义互不重复，避免多个“正确答案”
 */
export function buildUniqueOptions(
  correctMeaning: string,
  candidateMeanings: string[],
  count: number = 4
): string[] {
  const norm = (s: string) => s.trim().toLowerCase()
  const correct = correctMeaning.trim()
  const used = new Set<string>([norm(correct)])

  const wrong: string[] = []
  for (const m of candidateMeanings) {
    const t = m.trim()
    if (!t || norm(t) === norm(correct)) continue
    if (used.has(norm(t))) continue
    used.add(norm(t))
    wrong.push(t)
    if (wrong.length >= count - 1) break
  }

  // 干扰项不足时用占位（极少发生）
  while (wrong.length < count - 1) {
    const filler = `（干扰项${wrong.length + 1}）`
    if (!used.has(filler)) {
      wrong.push(filler)
      used.add(filler)
    } else break
  }

  return [correct, ...wrong].sort(() => Math.random() - 0.5)
}
