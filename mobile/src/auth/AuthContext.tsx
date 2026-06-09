import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearTokens, saveTokens } from '@/api/client'
import * as authApi from '@/api/auth'

interface AuthState {
  user: authApi.AuthUser | null
  booting: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  reloadProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<authApi.AuthUser | null>(null)
  const [booting, setBooting] = useState(true)

  const reloadProfile = useCallback(async () => {
    const result = await authApi.profile()
    setUser(result.data || result.user || null)
  }, [])

  useEffect(() => {
    reloadProfile()
      .catch(() => setUser(null))
      .finally(() => setBooting(false))
  }, [reloadProfile])

  const signIn = useCallback(async (username: string, password: string) => {
    const result = await authApi.login(username, password)
    await saveTokens(result.accessToken, result.refreshToken)
    if (result.user) setUser(result.user)
    else await reloadProfile()
  }, [reloadProfile])

  const signOut = useCallback(async () => {
    await clearTokens()
    setUser(null)
  }, [])

  const value = useMemo<AuthState>(() => ({
    user,
    booting,
    signIn,
    signOut,
    reloadProfile
  }), [booting, reloadProfile, signIn, signOut, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
