import prisma from '../prisma/client'

const MAX_CHILDREN = 8

export type LearnerSummary = {
  id: string
  name: string
  activeSubject: string
}

function toLearner(row: { id: string; name: string; activeSubject?: string | null }): LearnerSummary {
  return {
    id: row.id,
    name: row.name,
    activeSubject: row.activeSubject === 'chinese' ? 'chinese' : 'english'
  }
}

export async function listChildren(accountId: string) {
  const rows = await prisma.learner.findMany({
    where: { accountId, archivedAt: null },
    orderBy: { createdAt: 'asc' }
  })
  return rows.map(toLearner)
}

export async function ensureActiveLearner(accountId: string, activeLearnerId?: string | null) {
  const children = await listChildren(accountId)
  if (!children.length) return { children, learner: null as LearnerSummary | null, activeLearnerId: null as string | null }
  const current = children.find(item => item.id === activeLearnerId) || children[0]
  if (current.id !== activeLearnerId) {
    await prisma.user.update({
      where: { id: accountId },
      data: { activeLearnerId: current.id }
    })
  }
  return { children, learner: current, activeLearnerId: current.id }
}

export async function createChild(accountId: string, name: string) {
  const trimmed = String(name || '').trim()
  if (trimmed.length < 1 || trimmed.length > 20) {
    throw new Error('请填写 1–20 个字的学生姓名')
  }
  const account = await prisma.user.findUnique({ where: { id: accountId } })
  if (!account) {
    throw new Error('只有家庭账号可以添加学生')
  }
  const count = await prisma.learner.count({ where: { accountId, archivedAt: null } })
  if (count >= MAX_CHILDREN) {
    throw new Error(`最多添加 ${MAX_CHILDREN} 个学生`)
  }
  const child = await prisma.learner.create({
    data: {
      accountId,
      name: trimmed,
      activeSubject: account.activeSubject === 'chinese' ? 'chinese' : 'english'
    }
  })
  await prisma.user.update({
    where: { id: accountId },
    data: { activeLearnerId: child.id }
  })
  return toLearner(child)
}

export async function renameChild(accountId: string, studentId: string, name: string) {
  const trimmed = String(name || '').trim()
  if (trimmed.length < 1 || trimmed.length > 20) {
    throw new Error('请填写 1–20 个字的学生姓名')
  }
  const child = await prisma.learner.findFirst({
    where: { id: studentId, accountId, archivedAt: null }
  })
  if (!child) throw new Error('学生不存在')
  const updated = await prisma.learner.update({
    where: { id: studentId },
    data: { name: trimmed }
  })
  return toLearner(updated)
}

export async function archiveChild(accountId: string, studentId: string) {
  const child = await prisma.learner.findFirst({
    where: { id: studentId, accountId, archivedAt: null }
  })
  if (!child) throw new Error('学生不存在')
  await prisma.learner.update({
    where: { id: studentId },
    data: { archivedAt: new Date() }
  })
  const account = await prisma.user.findUnique({ where: { id: accountId } })
  if (account?.activeLearnerId === studentId) {
    const next = await prisma.learner.findFirst({
      where: { accountId, archivedAt: null },
      orderBy: { createdAt: 'asc' }
    })
    await prisma.user.update({
      where: { id: accountId },
      data: { activeLearnerId: next?.id || null }
    })
  }
  return ensureActiveLearner(accountId)
}

export async function setActiveLearner(accountId: string, studentId: string) {
  const child = await prisma.learner.findFirst({
    where: { id: studentId, accountId, archivedAt: null }
  })
  if (!child) throw new Error('学生不存在')
  await prisma.user.update({
    where: { id: accountId },
    data: { activeLearnerId: child.id }
  })
  return toLearner(child)
}
