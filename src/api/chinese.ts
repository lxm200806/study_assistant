import { request, requestDirect } from './client'
import type {
  ChineseReviewBody,
  ChineseReviewResponse,
  ChineseTodayResponse
} from '@/types/api-contract'

export const chineseAPI = {
  meta: () => request('/chinese/meta', 'GET'),
  library: (query = '') => request(`/chinese/library${query ? `?${query}` : ''}`, 'GET'),
  coverage: () => request('/chinese/library/coverage', 'GET'),
  courses: () => request('/chinese/courses', 'GET'),
  previewCourse: (body: Record<string, unknown>) => request('/chinese/courses/preview', 'POST', body),
  createCourse: (body: Record<string, unknown>) => request('/chinese/courses', 'POST', body),
  patchCourse: (id: string, body: Record<string, unknown>) => request(`/chinese/courses/${id}`, 'PUT', body),
  deleteCourse: (id: string) => request(`/chinese/courses/${id}`, 'DELETE'),
  syncCourse: (id: string) => request(`/chinese/courses/${id}/sync`, 'POST'),
  today: (id: string, mode?: string, options?: { extraMinutes?: number; reciteOffset?: number }) => {
    const params = new URLSearchParams()
    if (mode) params.set('mode', mode)
    if (options?.extraMinutes) params.set('extraMinutes', String(options.extraMinutes))
    if (options?.reciteOffset) params.set('reciteOffset', String(options.reciteOffset))
    const query = params.toString()
    return requestDirect<ChineseTodayResponse>(
      `/chinese/courses/${id}/today${query ? `?${query}` : ''}`,
      'GET'
    )
  },
  plan: (id: string) => request(`/chinese/courses/${id}/plan`, 'GET'),
  review: (id: string, body: ChineseReviewBody) =>
    requestDirect<ChineseReviewResponse>(`/chinese/courses/${id}/review`, 'POST', body),
  stats: (id: string) => request(`/chinese/courses/${id}/stats`, 'GET'),
  resources: () => request('/chinese/resources', 'GET'),
  resource: (id: string) => request(`/chinese/resources/${id}`, 'GET'),
  syncResource: (id: string) => request(`/chinese/resources/${id}/sync`, 'POST'),
  syncIncremental: () => request('/chinese/resources/sync-incremental', 'POST'),
  syncAll: () => request('/chinese/resources/sync-all', 'POST'),
  seed: () => request('/chinese/resources/seed', 'POST'),
  drafts: (query = '') => request(`/chinese/drafts${query ? `?${query}` : ''}`, 'GET'),
  importDrafts: (body: Record<string, unknown>) => request('/chinese/drafts/import', 'POST', body),
  patchDraft: (id: string, body: Record<string, unknown>) => request(`/chinese/drafts/${id}`, 'PUT', body),
  publishDraft: (id: string) => request(`/chinese/drafts/${id}/publish`, 'POST'),
  publishDrafts: (ids: string[]) => request('/chinese/drafts/publish-batch', 'POST', { ids }),
  patchPoint: (id: string, body: Record<string, unknown>) => request(`/chinese/library/${id}`, 'PUT', body)
}
