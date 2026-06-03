export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

export const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  
  return formatDate(timestamp)
}

export const getWeekDays = (): string[] => {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
}

export const shuffleArray = <T>(array: T[]): T[] => {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export const debounce = <T extends (...args: unknown[]) => void>(fn: T, delay: number): T => {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: unknown[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

export const throttle = <T extends (...args: unknown[]) => void>(fn: T, limit: number): T => {
  let inThrottle = false
  return ((...args: unknown[]) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }) as T
}
