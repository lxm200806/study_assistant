import type { Vocabulary } from '@/types'
import { useVocabularyStore } from '@/stores/vocabulary'
import { useUserStore } from '@/stores/user'

export function isBookAccessible(bookCode: string, isFree?: boolean): boolean {
  const userStore = useUserStore()
  if (userStore.isAdmin || userStore.plan === 'premium') return true
  if (isFree === true || bookCode === 'ket') return true
  return false
}

type LoadErrorKind = 'auth' | 'locked' | 'network' | 'unknown'

function classifyTrainingLoadError(error: unknown): LoadErrorKind {
  const msg = (error as Error)?.message || String(error || '')
  if (/Unauthorized|401|Invalid token|请先登录/i.test(msg)) return 'auth'
  if (/BOOK_LOCKED|会员|403/i.test(msg)) return 'locked'
  if (/Network|timeout|网络/i.test(msg)) return 'network'
  return 'unknown'
}

export async function ensureTrainingWords(
  words: Vocabulary[],
  loadError?: unknown
): Promise<boolean> {
  if (words.length > 0) return true

  const vocabStore = useVocabularyStore()
  const book = vocabStore.getCurrentBook
  const errorKind = loadError ? classifyTrainingLoadError(loadError) : null
  const locked = errorKind === 'locked' || (book && !isBookAccessible(book.code, book.isFree))

  let content = '暂无可用词汇，请切换词书或稍后再试。'
  let confirmText = '切换 KET'

  if (errorKind === 'auth') {
    content = '请先登录后再开始训练。'
    confirmText = '去登录'
  } else if (locked) {
    content = `「${book?.name || '当前词书'}」需开通会员。免费用户可使用 KET 词书。`
    confirmText = '去会员页'
  } else if (errorKind === 'network') {
    content = '网络异常，请检查连接后重试。'
    confirmText = '知道了'
  }

  return new Promise((resolve) => {
    uni.showModal({
      title: '无法加载题目',
      content,
      confirmText,
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          if (errorKind === 'auth') {
            uni.navigateTo({ url: '/pages/login/login' })
          } else if (locked) {
            if (errorKind === 'locked' || !isBookAccessible(book?.code || '', book?.isFree)) {
              uni.navigateTo({ url: '/pages/membership/membership' })
            } else {
              vocabStore.setCurrentBook('ket')
              uni.showToast({ title: '已切换到 KET', icon: 'none' })
            }
          } else if (errorKind !== 'network') {
            vocabStore.setCurrentBook('ket')
            uni.showToast({ title: '已切换到 KET', icon: 'none' })
          }
        }
        resolve(false)
      },
      fail: () => resolve(false)
    })
  })
}

export async function requireLoginForTraining(): Promise<boolean> {
  const userStore = useUserStore()
  const loggedIn = await userStore.checkLogin()
  if (loggedIn) return true

  return new Promise((resolve) => {
    uni.showModal({
      title: '需要登录',
      content: '开始训练前请先登录账号。',
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          uni.navigateTo({ url: '/pages/login/login' })
        }
        resolve(false)
      },
      fail: () => resolve(false)
    })
  })
}
