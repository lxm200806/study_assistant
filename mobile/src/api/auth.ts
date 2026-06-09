import { request, authLogin, authRegister, authRefresh, authProfile as apiProfile, authOnboard as apiOnboard } from './client'

export interface AuthUser {
  id: string
  username: string
}

// Re-export convenience functions
export { authLogin, authRegister, authRefresh, apiProfile, apiOnboard }

// Legacy compatibility
export async function login(username: string, password: string) {
  return authLogin(username, password)
}

export async function register(username: string, password: string) {
  return authRegister(username, password)
}

export async function profile() {
  return apiProfile()
}

export async function onboard() {
  return apiOnboard()
}
