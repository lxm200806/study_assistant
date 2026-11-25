import { z } from 'zod'
import { wordTypeSchema } from './schemas'

const anyObject = z.record(z.string(), z.any())

export const learnerSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  activeSubject: z.string().optional()
})

export const userSummarySchema = z
  .object({
    id: z.string(),
    username: z.string(),
    isAdmin: z.boolean().optional(),
    hasOnboarded: z.boolean().optional(),
    plan: z.string().optional(),
    activeSubject: z.string().optional(),
    accountType: z.string().optional(),
    displayName: z.string().optional(),
    activeLearnerId: z.string().nullable().optional(),
    activeRole: z.string().optional(),
    learner: learnerSummarySchema.nullable().optional(),
    children: z.array(learnerSummarySchema).optional()
  })
  .passthrough()

export const tokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userSummarySchema
})

export const refreshResponseSchema = z.object({
  accessToken: z.string()
})

export const setActiveStudentResponseSchema = z.object({
  success: z.literal(true),
  learner: learnerSummarySchema,
  user: userSummarySchema
})

export const bookWordSchema = z
  .object({
    id: z.string(),
    word: z.string(),
    meaning: z.string(),
    phonetic: z.string().optional(),
    englishMeaning: z.string().optional(),
    example: z.string().optional(),
    examples: z.array(z.string()).optional(),
    topic: z.string().optional(),
    tags: z.array(z.string()).optional()
  })
  .passthrough()

export const bookSessionDataSchema = z
  .object({
    words: z.array(bookWordSchema),
    progress: anyObject.optional(),
    mode: z.string(),
    sessionToken: z.string()
  })
  .passthrough()

export const bookSessionResponseSchema = z.object({
  success: z.literal(true),
  data: bookSessionDataSchema
})

export const bookMapDataSchema = z
  .object({
    book: anyObject.optional(),
    summary: anyObject.optional(),
    byContentType: z.array(anyObject).optional(),
    byTopic: z.array(anyObject).optional(),
    words: z.array(anyObject).optional(),
    weakestTopics: z.array(z.string()).optional()
  })
  .passthrough()

export const bookMapResponseSchema = z.object({
  success: z.literal(true),
  data: bookMapDataSchema
})

export const practiceDataSchema = z
  .object({
    wordId: z.string(),
    type: wordTypeSchema,
    practiceCount: z.number().optional(),
    correctCount: z.number().optional(),
    lastPractice: z.string().nullable().optional(),
    mastery: z.number(),
    due: z.string().nullable().optional(),
    stability: z.number().optional(),
    difficulty: z.number().optional(),
    reps: z.number().optional(),
    lapses: z.number().optional(),
    fsrsState: z.string().optional(),
    lastReview: z.string().nullable().optional(),
    retrievability: z.number().optional(),
    recentLapse: z.boolean().optional(),
    needsReconfirm: z.boolean().optional(),
    learningSteps: z.number().optional(),
    scheduledDays: z.number().optional(),
    status: z.string().optional(),
    weakReason: z.string().nullable().optional()
  })
  .passthrough()

export const practiceResponseSchema = z.object({
  success: z.literal(true),
  data: practiceDataSchema
})

export const completeSessionDataSchema = z.object({
  newlyCovered: z.number(),
  cycleReset: z.boolean(),
  dailyWordCount: z.number().nullable(),
  streak: z.number().nullable()
})

export const completeSessionResponseSchema = z.object({
  success: z.literal(true),
  data: completeSessionDataSchema,
  newlyCovered: z.number()
})

export const typingWordSchema = z
  .object({
    id: z.string(),
    word: z.string(),
    meaning: z.string(),
    phonetic: z.string().optional(),
    favorite: z.boolean().optional(),
    skipMastered: z.boolean().optional(),
    inWrongBook: z.boolean().optional(),
    due: z.string().nullable().optional(),
    practiced: z.boolean().optional(),
    recentLapse: z.boolean().optional()
  })
  .passthrough()

export const typingQueueDataSchema = z
  .object({
    source: z.string(),
    mode: z.string(),
    scopedToBook: z.boolean(),
    bookCode: z.string().nullable().optional(),
    words: z.array(typingWordSchema),
    missing: z.array(z.string()).optional(),
    rejected: z.array(anyObject).optional(),
    sessionToken: z.string().optional()
  })
  .passthrough()

export const typingQueueResponseSchema = z.object({
  success: z.literal(true),
  data: typingQueueDataSchema
})

export const typingAnswerDataSchema = z
  .object({
    review: anyObject,
    favorite: z.boolean(),
    skipMastered: z.boolean(),
    inWrongBook: z.boolean(),
    wrongSource: z.string().optional(),
    wrongStreak: z.number().optional()
  })
  .passthrough()

export const typingAnswerResponseSchema = z.object({
  success: z.literal(true),
  data: typingAnswerDataSchema
})

export const chineseTodayResponseSchema = z
  .object({
    today: z.string(),
    items: z.array(anyObject),
    due: z.number().optional(),
    fresh: z.number().optional(),
    tasks: z.number().optional(),
    cards: z.number().optional(),
    courseName: z.string().optional(),
    mode: z.string(),
    modes: z.array(anyObject).optional(),
    modeCounts: z.record(z.string(), z.number()).optional(),
    dailyMinutes: z.number().optional()
  })
  .passthrough()

export const chineseReviewResponseSchema = z
  .object({
    answer: z.string().optional(),
    lines: z.array(z.string()).optional(),
    correct: z.boolean().optional(),
    quality: z.number().optional(),
    state: anyObject.optional(),
    isNew: z.boolean().optional(),
    mode: z.string().optional(),
    updateSm2: z.boolean().optional(),
    revealed: z.boolean().optional()
  })
  .passthrough()

