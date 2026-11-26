#!/usr/bin/env node
/**
 * 微信小程序包体门禁。
 * 主包上限默认 2MB、整包默认 20MB；可用环境变量覆盖：
 *   MP_PACKAGE_LIMIT_MB / MP_TOTAL_PACKAGE_LIMIT_MB
 * 若 app.json 配置了 subPackages，主包大小会排除分包目录。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.resolve(ROOT, process.argv[2] || 'dist/build/mp-weixin')
const MB = 1024 * 1024
const MAIN_LIMIT_MB = Number(process.env.MP_PACKAGE_LIMIT_MB || 2)
const TOTAL_LIMIT_MB = Number(process.env.MP_TOTAL_PACKAGE_LIMIT_MB || 20)

function fail(message) {
  console.error(`[mp-size] ${message}`)
  process.exit(1)
}

function readSubpackageRoots() {
  const appJsonPath = path.join(DIST, 'app.json')
  if (!fs.existsSync(appJsonPath)) return []
  try {
    const app = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))
    const packages = app.subPackages || app.subpackages || []
    return packages
      .map(item => String(item?.root || '').replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .map(root => root.replace(/\\/g, '/'))
  } catch (error) {
    console.warn('[mp-size] 无法解析 app.json，按整包统计', error.message)
    return []
  }
}

function collectFiles(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(full, files)
    } else if (entry.isFile()) {
      files.push({
        path: full,
        relative: path.relative(DIST, full).replace(/\\/g, '/'),
        size: fs.statSync(full).size
      })
    }
  }
}

if (!fs.existsSync(DIST)) {
  fail(`构建目录不存在: ${DIST}（先运行 npm run build:mp-weixin）`)
}

const subpackageRoots = readSubpackageRoots()
const files = []
collectFiles(DIST, files)

const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
const mainBytes = files
  .filter(
    file =>
      !subpackageRoots.some(
        root => file.relative === root || file.relative.startsWith(`${root}/`)
      )
  )
  .reduce((sum, file) => sum + file.size, 0)

const format = bytes => `${(bytes / MB).toFixed(2)} MB`
console.log(
  `[mp-size] main ${format(mainBytes)} / ${MAIN_LIMIT_MB} MB, total ${format(totalBytes)} / ${TOTAL_LIMIT_MB} MB`
)
if (subpackageRoots.length > 0) {
  console.log(`[mp-size] subpackages: ${subpackageRoots.join(', ')}`)
}

if (mainBytes > MAIN_LIMIT_MB * MB) {
  fail(`主包 ${format(mainBytes)} 超过 ${MAIN_LIMIT_MB} MB 限制`)
}
if (totalBytes > TOTAL_LIMIT_MB * MB) {
  fail(`整包 ${format(totalBytes)} 超过 ${TOTAL_LIMIT_MB} MB 限制`)
}
