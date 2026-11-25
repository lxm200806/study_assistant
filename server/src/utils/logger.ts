type LogLevel = 'info' | 'warn' | 'error'

const silent = process.env.NODE_ENV === 'test'

/** 结构化日志；生产环境由 Docker json-file 收集。测试环境保持安静。 */
export function log(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {}
): void {
  if (silent) return
  const entry = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...fields
  })
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.log(entry)
}
