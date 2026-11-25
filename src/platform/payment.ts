export interface PaymentOrder {
  id: string
  amount: number
  currency: 'CNY'
  subject: string
}

export interface PaymentResult {
  ok: boolean
  transactionId?: string
  error?: string
}

export interface PaymentProvider {
  readonly name: string
  isAvailable(): boolean
  pay(order: PaymentOrder): Promise<PaymentResult>
}

class UnavailablePaymentProvider implements PaymentProvider {
  readonly name = 'unavailable'

  isAvailable(): boolean {
    return false
  }

  async pay(): Promise<PaymentResult> {
    return { ok: false, error: '支付渠道尚未配置' }
  }
}

/**
 * 支付边界：后续按端接入微信/支付宝/Apple IAP 时实现 PaymentProvider，
 * 页面只依赖本接口，不直接调用 uni.requestPayment/StoreKit。
 */
export function getPaymentProvider(): PaymentProvider {
  return new UnavailablePaymentProvider()
}
