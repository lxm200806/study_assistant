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

export const TOPIC_CATEGORIES: TopicMeta[] = [
  { id: 'daily-life', label: '日常生活', color: '#4caf50', contentTypes: ['non-fiction'] },
  { id: 'school', label: '学校学习', color: '#3f51b5', contentTypes: ['non-fiction'] },
  { id: 'nature', label: '自然动物', color: '#8bc34a', contentTypes: ['non-fiction'] },
  { id: 'science', label: '科学技术', color: '#00bcd4', contentTypes: ['non-fiction'] },
  { id: 'travel', label: '旅行交通', color: '#ff9800', contentTypes: ['non-fiction'] },
  { id: 'health', label: '健康医疗', color: '#e91e63', contentTypes: ['non-fiction'] },
  { id: 'entertainment', label: '娱乐文艺', color: '#ff5722', contentTypes: ['fiction', 'non-fiction'] },
  { id: 'abstract', label: '抽象概念', color: '#795548', contentTypes: ['non-fiction', 'function'] },
  { id: 'society', label: '社会政治', color: '#673ab7', contentTypes: ['non-fiction'] },
  { id: 'business', label: '商业经济', color: '#009688', contentTypes: ['non-fiction'] }
]

export function getContentTypeLabel(id: ContentType): string {
  return CONTENT_TYPES.find(c => c.id === id)?.label || id
}

export function getTopicLabel(id: TopicCategory): string {
  return TOPIC_CATEGORIES.find(t => t.id === id)?.label || id
}
