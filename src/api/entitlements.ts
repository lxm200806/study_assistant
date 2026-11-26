import { request } from './client'

export interface EntitlementPermission {
  key: string
  kind: string
  unit: string | null
  limitValue: number | null
  period: string | null
  active: boolean
  expiresAt: string | null
  used: number
  remaining: number | null
  sources: string[]
}

export interface EntitlementSubscription {
  id: string
  planCode: string
  planName: string
  subject: string
  kind: string
  endsAt: string
  autoRenew: boolean
}

export interface EntitlementsSnapshot {
  accountId: string
  isAdmin: boolean
  permissions: Record<string, EntitlementPermission>
  subscriptions: EntitlementSubscription[]
  credits: { balance: number }
  legacyPlan: { plan: string; expiresAt: string | null }
}

export interface EntitlementsResponse {
  success: boolean
  data?: EntitlementsSnapshot
  error?: string
}

export const entitlementsAPI = {
  get: async () => request<EntitlementsSnapshot>('/entitlements', 'GET')
}
