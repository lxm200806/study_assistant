import { request, requestDirect } from './client'
import type {
  CredentialsBody,
  RefreshBody,
  RefreshResponse,
  SetActiveStudentBody,
  SetActiveStudentResponse,
  TokenResponse
} from '@/types/api-contract'

export const authAPI = {
  login: async (username: string, password: string, code?: string) => {
    const body: CredentialsBody = { username, password, ...(code ? { code } : {}) }
    return requestDirect<TokenResponse>('/auth/login', 'POST', body)
  },
  register: async (username: string, password: string) => {
    const body: CredentialsBody = { username, password }
    return requestDirect<TokenResponse>('/auth/register', 'POST', body)
  },
  refresh: async (refreshToken: string) => {
    const body: RefreshBody = { refreshToken }
    return requestDirect<RefreshResponse>('/auth/refresh', 'POST', body)
  },
  profile: async () => {
    return request('/auth/profile', 'GET')
  },
  logout: async () => {
    return request('/auth/logout', 'POST')
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    return request('/auth/password', 'POST', { currentPassword, newPassword })
  },
  logoutAll: async () => {
    return request('/auth/logout-all', 'POST')
  },
  sessions: async () => {
    return request('/auth/sessions', 'GET')
  },
  exportData: async () => {
    return request('/auth/account/export', 'GET')
  },
  deleteAccount: async (password: string) => {
    return request('/auth/account/delete', 'POST', { password })
  },
  twoFactorStatus: async () => {
    return request('/auth/2fa/status', 'GET')
  },
  twoFactorSetup: async () => {
    return request('/auth/2fa/setup', 'POST')
  },
  twoFactorEnable: async (code: string) => {
    return request('/auth/2fa/enable', 'POST', { code })
  },
  twoFactorDisable: async (password: string) => {
    return request('/auth/2fa/disable', 'POST', { password })
  },
  onboard: async (subject?: string) => {
    const body: Record<string, string> = {}
    if (subject) body.subject = subject
    return request('/auth/onboard', 'POST', body)
  },
  setSubject: async (subject: string) => {
    return request('/auth/subject', 'PUT', { subject })
  },
  setRole: async (role: 'parent' | 'student', studentId?: string) => {
    return request('/auth/role', 'PUT', { role, studentId })
  },
  students: async () => {
    return request('/auth/students', 'GET')
  },
  createStudent: async (name: string) => {
    return request('/auth/students', 'POST', { name })
  },
  setActiveStudent: async (studentId: string) => {
    const body: SetActiveStudentBody = { studentId }
    return requestDirect<SetActiveStudentResponse>('/auth/students/active', 'PUT', body)
  },
  renameStudent: async (id: string, name: string) => {
    return request(`/auth/students/${id}`, 'PUT', { name })
  },
  archiveStudent: async (id: string) => {
    return request(`/auth/students/${id}`, 'DELETE')
  },
  wechatLogin: async (code: string) => {
    return request('/auth/wechat', 'POST', { code })
  }
}

export const adminAPI = {
  missingSummary: async () => {
    return request('/admin/vocabulary/missing/summary', 'GET')
  },
  missingWords: async (
    bookCode?: string,
    page: number = 1,
    limit: number = 50,
    issueType?: 'missing_cn' | 'parse_error'
  ) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (bookCode) params.set('bookCode', bookCode)
    if (issueType) params.set('issueType', issueType)
    return request(`/admin/vocabulary/missing?${params.toString()}`, 'GET')
  }
}
