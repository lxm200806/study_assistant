import { seedChineseIfEmpty } from './chinese/materials'
import { ensureAdminUser } from './services/admin-seed.service'
import { initBooks } from './services/book.service'
import { initVocabulary } from './utils/seed'
import { ensureBillingPlansOnce } from './services/billing.service'
import { backfillLegacyPremiumGrants } from './entitlements/seed'

export interface BootState {
  ready: boolean
  startedAt: string
  finishedAt: string | null
  errors: string[]
}

const state: BootState = {
  ready: false,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  errors: []
}

export function getBootState(): BootState {
  return state
}

async function runStep(name: string, task: () => Promise<unknown>): Promise<void> {
  try {
    await task()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    state.errors.push(`${name}: ${message}`)
    console.error(`[boot] ${name} failed:`, error)
  }
}

/**
 * 启动后的内容同步。各步骤相互独立，单步失败不会阻断其余内容，
 * 失败信息会通过 /ready 暴露出来。
 */
export async function bootstrap(): Promise<void> {
  await runStep('admin', () => ensureAdminUser())
  await runStep('vocabulary', () => initVocabulary())
  await runStep('books', async () => {
    const result = await initBooks()
    if (result.failures.length > 0) {
      state.errors.push(`books: ${result.failures.map(item => item.code).join(', ')}`)
    }
  })
  await runStep('chinese', () => seedChineseIfEmpty())
  await runStep('billing', () => ensureBillingPlansOnce())
  await runStep('entitlements', () => backfillLegacyPremiumGrants())
  state.ready = true
  state.finishedAt = new Date().toISOString()
}
