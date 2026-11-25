/** 统一错误响应体。 */
export function apiErrorBody(error: string, code: string, details?: unknown) {
  return {
    success: false as const,
    error,
    code,
    ...(details === undefined ? {} : { details })
  }
}
