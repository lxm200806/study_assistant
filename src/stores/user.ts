import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authAPI } from '@/utils/api'

interface StoredUser {
  id: string
  username: string
  isAdmin: boolean
}

export const useUserStore = defineStore('user', () => {
  const isLoggedIn = ref(false)
  const username = ref('')
  const userId = ref('')
  const isAdmin = ref(false)

  const persistUser = (user: StoredUser) => {
    username.value = user.username
    userId.value = user.id
    isAdmin.value = user.isAdmin
    uni.setStorageSync('user', user)
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
            isAdmin: !!result.user.isAdmin
          })
        }

        isLoggedIn.value = true

        uni.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => {
          if (isAdmin.value) {
            uni.reLaunch({ url: '/pages/admin/admin' })
          } else {
            uni.switchTab({ url: '/pages/home/home' })
          }
        }, 800)
      }
    } catch (error: any) {
      uni.showToast({ title: error.message || '登录失败', icon: 'none' })
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
            isAdmin: !!result.user.isAdmin
          })
        }

        isLoggedIn.value = true

        uni.showToast({ title: '注册成功', icon: 'success' })
        setTimeout(() => {
          uni.switchTab({ url: '/pages/home/home' })
        }, 1000)
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
    uni.removeStorageSync('accessToken')
    uni.removeStorageSync('refreshToken')
    uni.removeStorageSync('user')
    uni.removeStorageSync('vocabularyStats')
    uni.removeStorageSync('trainingRecords')
    uni.showToast({ title: '已退出登录', icon: 'none' })
    uni.reLaunch({ url: '/pages/login/login' })
  }

  const checkLogin = async () => {
    const token = uni.getStorageSync('accessToken')
    const user = uni.getStorageSync('user') as StoredUser | undefined

    if (token) {
      if (user) {
        username.value = user.username
        userId.value = user.id
        isAdmin.value = !!user.isAdmin
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
    login,
    register,
    logout,
    checkLogin
  }
})
