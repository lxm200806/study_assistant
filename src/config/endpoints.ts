export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    profile: '/auth/profile',
    onboard: '/auth/onboard',
    wechatLogin: '/auth/wechat'
  },
  admin: {
    missingSummary: '/admin/vocabulary/missing/summary',
    missingWords: (params) => `/admin/vocabulary/missing?${params}`
  },
  vocabulary: {
    list: (page, limit) => `/vocabulary?page=${page}&limit=${limit}`,
    detail: (id) => `/vocabulary/${id}`,
    random: (count) => `/vocabulary/random?count=${count}`,
    stats: '/vocabulary/stats'
  },
  training: {
    practice: '/training/practice',
    review: (params) => `/training/review${params}`,
    completeSession: '/training/session/complete',
    history: (page, limit) => `/training/history?page=${page}&limit=${limit}`
  },
  chat: {
    send: '/chat/send',
    history: (page, limit) => `/chat/history?page=${page}&limit=${limit}`,
    quota: '/chat/quota'
  },
  speech: {
    asrConfig: '/speech/asr/config',
    asrStartSession: '/speech/asr/session/start',
    asrPushChunk: '/speech/asr/session/chunk',
    asrEndSession: '/speech/asr/session/end',
    transcribe: '/speech/transcribe',
    assess: '/speech/assess'
  },
  book: {
    list: '/books',
    detail: (code) => `/books/${code}`,
    random: (code, count) => `/books/${code}/random?count=${count}`,
    session: (code, params) => `/books/${code}/session?${params}`,
    progress: (code) => `/books/${code}/progress`,
    dueCount: (code, typeQuery) => `/books/${code}/due-count${typeQuery}`
  },
  stats: {
    bookMap: (code, typeQuery) => `/stats/book/${code}/map${typeQuery}`,
    globalMap: '/stats/global/map',
    daily: '/stats/daily',
    weeklyReport: '/stats/weekly-report'
  },
  quiz: {
    words: (bookCode, count) => `/training/quiz/words?bookCode=${bookCode}&count=${count}`,
    submit: '/training/quiz/submit'
  }
} as const;
