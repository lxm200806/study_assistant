import type { RequestHandler } from 'express'
import { verifyAccessToken } from '../utils/jwt'
import { apiErrorBody } from '../utils/api-response'

/**
 * 音频元素无法设置 Authorization 头，因此 TTS 额外接受 `?token=<access token>`。
 * access token 有效期 2 小时；这里不查设备会话，避免每个音频请求多一次 DB 查询。
 */
export const ttsAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined
  const decoded = verifyAccessToken(bearer || queryToken || '')
  if (!decoded) {
    res.status(401).json(apiErrorBody('Unauthorized', 'UNAUTHORIZED'))
    return
  }
  req.userId = decoded.userId
  req.username = decoded.username
  next()
}
