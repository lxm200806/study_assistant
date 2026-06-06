import { getBookByCode, getRandomWordsFromBook } from './book.service'
import { getBookProgress } from './coverage.service'
import { getBookMap } from './graph.service'
import { getReviewWords } from './training.service'
import { findScenario } from './chat-scenarios'

export interface ChallengeWordEntry {
  word: string
  meaning: string
  example?: string
}

export interface LearnerChatContext {
  bookCode?: string
  bookLevel?: string
  coverageRate: number
  practicedCount: number
  wordCount: number
  weakTopics: string[]
  dueWordCount: number
  backgroundWords: string[]
  challengeWordEntries: ChallengeWordEntry[]
  levelHint: 'beginner' | 'developing' | 'intermediate'
}

const EMPTY_CONTEXT: LearnerChatContext = {
  coverageRate: 0,
  practicedCount: 0,
  wordCount: 0,
  weakTopics: [],
  dueWordCount: 0,
  backgroundWords: [],
  challengeWordEntries: [],
  levelHint: 'beginner'
}

export async function getLearnerChatContext(
  userId: string,
  bookCode?: string
): Promise<LearnerChatContext> {
  if (!bookCode) return { ...EMPTY_CONTEXT }

  const book = await getBookByCode(bookCode)
  if (!book) return { ...EMPTY_CONTEXT, bookCode }

  const progress = await getBookProgress(userId, bookCode)

  let weakTopics: string[] = []
  try {
    const map = await getBookMap(userId, bookCode)
    weakTopics = (map.weakestTopics || []).slice(0, 3)
  } catch {
    // ignore map errors
  }

  // Build a word detail lookup from the book's vocabulary join
  const wordDetailMap = new Map<string, { meaning: string; example?: string }>()
  for (const bv of book.vocabulary) {
    wordDetailMap.set(bv.word.word, {
      meaning: bv.word.meaning,
      example: bv.word.exampleSentence ?? undefined
    })
  }

  const dueWords = await getReviewWords(userId, { bookCode, limit: 8 })
  const dueWordList = dueWords
    .map(w => w.word?.word)
    .filter((w): w is string => !!w)

  const sourceWords =
    dueWordList.length >= 3
      ? dueWordList.slice(0, 6)
      : (await getRandomWordsFromBook(bookCode, 6)).map(w => w.word)

  const backgroundWords = sourceWords

  const challengeWordEntries: ChallengeWordEntry[] = sourceWords
    .slice(0, 3)
    .map(w => {
      const detail = wordDetailMap.get(w)
      return {
        word: w,
        meaning: detail?.meaning ?? '',
        example: detail?.example
      }
    })
    .filter(e => e.meaning)

  const rate = progress.coverageRate
  const levelHint =
    rate < 20 ? 'beginner' : rate < 55 ? 'developing' : 'intermediate'

  return {
    bookCode,
    bookLevel: book.level,
    coverageRate: progress.coverageRate,
    practicedCount: progress.practicedCount,
    wordCount: progress.wordCount,
    weakTopics,
    dueWordCount: dueWordList.length,
    backgroundWords,
    challengeWordEntries,
    levelHint
  }
}

// ---------------------------------------------------------------------------
// Level-calibration helper
// ---------------------------------------------------------------------------
function levelDescription(levelHint: LearnerChatContext['levelHint']): string {
  if (levelHint === 'beginner') {
    return 'Their English is basic (A1–A2). Use short, simple sentences and everyday vocabulary.'
  }
  if (levelHint === 'developing') {
    return 'Their English is developing (A2–B1). Natural conversation pace is fine; avoid rare idioms.'
  }
  return 'Their English is fairly good (B1+). You can use richer expressions, still keep it conversational.'
}

