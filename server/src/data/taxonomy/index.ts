import type { ContentType, TopicCategory } from '../vocabulary/types'

export interface ContentTypeMeta {
  id: ContentType
  label: string
  color: string
}

export interface TopicMeta {
  id: TopicCategory
  label: string
  color: string
  contentTypes: ContentType[]
}

export const CONTENT_TYPES: ContentTypeMeta[] = [
  { id: 'fiction', label: '虚构类', color: '#9c27b0' },
  { id: 'non-fiction', label: '非虚构类', color: '#2196f3' },
  { id: 'function', label: '功能词', color: '#607d8b' }
]

/** 与词光 19 类对齐，另加 uncategorized（禁止再用 abstract 兜底）。 */
export const TOPIC_CATEGORIES: TopicMeta[] = [
  { id: 'daily', label: '日常生活', color: '#4caf50', contentTypes: ['non-fiction'] },
  { id: 'education', label: '教育学习', color: '#3f51b5', contentTypes: ['non-fiction'] },
  { id: 'work', label: '工作职场', color: '#607d8b', contentTypes: ['non-fiction'] },
  { id: 'nature', label: '自然动物', color: '#8bc34a', contentTypes: ['non-fiction'] },
  { id: 'science', label: '科学', color: '#00bcd4', contentTypes: ['non-fiction'] },
  { id: 'technology', label: '科技', color: '#0288d1', contentTypes: ['non-fiction'] },
  { id: 'travel', label: '旅行交通', color: '#ff9800', contentTypes: ['non-fiction'] },
  { id: 'health', label: '健康医疗', color: '#e91e63', contentTypes: ['non-fiction'] },
  { id: 'emotion', label: '情感心理', color: '#ec407a', contentTypes: ['non-fiction'] },
  { id: 'thinking', label: '思维认知', color: '#795548', contentTypes: ['non-fiction', 'function'] },
  { id: 'society', label: '社会', color: '#673ab7', contentTypes: ['non-fiction'] },
  { id: 'government', label: '政治政府', color: '#5e35b1', contentTypes: ['non-fiction'] },
  { id: 'economy', label: '经济商业', color: '#009688', contentTypes: ['non-fiction'] },
  { id: 'arts', label: '艺术娱乐', color: '#ff5722', contentTypes: ['fiction', 'non-fiction'] },
  { id: 'media', label: '媒体传播', color: '#f4511e', contentTypes: ['non-fiction'] },
  { id: 'city', label: '城市生活', color: '#78909c', contentTypes: ['non-fiction'] },
  { id: 'environment', label: '环境', color: '#43a047', contentTypes: ['non-fiction'] },
  { id: 'history', label: '历史', color: '#8d6e63', contentTypes: ['non-fiction'] },
  { id: 'sport', label: '体育运动', color: '#f9a825', contentTypes: ['non-fiction'] },
  { id: 'uncategorized', label: '未分类', color: '#9e9e9e', contentTypes: ['non-fiction', 'function'] }
]

const TOPIC_IDS = new Set(TOPIC_CATEGORIES.map(t => t.id))

/** 旧主题 → 新主题 */
export const LEGACY_TOPIC_MAP: Record<string, TopicCategory> = {
  'daily-life': 'daily',
  school: 'education',
  entertainment: 'arts',
  abstract: 'thinking',
  business: 'economy',
  nature: 'nature',
  science: 'science',
  travel: 'travel',
  health: 'health',
  society: 'society'
}

export function normalizeTopic(topic: string | null | undefined): TopicCategory {
  if (!topic) return 'uncategorized'
  const mapped = LEGACY_TOPIC_MAP[topic] || topic
  if (TOPIC_IDS.has(mapped as TopicCategory)) return mapped as TopicCategory
  return 'uncategorized'
}

export function isWeakTopic(topic: string | null | undefined): boolean {
  const t = normalizeTopic(topic)
  return t === 'uncategorized' || t === 'thinking'
}

export function getContentTypeLabel(id: ContentType): string {
  return CONTENT_TYPES.find(c => c.id === id)?.label || id
}

export function getTopicLabel(id: TopicCategory | string): string {
  const normalized = normalizeTopic(id)
  return TOPIC_CATEGORIES.find(t => t.id === normalized)?.label || id
}
