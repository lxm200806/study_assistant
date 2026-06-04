import prisma from '../prisma/client'
import { hashPassword, comparePassword } from '../utils/password'
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt'
import { LoginDto, RegisterDto, TokenResponse } from '../types'

function toUserResponse(user: { id: string; username: string; isAdmin: boolean; hasOnboarded?: boolean; plan?: string }) {
  return {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    hasOnboarded: user.hasOnboarded ?? false,
    plan: user.plan ?? 'free'
  }
}

export async function register(dto: RegisterDto): Promise<TokenResponse> {
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
      isAdmin: false
    }
  })

  const accessToken = generateAccessToken(user.id, user.username)
  const refreshToken = generateRefreshToken(user.id)

  return {
    accessToken,
    refreshToken,
    user: toUserResponse(user)
  }
}

export async function login(dto: LoginDto): Promise<TokenResponse> {
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

  const accessToken = generateAccessToken(user.id, user.username)
  const refreshToken = generateRefreshToken(user.id)

  return {
    accessToken,
    refreshToken,
    user: toUserResponse(user)
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
    where: { id: userId },
    select: { id: true, username: true, isAdmin: true, hasOnboarded: true, plan: true, planExpiresAt: true, createdAt: true }
  })

  if (!user) {
    throw new Error('User not found')
  }

  return user
}

export async function completeOnboarding(userId: string, bookCode?: string, dailyGoal?: number) {
  return prisma.user.update({
    where: { id: userId },
    data: { hasOnboarded: true }
  })
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
  return { accessToken, refreshToken, user: toUserResponse(user) }
}
