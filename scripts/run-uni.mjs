#!/usr/bin/env node
/** 跨平台调用 uni-app CLI：固定注入 patch-os-ni，避免 Windows/PowerShell 下走 bash。 */

import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const UNI_BIN = join(ROOT, 'node_modules', '@dcloudio', 'vite-plugin-uni', 'bin', 'uni.js')
const PATCH = join(ROOT, 'scripts', 'patch-os-ni.cjs')

const existing = process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ''
// NODE_OPTIONS 会被 Node 重新解析，反斜杠会被吞掉
const patchPath = PATCH.replace(/\\/g, '/')
const env = {
  ...process.env,
  NODE_OPTIONS: `${existing}--require "${patchPath}"`
}

const child = spawn(process.execPath, [UNI_BIN, ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: 'inherit',
  env
})

child.once('error', error => {
  console.error(error)
  process.exit(1)
})

child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
