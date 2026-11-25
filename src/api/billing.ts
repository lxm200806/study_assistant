import { request } from './client'

export interface BillingPlan {
  code: string
  name: string
  days: number
  priceCents: number
}

export interface PaymentOrder {
  id: string
  planCode: string
  amountCents: number
  status: string
  provider: string
  createdAt: string
  paidAt?: string | null
}

export const billingAPI = {
  plans: async () => request<BillingPlan[]>('/billing/plans', 'GET'),
  orders: async () => request<PaymentOrder[]>('/billing/orders', 'GET'),
  createOrder: async (planCode: string) =>
    request<PaymentOrder>('/billing/orders', 'POST', { planCode }),
  payOrder: async (id: string) =>
    request<PaymentOrder>(`/billing/orders/${id}/pay`, 'POST', { provider: 'mock' })
}
