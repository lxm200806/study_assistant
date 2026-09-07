import prisma from '../prisma/client'
import { hashPassword, comparePassword } from '../utils/password'
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt'
import { LoginDto, RegisterDto, TokenResponse } from '../types'
import { ensureActiveLearner, type LearnerSummary } from './family.service'

function normalizeAccountType(value?: string | null) {
  return value === 'parent' ? 'parent' : 'student'
}

function normalizeSubject(value?: string | null) {
  return value === 'chinese' ? 'chinese' : 'english'
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
}, extras?: { children?: LearnerSummary[]; learner?: LearnerSummary | null }) {
  const accountType = normalizeAccountType(user.accountType)
  return {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    hasOnboarded: user.hasOnboarded ?? false,
    plan: user.plan ?? 'free',
    activeSubject: normalizeSubject(user.activeSubject),
    accountType,
    displayName: user.displayName || user.username,
    activeLearnerId: extras?.learner?.id || user.activeLearnerId || null,
    learner: extras?.learner || null,
    children: extras?.children || []
  }
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
}) {
  if (normalizeAccountType(user.accountType) !== 'parent') {
    return toUserResponse(user, {
      children: [],
      learner: { id: user.id, name: user.displayName || user.username, activeSubject: normalizeSubject(user.activeSubject) }
    })
  }
  const family = await ensureActiveLearner(user.id, user.activeLearnerId)
  return toUserResponse({ ...user, activeLearnerId: family.activeLearnerId }, family)
}

export async function register(dto: RegisterDto): Promise<TokenResponse> {
  const existingUser = await prisma.user.findUnique({
    where: { username: dto.username }
  })

  if (existingUser) {
    throw new Error('Username already exists')
  }

  const passwordHash = await hashPassword(dto.password)
  const accountType = normalizeAccountType(dto.accountType)

  const user = await prisma.user.create({
    data: {
      username: dto.username,
      passwordHash,
      isAdmin: false,
      accountType,
      displayName: dto.username
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
    throw new Error('请使用家长账号登录')
  }

  const isPasswordValid = await comparePassword(dto.password, user.passwordHash)

  if (!isPasswordValid) {
    throw new Error('Invalid credentials')
  }

  if (dto.accountType && normalizeAccountType(user.accountType) !== normalizeAccountType(dto.accountType)) {
    throw new Error(
      user.accountType === 'parent'
        ? '这是家长账号，请选择家长模式登录'
        : '这是学生账号，请选择学生模式登录'
    )
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
  const decoded = verifyToken(refreshToken)

  if (!decoded) {
    throw new Error('Invalid refresh token')
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId }
  })

  if (!user) {
    throw new Error('User not found')
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

export async function completeOnboarding(userId: string, subject?: string, accountType?: string) {
  const activeSubject = subject === 'chinese' || subject === 'english' ? subject : undefined
  const nextType = accountType === 'parent' || accountType === 'student' ? accountType : undefined
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      hasOnboarded: true,
      ...(activeSubject ? { activeSubject } : {}),
      ...(nextType ? { accountType: nextType } : {})
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

export async function wechatLoginStub(code: string) {
  if (!code) throw new Error('Invalid wechat code')
  const openId = `wx_${code.slice(0, 16)}`
  let user = await prisma.user.findUnique({ where: { wxOpenId: openId } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        username: `wx_${openId.slice(-8)}`,
        passwordHash: await hashPassword(openId),
        wxOpenId: openId
      }
    })
  }
  const accessToken = generateAccessToken(user.id, user.username)
  const refreshToken = generateRefreshToken(user.id)
  return { accessToken, refreshToken, user: await withFamily(user) }
}
