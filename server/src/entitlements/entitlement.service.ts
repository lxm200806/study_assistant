import { Prisma } from '@prisma/client'
import prisma from '../prisma/client'
import { runSerializable } from '../prisma/tx'
import { TtlCache } from '../utils/ttl-cache'
import { PERMISSIONS_CATALOG, type PermissionKey } from './permissions'

export interface PermissionRule {
  key: string
  kind: string
  unit: string | null
  limitValue: number | null
  period: string | null
}

export interface EffectivePermission extends PermissionRule {
  active: boolean
  expiresAt: Date | null
  used: number
  remaining: number | null
  sources: string[]
}

export interface EntitlementsSnapshot {
  accountId: string
  isAdmin: boolean
  permissions: Record<string, EffectivePermission>
  subscriptions: Array<{
    id: string
    planCode: string
    planName: string
    subject: string
    kind: string
    endsAt: Date
    autoRenew: boolean
  }>
  credits: { balance: number }
  legacyPlan: { plan: string; expiresAt: Date | null }
}

export interface PlanActivation {
  code: string
  name: string
  kind: string
  subject: string
  groupKey: string | null
  days: number
  priceCents: number
  creditAmount: number
  permissions: Array<{
    permissionKey: string
    limitValue: number | null
    period: string | null
  }>
}

interface GrantRecord {
  permissionKey: string
  sourceType: string
  endsAt: Date | null
  limitValue: number | null
  period: string | null
}

interface GrantInput {
  permissionKey: PermissionKey | string
  endsAt?: Date | null
  limitValue?: number | null
  period?: string | null
  metadata?: Record<string, unknown>
}

const freeRulesCache = new TtlCache<string, PermissionRule[]>(60_000)
const freeKeysCache = new TtlCache<string, Set<string>>(60_000)

export function clearEntitlementCaches(): void {
  freeRulesCache.clear()
  freeKeysCache.clear()
}

/** 免费套餐的权限是隐式基线，不落授权记录；付费授权覆盖同名权限。 */
export async function getFreePlanRules(): Promise<PermissionRule[]> {
  const cached = freeRulesCache.get('free')
  if (cached) return cached

  const plan = await prisma.membershipPlan.findUnique({
    where: { code: 'free' },
    include: {
      permissions: {
        include: { permission: { select: { key: true, kind: true, unit: true, active: true } } }
      }
    }
  })
  const rules: PermissionRule[] = (plan?.permissions || [])
    .filter(row => row.permission.active)
    .map(row => ({
      key: row.permission.key,
      kind: row.permission.kind,
      unit: row.permission.unit,
      limitValue: row.limitValue,
      period: row.period
    }))
  freeRulesCache.set('free', rules)
  freeKeysCache.set('free', new Set(rules.map(rule => rule.key)))
  return rules
}

async function getFreePermissionKeys(): Promise<Set<string>> {
  const cached = freeKeysCache.get('free')
  if (cached) return cached
  await getFreePlanRules()
  return freeKeysCache.get('free') || new Set()
}

export function periodKeyFor(period: string | null | undefined, now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  if (period === 'month') return `${year}-${month}`
  if (period === 'day') return `${year}-${month}-${day}`
  return 'total'
}

function isActiveGrant(grant: GrantRecord, now: Date): boolean {
  return !grant.endsAt || grant.endsAt > now
}

function pickLimit(grants: GrantRecord[]): { limitValue: number | null; period: string | null } {
  if (grants.some(grant => grant.limitValue == null)) {
    return { limitValue: null, period: grants.find(grant => grant.limitValue == null)?.period || null }
  }
  return grants.reduce(
    (best, grant) => {
      if (best.limitValue == null || (grant.limitValue ?? 0) > best.limitValue) {
        return { limitValue: grant.limitValue, period: grant.period }
      }
      return best
    },
    { limitValue: grants[0]?.limitValue ?? null, period: grants[0]?.period ?? null } as {
      limitValue: number | null
      period: string | null
    }
  )
}

function mergeExpiry(grants: GrantRecord[]): Date | null {
  if (grants.some(grant => grant.endsAt == null)) return null
  const latest = grants.reduce<Date | null>(
    (max, grant) => (!max || (grant.endsAt && grant.endsAt > max) ? grant.endsAt : max),
    null
  )
  return latest
}

/**
 * 账号级最终权限：免费套餐基线 + 有效授权（付费/赠送/试用），
 * 付费授权覆盖同名免费权限；管理员拥有所有权限。
 */
