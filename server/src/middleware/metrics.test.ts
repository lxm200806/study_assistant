import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { metricsMiddleware, renderMetrics, resetMetrics } from './metrics'

beforeEach(() => resetMetrics())

describe('metrics', () => {
  it('renders an empty Prometheus document', () => {
    const text = renderMetrics()
    expect(text).toContain('http_requests_total')
    expect(text).toContain('http_request_duration_ms_bucket')
    expect(text).toContain('process_uptime_seconds')
  })

  it('records request count and status', () => {
    const req = {
      path: '/api/books',
      baseUrl: '',
      route: { path: '/api/books' },
      method: 'GET'
    } as never
    const res = new EventEmitter() as EventEmitter & { statusCode: number }
    res.statusCode = 200
    const next = vi.fn()

    metricsMiddleware()(req, res as never, next)
    res.emit('finish')

    expect(next).toHaveBeenCalledOnce()
    expect(renderMetrics()).toContain('http_requests_total{method="GET",route="/api/books",status="200"} 1')
  })
})
