/**
 * 用大模型逐词校验 / 补全 / 修正全局词典条目。
 * 通过后 status = llm。
 */
import {
  normalizeLexiconStatus,
  normalizeSenseEntry,
  type GlobalSense
} from '../../src/data/vocabulary/senses'
import { TOPIC_CATEGORIES, normalizeTopic } from '../../src/data/taxonomy'
import { getLlmApiKey, getLlmBaseUrl, getLlmModel } from '../../src/services/llm-config.service'

const TOPIC_IDS = TOPIC_CATEGORIES.map(t => t.id)
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export interface LlmVerifyResult {
  word: string
  ok: boolean
  changed: boolean
  notes: string
  entry?: GlobalSense
  error?: string
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return m ? m[1].trim() : trimmed
}

function extractJson(text: string): unknown {
  const cleaned = stripCodeFence(text)
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    throw new Error('模型未返回合法 JSON')
  }
}

function buildSystemPrompt(): string {
  return [
    '你是英语学习词典编辑。请校验并必要时修正一个英文词条，面向中国学习者。',
    '规则：',
    '1. 先看字段是否齐全；缺则补上。有则判断是否正确、合适；不对则改成合适内容。',
    '2. 必须有中文释义 meaning.zh、英文释义 meaning.en，简洁准确。',
    '3. 至少一条 role=basic 的例句（en+zh），例句必须包含该单词（或常见变形），且贴合该义项。',
    '4. 尽量再给一条 role=ext 的稍难/应用例句（en+zh）。',
    '5. 音标用 IPA，放在 phonetic.uk / phonetic.us；若英美相同可只填 phonetic.g，两侧也可同时填相同值。',
    '6. topic 只能从给定列表选一个最贴切的 id。',
    '7. level 只能是 A1 A2 B1 B2 C1 C2 之一。',
    '8. pos 可选（如 n. / v. / adj.）。',
    '9. 不要编造与单词无关的内容；不要输出除 JSON 外的文字。',
    '',
    `可选 topic：${TOPIC_IDS.join(', ')}`,
    `可选 level：${LEVELS.join(', ')}`,
    '',
    '只输出一个 JSON 对象，格式：',
    '{',
    '  "changed": boolean,',
    '  "notes": string,',
    '  "entry": {',
    '    "meanings": [{"pos":"v.","meaning":{"zh":"...","en":"..."},"sentences":[{"en":"...","zh":"...","role":"basic|ext"}]}],',
    '    "phonetic": {"uk":"/.../","us":"/.../"} 或 {"g":"/.../"},',
    '    "topic": "daily",',
    '    "level": "A2"',
    '  }',
    '}'
  ].join('\n')
}

const LLM_TIMEOUT_MS = 30_000
const LLM_RETRIES = 2 // 共 3 次（1 次首次 + 2 次重试）

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; message?: string }
  return e.name === 'AbortError' || /aborted|timeout/i.test(String(e.message || ''))
}

async function chatJson(userContent: string, retries = LLM_RETRIES): Promise<any> {
  const apiKey = getLlmApiKey()
  if (!apiKey) throw new Error('缺少 OPENAI_API_KEY / DEEPSEEK_API_KEY（请写在 server/.env）')

  const url = `${getLlmBaseUrl()}/chat/completions`
  const model = getLlmModel()
  let lastErr: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)
    const t0 = Date.now()
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: userContent }
          ]
        })
      })
      const rawText = await res.text()
      if (!res.ok) {
        throw new Error(`LLM HTTP ${res.status}: ${rawText.slice(0, 300)}`)
      }
      const data = JSON.parse(rawText) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = data.choices?.[0]?.message?.content
      if (!content?.trim()) throw new Error('LLM 返回空内容')
      return extractJson(content)
    } catch (err) {
      const elapsed = Date.now() - t0
      if (isAbortError(err)) {
        lastErr = new Error(`LLM 超时（>${LLM_TIMEOUT_MS}ms，实际 ${elapsed}ms）`)
      } else {
        lastErr = err instanceof Error ? err : new Error(String(err))
      }
      if (attempt < retries) {
        const wait = 800 * (attempt + 1)
        process.stdout.write(
          `  ↻ 第 ${attempt + 1} 次失败：${lastErr.message}，${wait}ms 后重试（${attempt + 2}/${retries + 1}）\n`
        )
        await new Promise(r => setTimeout(r, wait))
      }
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr || new Error('LLM 调用失败')
}

