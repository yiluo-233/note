import type { Category, Status } from '../../../shared/types'

export const CATEGORIES: { value: Category; label: string; producerLabel: string }[] = [
  { value: 'anime', label: '动画', producerLabel: '制作公司' },
  { value: 'novel', label: '书籍', producerLabel: '作者' },
  { value: 'movie', label: '电影', producerLabel: '导演' },
  { value: 'galgame', label: '视觉小说', producerLabel: '开发商' }
]

export const STATUSES: { value: Status; label: string }[] = [
  { value: 'wish', label: '想看' },
  { value: 'doing', label: '在看' },
  { value: 'done', label: '看过' }
]

export const coverUrl = (name: string): string =>
  name ? `cover://local/${encodeURIComponent(name)}` : ''

export function statusesFor(category: Category | 'all'): { value: Status; label: string }[] {
  return category === 'galgame'
    ? [
        { value: 'wish', label: '想玩' },
        { value: 'doing', label: '在玩' },
        { value: 'done', label: '玩过' }
      ]
    : STATUSES
}
