#!/usr/bin/env node
/**
 * 内网 App 调试：自动检测本机局域网 IP，并注入
 *   VITE_API_BASE=http://<LAN_IP>:3005/api
 *   VITE_ASSET_BASE=http://<LAN_IP>:5173
 * 然后调用 uni-app 的 app 平台 dev/build。
 *
 * 用法：
 *   node scripts/run-app-lan.mjs dev
 *   node scripts/run-app-lan.mjs build
 * 可用 LAN_IP / API_PORT / WEB_PORT 覆盖自动检测结果。
 */

import { spawn } from 'node:child_process'
import net from 'node:net'
import os from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API_PORT = process.env.API_PORT || '3005'
const WEB_PORT = process.env.WEB_PORT || '5173'
const VIRTUAL_ADAPTER = /(vEthernet|WSL|VirtualBox|VMware|Hyper-V|Loopback|Tailscale|ZeroTier|docker)/i

function lanCandidates() {
  const result = []
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family !== 'IPv4' || address.internal) continue
      result.push({
        name,
        address: address.address,
        virtual: VIRTUAL_ADAPTER.test(name)
      })
    }
  }
  return result.sort((a, b) => Number(a.virtual) - Number(b.virtual))
}

function pickLanIp() {
  if (process.env.LAN_IP?.trim()) return process.env.LAN_IP.trim()

  const candidates = lanCandidates()
  const preferred =
    candidates.find(item => !item.virtual && /^192\.168\./.test(item.address)) ||
    candidates.find(item => !item.virtual && /^10\./.test(item.address)) ||
    candidates.find(item => !item.virtual && /^172\.(1[6-9]|2\d|3[01])\./.test(item.address)) ||
    candidates.find(item => !item.virtual) ||
    candidates[0]

  if (!preferred) {
    throw new Error('未检测到局域网 IPv4 地址，请用 LAN_IP=192.168.x.x 指定')
  }

  const others = candidates.filter(item => item.address !== preferred.address)
  if (others.length > 0) {
    console.log(
      `[app-lan] other candidates: ${others
        .map(item => `${item.address} (${item.name})`)
        .join(', ')}`
    )
  }
  return preferred.address
}

function probe(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port, timeout: 800 })
    const done = value => {
      socket.destroy()
      resolve(value)
    }
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

async function main() {
  const mode = process.argv[2] === 'dev' ? 'dev' : 'build'
  const ip = pickLanIp()
  const apiBase = process.env.VITE_API_BASE?.trim() || `http://${ip}:${API_PORT}/api`
  const assetBase = process.env.VITE_ASSET_BASE?.trim() || `http://${ip}:${WEB_PORT}`

  console.log(`[app-lan] API:    ${apiBase}`)
  console.log(`[app-lan] assets: ${assetBase}/static/atlas`)
  console.log(`[app-lan] H5:     http://${ip}:${WEB_PORT}/`)

  const [apiUp, webUp] = await Promise.all([probe(Number(API_PORT)), probe(Number(WEB_PORT))])
  if (!apiUp) {
    console.warn(
      `[app-lan] ${API_PORT} 未监听：App 登录/接口会失败，请先运行 node scripts/dev.mjs start all`
    )
  }
  if (!webUp) {
    console.warn(
      `[app-lan] ${WEB_PORT} 未监听：App 图鉴需要 H5 dev server 提供 /static/atlas，请先启动前端`
    )
  }

  const args = [join(ROOT, 'scripts', 'run-uni.mjs')]
  if (mode === 'build') args.push('build')
  args.push('-p', 'app')

  const env = {
    ...process.env,
    VITE_API_BASE: apiBase,
    VITE_ASSET_BASE: assetBase
  }

  const child = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env })
  child.once('error', error => {
    console.error('[app-lan]', error)
    process.exit(1)
  })
  child.once('exit', code => process.exit(code ?? 0))
}

main().catch(error => {
  console.error('[app-lan]', error)
  process.exit(1)
})
