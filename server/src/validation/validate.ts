import type { RequestHandler, Response } from 'express'
import type { ZodError, ZodTypeAny } from 'zod'

function formatIssues(error: ZodError) {
  return error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message
  }))
}

function invalidRequest(res: Response, error: ZodError) {
  return res.status(400).json({
    success: false,
    error: '请求参数不正确',
    code: 'INVALID_REQUEST',
    details: formatIssues(error)
  })
}

/** 校验并替换 req.body；控制器拿到的是解析后的数据。 */
export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) return invalidRequest(res, result.error)
    req.body = result.data
    next()
  }
}

/** 校验 query，解析结果放在 res.locals.validatedQuery。 */
export function validateQuery<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query)
    if (!result.success) return invalidRequest(res, result.error)
    res.locals.validatedQuery = result.data
    next()
  }
}

export function validatedQuery<T>(res: Response): T {
  return res.locals.validatedQuery as T
}
