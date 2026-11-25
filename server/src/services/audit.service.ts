import prisma from '../prisma/client'

export interface AuditInput {
  actorId?: string
  action: string
  target?: string
  detail?: Record<string, unknown>
  ip?: string
}

/** 记录管理端写操作；失败只影响审计，不阻断业务。 */
export async function auditAdminAction(input: AuditInput): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        target: String(input.target || '').slice(0, 200),
        detail: (input.detail || {}) as object,
        ip: String(input.ip || '').slice(0, 80)
      }
    })
  } catch (error) {
    console.error('[audit] failed to record admin action:', error)
  }
}

export async function listAdminAudit(page = 1, limit = 50) {
  const skip = (page - 1) * limit
  const [total, rows] = await Promise.all([
    prisma.adminAuditLog.count(),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { actor: { select: { username: true } } }
    })
  ])
  return {
    total,
    page,
    limit,
    items: rows.map(row => ({
      id: row.id,
      actorId: row.actorId,
      actor: row.actor?.username || '',
      action: row.action,
      target: row.target,
      detail: row.detail,
      ip: row.ip,
      createdAt: row.createdAt
    }))
  }
}
