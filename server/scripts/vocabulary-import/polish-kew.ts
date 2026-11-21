#!/usr/bin/env ts-node
/**
 * @deprecated 请改用：npm run cishu:bianpai -- kew1200
 * 本脚本仅作兼容跳转。
 */
import { spawnSync } from 'child_process'
import path from 'path'

const args = process.argv.slice(2).filter(a => !a.endsWith('.ts'))
console.warn('[提示] paoguang/polish:kew* 已改名为 cishu:bianpai（编排课表）')
const r = spawnSync(
  process.execPath,
  [
    path.join(__dirname, '../../node_modules/ts-node/dist/bin.js'),
    '--transpile-only',
    path.join(__dirname, 'arrange-books.ts'),
    ...args
  ],
  { stdio: 'inherit' }
)
process.exit(r.status ?? 1)
