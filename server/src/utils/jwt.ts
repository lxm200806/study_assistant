import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET || 'your_jwt_secret_key_here_must_be_at_least_32_characters_long'
const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '2h'
const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

export type TokenType = 'access' | 'refresh'

export function generateAccessToken(userId: string, username: string): string {
  return jwt.sign({ userId, username, tokenType: 'access' }, secret as jwt.Secret, {
    expiresIn: accessExpiresIn
  } as jwt.SignOptions)
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, tokenType: 'refresh' }, secret as jwt.Secret, {
    expiresIn: refreshExpiresIn
  } as jwt.SignOptions)
}

export function verifyToken(
  token: string,
  expectedType?: TokenType
): { userId: string; username?: string; tokenType?: TokenType } | null {
  try {
    const decoded = jwt.verify(token, secret as jwt.Secret) as {
      userId: string
      username?: string
      tokenType?: TokenType
    }
    if (expectedType && decoded.tokenType && decoded.tokenType !== expectedType) {
      return null
    }
    return decoded
  } catch {
    return null
  }
}
