/**
 * Copy personal textbook Markdown tree into server/data/kb/md (gitignored).
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/kb/sync-md.ts --from /path/to/kb/md
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const ROOT = path.resolve(__dirname, '../..')
const DEST = path.join(ROOT, 'data/kb/md')
const DEFAULT_FROM = '/Users/lxm/Documents/CCTest/data/kb/md'

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return undefined
  return process.argv[i + 1]
}

function main() {
  const from = path.resolve(argValue('--from') || DEFAULT_FROM)
  if (!fs.existsSync(from)) {
    console.error(`源目录不存在: ${from}`)
    process.exit(1)
  }
  fs.mkdirSync(path.dirname(DEST), { recursive: true })
  const r = spawnSync('rsync', ['-a', '--delete', `${from}/`, `${DEST}/`], { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status || 1)
  const files = countFiles(DEST)
  console.log(`已同步 → ${DEST}（${files} 个文件）`)
}

function countFiles(dir: string): number {
  let n = 0
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) n += countFiles(p)
    else n += 1
  }
  return n
}

main()
