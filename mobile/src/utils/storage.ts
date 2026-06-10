// Storage utilities (React Native compatible)
import * as SecureStore from 'expo-secure-store'
import * as AsyncStorage from '@react-native-async-storage/async-storage'

export interface StorageItem<T = any> {
  key: string
  value?: T
}

// Secure Store (for sensitive data like tokens)
export async function getSecureItem<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function setSecureItem<T>(key: string, value: T): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value))
  } catch (err) {
    console.error('Failed to save secure item:', err)
  }
}

export async function removeSecureItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key)
  } catch (err) {
    console.error('Failed to remove secure item:', err)
  }
}

// Async Storage (for non-sensitive data)
export async function getStorageItem<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.error('Failed to save storage item:', err)
  }
}

export async function removeStorageItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key)
  } catch (err) {
    console.error('Failed to remove storage item:', err)
  }
}