export const bookSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    description: z.string().nullable().optional(),
    level: z.string(),
    wordCount: z.number(),
    isFree: z.boolean(),
    createdAt: z.string().optional()
  })
  .passthrough()

export const bookListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(bookSummarySchema)
})

export const bookDetailDataSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    description: z.string().nullable().optional(),
    level: z.string(),
    wordCount: z.number(),
    words: z.array(bookWordSchema)
  })
  .passthrough()

export const bookDetailResponseSchema = z.object({
  success: z.literal(true),
  data: bookDetailDataSchema
})

export const reviewStatSchema = z
  .object({
    wordId: z.string(),
    type: wordTypeSchema.optional(),
    word: z.string().optional(),
    meaning: z.string().optional(),
    due: z.string().nullable().optional(),
    mastery: z.number().optional(),
    status: z.string().optional(),
    weakReason: z.string().nullable().optional()
  })
  .passthrough()

export const reviewResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(reviewStatSchema)
})

export const trainingHistoryItemSchema = z
  .object({
    id: z.string(),
    wordId: z.string(),
    type: wordTypeSchema,
    isCorrect: z.boolean(),
    createdAt: z.string(),
    word: anyObject.optional()
  })
  .passthrough()

export const historyResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(trainingHistoryItemSchema)
})

export const quizWordsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(bookWordSchema)
})

export const quizSubmitResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    bookCode: z.string(),
    total: z.number(),
    correct: z.number(),
    accuracy: z.number(),
    wrongCount: z.number()
  })
})

export const typingSummaryResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    bookCode: z.string(),
    mode: z.string(),
    bookWords: z.number(),
    due: z.number(),
    unseen: z.number(),
    skipped: z.number(),
    wrong: z.number(),
    favorite: z.number()
  })
})

export const typingListsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        count: z.number(),
        createdAt: z.string()
      })
      .passthrough()
  )
})

export const typingCreateListResponseSchema = z.object({
  success: z.literal(true),
  data: z
    .object({
      id: z.string(),
      name: z.string(),
      count: z.number(),
      linked: z.number(),
      created: z.number(),
      matched: z.number(),
      missing: z.array(z.string()),
      rejected: z.array(anyObject)
    })
    .passthrough()
})

export const typingDeleteListResponseSchema = z.object({
  success: z.literal(true)
})

export const chatSendDataSchema = z
  .object({
    userMessage: z.string(),
    aiResponse: z.string(),
    matchedWords: z.array(anyObject),
    remainingFree: z.number().optional(),
    usedFallback: z.boolean().optional()
  })
  .passthrough()

export const chatSendResponseSchema = z.object({
  success: z.literal(true),
  data: chatSendDataSchema
})

export const chatHistoryResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z
      .object({
        id: z.string(),
        role: z.string(),
        content: z.string(),
        mode: z.string().nullable().optional(),
        createdAt: z.string()
      })
      .passthrough()
  )
})

export const chatQuotaResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    remaining: z.number(),
    isPremium: z.boolean()
  })
})

export const profileResponseSchema = z.object({
  success: z.literal(true),
  data: userSummarySchema
})

export const studentsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(learnerSummarySchema)
})

export const studentMutationResponseSchema = z.object({
  success: z.literal(true),
  learner: learnerSummarySchema,
  user: userSummarySchema
})

export const userMutationResponseSchema = z.object({
  success: z.literal(true),
  user: userSummarySchema
})

export const vocabListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(bookWordSchema)
})

export const vocabDetailResponseSchema = z.object({
  success: z.literal(true),
  data: bookWordSchema
})

export const vocabStatsResponseSchema = z.object({
  success: z.literal(true),
  data: anyObject
})

export const globalMapResponseSchema = z.object({
  success: z.literal(true),
  data: anyObject
})

export const bookProgressResponseSchema = z.object({
  success: z.literal(true),
  data: anyObject
})

export const dueCountResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    dueCount: z.number(),
    overdueCount: z.number()
  })
})

export const bookRandomResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(bookWordSchema)
})

export const typingMarkResponseSchema = z.object({
  success: z.literal(true),
  data: z
    .object({
      wordId: z.string(),
      favorite: z.boolean(),
      skipMastered: z.boolean(),
      inWrongBook: z.boolean(),
      wrongSource: z.string().optional(),
      wrongStreak: z.number().optional()
    })
    .passthrough()
})

export const typingActivityResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ recorded: z.number() })
})

export const typingHistoryResponseSchema = z.object({
  success: z.literal(true),
  data: anyObject
})

export const typingSessionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    date: z.string(),
    charsPerMinute: z.number()
  })
})

export const typingArticlesResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(anyObject)
})

export const typingArticleResponseSchema = z.object({
  success: z.literal(true),
  data: anyObject
})

export const typingDueArticlesResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    total: z.number(),
    sentences: z.array(anyObject)
  })
})

export const typingArticleAnswerResponseSchema = z.object({
  success: z.literal(true),
  data: anyObject
})

export const typingDeleteResponseSchema = z.object({
  success: z.literal(true)
})

/** 语文接口直接返回业务对象，不包 success/data。 */
export const chineseObjectResponseSchema = anyObject
export const chineseArrayResponseSchema = z.array(anyObject)

export const adminResponseSchema = z.object({
  success: z.literal(true),
  data: anyObject
})

export const speechResponseSchema = z.object({
  success: z.literal(true),
  data: anyObject
})
