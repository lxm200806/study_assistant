import { describe, expect, it } from 'vitest'
import { buildTotpUri, decodeBase32, encodeBase32, generateTotp, verifyTotp } from './totp'

const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('totp', () => {
  it('round-trips base32', () => {
    const raw = Buffer.from('12345678901234567890')
    expect(decodeBase32(encodeBase32(raw)).toString()).toBe(raw.toString())
  })

  it('matches the RFC 6238 SHA-1 vector', () => {
    expect(generateTotp(RFC_SECRET, 59_000, 8)).toBe('94287082')
  })

  it('accepts the current window and rejects a wrong code', () => {
    const now = 1_700_000_000_000
    const code = generateTotp(RFC_SECRET, now)
    expect(verifyTotp(RFC_SECRET, code, now)).toBe(true)
    expect(verifyTotp(RFC_SECRET, '000000', now)).toBe(false)
  })

  it('builds an otpauth URI', () => {
    expect(buildTotpUri('ABC234', 'admin')).toContain('otpauth://totp/')
  })
})