function finalizeEntry(word: string, rawEntry: unknown, prev: GlobalSense): GlobalSense {
  const normalized = normalizeSenseEntry({
    ...(typeof rawEntry === 'object' && rawEntry ? rawEntry : {}),
    status: 'llm',
    origin: prev.origin || 'llm-verify'
  })

  if (!normalized.meanings.length) {
    throw new Error(`${word}: 模型未返回 meanings`)
  }
  const m0 = normalized.meanings[0]
  if (!m0.meaning?.zh?.trim() || !m0.meaning?.en?.trim()) {
    throw new Error(`${word}: 缺少中/英释义`)
  }
  // 模型偶尔漏写 role：有句子则第一条当 basic
  if (!m0.sentences.some(s => s.role === 'basic' && s.en.trim()) && m0.sentences[0]?.en?.trim()) {
    m0.sentences[0] = { ...m0.sentences[0], role: 'basic' }
  }
  // 仍无例句时：沿用旧 basic（避免因模型漏句整条失败）
  if (!m0.sentences.some(s => s.role === 'basic' && s.en.trim())) {
    const prevBasic = prev.meanings?.[0]?.sentences?.find(s => s.role === 'basic' && s.en.trim())
    if (prevBasic) m0.sentences.unshift({ ...prevBasic, role: 'basic' })
  }
  if (!m0.sentences.some(s => s.role === 'basic' && s.en.trim())) {
    throw new Error(`${word}: 缺少 basic 例句`)
  }
  if (!normalized.phonetic || !(normalized.phonetic.g || normalized.phonetic.uk || normalized.phonetic.us)) {
    const prevPh = prev.phonetic
    if (prevPh && (prevPh.g || prevPh.uk || prevPh.us)) normalized.phonetic = prevPh
  }
  if (!normalized.phonetic || !(normalized.phonetic.g || normalized.phonetic.uk || normalized.phonetic.us)) {
    throw new Error(`${word}: 缺少音标`)
  }
  normalized.topic = normalizeTopic(String(normalized.topic || prev.topic || 'uncategorized'))
  const level = String(normalized.level || prev.level || '').toUpperCase()
  if (!LEVELS.includes(level as (typeof LEVELS)[number])) {
    throw new Error(`${word}: level 非法 ${normalized.level || prev.level}`)
  }
  normalized.level = level
  normalized.status = 'llm'
  return normalized
}

/** 校验并修正单个词 */
export async function verifyOneWordWithLlm(word: string, entry: GlobalSense): Promise<LlmVerifyResult> {
  try {
    const payload = {
      word,
      current: {
        meanings: entry.meanings,
        phonetic: entry.phonetic,
        topic: entry.topic,
        level: entry.level,
        contentType: entry.contentType
      }
    }
    const parsed = await chatJson(
      `请校验并修正下列词条（必要时补全/改正）。单词：${word}\n${JSON.stringify(payload, null, 2)}`
    )
    const next = finalizeEntry(word, parsed?.entry ?? parsed, entry)
    const changed =
      typeof parsed?.changed === 'boolean'
        ? parsed.changed
        : JSON.stringify(normalizeSenseEntry({ ...entry, status: 'pending' })) !==
          JSON.stringify(normalizeSenseEntry({ ...next, status: 'pending' }))
    return {
      word,
      ok: true,
      changed,
      notes: String(parsed?.notes || ''),
      entry: next
    }
  } catch (err) {
    return {
      word,
      ok: false,
      changed: false,
      notes: '',
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

/** 一次最多 5 个词；失败则回退逐词 */
export async function verifyBatchWithLlm(
  items: Array<{ word: string; entry: GlobalSense }>
): Promise<LlmVerifyResult[]> {
  if (items.length <= 1) {
    const one = items[0]
    return one ? [await verifyOneWordWithLlm(one.word, one.entry)] : []
  }

  try {
    const payload = {
      words: items.map(({ word, entry }) => ({
        word,
        current: {
          meanings: entry.meanings,
          phonetic: entry.phonetic,
          topic: entry.topic,
          level: entry.level
        }
      }))
    }
    const parsed = await chatJson(
      [
        `请校验并修正下列 ${items.length} 个词条。`,
        '只输出 JSON：{"results":[{"word":"...","changed":true,"notes":"...","entry":{...}}]}',
        '每个 word 都必须有对应结果。',
        JSON.stringify(payload)
      ].join('\n')
    )
    const results = Array.isArray(parsed?.results) ? parsed.results : []
    const byWord = new Map<string, any>()
    for (const row of results) {
      if (row?.word) byWord.set(String(row.word).toLowerCase(), row)
    }

    const out: LlmVerifyResult[] = []
    for (const { word, entry } of items) {
      const row = byWord.get(word.toLowerCase())
      if (!row?.entry) {
        out.push(await verifyOneWordWithLlm(word, entry))
        continue
      }
      try {
        const next = finalizeEntry(word, row.entry, entry)
        out.push({
          word,
          ok: true,
          changed: !!row.changed,
          notes: String(row.notes || ''),
          entry: next
        })
      } catch (err) {
        out.push(await verifyOneWordWithLlm(word, entry))
      }
    }
    return out
  } catch {
    const out: LlmVerifyResult[] = []
    for (const item of items) {
      out.push(await verifyOneWordWithLlm(item.word, item.entry))
    }
    return out
  }
}

export function assertLlmConfigured() {
  if (!getLlmApiKey()) {
    throw new Error('未配置 LLM：请在 server/.env 设置 OPENAI_API_KEY（及 LLM_BASE_URL / LLM_MODEL）')
  }
  return {
    baseUrl: getLlmBaseUrl(),
    model: getLlmModel()
  }
}

export { normalizeLexiconStatus }
