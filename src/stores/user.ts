import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authAPI, getAuthToken } from '@/utils/api'
import { unwrapStorage } from '@/utils/storage'

interface StoredUser {
  id: string
  username: string
  isAdmin: boolean
  hasOnboarded?: boolean
  plan?: string
}

export const useUserStore = defineStore('user', () => {
  const isLoggedIn = ref(false)
  const username = ref('')
  const userId = ref('')
  const isAdmin = ref(false)
  const hasOnboarded = ref(true)
  const plan = ref('free')

  const persistUser = (user: StoredUser) => {
    username.value = user.username
    userId.value = user.id
    isAdmin.value = user.isAdmin
    hasOnboarded.value = user.hasOnboarded ?? true
    plan.value = user.plan ?? 'free'
    uni.setStorageSync('user', user)
  }

  const setOnboarded = (value: boolean) => {
    hasOnboarded.value = value
    const user = uni.getStorageSync('user') as StoredUser | undefined
    if (user) {
      persistUser({ ...user, hasOnboarded: value })
    }
  }

  const navigateAfterAuth = () => {
    setTimeout(() => {
      if (isAdmin.value) {
        uni.reLaunch({ url: '/pages/admin/admin' })
      } else if (!hasOnboarded.value) {
        uni.reLaunch({ url: '/pages/onboarding/onboarding' })
      } else {
        uni.switchTab({ url: '/pages/home/home' })
      }
    }, 800)
  }

  const login = async (user: string, password: string) => {
    try {
      const result = await authAPI.login(user, password)

      if (result.accessToken) {
        uni.setStorageSync('accessToken', result.accessToken)
        uni.setStorageSync('refreshToken', result.refreshToken!)

        if (result.user) {
          persistUser({
            id: result.user.id,
            username: result.user.username,
            isAdmin: !!(result.user as StoredUser).isAdmin,
            hasOnboarded: (result.user as StoredUser).hasOnboarded,
            plan: (result.user as StoredUser).plan
          })
        }

        isLoggedIn.value = true
        uni.showToast({ title: '登录成功', icon: 'success' })
        navigateAfterAuth()
      }
    } catch (error: any) {
      uni.showToast({ title: error.message || '登录失败', icon: 'none' })
    }
  }

  const wechatLogin = async (code: string) => {
    try {
      const result = await authAPI.wechatLogin(code)
      if (result.accessToken) {
        uni.setStorageSync('accessToken', result.accessToken)
        uni.setStorageSync('refreshToken', result.refreshToken!)
        if (result.user) {
          persistUser(result.user as StoredUser)
        }
        isLoggedIn.value = true
        uni.showToast({ title: '微信登录成功', icon: 'success' })
        navigateAfterAuth()
      }
    } catch (error: any) {
      uni.showToast({ title: error.message || '微信登录失败', icon: 'none' })
    }
  }

  const register = async (user: string, password: string) => {
    try {
      const result = await authAPI.register(user, password)

      if (result.accessToken) {
        uni.setStorageSync('accessToken', result.accessToken)
        uni.setStorageSync('refreshToken', result.refreshToken!)

        if (result.user) {
          persistUser({
            id: result.user.id,
            username: result.user.username,
            isAdmin: false,
            hasOnboarded: false,
            plan: 'free'
          })
        }

        isLoggedIn.value = true
        uni.showToast({ title: '注册成功', icon: 'success' })
        navigateAfterAuth()
      }
    } catch (error: any) {
      uni.showToast({ title: error.message || '注册失败', icon: 'none' })
    }
  }

  const logout = () => {
    isLoggedIn.value = false
    username.value = ''
    userId.value = ''
    isAdmin.value = false
    hasOnboarded.value = true
    plan.value = 'free'
    uni.removeStorageSync('accessToken')
    uni.removeStorageSync('refreshToken')
    uni.removeStorageSync('user')
    uni.removeStorageSync('vocabularyStats')
    uni.removeStorageSync('trainingRecords')
    uni.showToast({ title: '已退出登录', icon: 'none' })
    uni.reLaunch({ url: '/pages/login/login' })
  }

  const checkLogin = async () => {
    const token = getAuthToken()
    const user = unwrapStorage<StoredUser>(uni.getStorageSync('user'))
      ?? (uni.getStorageSync('user') as StoredUser | undefined)

    if (token) {
      if (user) {
        username.value = user.username
        userId.value = user.id
        isAdmin.value = !!user.isAdmin
        hasOnboarded.value = user.hasOnboarded ?? true
        plan.value = user.plan ?? 'free'
      } else {
        try {
          const result = await authAPI.profile()
          const profile = result.data as StoredUser
          if (profile) persistUser(profile)
        } catch {
          // ignore profile fetch errors
        }
      }
      isLoggedIn.value = true
      return true
    }
    return false
  }

  return {
    isLoggedIn,
    username,
    userId,
    isAdmin,
    hasOnboarded,
    plan,
    login,
    wechatLogin,
    register,
    logout,
    checkLogin,
    setOnboarded
  }
})
