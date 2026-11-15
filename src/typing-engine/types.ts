/** Subset of TypeWords WordPracticeType used by the keyboard engine. */
export enum WordPracticeType {
  FollowWrite = 'FollowWrite',
  Spell = 'Spell',
  Dictation = 'Dictation',
  Identify = 'Identify',
  Listen = 'Listen'
}

export enum WordPlayTrigger {
  NewWord = 'NewWord',
  ResetSameWord = 'ResetSameWord',
  Typo = 'Typo',
  RepeatWord = 'RepeatWord',
  DictationReveal = 'DictationReveal',
  Manual = 'Manual'
}