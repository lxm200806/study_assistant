#!/usr/bin/env node
/**
 * 跨平台开发进程管理器（Windows Git Bash / PowerShell / Linux / macOS）。
 *
 * 取代 stop-port.sh 的 lsof、restart-*.sh 的 python3 以及 npm/bash wrapper PID：
 * 记录真实子进程 PID，停止时按进程树 / 进程组回收，端口查找做跨平台回退。
 *
 * 用法:
 *   node scripts/dev.mjs start  [all|api|web] [--foreground] [--no-db] [--no-migrate] [--no-generate]
 *   node scripts/dev.mjs stop   [all|api|web]
 *   node scripts/dev.mjs restart[all|api|web] [...start flags]
 *   node scripts/dev.mjs status [all|api|web]
 *   node scripts/dev.mjs migrate
 *   node scripts/dev.mjs kill-port <port> [label]
 */

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SERVER_DIR = join(ROOT, 'server')
const LOGS_DIR = join(ROOT, 'logs')
const IS_WIN = process.platform === 'win32'
const PATCH_OS_NI = join(ROOT, 'scripts', 'patch-os-ni.cjs')

function readEnvPort() {
  if (process.env.API_PORT && /^\d+$/.test(process.env.API_PORT.trim())) {
    return Number(process.env.API_PORT.trim())
  }
  const envFile = join(SERVER_DIR, '.env')
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*PORT\s*=\s*(.+?)\s*$/)
      if (!match) continue
      const value = match[1].replace(/^["']|["']$/g, '').trim()
      if (/^\d+$/.test(value)) return Number(value)
    }
  }
  return 3005
}

const API_PORT = readEnvPort()
const WEB_PORT = Number(process.env.WEB_PORT || 5173)

const TARGETS = {
  api: {
    key: 'api',
    name: '后端 API',
    port: API_PORT,
    cwd: SERVER_DIR,
    pidFile: join(LOGS_DIR, 'server.pid'),
    logFile: join(LOGS_DIR, 'server.log'),
    readyUrl: `http://127.0.0.1:${API_PORT}/api/books`
  },
  web: {
    key: 'web',
    name: '前端 H5',
    port: WEB_PORT,
    cwd: ROOT,
    pidFile: join(LOGS_DIR, 'client.pid'),
    logFile: join(LOGS_DIR, 'client.log'),
    readyUrl: `http://127.0.0.1:${WEB_PORT}/`
  }
}

function isWindows() {
  return IS_WIN
}

function ensureLogsDir() {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true })
}

function readPid(file) {
  try {
    const pid = Number.parseInt(readFileSync(file, 'utf8').trim(), 10)
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

function processAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error && error.code === 'EPERM'
  }
}

function commandExists(command) {
  const probe = isWindows() ? 'where' : 'which'
  const result = spawnSync(probe, [command], { stdio: 'ignore' })
  return !result.error && result.status === 0
}

let bashPathCache

// Windows 的 PATH 里 bash 通常是 WSL 的 C:\Windows\System32\bash.exe，
// 在 PowerShell 下必须优先使用 Git Bash，否则脚本会落到 WSL 里读不到仓库。
function resolveBash() {
  if (bashPathCache !== undefined) return bashPathCache
  if (isWindows()) {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
    const candidates = [
      join(programFiles, 'Git', 'bin', 'bash.exe'),
      join(programFiles, 'Git', 'usr', 'bin', 'bash.exe'),
      process.env.LOCALAPPDATA
        ? join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe')
        : null
    ]
    for (const candidate of candidates) {
      if (candidate && existsSync(candidate)) {
        bashPathCache = candidate
        return bashPathCache
      }
    }
  }
  bashPathCache = commandExists('bash') ? 'bash' : null
  return bashPathCache
}

