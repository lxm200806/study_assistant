import prisma from '../prisma/client'
import { hashPassword, comparePassword } from '../utils/password'
import { LoginDto, RegisterDto, TokenResponse } from '../types'
import { ensureActiveLearner, setActiveLearner, type LearnerSummary } from './family.service'
import { isProduction } from '../config/env'
import {
  issueSessionTokens,
  rotateSessionTokens,
  type SessionContext
} from './auth-session.service'
import { buildTotpUri, generateTotpSecret, verifyTotp } from '../utils/totp'

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

async function withFamily(user: {
  id: string
  username: string
  isAdmin: boolean
  hasOnboarded?: boolean
  plan?: string
  activeSubject?: string
  displayName?: string | null
  activeLearnerId?: string | null
  activeRole?: string | null
}) {
  const family = await ensureActiveLearner(user.id, user.activeLearnerId)
  return toUserResponse({ ...user, activeLearnerId: family.activeLearnerId }, family)
}

export async function register(
  dto: RegisterDto,
  context?: SessionContext
): Promise<TokenResponse> {
  const existingUser = await prisma.user.findUnique({
    where: { username: dto.username }
  })

  if (existingUser) {
    throw new Error('Username already exists')
  }

  const passwordHash = await hashPassword(dto.password)

  const user = await prisma.user.create({
    data: {
      username: dto.username,
      passwordHash,
      isAdmin: false,
      activeRole: 'parent',
      displayName: dto.username
    }
  })

  const tokens = await issueSessionTokens(user, context)
  return {
    ...tokens,
    user: await withFamily(user)
  }
}

export async function login(dto: LoginDto, context?: SessionContext): Promise<TokenResponse> {
  const user = await prisma.user.findUnique({
    where: { username: dto.username }
  })

  if (!user) {
    throw new Error('Invalid credentials')
  }

  const isPasswordValid = await comparePassword(dto.password, user.passwordHash)

  if (!isPasswordValid) {
    throw new Error('Invalid credentials')
  }

  if (user.twoFactorEnabled) {
    if (!dto.code) throw new Error('请输入两步验证码')
    if (!verifyTotp(user.twoFactorSecret || '', dto.code)) {
      throw new Error('两步验证码不正确')
    }
  }

  const tokens = await issueSessionTokens(user, context)
  return {
    ...tokens,
    user: await withFamily(user)
  }
}

export async function refreshToken(
  token: string,
  context?: SessionContext
): Promise<{ accessToken: string; refreshToken: string }> {
  return rotateSessionTokens(token, context)
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
  if (user.activeLearnerId) {
    await prisma.learner.updateMany({
      where: { id: user.activeLearnerId, accountId: userId },
      data: { activeSubject }
    })
  }
  return withFamily(user)
}

export async function setActiveRole(userId: string, role?: string, studentId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new Error('无法切换角色')
  }

  if (role === 'parent') {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { activeRole: 'parent' }
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
      data: { activeRole: 'student', activeLearnerId: targetId }
    })
    return withFamily(updated)
  }

  throw new Error('请选择家长或学生角色')
}

export async function wechatLoginStub(code: string, context?: SessionContext) {
  if (isProduction() || process.env.WECHAT_LOGIN_STUB !== 'true') {
    throw new Error('Wechat login is not configured')
  }
  if (!code) throw new Error('Invalid wechat code')
  const openId = `wx_${code.slice(0, 16)}`
  let user = await prisma.user.findUnique({ where: { wxOpenId: openId } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        username: `wx_${openId.slice(-8)}`,
        passwordHash: await hashPassword(openId),
        wxOpenId: openId,
        activeRole: 'parent'
      }
    })
  }
  const tokens = await issueSessionTokens(user, context)
  return { ...tokens, user: await withFamily(user) }
}

export async function getTwoFactorStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, twoFactorEnabled: true }
  })
  if (!user) throw new Error('User not found')
  return { isAdmin: user.isAdmin, enabled: user.twoFactorEnabled }
}

export async function setupTwoFactor(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (!user.isAdmin) throw new Error('仅管理员可以开启两步验证')
  if (user.twoFactorEnabled) throw new Error('两步验证已开启')
  const secret = generateTotpSecret()
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret, twoFactorEnabled: false }
  })
  return {
    secret,
    otpauth: buildTotpUri(secret, user.username)
  }
}

export async function enableTwoFactor(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (!user.isAdmin) throw new Error('仅管理员可以开启两步验证')
  if (!user.twoFactorSecret) throw new Error('请先生成两步验证密钥')
  if (!verifyTotp(user.twoFactorSecret, code)) throw new Error('两步验证码不正确')
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true }
  })
  return { enabled: true }
}

export async function disableTwoFactor(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (!(await comparePassword(password, user.passwordHash))) throw new Error('密码不正确')
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: null, twoFactorEnabled: false }
  })
  return { enabled: false }
}
