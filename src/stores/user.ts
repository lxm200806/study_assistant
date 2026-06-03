import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authAPI } from '@/utils/api'

export const useUserStore = defineStore('user', () => {
  const isLoggedIn = ref(false)
  const username = ref('')
  const userId = ref('')

  const login = async (user: string, password: string) => {
    try {
      const result = await authAPI.login(user, password)
      
      if (result.accessToken) {
        uni.setStorageSync('accessToken', result.accessToken)
        uni.setStorageSync('refreshToken', result.refreshToken!)
        
        if (result.user) {
          username.value = result.user.username
          userId.value = result.user.id
        }
        
        isLoggedIn.value = true
        
        uni.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => {
          uni.switchTab({ url: '/pages/home/home' })
        }, 1000)
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
          username.value = result.user.username
          userId.value = result.user.id
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
    uni.removeStorageSync('accessToken')
    uni.removeStorageSync('refreshToken')
    uni.removeStorageSync('vocabularyStats')
    uni.removeStorageSync('trainingRecords')
    uni.showToast({ title: '已退出登录', icon: 'none' })
    uni.reLaunch({ url: '/pages/login/login' })
  }

  const checkLogin = () => {
    const token = uni.getStorageSync('accessToken')
    const user = uni.getStorageSync('user')
    
    if (token) {
      if (user) {
        username.value = user.username
        userId.value = user.id
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
    login,
    register,
    logout,
    checkLogin
  }
})