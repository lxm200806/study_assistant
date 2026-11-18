#!/usr/bin/env ts-node
/**
 * 全局词典校验：
 * - 默认：列出 pending，报告缺字段
 * - --mark-verified：人工标记 verified
 * - --llm：用大模型自动校验所有 pending，通过后 status=llm（写回 senses.json）
 *
 * 用法（在 server/ 下）：
 *   npm run cidian:jiaoyan
 *   npm run cidian:jiaoyan -- --llm
 *   npm run cidian:jiaoyan -- --llm --concurrency 8
 *   npm run cidian:jiaoyan -- --llm --flush 30
 *   npm run cidian:jiaoyan -- --llm --batch 5
 *   npm run cidian:jiaoyan -- --llm --limit 20
 *   npm run cidian:jiaoyan -- --mark-verified apple ball
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import {
  asFlatSense,
  clearSensesCache,
  isLexiconSettled,
  loadGlobalSenses,
  missingLexiconFields,
  saveGlobalSenses,
  sensesFilePath,
  type GlobalSense
} from '../../src/data/vocabulary/senses'
import { REPORT_DIR } from './kew-layout'
import {
  assertLlmConfigured,
  verifyBatchWithLlm,
  verifyOneWordWithLlm,
  type LlmVerifyResult
} from './verify-lexicon-llm'

dotenv.config({ path: path.join(__dirname, '../../.env') })

/** 强制刷到终端，避免被管道/后台缓冲吞掉 */
function log(...parts: unknown[]) {
  const line = parts.map(p => (typeof p === 'string' ? p : String(p))).join(' ')
  process.stdout.write(`${line}\n`)
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

/** 固定并发池：LLM 可并行；onResult 在单线程里串行执行，可安全改内存 */
async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
) {
  const n = Math.max(1, Math.min(concurrency, items.length || 1))
  let next = 0
  async function run() {
    while (true) {
      const i = next
      next += 1
      if (i >= items.length) return
      await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: n }, () => run()))
}

