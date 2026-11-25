import { defineConfig, devices } from '@playwright/test'

// Windows 本地优先用系统 Edge，避免 Playwright 浏览器下载失败；其他平台/CI 使用安装的 Chromium。
const localChannel = process.platform === 'win32' ? 'msedge' : undefined
const channel = process.env.PLAYWRIGHT_CHANNEL || (process.env.CI ? undefined : localChannel)

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run dev:h5',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel }
    }
  ]
})
