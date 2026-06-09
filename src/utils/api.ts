import { unwrapStorage } from './storage';
import { ENDPOINTS } from '../config/endpoints';
import { ERROR_CODES } from '../config/errors';

/** 获取本地存储的 Access Token */
export function getAuthToken(): string | null {
  const raw = uni.getStorageSync('accessToken');
  const token = unwrapStorage<string>(raw) ?? (typeof raw === 'string' ? raw : null);
  return token || null;
}

/** 根据运行环境返回 API 基础 URL */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return import.meta.env.DEV ? '/api' : 'http://localhost:3004/api';
}

/** 错误统一封装 */
export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    if (status) this.status = status;
  }
}

/** 通用响应结构 */
export interface ResponseData<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: { id: string; username: string };
}

/** 构造完整 URL（可附带查询参数） */
function buildUrl(path: string, params?: Record<string, string | number>) {
  const base = getApiBaseUrl();
  if (!params) return `${base}${path}`;
  const query = new URLSearchParams(params as any).toString();
  return `${base}${path}?${query}`;
}

/** 核心请求函数，统一处理 token、错误和超时 */
export async function request<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any,
  headers?: Record<string, string>
): Promise<ResponseData<T>> {
  const token = getAuthToken();

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };

  const options: UniApp.RequestOptions = {
    url,
    method,
    timeout: 120000,
    header: { ...defaultHeaders, ...headers },
    data: data ? JSON.stringify(data) : undefined
  };

  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      success: (res) => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(res.data as ResponseData<T>);
        } else {
          const body = res.data as ResponseData;
          const errMsg = body?.error || 'Request failed';
          if (res.statusCode === ERROR_CODES.UNAUTHORIZED) {
            reject(new ApiError(`Unauthorized: ${errMsg}`, res.statusCode));
          } else if (res.statusCode === ERROR_CODES.FORBIDDEN) {
            reject(new ApiError(`${ERROR_CODES.BOOK_LOCKED}: ${errMsg}`, res.statusCode));
          } else {
            reject(new ApiError(errMsg, res.statusCode));
          }
        }
      },
      fail: (err) => {
        reject(new ApiError(err.errMsg || 'Network error'));
      }
    });
  });
}

/** 以下是基于 ENDPOINTS 的快捷 API 调用，保持原有签名 */
export const authAPI = {
  login: (username: string, password: string) =>
    request(ENDPOINTS.auth.login, 'POST', { username, password }),
  register: (username: string, password: string) =>
    request(ENDPOINTS.auth.register, 'POST', { username, password }),
  refresh: (refreshToken: string) =>
    request(ENDPOINTS.auth.refresh, 'POST', { refreshToken }),
  profile: () => request(ENDPOINTS.auth.profile, 'GET'),
  onboard: () => request(ENDPOINTS.auth.onboard, 'POST'),
  wechatLogin: (code: string) => request(ENDPOINTS.auth.wechatLogin, 'POST', { code })
};

export const adminAPI = {
  missingSummary: () => request(ENDPOINTS.admin.missingSummary, 'GET'),
  missingWords: async (
    bookCode?: string,
    page: number = 1,
    limit: number = 50,
    issueType?: 'missing_cn' | 'parse_error'
  ) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (bookCode) params.set('bookCode', bookCode);
    if (issueType) params.set('issueType', issueType);
    return request(ENDPOINTS.admin.missingWords(params.toString()), 'GET');
  }
};

export const vocabularyAPI = {
  list: (page: number = 1, limit: number = 20) =>
    request(ENDPOINTS.vocabulary.list(page, limit), 'GET'),
  detail: (id: string) => request(ENDPOINTS.vocabulary.detail(id), 'GET'),
  random: (count: number = 10) => request(ENDPOINTS.vocabulary.random(count), 'GET'),
  stats: () => request(ENDPOINTS.vocabulary.stats, 'GET')
};

