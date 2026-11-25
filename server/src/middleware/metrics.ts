import type { RequestHandler } from 'express'

const requestCounts = new Map<string, number>()
const buckets = [50, 100, 250, 500, 1000, 2500, 5000, 10_000]
const bucketCounts = new Array(buckets.length + 1).fill(0)
let durationSum = 0
let durationCount = 0

function routeLabel(req: Parameters<RequestHandler>[0]) {
  return `${req.baseUrl}${req.route?.path || req.path || 'unknown'}`
}

/** 记录请求计数和延迟直方图；/metrics 本身不记录。 */
export function metricsMiddleware(): RequestHandler {
  return (req, res, next) => {
    if (req.path === '/metrics') {
      next()
      return
    }
    const startedAt = process.hrtime.bigint()
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
      const status = String(res.statusCode)
      const key = `${req.method}|${routeLabel(req)}|${status}`
      requestCounts.set(key, (requestCounts.get(key) || 0) + 1)
      durationSum += durationMs
      durationCount += 1
      const index = buckets.findIndex(bucket => durationMs <= bucket)
      bucketCounts[index === -1 ? buckets.length : index] += 1
    })
    next()
  }
}

export function renderMetrics(): string {
  const lines: string[] = []
  lines.push('# HELP http_requests_total Total HTTP requests.')
  lines.push('# TYPE http_requests_total counter')
  for (const [key, count] of requestCounts) {
    const [method, route, status] = key.split('|')
    lines.push(
      `http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`
    )
  }

  lines.push('# HELP http_request_duration_ms HTTP request latency in milliseconds.')
  lines.push('# TYPE http_request_duration_ms histogram')
  let cumulative = 0
  buckets.forEach((bucket, index) => {
    cumulative += bucketCounts[index]
    lines.push(`http_request_duration_ms_bucket{le="${bucket}"} ${cumulative}`)
  })
  cumulative += bucketCounts[buckets.length]
  lines.push(`http_request_duration_ms_bucket{le="+Inf"} ${cumulative}`)
  lines.push(`http_request_duration_ms_sum ${durationSum}`)
  lines.push(`http_request_duration_ms_count ${durationCount}`)
  lines.push('# HELP process_uptime_seconds Process uptime in seconds.')
  lines.push('# TYPE process_uptime_seconds gauge')
  lines.push(`process_uptime_seconds ${process.uptime()}`)
  return `${lines.join('\n')}\n`
}

/** 仅测试使用。 */
export function resetMetrics(): void {
  requestCounts.clear()
  bucketCounts.fill(0)
  durationSum = 0
  durationCount = 0
}
