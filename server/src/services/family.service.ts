import prisma from '../prisma/client'
import { hashPassword } from '../utils/password'

const MAX_CHILDREN = 8

export type LearnerSummary = {
  id: string
  name: string
  activeSubject: string
}

function learnerName(user: { displayName?: string | null; username: string }) {
  return user.displayName || user.username
}

export function toLearner(user: { id: string; displayName?: string | null; username: string; activeSubject?: string | null }): LearnerSummary {
  return {
    id: user.id,
    name: learnerName(user),
    activeSubject: user.activeSubject === 'chinese' ? 'chinese' : 'english'
  }
}

export async function listChildren(parentId: string) {
  const rows = await prisma.user.findMany({
    where: { parentId, archivedAt: null },
    orderBy: { createdAt: 'asc' }
  })
  return rows.map(toLearner)
}

export async function ensureActiveLearner(parentId: string, activeLearnerId?: string | null) {
  const children = await listChildren(parentId)
  if (!children.length) return { children, learner: null as LearnerSummary | null, activeLearnerId: null as string | null }
  const current = children.find(item => item.id === activeLearnerId) || children[0]
  if (current.id !== activeLearnerId) {
    await prisma.user.update({
      where: { id: parentId },
      data: { activeLearnerId: current.id }
    })
  }
  return { children, learner: current, activeLearnerId: current.id }
}

export async function createChild(parentId: string, name: string) {
  const trimmed = String(name || '').trim()
  if (trimmed.length < 1 || trimmed.length > 20) {
    throw new Error('请填写 1–20 个字的学生姓名')
  }
  const parent = await prisma.user.findUnique({ where: { id: parentId } })
  if (!parent || parent.accountType !== 'parent') {
    throw new Error('只有家长可以添加学生')
  }
  const count = await prisma.user.count({ where: { parentId, archivedAt: null } })
  if (count >= MAX_CHILDREN) {
    throw new Error(`最多添加 ${MAX_CHILDREN} 个学生`)
  }
  const child = await prisma.user.create({
    data: {
      username: `p_${parentId.replace(/-/g, '').slice(0, 10)}_${Date.now().toString(36)}`,
      passwordHash: await hashPassword(`child_${parentId}_${Date.now()}_${Math.random()}`),
      accountType: 'student',
      displayName: trimmed,
      parentId,
      hasOnboarded: true,
      activeSubject: parent.activeSubject === 'chinese' ? 'chinese' : 'english',
      plan: parent.plan,
      planExpiresAt: parent.planExpiresAt
    }
  })
  await prisma.user.update({
    where: { id: parentId },
    data: { activeLearnerId: child.id }
  })
  return toLearner(child)
}

export async function renameChild(parentId: string, studentId: string, name: string) {
  const trimmed = String(name || '').trim()
  if (trimmed.length < 1 || trimmed.length > 20) {
    throw new Error('请填写 1–20 个字的学生姓名')
  }
  const child = await prisma.user.findFirst({
    where: { id: studentId, parentId, archivedAt: null }
  })
  if (!child) throw new Error('学生不存在')
  const updated = await prisma.user.update({
    where: { id: studentId },
    data: { displayName: trimmed }
  })
  return toLearner(updated)
}

export async function archiveChild(parentId: string, studentId: string) {
  const child = await prisma.user.findFirst({
    where: { id: studentId, parentId, archivedAt: null }
  })
  if (!child) throw new Error('学生不存在')
  await prisma.user.update({
    where: { id: studentId },
    data: { archivedAt: new Date() }
  })
  const parent = await prisma.user.findUnique({ where: { id: parentId } })
  if (parent?.activeLearnerId === studentId) {
    const next = await prisma.user.findFirst({
      where: { parentId, archivedAt: null },
      orderBy: { createdAt: 'asc' }
    })
    await prisma.user.update({
      where: { id: parentId },
      data: { activeLearnerId: next?.id || null }
    })
  }
  return ensureActiveLearner(parentId)
}

export async function setActiveLearner(parentId: string, studentId: string) {
  const child = await prisma.user.findFirst({
    where: { id: studentId, parentId, archivedAt: null }
  })
  if (!child) throw new Error('学生不存在')
  await prisma.user.update({
    where: { id: parentId },
    data: { activeLearnerId: child.id }
  })
  return toLearner(child)
}
