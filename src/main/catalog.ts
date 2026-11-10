/** 聚合搜索：合并来源、统一排序、缓存远程资料并实时标记书架状态。 */
import { searchBangumi, importBangumi } from './bangumi'
import { searchNeo, importNeo } from './neodb'
import { listSourceKeys } from './db'
import { normalizeSearchText, titleMatchScore } from './search-text'
import type { Category } from '../../shared/types'
import {
  SEARCH_PAGE_SIZE,
  type CatalogEntry,
  type SearchPage,
  type ImportDraft
} from '../../shared/bangumi'

interface MergedEntry {
  item: CatalogEntry
  sourceKeys: Set<string>
}

interface CatalogData {
  entries: MergedEntry[]
  warning: string
}

const CACHE_TTL_MS = 120_000
const CACHE_LIMIT = 20
const BANGUMI_PAGE_SIZE = 100
const cache = new Map<string, { time: number; value: Promise<CatalogData> }>()

async function allBangumi(keyword: string, category?: Category): Promise<CatalogEntry[]> {
  const first = await searchBangumi(keyword, category, 0, BANGUMI_PAGE_SIZE)
  const rows = [...first.results]
  for (let offset = BANGUMI_PAGE_SIZE; offset < first.total; offset += BANGUMI_PAGE_SIZE) {
    const page = await searchBangumi(keyword, category, offset, BANGUMI_PAGE_SIZE)
    rows.push(...page.results)
  }
  return rows
}

/** 优先保留 Bangumi 资料，同时保留被合并来源的标识用于书架判重。 */
function mergeEntries(items: CatalogEntry[], keyword: string): MergedEntry[] {
  const unique = new Map<string, MergedEntry>()
  for (const item of items) {
    const sourceKey = `${item.source}:${item.id}`
    const key = item.bangumiId ? `bangumi:${item.bangumiId}` : sourceKey
    const entry = unique.get(key) ?? { item, sourceKeys: new Set<string>() }
    entry.sourceKeys.add(sourceKey)
    entry.sourceKeys.add(key)
    unique.set(key, entry)
  }

  const query = normalizeSearchText(keyword)
  const score = ({ item }: MergedEntry): number =>
    Math.max(titleMatchScore(item.title, query), titleMatchScore(item.originalTitle, query))
  return [...unique.values()].sort((left, right) => score(right) - score(left))
}

async function fetchCatalog(keyword: string, category?: Category): Promise<CatalogData> {
  const responses = await Promise.allSettled([
    allBangumi(keyword, category),
    searchNeo(keyword, category)
  ])
  if (responses.every((response) => response.status === 'rejected')) {
    throw new Error('搜索失败，请重试')
  }
  const items = responses.flatMap((response) =>
    response.status === 'fulfilled' ? response.value : []
  )
  const warning = responses
    .map((response, index) =>
      response.status === 'rejected' ? `${['Bangumi', 'NeoDB'][index]} 暂时不可用` : ''
    )
    .filter(Boolean)
    .join('；')
  return { entries: mergeEntries(items, keyword), warning }
}

function cachedCatalog(keyword: string, category?: Category): Promise<CatalogData> {
  const key = JSON.stringify([keyword, category])
  const entry = cache.get(key)
  if (entry && Date.now() - entry.time <= CACHE_TTL_MS) {
    return entry.value
  }

  const value = fetchCatalog(keyword, category)
  cache.set(key, { time: Date.now(), value })
  if (cache.size > CACHE_LIMIT) {
    cache.delete(cache.keys().next().value!)
  }
  void value.catch(() => {
    // 旧请求失败时不能删掉同一查询后来创建的新缓存。
    if (cache.get(key)?.value === value) {
      cache.delete(key)
    }
  })
  return value
}

export async function searchCatalog(
  keyword: string,
  category?: Category,
  offset = 0
): Promise<SearchPage> {
  if (typeof keyword !== 'string' || !keyword.trim() || keyword.length > 200) {
    throw new Error('请输入 1~200 字的作品名')
  }
  if (category !== undefined && !['anime', 'novel', 'movie', 'galgame'].includes(category)) {
    throw new Error('无效分类')
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('无效页码')
  }

  const { entries, warning } = await cachedCatalog(keyword.trim(), category)
  const existing = listSourceKeys()
  return {
    total: entries.length,
    warning,
    results: entries.slice(offset, offset + SEARCH_PAGE_SIZE).map(({ item, sourceKeys }) => ({
      ...item,
      exists: [...sourceKeys].some((key) => existing.has(key))
    }))
  }
}

export function importCatalog(source: string, id: string | number): Promise<ImportDraft> {
  if (source === 'bangumi') {
    return importBangumi(Number(id))
  }
  if (source === 'neodb' && typeof id === 'string') {
    return importNeo(id)
  }
  throw new Error('无效来源')
}
