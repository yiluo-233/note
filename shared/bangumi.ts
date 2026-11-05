import type { Category, ItemInput } from './types'
export interface SearchResult {
  id: number | string
  source: 'bangumi' | 'neodb'
  bangumiId?: string
  title: string
  originalTitle: string
  date: string
  typeLabel: string
  image: string
  category: Category
  exists: boolean
}
export interface SearchPage {
  results: SearchResult[]
  total: number
  warning?: string
}
export interface ImportDraft {
  input: ItemInput
  warning: string
}