export async function getEntitlements(accountId: string): Promise<EntitlementsSnapshot> {
  const now = new Date()
  const user = await prisma.user.findUnique({
    where: { id: accountId },
    select: { isAdmin: true, plan: true, planExpiresAt: true }
  })
  if (!user) {
    return {
      accountId,
      isAdmin: false,
      permissions: {},
      subscriptions: [],
      credits: { balance: 0 },
      legacyPlan: { plan: 'free', expiresAt: null }
    }
  }

  if (user.isAdmin) {
    const permissions: Record<string, EffectivePermission> = {}
    for (const permission of PERMISSIONS_CATALOG) {
      permissions[permission.key] = {
        key: permission.key,
        kind: permission.kind,
        unit: permission.unit ?? null,
        limitValue: null,
        period: null,
        active: true,
        expiresAt: null,
        used: 0,
        remaining: null,
        sources: ['admin']
      }
    }
    const subscriptions = await activeSubscriptions(accountId, now)
    const wallet = await prisma.creditWallet.findUnique({ where: { accountId } })
    return {
      accountId,
      isAdmin: true,
      permissions,
      subscriptions,
      credits: { balance: wallet?.balance || 0 },
      legacyPlan: { plan: user.plan, expiresAt: user.planExpiresAt }
    }
  }

  const [freeRules, grants, subscriptions, wallet] = await Promise.all([
    getFreePlanRules(),
    prisma.entitlementGrant.findMany({
      where: {
        accountId,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }]
      }
    }),
    activeSubscriptions(accountId, now),
    prisma.creditWallet.findUnique({ where: { accountId } })
  ])

  const freeByKey = new Map(freeRules.map(rule => [rule.key, rule]))
  const catalogByKey = new Map(PERMISSIONS_CATALOG.map(permission => [permission.key, permission]))
  const grantsByKey = new Map<string, GrantRecord[]>()
  for (const grant of grants) {
    if (!isActiveGrant(grant, now)) continue
    const list = grantsByKey.get(grant.permissionKey) || []
    list.push(grant)
    grantsByKey.set(grant.permissionKey, list)
  }

  const permissions: Record<string, EffectivePermission> = {}
  for (const free of freeRules) {
    permissions[free.key] = {
      ...free,
      active: true,
      expiresAt: null,
      used: 0,
      remaining: free.limitValue == null ? null : free.limitValue,
      sources: ['free']
    }
  }

  for (const [key, keyGrants] of grantsByKey) {
    const paid = keyGrants.filter(grant => grant.sourceType !== 'free')
    if (!paid.length) continue
    const permission = catalogByKey.get(key as PermissionKey)
    const freeRule = freeByKey.get(key)
    const { limitValue, period } = pickLimit(paid)
    permissions[key] = {
      key,
      kind: permission?.kind || freeRule?.kind || 'access',
      unit: permission?.unit || freeRule?.unit || null,
      limitValue,
      period,
      active: true,
      expiresAt: mergeExpiry(paid),
      used: 0,
      remaining: limitValue == null ? null : limitValue,
      sources: [...new Set(paid.map(grant => grant.sourceType))]
    }
  }

  await attachUsage(accountId, permissions, now)

  return {
    accountId,
    isAdmin: false,
    permissions,
    subscriptions,
    credits: { balance: wallet?.balance || 0 },
    legacyPlan: { plan: user.plan, expiresAt: user.planExpiresAt }
  }
}

async function activeSubscriptions(accountId: string, now: Date) {
  const rows = await prisma.subscription.findMany({
    where: { accountId, status: 'active', endsAt: { gt: now } },
    orderBy: { endsAt: 'desc' },
    include: { plan: { select: { name: true, subject: true, kind: true } } }
  })
  return rows.map(row => ({
    id: row.id,
    planCode: row.planCode,
    planName: row.plan.name,
    subject: row.plan.subject,
    kind: row.plan.kind,
    endsAt: row.endsAt,
    autoRenew: row.autoRenew
  }))
}

async function attachUsage(
  accountId: string,
  permissions: Record<string, EffectivePermission>,
  now: Date
): Promise<void> {
  const quotaRows = Object.values(permissions).filter(
    permission => permission.active && permission.limitValue != null
  )
  if (!quotaRows.length) return

  const periodKeys = new Set(quotaRows.map(permission => periodKeyFor(permission.period, now)))
  const counters = await prisma.usageCounter.findMany({
    where: { accountId, scopeId: 'account', periodKey: { in: [...periodKeys] } }
  })
  const usedByKey = new Map(
    counters.map(counter => [`${counter.permissionKey}:${counter.periodKey}`, counter.used])
  )

  for (const permission of quotaRows) {
    const periodKey = periodKeyFor(permission.period, now)
    const used = usedByKey.get(`${permission.key}:${periodKey}`) || 0
    permission.used = used
    permission.remaining =
      permission.limitValue == null ? null : Math.max(0, permission.limitValue - used)
  }
}

