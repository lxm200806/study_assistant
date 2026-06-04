import prisma from '../prisma/client'
import { hashPassword, comparePassword } from '../utils/password'
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt'
import { LoginDto, RegisterDto, TokenResponse } from '../types'

function toUserResponse(user: { id: string; username: string; isAdmin: boolean }) {
  return {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin
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
    select: { id: true, username: true, isAdmin: true, createdAt: true }
  })

  if (!user) {
    throw new Error('User not found')
  }

  return user
}
