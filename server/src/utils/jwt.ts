import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET || 'your_jwt_secret_key_here_must_be_at_least_32_characters_long'
const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '2h'
const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

export function generateAccessToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, secret as any, { expiresIn: accessExpiresIn })
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, secret as any, { expiresIn: refreshExpiresIn })
}

export function verifyToken(token: string): { userId: string; username?: string } | null {
  try {
    const decoded = jwt.verify(token, secret as any) as { userId: string; username?: string }
    return decoded
  } catch {
    return null
  }
}