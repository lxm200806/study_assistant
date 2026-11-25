import { request } from './client'

export const pushAPI = {
  register: async (token: string, platform = 'app', provider = 'unknown') =>
    request<{ id: string }>('/push/register', 'POST', { token, platform, provider }),
  remove: async (token: string) => request('/push/register', 'DELETE', { token })
}
