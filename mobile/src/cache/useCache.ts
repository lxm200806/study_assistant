// Cache hook for React components
import { useEffect, useState, useCallback } from 'react'
import { getCachedData, setCachedData, deleteCachedData } from './index'

export function useCache<T>(key: string, ttl = 3600000) {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Load cached data on mount
  useEffect(() => {
    loadCachedData()
  }, [])

  const loadCachedData = useCallback(async () => {
    setIsLoading(true)
    try {
      const cached = await getCachedData<T>(key)
      if (cached) {
        setData(cached)
      }
    } catch (err) {
      console.error('Failed to load cached data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [key])

  const saveToCache = useCallback(async (newData: T) => {
    try {
      await setCachedData(key, newData, ttl)
      setData(newData)
    } catch (err) {
      console.error('Failed to save to cache:', err)
    }
  }, [key, ttl])

  const invalidateCache = useCallback(async () => {
    try {
      await deleteCachedData(key)
      setData(null)
    } catch (err) {
      console.error('Failed to invalidate cache:', err)
    }
  }, [key])

  return { data, isLoading, saveToCache, invalidateCache }
}

export default useCache