function databaseTarget() {
  const fallback = { host: '127.0.0.1', port: 5432 }
  const envFile = join(SERVER_DIR, '.env')
  if (!existsSync(envFile)) return fallback
  const line = readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .find(item => /^\s*DATABASE_URL\s*=/.test(item))
  if (!line) return fallback
  const raw = line
    .slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^["']|["']$/g, '')
  try {
    const parsed = new URL(raw)
    return {
      host: parsed.hostname || fallback.host,
      port: parsed.port ? Number(parsed.port) : 5432
    }
  } catch {
    return fallback
  }
}

function listListeningPidsWin(port) {
  const result = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
  if (result.error || !result.stdout) return []
  const pids = new Set()
  for (const raw of result.stdout.split(/\r?\n/)) {
    const columns = raw.trim().split(/\s+/)
    if (columns.length < 5 || columns[0] !== 'TCP' || columns[3] !== 'LISTENING') continue
    if (!columns[1].endsWith(`:${port}`)) continue
    const pid = Number.parseInt(columns[4], 10)
    if (Number.isInteger(pid) && pid > 0) pids.add(pid)
  }
  return [...pids]
}

function listListeningPidsPosix(port) {
  const pids = new Set()

  if (commandExists('ss')) {
    const result = spawnSync('ss', ['-ltnp'], { encoding: 'utf8' })
    if (!result.error && result.stdout) {
      for (const line of result.stdout.split(/\r?\n/)) {
        if (!line.includes(`:${port} `) && !line.includes(`:${port}\t`)) continue
        for (const match of line.matchAll(/pid=(\d+)/g)) {
          pids.add(Number.parseInt(match[1], 10))
        }
      }
    }
  }

  if (pids.size === 0 && commandExists('lsof')) {
    const result = spawnSync('lsof', ['-t', `-i:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
    if (!result.error && result.stdout) {
      for (const line of result.stdout.split(/\r?\n/)) {
        const pid = Number.parseInt(line.trim(), 10)
        if (Number.isInteger(pid) && pid > 0) pids.add(pid)
      }
    }
  }

  return [...pids]
}

function listListeningPids(port) {
  return isWindows() ? listListeningPidsWin(port) : listListeningPidsPosix(port)
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise(resolvePort => {
    const socket = net.connect({ host, port })
    const finish = open => {
      socket.destroy()
      resolvePort(open)
    }
    socket.setTimeout(500)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

function killTree(pid) {
  if (!pid || pid === process.pid) return
  if (isWindows()) {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  for (const signal of ['SIGTERM']) {
    try {
      process.kill(-pid, signal)
      return
    } catch {
      // not a process-group leader; fall back to the pid itself
    }
    try {
      process.kill(pid, signal)
      return
    } catch {
      // already gone
    }
  }
}

function forceKill(pid) {
  if (!pid || pid === process.pid) return
  if (isWindows()) {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // already gone
    }
  }
}

const sleep = ms => new Promise(done => setTimeout(done, ms))

/** 端口不仅要空闲，还要稳定空闲一段时间，避免 watchdog 立刻重新绑定。 */
async function waitForPortFreeStable(port, timeoutMs = 4000, stableMs = 1200) {
  const deadline = Date.now() + timeoutMs
  let freeSince = null
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) {
      freeSince = null
    } else if (freeSince === null) {
      freeSince = Date.now()
    } else if (Date.now() - freeSince >= stableMs) {
      return true
    }
    await sleep(150)
  }
  return !(await isPortOpen(port))
}

async function waitForReady(url, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await httpOk(url)) return true
    await sleep(500)
  }
  return false
}

function httpOk(url) {
  return new Promise(resolveOk => {
    const request = http.get(url, response => {
      response.resume()
      resolveOk(response.statusCode >= 200 && response.statusCode < 400)
    })
    request.setTimeout(2000, () => {
      request.destroy()
      resolveOk(false)
    })
    request.on('error', () => resolveOk(false))
  })
}

const VIRTUAL_ADAPTER = /(vEthernet|WSL|VirtualBox|VMware|Hyper-V|Loopback|Tailscale|ZeroTier|docker)/i

function lanAddresses() {
  const addresses = []
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const item of list || []) {
      if (item.family !== 'IPv4' || item.internal) continue
      addresses.push({ address: item.address, name, virtual: VIRTUAL_ADAPTER.test(name) })
    }
  }
  // 真实 Wi-Fi/以太网优先，避免把 Hyper-V/WSL 的 172.x 当成手机可访问地址
  return addresses.sort((a, b) => Number(a.virtual) - Number(b.virtual))
}

function printUrls(target) {
  console.log('────────────────────────────────────')
  console.log(`  ${target.name}`)
  console.log('────────────────────────────────────')
  console.log(`  本机: http://localhost:${target.port}`)
  for (const { address, name, virtual } of lanAddresses()) {
    console.log(`  局域网: http://${address}:${target.port}${virtual ? `  (${name}，虚拟网卡)` : ''}`)
  }
  if (target.key === 'web') {
    console.log(`  API 代理: /api -> http://127.0.0.1:${API_PORT}`)
  }
  console.log('────────────────────────────────────')
}

function buildCommand(target) {
  if (target.key === 'api') {
    return {
      command: process.execPath,
      args: [join(SERVER_DIR, 'node_modules', 'nodemon', 'bin', 'nodemon.js')],
      env: process.env
    }
  }
  const nodeOptions = process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ''
  // NODE_OPTIONS 会被 Node 重新解析，Windows 反斜杠会被当作转义符吃掉。
  const patchPath = PATCH_OS_NI.replace(/\\/g, '/')
  return {
    command: process.execPath,
    args: [join(ROOT, 'node_modules', '@dcloudio', 'vite-plugin-uni', 'bin', 'uni.js')],
    env: {
      ...process.env,
      NODE_OPTIONS: `${nodeOptions}--require "${patchPath}"`
    }
  }
}

function runNodeScript(scriptPath, args, cwd) {
  if (!existsSync(scriptPath)) {
    console.warn(`⚠️  未找到 ${scriptPath}，已跳过`)
    return true
  }
  const result = spawnSync(process.execPath, [scriptPath, ...args], { cwd, stdio: 'inherit' })
  return !result.error && result.status === 0
}

function prismaScript() {
  return join(SERVER_DIR, 'node_modules', 'prisma', 'build', 'index.js')
}

async function ensureDatabase() {
  const db = databaseTarget()
  if (await isPortOpen(db.port, db.host)) {
    console.log(`🐘 数据库已就绪 (${db.host}:${db.port})`)
    return true
  }
  const script = join(ROOT, 'scripts', 'start-db.sh')
  if (!existsSync(script)) return true
  const bash = resolveBash()
  if (!bash) {
    console.warn('⚠️  未找到 bash，跳过数据库自动启动；请确认 PostgreSQL 已运行')
    return false
  }
  console.log('🐘 检查数据库…')
  // Git Bash 会吞掉 Windows 反斜杠路径，这里统一用仓库内相对路径
  const result = spawnSync(bash, ['scripts/start-db.sh'], { cwd: ROOT, stdio: 'inherit' })
  if (!result.error && result.status === 0) return true
  if (await isPortOpen(db.port, db.host)) {
    console.warn('⚠️  start-db.sh 返回非 0，但数据库端口已就绪，继续启动')
    return true
  }
  return false
}

function runMigrations() {
  const script = prismaScript()
  console.log('🗄️  prisma migrate deploy…')
  return runNodeScript(script, ['migrate', 'deploy'], SERVER_DIR)
}

function runPrismaGenerate() {
  console.log('⚙️  prisma generate…')
  return runNodeScript(prismaScript(), ['generate'], SERVER_DIR)
}

async function openLogFile(logFile) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return { fd: openSync(logFile, 'a'), file: logFile }
    } catch (error) {
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(error && error.code)) throw error
      await sleep(200)
    }
  }
  const fallback = logFile.replace(/\.log$/, `-${Date.now()}.log`)
  console.warn(`⚠️  ${logFile} 被其他进程占用，改写到 ${fallback}`)
  return { fd: openSync(fallback, 'a'), file: fallback }
}

