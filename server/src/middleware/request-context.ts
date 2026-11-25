import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}

const REQUEST_ID_HEADER = 'x-request-id'
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/

/** 为每个请求生成/透传 request id，并回写到响应头。 */
export function requestContext(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.headers[REQUEST_ID_HEADER]
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming
    const requestId = candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID()

    req.requestId = requestId
    res.locals.requestId = requestId
    res.setHeader('X-Request-Id', requestId)
    next()
  }
}
