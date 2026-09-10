import { useUserStore } from '@/stores/user'

export type Subject = 'english' | 'chinese'
export type PageAccess = 'any' | 'parent' | 'student'

export function isChineseSubject(value?: string | null) {
  return value === 'chinese'
}

export function applySubjectTabBar(subject: Subject | string) {
  if (typeof uni.setTabBarItem !== 'function') return
  const chinese = isChineseSubject(subject)
  uni.setTabBarItem({ index: 1, text: chinese ? '掌握' : '统计' })
  uni.setTabBarItem({ index: 2, text: chinese ? '覆盖' : '图谱' })
}

export function applyAppShell() {
  const userStore = useUserStore()
  if (userStore.isStudentRole && typeof uni.hideTabBar === 'function') {
    uni.hideTabBar({ animation: false })
  } else if (typeof uni.showTabBar === 'function') {
    uni.showTabBar({ animation: false })
  }
  applySubjectTabBar(userStore.activeSubject)
}

export async function requireReadySession(opts?: {
  allowMissingRole?: boolean
  allowNoStudents?: boolean
}) {
  const userStore = useUserStore()
  await userStore.checkLogin()
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/login' })
    return false
  }
  if (!userStore.hasOnboarded) {
    uni.reLaunch({ url: '/pages/onboarding/onboarding' })
    return false
  }
  applyAppShell()
  if (!opts?.allowMissingRole && !userStore.roleChosen) {
    uni.reLaunch({ url: '/pages/family/roles' })
    return false
  }
  if (!opts?.allowNoStudents && !userStore.children.length) {
    uni.reLaunch({ url: '/pages/family/roles' })
    return false
  }
  return true
}

export async function requireSubject(page: Subject, access: PageAccess = 'any') {
  if (!(await requireReadySession({ allowNoStudents: access === 'parent' }))) return false
  const userStore = useUserStore()
  if (userStore.activeSubject !== page) {
    uni.showToast({
      title: page === 'chinese' ? '请先切换到语文' : '请先切换到英语',
      icon: 'none'
    })
    uni.switchTab({ url: '/pages/home/home' })
    return false
  }
  if (access === 'parent' && userStore.isStudentRole) {
    uni.showToast({ title: '请用家长角色查看', icon: 'none' })
    uni.switchTab({ url: '/pages/home/home' })
    return false
  }
  if (access === 'student' && !userStore.isStudentRole) {
    uni.showToast({ title: '请先选择学生角色学习', icon: 'none' })
    uni.reLaunch({ url: '/pages/family/roles' })
    return false
  }
  return true
}
