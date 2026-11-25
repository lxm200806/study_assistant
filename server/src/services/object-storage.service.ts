import fs from 'node:fs/promises'
import path from 'node:path'

export interface ObjectStorage {
  put(key: string, data: Buffer, contentType?: string): Promise<void>
  get(key: string): Promise<Buffer | null>
  has(key: string): Promise<boolean>
  delete(key: string): Promise<void>
}

function safeKey(key: string): string {
  if (key.split(/[\\/]/).some(part => part === '..')) {
    throw new Error('INVALID_OBJECT_KEY')
  }
  const normalized = path.posix.normalize(`/${key}`).replace(/^\/+/, '')
  if (!normalized || normalized.startsWith('..')) {
    throw new Error('INVALID_OBJECT_KEY')
  }
  return normalized
}

export class MemoryObjectStorage implements ObjectStorage {
  private readonly items = new Map<string, Buffer>()

  async put(key: string, data: Buffer): Promise<void> {
    this.items.set(safeKey(key), Buffer.from(data))
  }

  async get(key: string): Promise<Buffer | null> {
    return this.items.get(safeKey(key)) || null
  }

  async has(key: string): Promise<boolean> {
    return this.items.has(safeKey(key))
  }

  async delete(key: string): Promise<void> {
    this.items.delete(safeKey(key))
  }
}

/** 本地磁盘适配器；生产可替换为 S3/OSS 实现而不改调用方。 */
export class LocalObjectStorage implements ObjectStorage {
  constructor(
    private readonly root = process.env.OBJECT_STORAGE_DIR ||
      path.join(process.cwd(), 'data', 'object-store')
  ) {}

  private fullPath(key: string): string {
    return path.join(this.root, safeKey(key))
  }

  async put(key: string, data: Buffer): Promise<void> {
    const file = this.fullPath(key)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, data)
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.fullPath(key))
    } catch {
      return null
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      await fs.access(this.fullPath(key))
      return true
    } catch {
      return false
    }
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.fullPath(key), { force: true })
  }
}

export function createObjectStorage(): ObjectStorage {
  if (process.env.OBJECT_STORAGE_DRIVER === 'memory') return new MemoryObjectStorage()
  return new LocalObjectStorage()
}

export const objectStorage = createObjectStorage()
