import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUserStore } from './user'
import { resetUniMock, uniStorage } from '@/test/uni-mock'

const STORED_USER = {
  id: 'u-test',
  username: 'demo',
  isAdmin: false,
  hasOnboarded: true,
  plan: 'free',
  activeSubject: 'english',
  accountType: 'parent',
  activeRole: 'parent',
  displayName: 'Demo',
  activeLearnerId: 'l-test',
  learner: { id: 'l-test', name: '小明', activeSubject: 'english' },
  children: [{ id: 'l-test', name: '小明', activeSubject: 'english' }]
}

beforeEach(() => {
  resetUniMock()
  setActivePinia(createPinia())
})

describe('user store session', () => {
  it('restores a stored session', async () => {
    uniStorage.set('accessToken', 'token')
    uniStorage.set('user', STORED_USER)
    uniStorage.set('roleChosen', '1')

    const store = useUserStore()
    await expect(store.checkLogin()).resolves.toBe(true)
    expect(store.isLoggedIn).toBe(true)
    expect(store.userId).toBe('u-test')
    expect(store.learnerName).toBe('小明')
    expect(store.roleChosen).toBe(true)
  })

  it('returns false without a token', async () => {
    const store = useUserStore()
    await expect(store.checkLogin()).resolves.toBe(false)
    expect(store.isLoggedIn).toBe(false)
  })

  it('clears token and user on logout', () => {
    uniStorage.set('accessToken', 'token')
    uniStorage.set('refreshToken', 'refresh')
    uniStorage.set('user', STORED_USER)
    uniStorage.set('roleChosen', '1')

    const store = useUserStore()
    store.logout()

    expect(uniStorage.has('accessToken')).toBe(false)
    expect(uniStorage.has('refreshToken')).toBe(false)
    expect(uniStorage.has('user')).toBe(false)
    expect(store.isLoggedIn).toBe(false)
  })
})
