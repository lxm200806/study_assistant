function getApiBaseUrl(): string {
  // 开发模式走 Vite 同源代理（使用完整 origin，避免 H5 相对路径异常）
  if (import.meta.env.DEV) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/api`
    }
    return '/api'
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:3004/api`
  }

  return 'http://localhost:3004/api'
}

export interface ResponseData<T = any> {
  success?: boolean
  data?: T
  error?: string
  accessToken?: string
  refreshToken?: string
  user?: {
    id: string
    username: string
  }
}

export async function request<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any,
  headers?: Record<string, string>
): Promise<ResponseData<T>> {
  const token = uni.getStorageSync('accessToken')

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  }

  const options: UniApp.RequestOptions = {
    url: getApiBaseUrl() + url,
    method,
    timeout: 120000,
    header: { ...defaultHeaders, ...headers },
    data: data ? JSON.stringify(data) : undefined
  }

  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      success: (res) => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(res.data as ResponseData<T>)
        } else {
          reject(new Error((res.data as ResponseData).error || 'Request failed'))
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || 'Network error'))
      }
    })
  })
}

export const authAPI = {
  login: async (username: string, password: string) => {
    return request('/auth/login', 'POST', { username, password })
  },
  register: async (username: string, password: string) => {
    return request('/auth/register', 'POST', { username, password })
  },
  refresh: async (refreshToken: string) => {
    return request('/auth/refresh', 'POST', { refreshToken })
  },
  profile: async () => {
    return request('/auth/profile', 'GET')
  }
}

export const vocabularyAPI = {
  list: async (page: number = 1, limit: number = 20) => {
    return request(`/vocabulary?page=${page}&limit=${limit}`, 'GET')
  },
  detail: async (id: string) => {
    return request(`/vocabulary/${id}`, 'GET')
  },
  random: async (count: number = 10) => {
    return request(`/vocabulary/random?count=${count}`, 'GET')
  },
  stats: async () => {
    return request('/vocabulary/stats', 'GET')
  }
}

export const trainingAPI = {
  practice: async (wordId: string, type: string, isCorrect: boolean) => {
    return request('/training/practice', 'POST', { wordId, type, isCorrect })
  },
  review: async () => {
    return request('/training/review', 'GET')
  },
  completeSession: async (bookCode: string, wordIds: string[]) => {
    return request('/training/session/complete', 'POST', { bookCode, wordIds })
  },
  history: async (page: number = 1, limit: number = 20) => {
    return request(`/training/history?page=${page}&limit=${limit}`, 'GET')
  }
}

export const chatAPI = {
  send: async (content: string) => {
    return request('/chat/send', 'POST', { content })
  },
  history: async (page: number = 1, limit: number = 20) => {
    return request(`/chat/history?page=${page}&limit=${limit}`, 'GET')
  }
}

export const bookAPI = {
  list: async () => {
    return request('/books', 'GET')
  },
  detail: async (code: string) => {
    return request(`/books/${code}`, 'GET')
  },
  random: async (code: string, count: number = 10) => {
    return request(`/books/${code}/random?count=${count}`, 'GET')
  },
  session: async (code: string, count: number = 10, mode: string = 'coverage', type?: string) => {
    const typeQuery = type ? `&type=${type}` : ''
    return request(`/books/${code}/session?count=${count}&mode=${mode}${typeQuery}`, 'GET')
  },
  progress: async (code: string) => {
    return request(`/books/${code}/progress`, 'GET')
  }
}

export const statsAPI = {
  bookMap: async (code: string, type?: string) => {
    const typeQuery = type ? `?type=${type}` : ''
    return request(`/stats/book/${code}/map${typeQuery}`, 'GET')
  },
  globalMap: async () => {
    return request('/stats/global/map', 'GET')
  }
}
