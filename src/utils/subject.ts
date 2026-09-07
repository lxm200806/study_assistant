import { useUserStore } from '@/stores/user'

export type Subject = 'english' | 'chinese'

export function isChineseSubject(value?: string | null) {
  return value === 'chinese'
}

export function applySubjectTabBar(subject: Subject | string) {
  if (typeof uni.setTabBarItem !== 'function') return
  const chinese = isChineseSubject(subject)
  uni.setTabBarItem({ index: 1, text: chinese ? '掌握' : '统计' })
  uni.setTabBarItem({ index: 2, text: chinese ? '覆盖' : '图谱' })
}

export async function requireSubject(page: Subject) {
  const userStore = useUserStore()
  await userStore.checkLogin()
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/login' })
    return false
  }
  applySubjectTabBar(userStore.activeSubject)
  if (userStore.activeSubject !== page) {
    uni.showToast({
      title: page === 'chinese' ? '请先切换到语文' : '请先切换到英语',
      icon: 'none'
    })
    uni.switchTab({ url: '/pages/home/home' })
    return false
  }
  if (userStore.isParent && !userStore.activeLearnerId) {
    uni.reLaunch({ url: '/pages/family/students' })
    return false
  }
  return true
}
