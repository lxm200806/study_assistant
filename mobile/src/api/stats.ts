// Stats API
import { request } from './client'

export interface MasterySummary {
  total: number
  mastered: number
  learning: number
  unfamiliar: number
}

export async function loadDailyStats() {
  return request('/stats/daily', 'GET')
}

export async function getGlobalMap() {
  return request('/stats/global/map', 'GET')
}