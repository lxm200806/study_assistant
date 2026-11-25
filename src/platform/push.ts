export interface PushProvider {
  readonly name: string
  isAvailable(): boolean
  /** 返回设备推送 token；未配置时返回 null。 */
  register(): Promise<string | null>
}

class NoopPushProvider implements PushProvider {
  readonly name = 'noop'

  isAvailable(): boolean {
    return false
  }

  async register(): Promise<string | null> {
    return null
  }
}

/**
 * 推送边界：App 侧接入 APNs/FCM/厂商推送时实现 PushProvider，
 * 业务代码只依赖 register()，不直接调用 plus.push。
 */
export function getPushProvider(): PushProvider {
  return new NoopPushProvider()
}