export const trainingAPI = {
  practice: (wordId: string, type: string, isCorrect: boolean) =>
    request(ENDPOINTS.training.practice, 'POST', { wordId, type, isCorrect }),
  review: async (type?: string, bookCode?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (bookCode) params.set('bookCode', bookCode);
    if (limit) params.set('limit', String(limit));
    return request(ENDPOINTS.training.review(params.toString()), 'GET');
  },
  completeSession: (bookCode: string, wordIds: string[]) =>
    request(ENDPOINTS.training.completeSession, 'POST', { bookCode, wordIds }),
  history: (page: number = 1, limit: number = 20) =>
    request(ENDPOINTS.training.history(page, limit), 'GET')
};

export const chatAPI = {
  send: (
    content: string,
    bookCode?: string,
    mode?: 'free' | 'challenge' | 'roleplay',
    scenario?: string
  ) =>
    request(ENDPOINTS.chat.send, 'POST', { content, bookCode, mode, scenario }),
  history: (page: number = 1, limit: number = 20) =>
    request(ENDPOINTS.chat.history(page, limit), 'GET'),
  quota: () => request(ENDPOINTS.chat.quota, 'GET')
};

export const speechAPI = {
  asrConfig: () => request(ENDPOINTS.speech.asrConfig, 'GET'),
  asrStartSession: (encoding: 'lame' | 'raw' = 'lame') =>
    request(ENDPOINTS.speech.asrStartSession, 'POST', { encoding }),
  asrPushChunk: (sessionId: string, audioBase64: string, isLast = false) =>
    request(ENDPOINTS.speech.asrPushChunk, 'POST', { sessionId, audioBase64, isLast }),
  asrEndSession: (sessionId: string) =>
    request(ENDPOINTS.speech.asrEndSession, 'POST', { sessionId }),
  transcribe: (audioBase64: string, mimeType = 'audio/mp3') =>
    request(ENDPOINTS.speech.transcribe, 'POST', { audioBase64, mimeType }),
  assess: (referenceText: string, audioBase64: string, mimeType = 'audio/mp3') =>
    request(ENDPOINTS.speech.assess, 'POST', { referenceText, audioBase64, mimeType })
};

export const bookAPI = {
  list: () => request(ENDPOINTS.book.list, 'GET'),
  detail: (code: string) => request(ENDPOINTS.book.detail(code), 'GET'),
  random: (code: string, count: number = 10) =>
    request(ENDPOINTS.book.random(code, count), 'GET'),
  session: async (
    code: string,
    count: number = 10,
    mode: string = 'coverage',
    type?: string,
    topic?: string
  ) => {
    const params = new URLSearchParams({ count: String(count), mode });
    if (type) params.set('type', type);
    if (topic) params.set('topic', topic);
    return request(ENDPOINTS.book.session(code, params.toString()), 'GET');
  },
  progress: (code: string) => request(ENDPOINTS.book.progress(code), 'GET'),
  dueCount: (code: string, type?: string) => {
    const typeQuery = type ? `?type=${type}` : '';
    return request(ENDPOINTS.book.dueCount(code, typeQuery), 'GET');
  }
};

export const statsAPI = {
  bookMap: (code: string, type?: string) => {
    const typeQuery = type ? `?type=${type}` : '';
    return request(ENDPOINTS.stats.bookMap(code, typeQuery), 'GET');
  },
  globalMap: () => request(ENDPOINTS.stats.globalMap, 'GET'),
  daily: () => request(ENDPOINTS.stats.daily, 'GET'),
  weeklyReport: () => request(ENDPOINTS.stats.weeklyReport, 'GET')
};

export const quizAPI = {
  words: (bookCode: string, count: number = 30) =>
    request(ENDPOINTS.quiz.words(bookCode, count), 'GET'),
  submit: (bookCode: string, items: { wordId: string; isCorrect: boolean }[]) =>
    request(ENDPOINTS.quiz.submit, 'POST', { bookCode, items })
};
