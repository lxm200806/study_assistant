// Membership API
import { request } from './client'

export async function getMembershipInfo() {
  return request('/membership/info', 'GET')
}

export interface WeeklyReport {
  totalWords: number
  activeDays: number
  streak: number
  accuracy: number
}
