import prisma from '../prisma/client'
import { hashPassword, comparePassword } from '../utils/password'
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt'
import { LoginDto, RegisterDto, TokenResponse } from '../types'
import { ensureActiveLearner, setActiveLearner, type LearnerSummary } from './family.service'

function normalizeSubject(value?: string | null) {
  return value === 'chinese' ? 'chinese' : 'english'
}

function normalizeRole(value?: string | null) {
  return value === 'student' ? 'student' : 'parent'
}

function toUserResponse(user: {
  id: string
  username: string
  isAdmin: boolean
  hasOnboarded?: boolean
  plan?: string
  activeSubject?: string
  accountType?: string
  displayName?: string | null
  activeLearnerId?: string | null
  activeRole?: string | null
}, extras?: { children?: LearnerSummary[]; learner?: LearnerSummary | null }) {
  return {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    hasOnboarded: user.hasOnboarded ?? false,
    plan: user.plan ?? 'free',
    activeSubject: normalizeSubject(user.activeSubject),
    accountType: 'parent',
    displayName: user.displayName || user.username,
    activeLearnerId: extras?.learner?.id || user.activeLearnerId || null,
    activeRole: normalizeRole(user.activeRole),
    learner: extras?.learner || null,
    children: extras?.children || []
  }
}

async function ensureFamilyAccount(user: {
  id: string
  username: string
  isAdmin: boolean
  hasOnboarded?: boolean
  plan?: string
  activeSubject?: string
  accountType?: string
  displayName?: string | null
  activeLearnerId?: string | null
  activeRole?: string | null
  parentId?: string | null
}) {
  if (user.parentId) return user
  if (user.accountType === 'parent') return user
  return prisma.user.update({
    where: { id: user.id },
    data: { accountType: 'parent', activeRole: normalizeRole(user.activeRole) }
  })
}

async function withFamily(user: {
  id: string
  username: string
  isAdmin: boolean
  hasOnboarded?: boolean
  plan?: string
  activeSubject?: string
  accountType?: string
  displayName?: string | null
  activeLearnerId?: string | null
  activeRole?: string | null
  parentId?: string | null
}) {
  const familyUser = await ensureFamilyAccount(user)
  const family = await ensureActiveLearner(familyUser.id, familyUser.activeLearnerId)
  return toUserResponse({ ...familyUser, activeLearnerId: family.activeLearnerId }, family)
}

export async function register(dto: RegisterDto): Promise<TokenResponse> {
  const username = String(dto.username || '').trim()
  const password = String(dto.password || '')
  if (username.length < 3 || username.length > 32) {
    throw new Error('Username must be 3–32 characters')
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  const existingUser = await prisma.user.findUnique({
    where: { username }
  })

  if (existingUser) {
    throw new Error('Username already exists')
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      isAdmin: false,
      accountType: 'parent',
      activeRole: 'parent',
      displayName: username
    }
  })

  const accessToken = generateAccessToken(user.id, user.username)
  const refreshToken = generateRefreshToken(user.id)

  return {
    accessToken,
    refreshToken,
    user: await withFamily(user)
  }
}

export async function login(dto: LoginDto): Promise<TokenResponse> {
  const user = await prisma.user.findUnique({
    where: { username: dto.username }
  })

  if (!user || user.archivedAt) {
    throw new Error('Invalid credentials')
  }

  if (user.parentId) {
    throw new Error('请使用家庭账号登录')
  }

  const isPasswordValid = await comparePassword(dto.password, user.passwordHash)

  if (!isPasswordValid) {
    throw new Error('Invalid credentials')
  }

  const accessToken = generateAccessToken(user.id, user.username)
  const refreshToken = generateRefreshToken(user.id)

  return {
    accessToken,
    refreshToken,
    user: await withFamily(user)
  }
}

export async function refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
  const decoded = verifyToken(refreshToken, 'refresh')

  if (!decoded) {
    throw new Error('Invalid refresh token')
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId }
  })

  if (!user || user.archivedAt) {
    throw new Error('Invalid refresh token')
  }

  const accessToken = generateAccessToken(user.id, user.username)

  return { accessToken }
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    throw new Error('User not found')
  }

  return withFamily(user)
}

export async function completeOnboarding(userId: string, subject?: string) {
  const activeSubject = subject === 'chinese' || subject === 'english' ? subject : undefined
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      hasOnboarded: true,
      accountType: 'parent',
      ...(activeSubject ? { activeSubject } : {})
    }
  })
  return withFamily(user)
}

export async function setActiveSubject(userId: string, subject: string) {
  const activeSubject = normalizeSubject(subject)
  const user = await prisma.user.update({
    where: { id: userId },
    data: { activeSubject }
  })
  return withFamily(user)
}

export async function setActiveRole(userId: string, role?: string, studentId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.parentId) {
    throw new Error('无法切换角色')
  }

  if (role === 'parent') {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { activeRole: 'parent', accountType: 'parent' }
    })
    return withFamily(updated)
  }

  if (role === 'student') {
    const family = await ensureActiveLearner(userId, studentId || user.activeLearnerId)
    const targetId = studentId || family.learner?.id
    if (!targetId) {
      throw new Error('请先添加学生')
    }
    await setActiveLearner(userId, targetId)
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { activeRole: 'student', activeLearnerId: targetId, accountType: 'parent' }
    })
    return withFamily(updated)
  }

  throw new Error('请选择家长或学生角色')
}

export async function wechatLoginStub(code: string) {
  if (!code) throw new Error('Invalid wechat code')
  const openId = `wx_${code.slice(0, 16)}`
  let user = await prisma.user.findUnique({ where: { wxOpenId: openId } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        username: `wx_${openId.slice(-8)}`,
        passwordHash: await hashPassword(openId),
        wxOpenId: openId,
        accountType: 'parent',
        activeRole: 'parent'
      }
    })
  }
  const accessToken = generateAccessToken(user.id, user.username)
  const refreshToken = generateRefreshToken(user.id)
  return { accessToken, refreshToken, user: await withFamily(user) }
}
