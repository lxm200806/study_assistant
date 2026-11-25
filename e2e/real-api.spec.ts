import { expect, request, test } from '@playwright/test'

const API_BASE = process.env.E2E_API_BASE || 'http://127.0.0.1:3005'

test.skip(process.env.E2E_REAL_API !== '1', 'set E2E_REAL_API=1 with a running API + seeded DB')

test('registers via the real API and renders the real book list', async ({ page }) => {
  const api = await request.newContext({ baseURL: API_BASE })
  try {
    const username = `e2e_${Date.now()}`
    const registered = await api.post('/api/auth/register', {
      data: { username, password: 'TestPass123!' }
    })
    expect(registered.ok()).toBeTruthy()
    const auth = await registered.json()

    const student = await api.post('/api/auth/students', {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      data: { name: 'E2E学生' }
    })
    expect(student.ok()).toBeTruthy()
    const studentBody = await student.json()

    await page.goto('/#/pages/login/login')
    await page.evaluate(
      ({ tokens, user }) => {
        const storage = (window as unknown as {
          uni: { setStorageSync: (key: string, value: unknown) => void }
        }).uni
        storage.setStorageSync('accessToken', tokens.accessToken)
        storage.setStorageSync('refreshToken', tokens.refreshToken)
        storage.setStorageSync('user', user)
        storage.setStorageSync('roleChosen', '1')
        storage.setStorageSync('currentBookCode', 'pep-g3a-2024')
      },
      { tokens: auth, user: studentBody.user }
    )

    await page.goto('/#/pages/books/books')
    await expect(page.locator('.book-name').first()).toBeVisible({ timeout: 15_000 })
  } finally {
    await api.dispose()
  }
})
