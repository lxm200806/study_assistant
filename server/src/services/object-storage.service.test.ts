import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalObjectStorage, MemoryObjectStorage } from './object-storage.service'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true })
})

describe('object storage adapters', () => {
  it('stores and reads in memory', async () => {
    const storage = new MemoryObjectStorage()
    await storage.put('a/b.txt', Buffer.from('hello'))
    expect(await storage.has('a/b.txt')).toBe(true)
    expect((await storage.get('a/b.txt'))?.toString()).toBe('hello')
    await storage.delete('a/b.txt')
    expect(await storage.has('a/b.txt')).toBe(false)
  })

  it('stores and reads on local disk', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'study-storage-'))
    tempDirs.push(dir)
    const storage = new LocalObjectStorage(dir)
    await storage.put('tts/a.mp3', Buffer.from('audio'))
    expect((await storage.get('tts/a.mp3'))?.toString()).toBe('audio')
  })

  it('rejects path traversal keys', async () => {
    const storage = new MemoryObjectStorage()
    await expect(storage.put('../escape', Buffer.from('x'))).rejects.toThrow('INVALID_OBJECT_KEY')
  })
})
