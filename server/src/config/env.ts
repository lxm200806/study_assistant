import 'dotenv/config'

const MIN_SECRET_LENGTH = 32
const WEAK_JWT_SECRET = 'your_jwt_secret_key_here_must_be_at_least_32_characters_long'

function isUsableSecret(value?: string): value is string {
  return !!value && value.length >= MIN_SECRET_LENGTH && value !== WEAK_JWT_SECRET
}

let cachedAccessSecret: string | null = null

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function getJwtAccessSecret(): string {
  if (!cachedAccessSecret) {
    const value = process.env.JWT_SECRET?.trim()
    if (!isUsableSecret(value)) {
      throw new Error(`JWT_SECRET must be set to a random string of at least ${MIN_SECRET_LENGTH} characters`)
    }
    cachedAccessSecret = value
  }
  return cachedAccessSecret
}

export function getJwtRefreshSecret(): string {
  const value = process.env.JWT_REFRESH_SECRET?.trim()
  return isUsableSecret(value) ? value : getJwtAccessSecret()
}

export function assertAuthConfig(): void {
  getJwtAccessSecret()
  if (isProduction() && !isUsableSecret(process.env.JWT_REFRESH_SECRET?.trim())) {
    console.warn('[env] JWT_REFRESH_SECRET is not set; refresh tokens fall back to JWT_SECRET')
  }
}

export function assertAdminConfig(): void {
  if (isProduction() && !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD is required in production')
  }
}