// ---------------------------------------------------------------------------
// FREE MODE
// ---------------------------------------------------------------------------
function buildFreePrompt(ctx: LearnerChatContext): string {
  return [
    "You are Alex, a 25-year-old British guy who loves football, cooking, travel, and binge-watching shows.",
    "You've just made a Chinese friend who is learning English, and you're chatting with them in English.",
    '',
    '[Your chat style]',
    '- Casual and natural, like texting a friend — 1 to 2 sentences is plenty.',
    '- Genuinely curious about what they say; ask a follow-up question when it feels natural.',
    "- If they make a grammar slip, weave the correct form into your reply naturally (e.g. \"Oh nice, so you went to...\") without calling it out.",
    `- ${levelDescription(ctx.levelHint)}`,
    '',
    '[One rule only]',
    "Don't assign vocabulary tasks — no \"let's practice this word\", no \"can you make a sentence with...\". That's for study mode, not chatting.",
    '',
    '[Examples]',
    'User: "I like eat apple."',
    '✅ "Nice! Apples are great — do you prefer red ones or green ones?"',
    '❌ "Great! By the way, let\'s practice the word \'prefer\'. Can you make a sentence?"',
    '',
    'User: "I went to Beijing last week."',
    '✅ "Oh cool, what did you get up to there?"',
    '❌ "Interesting! Let\'s try a KET word: visit. Can you say a sentence with visit?"'
  ].join('\n')
}

// ---------------------------------------------------------------------------
// CHALLENGE MODE
// ---------------------------------------------------------------------------
function buildChallengePrompt(ctx: LearnerChatContext): string {
  const entries = ctx.challengeWordEntries
  const wordList =
    entries.length > 0
      ? entries
          .map(
            (e, i) =>
              `${i + 1}. ${e.word} — ${e.meaning}${e.example ? `;  e.g. "${e.example}"` : ''}`
          )
          .join('\n')
      : '(Pick 1–3 suitable words from the learner\'s vocabulary book.)'

  return [
    'You are Alex, an encouraging English vocabulary coach.',
    'This is [Word Challenge] mode — the goal is to help the learner actively use target words.',
    '',
    '[Target words for this session — work through them in order]',
    wordList,
    '',
    '[Turn structure — follow this every round]',
    'Step 1  Introduce the current word naturally in a sentence of your own, then invite the learner to try one.',
    "Step 2  Wait for the learner's attempt.",
    'Step 3  If correct: give specific praise + move to the next word.',
    '        If incorrect or unclear: give ONE helpful hint (not the answer). Let them try again.',
    '',
    '[Style]',
    '- Upbeat and game-like. Keep each reply to 2–3 sentences max.',
    '- Use English throughout; add a short Chinese gloss in parentheses only when introducing a new word.',
    `- ${levelDescription(ctx.levelHint)}`
  ].join('\n')
}

// ---------------------------------------------------------------------------
// ROLEPLAY MODE
// ---------------------------------------------------------------------------
function buildRoleplayPrompt(ctx: LearnerChatContext, scenario?: string): string {
  const found = scenario ? findScenario(scenario) : null
  const alexRole = found?.alexRole ?? scenario ?? 'a friendly English speaker'
  const userRole = found?.userRole ?? 'the other person in the scene'
  const sceneLabel = found?.label ?? scenario ?? 'everyday conversation'

  // Pick 2 background words to embed naturally (no examples list shown to user)
  const embedWords =
    ctx.backgroundWords.length > 0
      ? `Vocabulary you may weave in naturally (do NOT announce them as targets): ${ctx.backgroundWords.slice(0, 4).join(', ')}.`
      : ''

  return [
    `You are Alex. Current scene: [${sceneLabel}]`,
    `Your role: ${alexRole}`,
    `User's role: ${userRole}`,
    '',
    '[Rules]',
    '- Stay fully in character throughout. Never break the scene to teach grammar.',
    "- If the user makes an English error, echo back the correct phrasing naturally as your character (e.g. \"Oh, you'd like an Americano? Sure!\") — don't point it out.",
    '- Keep replies concise (2–3 sentences). Add a short Chinese hint in parentheses when genuinely needed.',
    "- Do NOT assign 'make a sentence with...' tasks — the scene itself is the practice.",
    embedWords,
    `- ${levelDescription(ctx.levelHint)}`
  ]
    .filter(Boolean)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export function buildSystemPrompt(
  mode: 'free' | 'challenge' | 'roleplay',
  ctx: LearnerChatContext,
  scenario?: string
): string {
  if (mode === 'free') return buildFreePrompt(ctx)
  if (mode === 'challenge') return buildChallengePrompt(ctx)
  return buildRoleplayPrompt(ctx, scenario)
}
