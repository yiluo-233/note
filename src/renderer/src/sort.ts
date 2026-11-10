/** 作品排序：支持评分、添加时间和按语言分组的标题排序。 */
import type { Item } from '../../../shared/types'
export type SortOrder = 'rating' | 'created' | 'title' | 'original'
const collators = [
  new Intl.Collator('en', { numeric: true, sensitivity: 'base' }),
  new Intl.Collator('zh-Hans-u-co-pinyin', { numeric: true, sensitivity: 'base' }),
  new Intl.Collator('ja', { numeric: true, sensitivity: 'base' })
]
function key(title: string): { value: string; group: number } {
  const value = title
    .normalize('NFKC')
    .trim()
    .replace(/^[\p{P}\p{S}\s]+/u, '')
  if (/^[a-z]/i.test(value)) {
    return { value, group: 0 }
  }
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)) {
    return { value, group: 2 }
  }
  if (/^\p{Script=Han}/u.test(value)) {
    return { value, group: 1 }
  }
  return { value, group: 3 }
}

export function sortItems(items: Item[], order: SortOrder): Item[] {
  return [...items].sort((a, b) => {
    if (order === 'rating') {
      return (b.rating ?? -1) - (a.rating ?? -1) || b.createdAt - a.createdAt || a.id - b.id
    }
    if (order === 'created') {
      return b.createdAt - a.createdAt || a.id - b.id
    }
    const left = key(order === 'title' ? a.title : a.originalTitle)
    const right = key(order === 'title' ? b.title : b.originalTitle)
    if (!left.value || !right.value) {
      return Number(!left.value) - Number(!right.value) || a.id - b.id
    }
    return (
      left.group - right.group ||
      collators[Math.min(left.group, 2)].compare(left.value, right.value) ||
      a.id - b.id
    )
  })
}