export async function hasPermission(accountId: string, permissionKey: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: accountId },
    select: { isAdmin: true }
  })
  if (!user) return false
  if (user.isAdmin) return true

  const now = new Date()
  const grant = await prisma.entitlementGrant.findFirst({
    where: {
      accountId,
      permissionKey,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }]
    },
    select: { id: true }
  })
  if (grant) return true

  const freeKeys = await getFreePermissionKeys()
  return freeKeys.has(permissionKey)
}

export async function assertPermission(accountId: string, permissionKey: string): Promise<void> {
  if (await hasPermission(accountId, permissionKey)) return
  const error = new Error('需要开通相应会员') as Error & {
    status: number
    code: string
    permission: string
  }
  error.status = 403
  error.code = 'PERMISSION_DENIED'
  error.permission = permissionKey
  throw error
}

export async function grantPermissions(
  accountId: string,
  grants: GrantInput[],
  options: { sourceType?: string; sourceId?: string } = {}
): Promise<void> {
  if (!grants.length) return
  await prisma.entitlementGrant.createMany({
    data: grants.map(grant => ({
      accountId,
      permissionKey: grant.permissionKey,
      sourceType: options.sourceType || 'admin',
      sourceId: options.sourceId || null,
      endsAt: grant.endsAt ?? null,
      limitValue: grant.limitValue ?? null,
      period: grant.period ?? null,
      metadata: (grant.metadata || {}) as Prisma.InputJsonValue
    }))
  })
}

export async function revokePermissions(
  accountId: string,
  filter: { permissionKey?: string; sourceType?: string; sourceId?: string }
): Promise<number> {
  const where: Prisma.EntitlementGrantWhereInput = { accountId }
  if (filter.permissionKey) where.permissionKey = filter.permissionKey
  if (filter.sourceType) where.sourceType = filter.sourceType
  if (filter.sourceId) where.sourceId = filter.sourceId
  const result = await prisma.entitlementGrant.deleteMany({ where })
  return result.count
}

function planSnapshot(plan: PlanActivation): Prisma.InputJsonValue {
  return {
    code: plan.code,
    name: plan.name,
    kind: plan.kind,
    subject: plan.subject,
    groupKey: plan.groupKey,
    days: plan.days,
    priceCents: plan.priceCents,
    creditAmount: plan.creditAmount,
    permissions: plan.permissions
  } as Prisma.InputJsonValue
}

/**
 * 在订单事务内授予套餐权限。同 groupKey 的订阅从当前到期时间续期。
 * credit 套餐只增加点数，不创建订阅。
 */
export async function activatePlanInTx(
  tx: Prisma.TransactionClient,
  accountId: string,
  plan: PlanActivation,
  options: { source?: string; orderId?: string; now?: Date } = {}
): Promise<string | null> {
  const now = options.now || new Date()
  let subscriptionId: string | null = null
  let endsAt = new Date(now.getTime() + Math.max(0, plan.days) * 86_400_000)

  if (plan.kind !== 'credit') {
    if (plan.groupKey) {
      const current = await tx.subscription.findFirst({
        where: {
          accountId,
          status: 'active',
          endsAt: { gt: now },
          plan: { groupKey: plan.groupKey }
        },
        orderBy: { endsAt: 'desc' },
        select: { endsAt: true }
      })
      if (current) endsAt = new Date(current.endsAt.getTime() + plan.days * 86_400_000)
    }
    const subscription = await tx.subscription.create({
      data: {
        accountId,
        planCode: plan.code,
        status: 'active',
        startsAt: now,
        endsAt,
        source: options.source || 'order',
        orderId: options.orderId || null,
        snapshot: planSnapshot(plan)
      }
    })
    subscriptionId = subscription.id

    await tx.entitlementGrant.createMany({
      data: plan.permissions.map(permission => ({
        accountId,
        permissionKey: permission.permissionKey,
        sourceType: plan.kind === 'beta' ? 'beta' : 'subscription',
        sourceId: subscription.id,
        startsAt: now,
        endsAt,
        limitValue: permission.limitValue,
        period: permission.period,
        metadata: { planCode: plan.code, orderId: options.orderId || null } as Prisma.InputJsonValue
      }))
    })
  } else {
    if (plan.creditAmount > 0) {
      await addCreditsInTx(tx, accountId, plan.creditAmount, 'grant', options.orderId, {
        planCode: plan.code
      })
    }
    await tx.entitlementGrant.createMany({
      data: plan.permissions.map(permission => ({
        accountId,
        permissionKey: permission.permissionKey,
        sourceType: 'credit',
        sourceId: options.orderId || null,
        startsAt: now,
        endsAt: null,
        limitValue: null,
        period: null,
        metadata: { planCode: plan.code, orderId: options.orderId || null } as Prisma.InputJsonValue
      }))
    })
  }

  if (plan.subject === 'english' && plan.kind === 'subscription') {
    const user = await tx.user.findUnique({
      where: { id: accountId },
      select: { planExpiresAt: true }
    })
    const current = user?.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now
    const nextExpiry = new Date(Math.max(current.getTime(), endsAt.getTime()))
    await tx.user.update({
      where: { id: accountId },
      data: { plan: 'premium', planExpiresAt: nextExpiry }
    })
  }

  return subscriptionId
}