async function stopTarget(target) {
  const listeners = listListeningPids(target.port)
  const launcher = readPid(target.pidFile)
  const portBusy = listeners.length > 0 || (await isPortOpen(target.port))

  if (!portBusy) {
    console.log(`✓ ${target.name}（端口 ${target.port}）未在运行`)
    rmSync(target.pidFile, { force: true })
    return true
  }

  // 先杀端口监听者，再回收 pid 文件记录的启动器（nodemon）。
  // 只杀监听者时，nodemon 会在几秒后重新拉起子进程，把端口和日志文件继续占住。
  if (listeners.length > 0) {
    console.log(`→ 停止 ${target.name}（监听 PID ${listeners.join(', ')}）…`)
    for (const pid of listeners) killTree(pid)
  }

  if (launcher && processAlive(launcher) && !listeners.includes(launcher)) {
    console.log(`→ 回收 ${target.name} 启动器（PID ${launcher}）…`)
    killTree(launcher)
  }

  if (await waitForPortFreeStable(target.port)) {
    rmSync(target.pidFile, { force: true })
    console.log(`✓ ${target.name} 已停止，端口 ${target.port} 已释放`)
    return true
  }

  // 兜底：端口被重新绑定（watchdog 重启）或无法读取监听 PID 时强制清理
  for (const pid of listListeningPids(target.port)) forceKill(pid)

  if (await waitForPortFreeStable(target.port, 4000, 800)) {
    rmSync(target.pidFile, { force: true })
    console.log(`✓ ${target.name} 已强制停止，端口 ${target.port} 已释放`)
    return true
  }

  console.error(`✗ ${target.name} 端口 ${target.port} 仍被占用：${listListeningPids(target.port).join(', ')}`)
  return false
}

