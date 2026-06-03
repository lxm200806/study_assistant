export function calculateMastery(practiceCount: number, correctCount: number, lastPractice?: Date): number {
  if (practiceCount === 0) return 0
  
  const accuracy = correctCount / practiceCount
  
  let recencyFactor = 1
  if (lastPractice) {
    const daysSincePractice = (Date.now() - lastPractice.getTime()) / (1000 * 60 * 60 * 24)
    recencyFactor = Math.max(0, 1 - daysSincePractice / 7)
  }
  
  const mastery = Math.round((accuracy * 0.7 + recencyFactor * 0.3) * 5)
  return Math.min(5, Math.max(0, mastery))
}