export async function addCredits(
  accountId: string,
  amount: number,
  reason: string,
  refId?: string,
  metadata?: Record<string, unknown>
): Promise<number> {
  return prisma.$transaction(tx => addCreditsInTx(tx, accountId, amount, reason, refId, metadata))
}

export async function addCreditsInTx(
  tx: Prisma.TransactionClient,
  accountId: string,
  amount: number,
  reason: string,
  refId?: string,
  metadata?: Record<string, unknown>
): Promise<number> {
  const delta = Math.floor(amount)
  if (!Number.isFinite(delta) || delta === 0) {
    const wallet = await tx.creditWallet.findUnique({ where: { accountId } })
    return wallet?.balance || 0
  }
  const wallet = await tx.creditWallet.upsert({
    where: { accountId },
    create: { accountId, balance: delta },
    update: { balance: { increment: delta } }
  })
  await tx.creditLedger.create({
    data: {
      accountId,
      delta,
      reason,
      refId: refId || null,
      metadata: (metadata || {}) as Prisma.InputJsonValue
    }
  })
  return wallet.balance
}

export async function consumeCredits(
  accountId: string,
  amount: number,
  reason: string,
  options: { permissionKey?: string; learnerId?: string; refId?: string; metadata?: Record<string, unknown> } = {}
): Promise<number> {
  const cost = Math.floor(amount)
  if (cost <= 0) throw new Error('INVALID_CREDIT_AMOUNT')
  return prisma.$transaction(async tx => {
    const updated = await tx.creditWallet.updateMany({
      where: { accountId, balance: { gte: cost } },
      data: { balance: { decrement: cost } }
    })
    if (updated.count === 0) throw new Error('INSUFFICIENT_CREDITS')
    await tx.creditLedger.create({
      data: {
        accountId,
        delta: -cost,
        reason,
        permissionKey: options.permissionKey || null,
        learnerId: options.learnerId || null,
        refId: options.refId || null,
        metadata: (options.metadata || {}) as Prisma.InputJsonValue
      }
    })
    const wallet = await tx.creditWallet.findUniqueOrThrow({ where: { accountId } })
    return wallet.balance
  })
}

export async function getCreditBalance(accountId: string): Promise<number> {
  const wallet = await prisma.creditWallet.findUnique({
    where: { accountId },
    select: { balance: true }
  })
  return wallet?.balance || 0
}

/**
 * 消耗配额（每日/每月次数）。limit 为空视为不限量。
 * 计数与额度判断在 serializable 事务内完成，避免并发绕过。
 */
export async function refundQuota(
  accountId: string,
  permissionKey: string,
  amount = 1,
  options: { scopeId?: string; period?: string | null } = {}
): Promise<void> {
  const snapshot = await getEntitlements(accountId)
  const permission = snapshot.permissions[permissionKey]
  if (!permission?.active) return
  const periodKey = periodKeyFor(options.period ?? permission.period)
  const scopeId = options.scopeId || 'account'
  await prisma.usageCounter.updateMany({
    where: {
      accountId,
      scopeId,
      permissionKey,
      periodKey,
      used: { gte: amount }
    },
    data: { used: { decrement: amount } }
  })
}

export async function consumeQuota(
  accountId: string,
  permissionKey: string,
  amount = 1,
  options: { scopeId?: string; period?: string | null } = {}
): Promise<{ used: number; remaining: number | null }> {
  const snapshot = await getEntitlements(accountId)
  const permission = snapshot.permissions[permissionKey]
  if (!permission?.active) throw new Error('PERMISSION_DENIED')

  const period = options.period ?? permission.period
  const periodKey = periodKeyFor(period)
  const scopeId = options.scopeId || 'account'
  const limit = permission.limitValue

  const result = await runSerializable(async tx => {
    const existing = await tx.usageCounter.findUnique({
      where: {
        accountId_scopeId_permissionKey_periodKey: {
          accountId,
          scopeId,
          permissionKey,
          periodKey
        }
      }
    })
    const used = existing?.used || 0
    if (limit != null && used + amount > limit) {
      throw new Error('QUOTA_EXCEEDED')
    }
    const updated = await tx.usageCounter.upsert({
      where: {
        accountId_scopeId_permissionKey_periodKey: {
          accountId,
          scopeId,
          permissionKey,
          periodKey
        }
      },
      create: { accountId, scopeId, permissionKey, periodKey, used: amount },
      update: { used: { increment: amount } }
    })
    return updated.used
  })

  return {
    used: result,
    remaining: limit == null ? null : Math.max(0, limit - result)
  }
}