async function startTarget(target, options) {
  if (await isPortOpen(target.port)) {
    console.log(`端口 ${target.port} 已被占用，先停止旧进程`)
    if (!(await stopTarget(target))) return false
  }

  if (target.key === 'api') {
    if (!options.noDb && !(await ensureDatabase())) {
      console.warn('⚠️  数据库检查未通过，继续尝试启动（API 可能启动失败）')
    }
    if (!options.noGenerate && !runPrismaGenerate()) {
      console.error('✗ prisma generate 失败')
      return false
    }
    if (!options.noMigrate && !runMigrations()) {
      console.error('✗ prisma migrate deploy 失败')
      return false
    }
  }

  ensureLogsDir()
  printUrls(target)

  const { command, args, env } = buildCommand(target)
  let child
  let activeLogFile = target.logFile

  if (options.foreground) {
    child = spawn(command, args, { cwd: target.cwd, stdio: 'inherit', env })
  } else {
    const { fd: logFd, file } = await openLogFile(target.logFile)
    activeLogFile = file
    child = spawn(command, args, {
      cwd: target.cwd,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env,
      windowsHide: true
    })
    closeSync(logFd)
    child.unref()
  }

  if (!child.pid) {
    console.error(`✗ ${target.name} 启动失败`)
    return false
  }
  writeFileSync(target.pidFile, `${child.pid}\n`)

  if (options.foreground) {
    const shutdown = signal => {
      killTree(child.pid)
      rmSync(target.pidFile, { force: true })
      process.exit(signal === 'SIGINT' ? 130 : 143)
    }
    process.once('SIGINT', () => shutdown('SIGINT'))
    process.once('SIGTERM', () => shutdown('SIGTERM'))
    child.once('exit', code => {
      rmSync(target.pidFile, { force: true })
      process.exit(code ?? 0)
    })
    return true
  }

  console.log(`⏳ 等待 ${target.name} 就绪（PID ${child.pid}，日志 ${target.logFile}）…`)
  if (await waitForReady(target.readyUrl)) {
    console.log(`✓ ${target.name} 已就绪：http://localhost:${target.port}`)
    return true
  }
  console.error(`✗ ${target.name} 启动超时，请查看 ${activeLogFile}`)
  return false
}

function resolveTargets(name) {
  if (name === 'all' || !name) return [TARGETS.api, TARGETS.web]
  const target = TARGETS[name]
  if (!target) {
    console.error(`未知目标: ${name}（可选 all|api|web）`)
    process.exit(2)
  }
  return [target]
}

function parseArgs(argv) {
  const command = argv[0] || 'status'
  const positional = argv.slice(1).filter(item => !item.startsWith('--'))
  const flags = new Set(argv.filter(item => item.startsWith('--')))
  return {
    command,
    targetName: positional[0] || 'all',
    rest: positional.slice(1),
    options: {
      foreground: flags.has('--foreground'),
      noDb: flags.has('--no-db'),
      noMigrate: flags.has('--no-migrate'),
      noGenerate: flags.has('--no-generate')
    }
  }
}

async function main() {
  const { command, targetName, rest, options } = parseArgs(process.argv.slice(2))

  if (command === 'kill-port') {
    const port = Number(rest[0] ?? targetName)
    if (!Number.isInteger(port) || port <= 0) {
      console.error('用法: node scripts/dev.mjs kill-port <port> [label]')
      process.exit(2)
    }
    const label = rest[1] || '服务'
    const target = {
      key: 'port',
      name: label,
      port,
      pidFile: join(LOGS_DIR, `port-${port}.pid`)
    }
    process.exit((await stopTarget(target)) ? 0 : 1)
  }

  if (command === 'migrate') {
    const ok = runPrismaGenerate() && runMigrations()
    process.exit(ok ? 0 : 1)
  }

  if (command === 'status') {
    for (const target of resolveTargets(targetName)) {
      const pid = readPid(target.pidFile)
      const listeners = listListeningPids(target.port)
      const open = await isPortOpen(target.port)
      console.log(
        `${target.name}: 端口 ${target.port} ${open ? '监听中' : '未监听'}` +
          ` | pid 文件 ${pid ?? '-'} | 监听 PID ${listeners.length ? listeners.join(',') : '-'}`
      )
    }
    return
  }

  if (command === 'stop') {
    let ok = true
    for (const target of resolveTargets(targetName)) {
      ok = (await stopTarget(target)) && ok
    }
    process.exit(ok ? 0 : 1)
  }

  if (command === 'restart') {
    for (const target of resolveTargets(targetName)) {
      if (!(await stopTarget(target))) process.exit(1)
    }
    for (const target of resolveTargets(targetName)) {
      if (!(await startTarget(target, options))) process.exit(1)
    }
    return
  }

  if (command === 'start') {
    let ok = true
    for (const target of resolveTargets(targetName)) {
      ok = (await startTarget(target, options)) && ok
      if (!ok) break
    }
    if (!options.foreground) process.exit(ok ? 0 : 1)
    return
  }

  console.error(`未知命令: ${command}（可选 start|stop|restart|status|migrate|kill-port）`)
  process.exit(2)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