async function runLlmVerify(opts: {
  limit: number
  batch: number
  delayMs: number
  concurrency: number
  flushEvery: number
}) {
  const cfg = assertLlmConfigured()
  const usePool = opts.concurrency > 1
  log(`LLM: model=${cfg.model} base=${cfg.baseUrl}`)
  if (usePool) {
    log(
      `模式: 并发池校验 pending → status=llm；concurrency=${opts.concurrency} flush每${opts.flushEvery}条`
    )
    if (opts.batch > 1) {
      log(`提示: concurrency>1 时忽略 --batch（改为逐词并发请求）`)
    }
  } else {
    log(`模式: 逐批校验 pending → status=llm；batch=${opts.batch} flush每${opts.flushEvery}条`)
  }

  clearSensesCache()
  const lexicon = loadGlobalSenses()
  const pendingWords = Object.keys(lexicon)
    .sort()
    .filter(w => !isLexiconSettled(lexicon[w]))

  const target = opts.limit > 0 ? pendingWords.slice(0, opts.limit) : pendingWords
  log(`待校验 ${pendingWords.length} 条，本次处理 ${target.length} 条`)
  log('进度会实时打印在终端（同时写入 tmp/kew/lexicon-llm-verify.jsonl）')

  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const logPath = path.join(REPORT_DIR, 'lexicon-llm-verify.jsonl')
  const summaryPath = path.join(REPORT_DIR, 'lexicon-llm-summary.json')

  let ok = 0
  let fail = 0
  let changed = 0
  let dirtySinceFlush = 0
  let dirty = false
  const failures: Array<{ word: string; error: string }> = []
  const startedAt = Date.now()
  let stopping = false

  function writeSummary() {
    fs.writeFileSync(
      summaryPath,
      `${JSON.stringify(
        {
          totalTarget: target.length,
          ok,
          fail,
          changed,
          remainingPending: Object.values(lexicon).filter(e => !isLexiconSettled(e)).length,
          failures: failures.slice(-50),
          log: logPath,
          concurrency: opts.concurrency,
          flushEvery: opts.flushEvery
        },
        null,
        2
      )}\n`
    )
  }

  function flush(reason: string) {
    if (!dirty) return
    saveGlobalSenses(lexicon)
    dirty = false
    dirtySinceFlush = 0
    log(`  已写入 senses.json（${reason}；累计成功 ${ok}，失败 ${fail}，修正 ${changed}）`)
  }

  function progressLine() {
    const done = ok + fail
    const elapsed = (Date.now() - startedAt) / 1000
    const rate = done > 0 ? elapsed / done : 0
    const eta = rate > 0 ? Math.round((target.length - done) * rate) : 0
    log(`  进度 ${done}/${target.length} | 用时 ${elapsed.toFixed(0)}s | 约剩余 ${eta}s`)
  }

  function applyResult(r: LlmVerifyResult, elapsedMs: number) {
    if (stopping) return
    const line = {
      at: new Date().toISOString(),
      word: r.word,
      ok: r.ok,
      changed: r.changed,
      notes: r.notes,
      error: r.error
    }
    fs.appendFileSync(logPath, `${JSON.stringify(line)}\n`)

    if (!r.ok || !r.entry) {
      fail += 1
      failures.push({ word: r.word, error: r.error || 'unknown' })
      log(`✗ ${r.word}: ${r.error || 'failed'} (${elapsedMs}ms)`)
      writeSummary()
      progressLine()
      return
    }

    lexicon[r.word] = r.entry
    dirty = true
    dirtySinceFlush += 1
    ok += 1
    if (r.changed) changed += 1
    log(
      `✓ ${r.word} [${ok + fail}/${target.length}] ${r.changed ? '已修正' : '确认OK'} (${elapsedMs}ms)${r.notes ? ` — ${r.notes.slice(0, 100)}` : ''}`
    )

    if (dirtySinceFlush >= opts.flushEvery) {
      flush(`每 ${opts.flushEvery} 条`)
    }
    writeSummary()
    progressLine()
  }

  const onSignal = (sig: string) => {
    if (stopping) return
    stopping = true
    log(`\n收到 ${sig}，正在落盘后退出…`)
    flush(`收到 ${sig}`)
    writeSummary()
    process.exit(fail ? 1 : 0)
  }
  process.once('SIGINT', () => onSignal('SIGINT'))
  process.once('SIGTERM', () => onSignal('SIGTERM'))

  try {
    if (usePool) {
      const items = target
        .map(word => ({ word, entry: lexicon[word] }))
        .filter(it => it.entry && !isLexiconSettled(it.entry)) as Array<{
        word: string
        entry: GlobalSense
      }>

      await mapPool(items, opts.concurrency, async (item, index) => {
        if (stopping) return
        log(`→ 正在校验 [${index + 1}/${items.length}] ${item.word} …`)
        const t0 = Date.now()
        // 用启动时快照，避免并发读到半更新对象；写回只在 applyResult
        const snapshot = item.entry
        const result = await verifyOneWordWithLlm(item.word, snapshot)
        if (stopping) return
        applyResult(result, Date.now() - t0)
        if (opts.delayMs > 0) await sleep(opts.delayMs)
      })
    } else {
      for (let i = 0; i < target.length; i += opts.batch) {
        if (stopping) break
        const chunk = target.slice(i, i + opts.batch)
        const items = chunk
          .map(word => ({ word, entry: lexicon[word] }))
          .filter(it => it.entry && !isLexiconSettled(it.entry)) as Array<{
          word: string
          entry: GlobalSense
        }>
        if (!items.length) continue

        const label = items.map(x => x.word).join(', ')
        const idx = Math.min(i + items.length, target.length)
        log(`→ 正在校验 [${idx}/${target.length}] ${label} …`)

        const t0 = Date.now()
        const results =
          items.length === 1
            ? [await verifyOneWordWithLlm(items[0].word, items[0].entry)]
            : await verifyBatchWithLlm(items)
        const ms = Date.now() - t0

        for (const r of results) {
          applyResult(r, ms)
        }

        if (i + opts.batch < target.length && opts.delayMs > 0) {
          await sleep(opts.delayMs)
        }
      }
    }
  } finally {
    flush('结束')
    writeSummary()
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('SIGTERM')
  }

  log(`\n完成：成功 ${ok}，失败 ${fail}，其中修正 ${changed}`)
  log(`日志: ${logPath}`)
  log(`摘要: ${summaryPath}`)
  log(`词典: ${sensesFilePath()}`)
  if (fail) process.exitCode = 1
}

