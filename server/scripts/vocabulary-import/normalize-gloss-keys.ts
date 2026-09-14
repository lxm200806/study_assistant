#!/usr/bin/env ts-node
/**
 * 把所有 *-glosses.json 的键从 word::sense 收成单词。
 */
import fs from 'fs'
import path from 'path'
import { writeNormalizedGlosses } from './kew-gloss'

const ROOT = path.join(__dirname, '../../data/sources')

function walk(dir: string, files: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) walk(full, files)
    else if (name.endsWith('-glosses.json')) files.push(full)
  }
  return files
}

function main() {
  const files = walk(ROOT)
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>
    const before = Object.keys(raw).length
    writeNormalizedGlosses(file, raw as never)
    const after = Object.keys(JSON.parse(fs.readFileSync(file, 'utf-8'))).length
    const oldStyle = Object.keys(raw).filter(key => key.includes('::')).length
    console.log(`${path.relative(ROOT, file)}: ${before} → ${after}（去掉 ${oldStyle} 个 :: 键）`)
  }
}

main()
