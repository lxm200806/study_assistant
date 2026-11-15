/**
 * Ported from TypeWords TypingSentenceItem / TypingArticle space flow:
 * finish word → if nextSpace wait for Space → next word.
 * Typing a letter while waiting for space skips the space and continues.
 */
import { computed, reactive } from 'vue'
import { parseTypingTokens, TokenType, type TypingToken } from './parse-tokens'
import { playTypingBeep, playTypingCorrect, playTypingKeyboard } from './sounds'

export interface TokenTypingFlowOptions {
  getTarget: () => string
  ignoreCase?: boolean
  /** TypeWords default: true — skip symbols/numbers */
  ignoreSymbol?: boolean
  keySound?: boolean
  getKeySound?: () => boolean
  onComplete: (payload: { typed: string; correct: boolean }) => void
  onWrong?: () => void
}

export function useTokenTypingFlow(options: TokenTypingFlowOptions) {
  const state = reactive({
    wordIndex: 0,
    stringIndex: 0,
    input: '',
    wrong: '',
    isSpace: false,
    isEnd: false
  })

  const words = reactive<TypingToken[]>([])
  let busy = false

  const currentWord = computed(() => words[state.wordIndex] ?? null)

  function ignoreCase() {
    return options.ignoreCase !== false
  }

  function ignoreSymbol() {
    return options.ignoreSymbol !== false
  }

  function compareText(a: string, b: string) {
    return ignoreCase() ? a.toLowerCase() === b.toLowerCase() : a === b
  }

  function isSkippable(word?: TypingToken | null) {
    return !!word && ignoreSymbol() && (word.type === TokenType.Symbol || word.type === TokenType.Number)
  }

  function playKey() {
    const on =
      typeof options.getKeySound === 'function'
        ? options.getKeySound() !== false
        : options.keySound !== false
    if (on) playTypingKeyboard()
  }

  function fillPrevious(endIndex: number) {
    for (let i = 0; i < endIndex; i++) {
      const w = words[i]
      if (w) w.input = (w.input || '') + w.word.slice((w.input || '').length)
    }
  }

  function allCorrect() {
    return words.every(w => isSkippable(w) || compareText(w.input || '', w.word))
  }

  function typedText() {
    let text = ''
    words.forEach(w => {
      text += w.input || ''
      if (w.input && compareText(w.input, w.word) && w.nextSpace) text += ' '
    })
    return text.trimEnd()
  }

  function finish() {
    if (state.isEnd) return
    words.forEach(w => {
      w.input = (w.input || '') + w.word.slice((w.input || '').length)
    })
    state.isSpace = false
    state.input = ''
    if (words.length) state.stringIndex = words[words.length - 1].word.length
    state.wordIndex = words.length
    state.isEnd = true
    const correct = allCorrect()
    if (correct) playTypingCorrect()
    options.onComplete({ typed: typedText(), correct })
  }

  function next() {
    state.isSpace = false
    state.input = ''
    state.stringIndex = 0
    state.wrong = ''

    if (state.wordIndex + 1 < words.length) {
      state.wordIndex++
      fillPrevious(state.wordIndex)
      if (isSkippable(currentWord.value)) next()
    } else {
      finish()
    }
  }

  function reset() {
    const parsed = parseTypingTokens(options.getTarget() || '')
    words.splice(0, words.length, ...parsed)
    state.wordIndex = 0
    state.stringIndex = 0
    state.input = ''
    state.wrong = ''
    state.isSpace = false
    state.isEnd = false
    if (isSkippable(currentWord.value)) next()
  }

  function findPrevTypeable(from: number) {
    for (let i = from; i >= 0; i--) {
      if (!isSkippable(words[i])) return i
    }
    return -1
  }

  function del() {
    playKey()
    if (state.isEnd) return
    if (state.wrong) {
      state.wrong = ''
      return
    }
    if (state.isSpace) state.isSpace = false

    let word = currentWord.value
    if (!word) return

    if (state.stringIndex === 0) {
      const prev = findPrevTypeable(state.wordIndex - 1)
      if (prev < 0) return
      state.wordIndex = prev
      word = words[prev]
      if (word.nextSpace) {
        state.isSpace = true
        state.stringIndex = word.word.length
      } else {
        state.stringIndex = Math.max(word.word.length - 1, 0)
      }
    } else {
      state.stringIndex--
    }

    word.input = word.input.slice(0, state.stringIndex)
    state.input = word.input
  }

  function onTyping(e: KeyboardEvent) {
    if (!words.length || busy || state.isEnd) return
    if (e.code === 'Backspace') {
      del()
      e.preventDefault()
      return
    }
    if (e.key.length !== 1 && e.code !== 'Space') return

    busy = true
    try {
      const word = currentWord.value
      if (!word) {
        finish()
        return
      }

      state.wrong = ''

      if (state.isSpace) {
        if (e.code === 'Space') {
          next()
          playKey()
        } else {
          // TypeWords: skip required space and feed this key into next word
          next()
          busy = false
          onTyping(e)
          return
        }
      } else {
        const letter = e.code === 'Space' ? ' ' : e.key
        if (!letter || letter.length > 1) return

        const targetChar = word.word[state.stringIndex] ?? ''
        const isRight = compareText(letter, targetChar)

        if (!isRight) {
          if (word.type === TokenType.Word) options.onWrong?.()
          state.wrong = letter
          // Wrong = beep only (TypeWords word mode). Do not also play key click.
          playTypingBeep()
        } else {
          playKey()
        }

        // TypeWords：错字（含空格）也写入并前进，空格用红色 Space 占位
        state.input += letter
        word.input = state.input
        state.stringIndex++

        if (!word.word[state.stringIndex]) {
          state.input = ''
          if (word.nextSpace) state.isSpace = true
          else next()
        }
      }

      e.preventDefault()
    } finally {
      busy = false
    }
  }

  function isCurrent(w: number) {
    return w === state.wordIndex
  }

  function isWrote(w: number) {
    return state.wordIndex > w || (state.wordIndex === w && state.stringIndex >= (words[w]?.word.length ?? 0))
  }

  reset()

  return {
    state,
    words,
    currentWord,
    reset,
    onTyping,
    del,
    isCurrent,
    isWrote
  }
}