const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Shanghai'

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

const offsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find(item => item.type === type)?.value ?? 0)
}

/** 返回应用时区（默认 Asia/Shanghai）下的 YYYY-MM-DD。 */
export function todayKey(date: Date = new Date()): string {
  const parts = dayFormatter.formatToParts(date)
  return `${part(parts, 'year')}-${String(part(parts, 'month')).padStart(2, '0')}-${String(part(parts, 'day')).padStart(2, '0')}`
}

function timezoneOffsetMs(date: Date): number {
  const parts = offsetFormatter.formatToParts(date)
  const asUtc = Date.UTC(
    part(parts, 'year'),
    part(parts, 'month') - 1,
    part(parts, 'day'),
    part(parts, 'hour') % 24,
    part(parts, 'minute'),
    part(parts, 'second')
  )
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** 应用时区当天 00:00 对应的绝对时间。 */
export function startOfToday(now: Date = new Date()): Date {
  const [year, month, day] = todayKey(now).split('-').map(Number)
  const wallClock = Date.UTC(year, month - 1, day)
  let start = wallClock - timezoneOffsetMs(new Date(wallClock))
  const corrected = wallClock - timezoneOffsetMs(new Date(start))
  if (corrected !== start) start = corrected
  return new Date(start)
}

/** 在 YYYY-MM-DD 上加减天数，跨月/跨年安全。 */
export function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number)
  const cursor = new Date(Date.UTC(year, month - 1, day))
  cursor.setUTCDate(cursor.getUTCDate() + days)
  return cursor.toISOString().slice(0, 10)
}
