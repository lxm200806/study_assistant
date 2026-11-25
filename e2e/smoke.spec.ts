import { expect, test, type Page } from '@playwright/test'

const DEMO_USER = {
  id: 'u-e2e',
  username: 'demo',
  isAdmin: false,
  hasOnboarded: true,
  plan: 'free',
  activeSubject: 'english',
  accountType: 'parent',
  activeRole: 'parent',
  displayName: 'Demo',
  activeLearnerId: 'l-e2e',
  learner: { id: 'l-e2e', name: '小明', activeSubject: 'english' },
  children: [{ id: 'l-e2e', name: '小明', activeSubject: 'english' }]
}

const DEMO_STUDENT = { ...DEMO_USER, activeRole: 'student' }

const isApiRequest = (url: URL) => url.pathname.startsWith('/api/')

async function mockUnauthorizedApi(page: Page) {
  await page.route(isApiRequest, route =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' })
    })
  )
}

async function mockDemoLogin(page: Page) {
  await page.route(
    (url: URL) => url.pathname === '/api/auth/login',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'e2e-access-token',
          refreshToken: 'e2e-refresh-token',
          user: DEMO_USER
        })
      })
  )
  await page.route(
    (url: URL) => url.pathname === '/api/auth/role',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, user: DEMO_USER })
      })
  )
  await page.route(
    (url: URL) => url.pathname === '/api/auth/profile',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: DEMO_USER })
      })
  )
}

async function loginAsDemo(page: Page) {
  await mockDemoLogin(page)
  await page.goto('/#/pages/login/login')
  await page.locator('input.uni-input-input').first().fill('demo')
  await page.locator('input[type="password"]').fill('secret')
  await page.locator('uni-button.start').click()
  await expect(page.getByText('小明', { exact: true })).toBeVisible({ timeout: 15_000 })
}

test.beforeEach(async ({ page }) => {
  await mockUnauthorizedApi(page)
})

test('renders the login form', async ({ page }) => {
  await page.goto('/#/pages/login/login')

  await expect(page.getByText('学习助手', { exact: true }).first()).toBeVisible()
  await expect(page.locator('input.uni-input-input').first()).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.locator('uni-button.start')).toContainText('登录')
})

test('shows the API login error', async ({ page }) => {
  await page.route(
    (url: URL) => url.pathname === '/api/auth/login',
    route =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: '用户名或密码错误' })
      })
  )

  await page.goto('/#/pages/login/login')
  await page.locator('input.uni-input-input').first().fill('demo')
  await page.locator('input[type="password"]').fill('bad-password')
  await page.locator('uni-button.start').click()

  await expect(page.getByText('用户名或密码错误')).toBeVisible()
})

test('redirects an unauthenticated protected page to login', async ({ page }) => {
  await page.goto('/#/pages/books/books')
  await expect(page.getByText('一个账号，多个角色。登录后从左下角进入。')).toBeVisible()
})

test('logs in and lands on the role page', async ({ page }) => {
  await loginAsDemo(page)
})

test('renders the authenticated book list', async ({ page }) => {
  await loginAsDemo(page)
  await page.route(
    (url: URL) => url.pathname === '/api/books',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'b-e2e',
              code: 'pep-g3a-2024',
              name: '人教 PEP 三上',
              description: 'E2E 测试词书',
              level: '小学三上',
              wordCount: 120,
              isFree: true
            }
          ]
        })
      })
  )

  await page.goto('/#/pages/books/books')
  await expect(page.getByText('人教 PEP 三上', { exact: true })).toBeVisible()
})

test('renders the typing setup page for a student', async ({ page }) => {
  await page.goto('/#/pages/login/login')
  await page.evaluate((student) => {
    const storage = (window as unknown as {
      uni: { setStorageSync: (key: string, value: unknown) => void }
    }).uni
    storage.setStorageSync('accessToken', 'e2e-access-token')
    storage.setStorageSync('refreshToken', 'e2e-refresh-token')
    storage.setStorageSync('user', student)
    storage.setStorageSync('roleChosen', '1')
    storage.setStorageSync('currentBookCode', 'pep-g3a-2024')
  }, DEMO_STUDENT)

  await page.route(
    (url: URL) => url.pathname === '/api/books',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'b-e2e',
              code: 'pep-g3a-2024',
              name: '人教 PEP 三上',
              description: 'E2E 测试词书',
              level: '小学三上',
              wordCount: 120,
              isFree: true
            }
          ]
        })
      })
  )
  await page.route(
    (url: URL) => url.pathname === '/api/typing/summary',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { due: 1, unseen: 2, skipped: 0, wrong: 0, favorite: 0 }
        })
      })
  )
  await page.route(
    (url: URL) => url.pathname === '/api/typing/articles',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] })
      })
  )
  await page.route(
    (url: URL) => url.pathname === '/api/typing/history',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { days: [], speed: [] } })
      })
  )

  await page.goto('/#/pages/typing/typing')
  await expect(page.locator('uni-page-body').getByText('拼读练习', { exact: true })).toBeVisible()
  await expect(page.locator('uni-page-body uni-button.start')).toContainText('开始')
})
