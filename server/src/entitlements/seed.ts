import prisma from '../prisma/client'
import { PERMISSIONS_CATALOG, PLAN_SEEDS, type PlanSeed } from './permissions'

let catalogSeedPromise: Promise<void> | null = null

/**
 * 初始化权限目录、套餐和套餐权限映射。
 * 价格/天数/active 只在首次创建时写入；已有套餐保留后台配置。
 * PlanPermission 以代码为准同步（已购授权另存快照，不受影响）。
 */
export async function seedEntitlementCatalog(): Promise<void> {
  for (const permission of PERMISSIONS_CATALOG) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: {
        key: permission.key,
        name: permission.name,
        subject: permission.subject,
        groupKey: permission.groupKey,
        kind: permission.kind,
        unit: permission.unit ?? null,
        description: permission.description,
        active: true
      },
      update: {
        name: permission.name,
        subject: permission.subject,
        groupKey: permission.groupKey,
        kind: permission.kind,
        unit: permission.unit ?? null,
        description: permission.description,
        active: true
      }
    })
  }

  // 旧版会员套餐不再售卖，历史订单保留。
  await prisma.membershipPlan.updateMany({
    where: { code: { in: ['premium_month', 'premium_year'] } },
    data: { active: false, kind: 'subscription', subject: 'english', groupKey: 'legacy' }
  })

  for (const plan of PLAN_SEEDS) {
    await prisma.membershipPlan.upsert({
      where: { code: plan.code },
      create: planCreateData(plan),
      update: {
        name: plan.name,
        kind: plan.kind,
        subject: plan.subject,
        groupKey: plan.groupKey ?? null,
        description: plan.description ?? '',
        sortOrder: plan.sortOrder
      }
    })

    await prisma.planPermission.deleteMany({ where: { planCode: plan.code } })
    await prisma.planPermission.createMany({
      data: plan.permissions.map(permission => ({
        planCode: plan.code,
        permissionKey: permission.key,
        limitValue: permission.limitValue ?? null,
        period: permission.period ?? null
      }))
    })
  }
}

export function seedEntitlementCatalogOnce(): Promise<void> {
  if (!catalogSeedPromise) {
    catalogSeedPromise = seedEntitlementCatalog().catch(error => {
      catalogSeedPromise = null
      throw error
    })
  }
  return catalogSeedPromise
}

function planCreateData(plan: PlanSeed) {
  return {
    code: plan.code,
    name: plan.name,
    kind: plan.kind,
    subject: plan.subject,
    groupKey: plan.groupKey ?? null,
    description: plan.description ?? '',
    days: plan.days,
    priceCents: plan.priceCents,
    creditAmount: plan.creditAmount ?? 0,
    active: plan.active,
    sortOrder: plan.sortOrder
  }
}

/**
 * 把旧的 User.plan='premium' 迁移成英语全科权限授权。
 * 仅补一次，已有 legacy 授权的账号跳过；原 planExpiresAt 为空时按永久处理。
 */
export async function backfillLegacyPremiumGrants(now = new Date()): Promise<number> {
  const users = await prisma.user.findMany({
    where: {
      plan: 'premium',
      OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }]
    },
    select: { id: true, planExpiresAt: true }
  })
  if (!users.length) return 0

  const plan = PLAN_SEEDS.find(item => item.code === 'english_core_month')
  if (!plan) return 0

  const migrated = await prisma.entitlementGrant.findMany({
    where: { accountId: { in: users.map(user => user.id) }, sourceType: 'legacy' },
    select: { accountId: true },
    distinct: ['accountId']
  })
  const skipped = new Set(migrated.map(row => row.accountId))

  let created = 0
  for (const user of users) {
    if (skipped.has(user.id)) continue
    await prisma.entitlementGrant.createMany({
      data: plan.permissions.map(permission => ({
        accountId: user.id,
        permissionKey: permission.key,
        sourceType: 'legacy',
        sourceId: user.id,
        endsAt: user.planExpiresAt,
        limitValue: permission.limitValue ?? null,
        period: permission.period ?? null,
        metadata: { planCode: plan.code, migratedFrom: 'User.plan=premium' }
      }))
    })
    created += 1
  }
  return created
}
