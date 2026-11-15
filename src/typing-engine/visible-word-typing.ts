/** Ported from TypeWords `visible-word-typing.ts` — character compare helpers. */

export interface PracticeInputCharacterState {
  character: string
  isCorrect: boolean
}

export interface PracticeKeyboardInput {
  key: string
  code: string
  shiftKey: boolean
}

const SHIFT_FULL_WIDTH_CHARACTER_CODE_MAP: Record<string, string[]> = {
  '！': ['Digit1'],
  '￥': ['Digit4'],
  '…': ['Digit6'],
  '（': ['Digit9'],
  '—': ['Minus'],
  '？': ['Slash'],
  '》': ['Period'],
  '《': ['Comma'],
  '“': ['Quote'],
  '”': ['Quote'],
  '：': ['Semicolon'],
  '）': ['Digit0']
}

const FULL_WIDTH_CHARACTER_CODE_MAP: Record<string, string[]> = {
  '、': ['Slash'],
  '。': ['Period'],
  '，': ['Comma'],
  '‘': ['Quote'],
  '’': ['Quote'],
  '；': ['Semicolon'],
  '【': ['BracketLeft'],
  '】': ['BracketRight']
}

/** café → cafe — learners can type plain ASCII for accented letters. */
export function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '')
}

export function normalizePracticeInputCharacter(event: PracticeKeyboardInput, targetCharacter = ''): string {
  const characterCodeMap = event.shiftKey ? SHIFT_FULL_WIDTH_CHARACTER_CODE_MAP : FULL_WIDTH_CHARACTER_CODE_MAP
  if (characterCodeMap[targetCharacter]?.includes(event.code)) {
    return targetCharacter
  }
  const key = event.key
  // Target is é / à / … and learner typed e / a → keep the book spelling on screen
  if (
    targetCharacter
    && key.length === 1
    && key !== targetCharacter
    && stripDiacritics(key).toLowerCase() === stripDiacritics(targetCharacter).toLowerCase()
  ) {
    return targetCharacter
  }
  return key
}

export function isPracticeCharacterCorrect(input: string, target: string | undefined, ignoreCase: boolean): boolean {
  if (target === undefined) return false
  if (!ignoreCase) return input === target
  // 'base' so e matches é (KET words like café); still case-insensitive
  return input.localeCompare(target, undefined, { sensitivity: 'base', usage: 'search' }) === 0
}

export function getPracticeInputCharacterStates(
  input: string,
  target: string,
  ignoreCase: boolean
): PracticeInputCharacterState[] {
  return [...input].map((character, index) => ({
    character,
    isCorrect: isPracticeCharacterCorrect(character, target[index], ignoreCase)
  }))
}

export function getFirstWrongCharacterIndex(input: string, target: string, ignoreCase: boolean): number {
  return getPracticeInputCharacterStates(input, target, ignoreCase).findIndex(item => !item.isCorrect)
}

export function isWholePracticeInputComplete(input: string, target: string): boolean {
  return input.length === target.length
}

export function isWholePracticeInputCorrect(input: string, target: string, ignoreCase: boolean): boolean {
  return isWholePracticeInputComplete(input, target) && getFirstWrongCharacterIndex(input, target, ignoreCase) === -1
}