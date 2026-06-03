import prisma from '../prisma/client'
import { hashPassword, comparePassword } from '../utils/password'
import { generateAccessToken, generateRefreshToken } from '../utils/jwt'
import { LoginDto, RegisterDto, TokenResponse } from '../types'

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
      passwordHash
    }
  })
  
  const accessToken = generateAccessToken(user.id, user.username)
  const refreshToken = generateRefreshToken(user.id)
  
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username
    }
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
    user: {
      id: user.id,
      username: user.username
    }
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

import { verifyToken } from '../utils/jwt'