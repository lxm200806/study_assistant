import type { RequestHandler } from 'express'

/** 统一的基础安全响应头（替代额外引入 helmet）。 */
export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(self)')
    next()
  }
}
