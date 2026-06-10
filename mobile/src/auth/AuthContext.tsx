// Auth Context for Study Assistant Mobile
import { createContext, useContext, useState, useCallback } from 'react'
import { getAccessToken, saveTokens, clearTokens } from '@/api/client'

interface AuthState {
  user: { id: string; username: string } | null
  booting: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  reloadProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; username: string } | null>(null)
  const [booting, setBooting] = useState(true)

  const reloadProfile = useCallback(async () => {
    // TODO: 调用 profile API
    const token = await getAccessToken()
    if (token) {
      setUser({ id: '1', username: '用户' })
    }
    setBooting(false)
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      booting,
      signIn: async (username, password) => {
        // TODO: 调用 login API
        await saveTokens('dummy-token', 'dummy-refresh')
        setUser({ id: '1', username })
        await reloadProfile()
      },
      signOut: async () => {
        await clearTokens()
        setUser(null)
      },
      reloadProfile
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

