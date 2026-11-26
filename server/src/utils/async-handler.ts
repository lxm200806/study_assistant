import type { NextFunction, Request, RequestHandler, Response } from 'express'

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>

/**
 * Express 4 不会捕获 async handler 的 Promise rejection。用这个包装器把异常
 * 交给 errorMiddleware，避免请求悬挂或触发 Node 的 unhandledRejection。
 */
export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}
