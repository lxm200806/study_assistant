import { unwrapStorage } from '@/utils/storage'

export { unwrapStorage }

/** 跨端存储适配：H5、小程序、App 都走 uni 的同步存储 API。 */
export function getStored<T>(key: string): T | null {
  return unwrapStorage<T>(uni.getStorageSync(key))
}

export function setStored<T>(key: string, value: T): void {
  uni.setStorageSync(key, value)
}

export function removeStored(key: string): void {
  uni.removeStorageSync(key)
}
