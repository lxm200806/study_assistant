import * as SecureStore from 'expo-secure-store'

interface UserState {
  username: string
  isPremium: boolean
  currentBook: string
  dailyGoal: number
  onboarded: boolean
}

const STORAGE_KEYS = {
  username: 'mobile_username',
  isPremium: 'mobile_isPremium',
  currentBook: 'mobile_currentBook',
  dailyGoal: 'mobile_dailyGoal',
  onboarded: 'mobile_onboarded',
}

let state: UserState = {
  username: '',
  isPremium: false,
  currentBook: 'ket',
  dailyGoal: 30,
  onboarded: false,
}

export async function initUserStore() {
  try {
    const u = await SecureStore.getItemAsync(STORAGE_KEYS.username)
    if (u) state.username = u
    const ip = await SecureStore.getItemAsync(STORAGE_KEYS.isPremium)
    if (ip) state.isPremium = ip === 'true'
    const cb = await SecureStore.getItemAsync(STORAGE_KEYS.currentBook)
    if (cb) state.currentBook = cb
    const dg = await SecureStore.getItemAsync(STORAGE_KEYS.dailyGoal)
    if (dg) state.dailyGoal = Number(dg)
    const ob = await SecureStore.getItemAsync(STORAGE_KEYS.onboarded)
    if (ob) state.onboarded = ob === 'true'
  } catch {}
}

function save(key: string, value: string | boolean | number) {
  SecureStore.setItemAsync(STORAGE_KEYS[key as keyof typeof STORAGE_KEYS], String(value)).catch(() => {})
}

export const USER_STORE = {
  get username() { return state.username },
  set username(v) { state.username = v; save('username', v) },

  get isPremium() { return state.isPremium },
  set isPremium(v) { state.isPremium = v; save('isPremium', v) },

  get currentBook() { return state.currentBook },
  set currentBook(v) { state.currentBook = v; save('currentBook', v) },

  get dailyGoal() { return state.dailyGoal },
  set dailyGoal(v) { state.dailyGoal = v; save('dailyGoal', v) },

  get onboarded() { return state.onboarded },
  set onboarded(v) { state.onboarded = v; save('onboarded', v) },

  reset() {
    state = { username: '', isPremium: false, currentBook: 'ket', dailyGoal: 30, onboarded: false }
  },
} as const
