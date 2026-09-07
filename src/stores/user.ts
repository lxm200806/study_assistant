import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authAPI, getAuthToken } from '@/utils/api'
import { unwrapStorage } from '@/utils/storage'
import { applySubjectTabBar, type Subject } from '@/utils/subject'

export type AccountType = 'parent' | 'student'

export interface LearnerInfo {
  id: string
  name: string
  activeSubject?: string
}

interface StoredUser {
  id: string
  username: string
  isAdmin: boolean
  hasOnboarded?: boolean
  plan?: string
  activeSubject?: Subject
  accountType?: AccountType
  displayName?: string
  activeLearnerId?: string | null
  learner?: LearnerInfo | null
  children?: LearnerInfo[]
}

export const useUserStore = defineStore('user', () => {
  const isLoggedIn = ref(false)
  const username = ref('')
  const userId = ref('')
  const isAdmin = ref(false)
  const hasOnboarded = ref(true)
  const plan = ref('free')
  const activeSubject = ref<Subject>('english')
  const accountType = ref<AccountType>('student')
  const displayName = ref('')
  const activeLearnerId = ref<string | null>(null)
  const learner = ref<LearnerInfo | null>(null)
  const children = ref<LearnerInfo[]>([])
  const isChinese = computed(() => activeSubject.value === 'chinese')
  const isParent = computed(() => accountType.value === 'parent')
  const learnerName = computed(() => learner.value?.name || displayName.value || username.value)

  const persistUser = (user: StoredUser) => {
    username.value = user.username
    userId.value = user.id
    isAdmin.value = user.isAdmin
    hasOnboarded.value = user.hasOnboarded ?? true
    plan.value = user.plan ?? 'free'
    activeSubject.value = user.activeSubject === 'chinese' ? 'chinese' : 'english'
    accountType.value = user.accountType === 'parent' ? 'parent' : 'student'
    displayName.value = user.displayName || user.username
    activeLearnerId.value = user.activeLearnerId || user.learner?.id || null
    learner.value = user.learner || null
    children.value = user.children || []
    uni.setStorageSync('user', {
      ...user,
      activeSubject: activeSubject.value,
      accountType: accountType.value,
      displayName: displayName.value,
      activeLearnerId: activeLearnerId.value,
      learner: learner.value,
      children: children.value
    })
    applySubjectTabBar(activeSubject.value)
  }

  const applyProfile = (user: StoredUser) => {
    persistUser(user)
  }

  const setOnboarded = (value: boolean) => {
    hasOnboarded.value = value
    const user = uni.getStorageSync('user') as StoredUser | undefined
    if (user) {
      persistUser({ ...user, hasOnboarded: value, activeSubject: activeSubject.value, accountType: accountType.value })
    }
  }

  const setSubject = async (subject: Subject, persistRemote = true) => {
    activeSubject.value = subject
    const user = uni.getStorageSync('user') as StoredUser | undefined
    if (user) persistUser({ ...user, activeSubject: subject })
    else applySubjectTabBar(subject)
    if (persistRemote) {
      try {
        const result = await authAPI.setSubject(subject)
        if (result.user) persistUser(result.user as StoredUser)
      } catch {
        // keep local switch even if the API is briefly unavailable
      }
    }
  }

  const setAccountType = (type: AccountType) => {
    accountType.value = type
    const user = uni.getStorageSync('user') as StoredUser | undefined
    if (user) persistUser({ ...user, accountType: type })
  }

  const refreshProfile = async () => {
    try {
      const result = await authAPI.profile()
      const profile = result.data as StoredUser
      if (profile) persistUser(profile)
    } catch {
      // ignore
    }
  }

  const createStudent = async (name: string) => {
    const result = await authAPI.createStudent(name)
    if (result.user) persistUser(result.user as StoredUser)
    return result.learner
  }

  const switchStudent = async (studentId: string) => {
    const result = await authAPI.setActiveStudent(studentId)
    if (result.user) persistUser(result.user as StoredUser)
  }

  const renameStudent = async (studentId: string, name: string) => {
    const result = await authAPI.renameStudent(studentId, name)
    if (result.user) persistUser(result.user as StoredUser)
  }

  const removeStudent = async (studentId: string) => {
    const result = await authAPI.archiveStudent(studentId)
    if (result.user) persistUser(result.user as StoredUser)
  }

  const navigateAfterAuth = () => {
    setTimeout(() => {
      if (!hasOnboarded.value) {
        uni.reLaunch({ url: '/pages/onboarding/onboarding' })
      } else if (isParent.value && !activeLearnerId.value) {
        uni.reLaunch({ url: '/pages/family/students' })
      } else {
        uni.switchTab({ url: '/pages/home/home' })
      }
    }, 800)
  }

  const login = async (user: string, password: string, type: AccountType) => {
    try {
      const result = await authAPI.login(user, password, type)

      if (result.accessToken) {
        uni.setStorageSync('accessToken', result.accessToken)
        uni.setStorageSync('refreshToken', result.refreshToken!)

        if (result.user) {
          persistUser(result.user as StoredUser)
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

  const register = async (user: string, password: string, type: AccountType) => {
    try {
      const result = await authAPI.register(user, password, type)

      if (result.accessToken) {
        uni.setStorageSync('accessToken', result.accessToken)
        uni.setStorageSync('refreshToken', result.refreshToken!)

        if (result.user) {
          persistUser({
            ...(result.user as StoredUser),
            hasOnboarded: false,
            accountType: type
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
    activeSubject.value = 'english'
    accountType.value = 'student'
    displayName.value = ''
    activeLearnerId.value = null
    learner.value = null
    children.value = []
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
        persistUser({
          ...user,
          isAdmin: !!user.isAdmin,
          hasOnboarded: user.hasOnboarded ?? true,
          plan: user.plan ?? 'free',
          activeSubject: user.activeSubject === 'chinese' ? 'chinese' : 'english',
          accountType: user.accountType === 'parent' ? 'parent' : 'student'
        })
      } else {
        await refreshProfile()
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
    activeSubject,
    isChinese,
    accountType,
    displayName,
    isParent,
    activeLearnerId,
    learner,
    children,
    learnerName,
    login,
    wechatLogin,
    register,
    logout,
    checkLogin,
    setOnboarded,
    setSubject,
    setAccountType,
    createStudent,
    switchStudent,
    renameStudent,
    removeStudent,
    refreshProfile,
    applyProfile
  }
})
