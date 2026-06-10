// Cache utilities for offline support
import * as FileSystem from 'expo-file-system'

export interface CachedData<T = any> {
  data: T
  timestamp: number
  expiresAt: number
}

export const CACHE_DIR = ${FileSystem.cacheDirectory}study_assistant/

// Ensure cache directory exists
export async function ensureCacheDir(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })
    }
  } catch (err) {
    console.error('Failed to create cache directory:', err)
  }
}

// Get cached data
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    await ensureCacheDir()
    const filePath = ${CACHE_DIR}.json
    const fileInfo = await FileSystem.getInfoAsync(filePath)
    
    if (!fileInfo.exists) return null
    
    const content = await FileSystem.readAsStringAsync(filePath)
    const cached: CachedData<T> = JSON.parse(content)
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      await FileSystem.deleteAsync(filePath)
      return null
    }
    
    return cached.data
  } catch (err) {
    console.error('Failed to get cached data:', err)
    return null
  }
}

// Set cached data
export async function setCachedData<T>(key: string, data: T, ttl = 3600000): Promise<void> { // Default TTL: 1 hour
  try {
    await ensureCacheDir()
    const filePath = ${CACHE_DIR}.json
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    }
    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(cached))
  } catch (err) {
    console.error('Failed to set cached data:', err)
  }
}

// Delete cached data
export async function deleteCachedData(key: string): Promise<void> {
  try {
    const filePath = ${CACHE_DIR}.json
    await FileSystem.deleteAsync(filePath)
  } catch (err) {
    console.error('Failed to delete cached data:', err)
  }
}

// Clear all cache
export async function clearCache(): Promise<void> {
  try {
    await ensureCacheDir()
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR)
    if (!dirInfo.exists) return
    
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR)
    for (const file of files) {
      await FileSystem.deleteAsync(${CACHE_DIR})
    }
  } catch (err) {
    console.error('Failed to clear cache:', err)
  }
}

// Cache keys
export const CACHE_KEYS = {
  VOCABULARY_LIST: 'vocabulary_list',
  BOOKS_LIST: 'books_list',
  USER_STATS: 'user_stats',
  DAILY_STATS: 'daily_stats',
  CHAT_HISTORY: 'chat_history',
  TTS_AUDIO: (word: string) => 	ts_
}

