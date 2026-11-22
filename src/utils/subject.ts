import { useUserStore } from '@/stores/user'
import { isBrowserH5 } from '@/utils/audio-recording'
import { isWidePc } from '@/utils/pc-route'

export type Subject = 'english' | 'chinese'
export type PageAccess = 'any' | 'parent' | 'student'

export function isChineseSubject(value?: string | null) {
  return value === 'chinese'
}

export function applySubjectTabBar(subject: Subject | string) {
  if (typeof uni.setTabBarItem !== 'function') return
  const chinese = isChineseSubject(subject)
  // 0 首页 · 1 词书 · 2 统计/掌握 · 3 图谱/覆盖 · 4 账号
  uni.setTabBarItem({ index: 2, text: chinese ? '掌握' : '统计' })
  uni.setTabBarItem({ index: 3, text: chinese ? '覆盖' : '图谱' })
}

export function applyAppShell() {
  const userStore = useUserStore()
  const widePc = isBrowserH5() && isWidePc()
  if ((widePc || userStore.isStudentRole) && typeof uni.hideTabBar === 'function') {
    uni.hideTabBar({ animation: false, fail() {} })
  } else if (typeof uni.showTabBar === 'function') {
    uni.showTabBar({ animation: false, fail() {} })
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
    // 不再进引导页，直接落到账号角色页
    uni.reLaunch({ url: '/pages/family/students' })
    return false
  }
  applyAppShell()
  if (!opts?.allowMissingRole && !userStore.roleChosen) {
    uni.reLaunch({ url: '/pages/family/students' })
    return false
  }
  if (!opts?.allowNoStudents && !userStore.children.length) {
    uni.reLaunch({ url: '/pages/family/students' })
    return false
  }
  return true
}

/** 角色进练习，账号进角色列表。语文角色仍用今日。 */
export function goToLanding() {
  const userStore = useUserStore()
  if (userStore.isStudentRole && userStore.isChinese) {
    uni.switchTab({ url: '/pages/home/home' })
    return
  }
  if (userStore.isStudentRole) {
    uni.reLaunch({ url: '/pages/recognition/recognition' })
    return
  }
  uni.reLaunch({ url: '/pages/family/students' })
}

export async function requireSubject(page: Subject, access: PageAccess = 'any') {
  if (!(await requireReadySession({ allowNoStudents: access === 'parent' }))) return false
  const userStore = useUserStore()
  if (userStore.activeSubject !== page) {
    uni.showToast({
      title: page === 'chinese' ? '请先切换到语文' : '请先切换到英语',
      icon: 'none'
    })
    goToLanding()
    return false
  }
  if (access === 'parent' && userStore.isStudentRole) {
    uni.showToast({ title: '请到账号里查看', icon: 'none' })
    goToLanding()
    return false
  }
  if (access === 'student' && !userStore.isStudentRole) {
    uni.showToast({ title: '请先选择一个角色学习', icon: 'none' })
    return false
  }
  return true
}
