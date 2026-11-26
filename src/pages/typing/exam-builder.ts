import { loadEnabledWordModes } from '@/utils/typing'
import type { ExamCard, ExamMode, WordMode } from './typing.types'

export const LEARN_MODE_ORDER: WordMode[] = ['follow', 'self']
export const EXAM_MODE_ORDER: ExamMode[] = ['recall', 'dictation']

export function loadExamModes(): ExamMode[] {
  const saved = loadEnabledWordModes()
  const selected = EXAM_MODE_ORDER.filter(
    (mode): mode is ExamMode => saved.includes(mode)
  )
  return selected.length ? selected : [...EXAM_MODE_ORDER]
}

export function shuffleInPlace<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/**
 * 检测题卡：默写相对易、听写更难。
 * 两种都开时，先整组默写（词序打乱），再整组听写（词序再打乱）；
 * 只开一种则只出该种并打乱词序。
 */
export function buildExamQueue(wordCount: number, modes: ExamMode[]): ExamCard[] {
  const ordered = EXAM_MODE_ORDER.filter(mode => modes.includes(mode))
  const cards: ExamCard[] = []
  for (const mode of ordered) {
    const block: ExamCard[] = []
    for (let wordIndex = 0; wordIndex < wordCount; wordIndex++) {
      block.push({ wordIndex, mode })
    }
    shuffleInPlace(block)
    cards.push(...block)
  }
  return cards
}
