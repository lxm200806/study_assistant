import Redis from 'ioredis'

interface MemoryEntry {
  value: string
  expiresAt: number
}

const REDIS_URL = process.env.REDIS_URL?.trim()
const memory = new Map<string, MemoryEntry>()

const client = REDIS_URL
  ? new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1_000,
      retryStrategy: () => null
    })
  : null

client?.on('error', error => {
  console.error('[kv] redis error, falling back to memory:', error.message)
})

export const redisEnabled = Boolean(client)

async function readyClient(): Promise<Redis | null> {
  if (!client) return null
  try {
    if (client.status === 'wait') await client.connect()
    return client.status === 'ready' ? client : null
  } catch {
    return null
  }
}

function pruneMemory(now: number) {
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key)
  }
}

/** 固定窗口计数；Redis 不可用时退回进程内 Map。 */
export async function kvIncrWindow(
  key: string,
  windowMs: number
): Promise<{ count: number; resetAt: number }> {
  const now = Date.now()
  const redis = await readyClient()
  if (redis) {
    try {
      const count = await redis.incr(key)
      if (count === 1) await redis.pexpire(key, windowMs)
      const ttl = await redis.pttl(key)
      return { count, resetAt: now + Math.max(ttl, 0) }
    } catch {
      // fall through to memory
    }
  }

  pruneMemory(now)
  const existing = memory.get(key)
  if (!existing || existing.expiresAt <= now) {
    const resetAt = now + windowMs
    memory.set(key, { value: '1', expiresAt: resetAt })
    return { count: 1, resetAt }
  }
  const count = Number(existing.value) + 1
  memory.set(key, { value: String(count), expiresAt: existing.expiresAt })
  return { count, resetAt: existing.expiresAt }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const redis = await readyClient()
  if (redis) {
    try {
      const value = await redis.get(key)
      return value ? (JSON.parse(value) as T) : null
    } catch {
      // fall through
    }
  }
  const entry = memory.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key)
    return null
  }
  try {
    return JSON.parse(entry.value) as T
  } catch {
    return entry.value as T
  }
}

export async function kvSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  const payload = JSON.stringify(value)
  const expiresAt = Date.now() + ttlMs
  const redis = await readyClient()
  if (redis) {
    try {
      await redis.set(key, payload, 'PX', ttlMs)
      return
    } catch {
      // fall through
    }
  }
  memory.set(key, { value: payload, expiresAt })
}

export async function kvDelete(key: string): Promise<void> {
  const redis = await readyClient()
  if (redis) {
    try {
      await redis.del(key)
    } catch {
      // ignore
    }
  }
  memory.delete(key)
}

/** 测试/运维使用。 */
export function resetKvMemory(): void {
  memory.clear()
}
