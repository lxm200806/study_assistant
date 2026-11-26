import type { RequestHandler } from 'express'
import { apiErrorBody } from '../utils/api-response'
import { hasPermission } from '../entitlements/entitlement.service'
import { PERMISSIONS, type PermissionKey } from '../entitlements/permissions'

const TRAINING_PERMISSIONS: Record<string, PermissionKey> = {
  listening: PERMISSIONS.ENGLISH_LISTENING,
  speaking: PERMISSIONS.ENGLISH_SPEAKING,
  reading: PERMISSIONS.ENGLISH_RECOGNITION,
  writing: PERMISSIONS.ENGLISH_WRITING
}

function denied(res: Parameters<RequestHandler>[1], key: PermissionKey) {
  return res
    .status(403)
    .json(apiErrorBody('需要开通相应会员', 'PERMISSION_DENIED', { permission: key }))
}

/** 路由级权限门禁；只认权限 key，不认套餐名。 */
export function requirePermission(key: PermissionKey): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json(apiErrorBody('Unauthorized', 'UNAUTHORIZED'))
      }
      if (await hasPermission(req.userId, key)) {
        next()
        return
      }
      return denied(res, key)
    } catch (error) {
      next(error)
    }
  }
}

/** 训练接口按 body/query 的 type（listening/speaking/reading/writing）映射权限。 */
export const requireTrainingPermission: RequestHandler = async (req, res, next) => {
  try {
    const validated = res.locals.validatedQuery as { type?: string } | undefined
    const type = String(validated?.type || req.body?.type || req.query?.type || '')
    const key = TRAINING_PERMISSIONS[type]
    if (!key) {
      next()
      return
    }
    if (!req.userId) {
      return res.status(401).json(apiErrorBody('Unauthorized', 'UNAUTHORIZED'))
    }
    if (await hasPermission(req.userId, key)) {
      next()
      return
    }
    return denied(res, key)
  } catch (error) {
    next(error)
  }
}
