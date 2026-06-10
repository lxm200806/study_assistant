// User store for Study Assistant Mobile
import { useState, useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'

export interface User {
  id: string
  username: string
  isAdmin?: boolean
  plan?: string
  planExpiresAt?: string
}

const USER_KEY = 'study_assistant_user'

export function useUserStore() {
  const [user, setUser] = useState<User | null>(null)
  const [booting, setBooting] = useState(true)

  // Load user on mount
  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY)
      if (raw) {
        setUser(JSON.parse(raw))
      }
    } catch (err) {
      console.error('Failed to load user:', err)
    } finally {
      setBooting(false)
    }
  }

  const login = async (username: string, password: string) => {
    // TODO: 调用后端登录 API
    try {
      // Mock response for now
      const mockUser: User = { id: '1', username, isAdmin: false }
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(mockUser))
      setUser(mockUser)
    } catch (err) {
      console.error('Login failed:', err)
      throw err
    }
  }

  const register = async (username: string, password: string) => {
    // TODO: 调用后端注册 API
    try {
      const mockUser: User = { id: '1', username, isAdmin: false }
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(mockUser))
      setUser(mockUser)
    } catch (err) {
      console.error('Register failed:', err)
      throw err
    }
  }

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync(USER_KEY)
      setUser(null)
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  const checkLogin = async (): Promise<boolean> => {
    if (user) return true
    await loadUser()
    return !!user
  }

  const setOnboarded = async (value: boolean) => {
    // TODO: 更新用户 onboarded 状态
  }

  return {
    user,
    booting,
    login,
    register,
    logout,
    checkLogin,
    setOnboarded,
    isLoggedIn: !!user,
    username: user?.username || ''
  }
}

// Expose store singleton for compatibility
export const USER_STORE = useUserStore()