function reportPending(limit: number) {
  clearSensesCache()
  const lexicon = loadGlobalSenses()
  const words = Object.keys(lexicon).sort()

  const pending: Array<{ word: string; missing: string[]; entry: GlobalSense }> = []
  let settled = 0
  let llm = 0
  let verified = 0
  for (const word of words) {
    const entry = lexicon[word]
    if (entry.status === 'llm') llm += 1
    if (entry.status === 'verified') verified += 1
    if (isLexiconSettled(entry)) {
      settled += 1
      continue
    }
    pending.push({ word, missing: missingLexiconFields(entry), entry })
  }

  const slice = limit > 0 ? pending.slice(0, limit) : pending
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const reportPath = path.join(REPORT_DIR, 'lexicon-pending.json')
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        total: words.length,
        settled,
        llm,
        verified,
        pending: pending.length,
        sample: slice.map(p => {
          const flat = asFlatSense(p.entry)
          return {
            word: p.word,
            missing: p.missing,
            meaning: flat.meaning,
            topic: flat.topic,
            level: flat.cefr,
            origin: flat.origin
          }
        })
      },
      null,
      2
    )}\n`
  )

  console.log(
    `全局词典 ${words.length} 条：llm ${llm}, verified ${verified}, pending ${pending.length}`
  )
  console.log(`报告: ${reportPath}`)
  for (const row of slice.slice(0, 30)) {
    const flat = asFlatSense(row.entry)
    console.log(
      `  ${row.word}: missing=[${row.missing.join(',') || '-'}] topic=${flat.topic || '-'} level=${flat.cefr || '-'}`
    )
  }
  if (pending.length > 30 && !limit) {
    console.log(`  ... 另有 ${pending.length - 30} 个 pending`)
  }
}

function markVerified(markWords: string[]) {
  clearSensesCache()
  const lexicon = loadGlobalSenses()
  let n = 0
  for (const w of markWords) {
    const key = w.trim().toLowerCase()
    if (!lexicon[key]) {
      console.warn(`跳过未知词: ${w}`)
      continue
    }
    lexicon[key] = { ...lexicon[key], status: 'verified' }
    n += 1
  }
  saveGlobalSenses(lexicon)
  console.log(`已标记 verified: ${n} 条 → ${sensesFilePath()}`)
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

async function main() {
  const args = process.argv.slice(2).filter(a => !a.endsWith('.ts'))
  const llm = args.includes('--llm')
  const limit = parsePositiveInt(
    args.indexOf('--limit') >= 0 ? args[args.indexOf('--limit') + 1] : undefined,
    0
  )
  const batchRaw = parsePositiveInt(
    args.indexOf('--batch') >= 0 ? args[args.indexOf('--batch') + 1] : undefined,
    1
  )
  const batch = Math.min(5, Math.max(1, batchRaw))
  const delayMs =
    args.indexOf('--delay') >= 0
      ? Math.max(0, Number(args[args.indexOf('--delay') + 1]) || 0)
      : 200
  const concurrencyRaw = parsePositiveInt(
    args.indexOf('--concurrency') >= 0
      ? args[args.indexOf('--concurrency') + 1]
      : args.indexOf('-c') >= 0
        ? args[args.indexOf('-c') + 1]
        : undefined,
    // --llm 默认开并发 5；仅报告/标记时不会走到这里
    5
  )
  const concurrency = Math.min(10, Math.max(1, concurrencyRaw))
  const flushEvery = parsePositiveInt(
    args.indexOf('--flush') >= 0 ? args[args.indexOf('--flush') + 1] : undefined,
    25
  )
  const markIdx = args.indexOf('--mark-verified')
  const markWords =
    markIdx >= 0
      ? args.slice(markIdx + 1).filter(a => !a.startsWith('-') && a !== String(limit) && a !== String(batch))
      : []

  if (markWords.length) {
    markVerified(markWords)
    return
  }

  if (llm) {
    await runLlmVerify({ limit, batch, delayMs, concurrency, flushEvery })
    return
  }

  reportPending(limit)
  console.log('\n大模型自动校验：npm run cidian:jiaoyan -- --llm')
  console.log('可选：--concurrency 8（默认5，最大10） --flush 25 --batch 5 --limit 20 --delay 200')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
