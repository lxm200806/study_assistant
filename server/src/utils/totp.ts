import { createHmac, randomBytes } from 'crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_SECONDS = 30
const DIGITS = 6

export function encodeBase32(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31]
  return output
}

export function decodeBase32(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const index = ALPHABET.indexOf(char)
    if (index < 0) continue
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function generateTotpSecret(bytes = 20): string {
  return encodeBase32(randomBytes(bytes))
}

function hotp(secret: string, counter: number, digits = DIGITS): string {
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', decodeBase32(secret)).update(buffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  return String(binary % 10 ** digits).padStart(digits, '0')
}

export function generateTotp(
  secret: string,
  timestamp = Date.now(),
  digits = DIGITS
): string {
  return hotp(secret, Math.floor(timestamp / 1000 / STEP_SECONDS), digits)
}

/** 允许前后各一个 30 秒窗口，容忍时钟偏差。 */
export function verifyTotp(secret: string, token: string, timestamp = Date.now()): boolean {
  if (!secret || !/^\d{6}$/.test(String(token || '').trim())) return false
  const counter = Math.floor(timestamp / 1000 / STEP_SECONDS)
  const expected = token.trim()
  return [-1, 0, 1].some(offset => hotp(secret, counter + offset) === expected)
}

export function buildTotpUri(secret: string, account: string, issuer = '学习助手'): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&period=30&digits=6`
}
