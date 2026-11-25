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

async function seedStudentStorage(page: Page, user: typeof DEMO_USER) {
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
  }, user)
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

test('renders the quiz start screen and PC rail', async ({ page }) => {
  await loginAsDemo(page)
  await page.route(isApiRequest, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null })
    })
  )
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

  await page.goto('/#/pages/quiz/quiz')
  await expect(page.getByText('阶段模拟小测', { exact: true })).toBeVisible()
  await expect(page.locator('uni-left-window')).toBeVisible()
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

test('renders the recognition setup for a student', async ({ page }) => {
  await seedStudentStorage(page, DEMO_STUDENT)
  await page.route(isApiRequest, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null })
    })
  )
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
    (url: URL) => url.pathname === '/api/vocab/stats',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            listening: { total: 0, mastered: 0, avgMastery: 0 },
            speaking: { total: 0, mastered: 0, avgMastery: 0 },
            reading: { total: 0, mastered: 0, avgMastery: 0 },
            writing: { total: 0, mastered: 0, avgMastery: 0 }
          }
        })
      })
  )

  await page.goto('/#/pages/recognition/recognition')
  await expect(page.locator('uni-page-body').getByText('认读练习', { exact: true })).toBeVisible()
  await expect(page.locator('uni-page-body uni-button.start')).toContainText('开始')
})

test('renders the Chinese drill card for a student', async ({ page }) => {
  await seedStudentStorage(page, { ...DEMO_STUDENT, activeSubject: 'chinese' })
  await page.route(isApiRequest, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null })
    })
  )
  await page.route(
    (url: URL) => url.pathname === '/api/chinese/courses/c-e2e/today',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          today: '2026-11-25',
          items: [
            {
              id: 'p-e2e',
              kind: 'poem',
              level: 'L1',
              grade: '三年级上',
              prompt: '床前明月光',
              answer: '疑是地上霜',
              questionType: 'dictation',
              lemma: '静夜思',
              role: 'new',
              groupSize: 1,
              groupIndex: 1,
              groupEnergy: 1,
              parts: 1,
              part: 1,
              audience: 'all',
              difficulty: 'primary',
              options: {},
              mode: 'learn'
            }
          ],
          due: 1,
          fresh: 1,
          tasks: 1,
          cards: 1,
          itemCount: 1,
          courseName: '语文测试课',
          mode: 'learn',
          defaultMode: 'learn',
          modes: [{ id: 'learn', label: '学一学', hint: '' }],
          modeCounts: { learn: 1 },
          dailyMinutes: 15,
          progress: { title: '今日学习', hint: '', status: '' }
        })
      })
  )

  await page.goto('/#/pages/chinese/drill?id=c-e2e')
  await expect(page.getByText('床前明月光', { exact: true })).toBeVisible()
})

test('starts the typing practice flow for a student', async ({ page }) => {
  await seedStudentStorage(page, DEMO_STUDENT)

  // 拼读设置页还会顺带请求 progress/due-count 等；给未单独 mock 的接口一个空成功响应，
  // 避免 catch-all 的 401 触发“登录失效”弹窗拦截点击。
  await page.route(isApiRequest, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null })
    })
  )
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
  await page.route(
    (url: URL) => url.pathname === '/api/typing/queue',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            source: 'smart',
            mode: 'follow',
            scopedToBook: true,
            bookCode: 'pep-g3a-2024',
            words: [
              {
                id: 'w-e2e',
                word: 'apple',
                meaning: '苹果',
                phonetic: '/ˈæpl/',
                favorite: false,
                skipMastered: false,
                inWrongBook: false
              }
            ],
            sessionToken: 'e2e-typing-session'
          }
        })
      })
  )

  await page.goto('/#/pages/typing/typing')
  await expect(page.locator('uni-page-body').getByText('拼读练习', { exact: true })).toBeVisible()
  await expect(page.locator('uni-page-body uni-button.start')).toContainText('开始')

  await page.locator('uni-page-body uni-button.start').click()
  await expect(page.locator('uni-page-body').getByText('跟着拼写', { exact: true })).toBeVisible()
})
