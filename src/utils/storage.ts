export function unwrapStorage<T>(raw: unknown): T | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object' && raw !== null && 'data' in raw) {
    const wrapped = raw as { type?: string; data?: T }
    if (wrapped.type === 'object' && wrapped.data != null) {
      return wrapped.data
    }
  }
  return raw as T
}
