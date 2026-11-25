#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(serverRoot, '.env') })

if (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
  console.error('缺少 TEST_DATABASE_URL 或 server/.env 中的 DATABASE_URL，无法运行数据库集成测试')
  process.exit(1)
}

const vitest = path.join(serverRoot, 'node_modules', 'vitest', 'vitest.mjs')
const result = spawnSync(process.execPath, [vitest, 'run'], {
  cwd: serverRoot,
  stdio: 'inherit',
  env: { ...process.env, RUN_DB_TESTS: '1' }
})

process.exit(result.status ?? 1)
