/** 搜索接口类型：定义各来源共用的结果、分页和导入草稿。 */
import type { Category, ItemInput } from './types'

export const SEARCH_PAGE_SIZE = 10

/** 数据源条目只包含远程资料，书架状态由聚合层实时补充。 */
export interface CatalogEntry {
  id: number | string
  source: 'bangumi' | 'neodb'
  bangumiId?: string
  title: string
  originalTitle: string
  date: string
  typeLabel: string
  image: string
  category: Category
}

export interface CatalogPage {
  results: CatalogEntry[]
  total: number
}

export interface SearchResult extends CatalogEntry {
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
