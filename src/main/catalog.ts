import { searchBangumi, importBangumi } from './bangumi'
import { searchNeo, importNeo } from './neodb'
import { listItems } from './db'
import type { Category } from '../../shared/types'
import type { SearchResult, SearchPage, ImportDraft } from '../../shared/bangumi'
const cache = new Map<string, { time: number; value: Promise<SearchPage> }>()
const normalize = (s: string): string =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
async function allBangumi(keyword: string, category?: Category): Promise<SearchResult[]> {
  const first = await searchBangumi(keyword, category, 0, 100)
  const rows = [...first.results]
  for (let offset = 100; offset < first.total; offset += 100)
    rows.push(...(await searchBangumi(keyword, category, offset, 100)).results)
  return rows
}
export async function searchCatalog(
  keyword: string,
  category?: Category,
  offset = 0
): Promise<SearchPage> {
  if (typeof keyword !== 'string' || !keyword.trim() || keyword.length > 200)
    throw new Error('请输入作品名')
  if (category && !['anime', 'novel', 'movie', 'galgame'].includes(category))
    throw new Error('无效分类')
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('无效页码')
  const key = JSON.stringify([keyword.trim(), category])
  let entry = cache.get(key)
  if (!entry || Date.now() - entry.time > 120000) {
    const value = (async (): Promise<SearchPage> => {
      const responses = await Promise.allSettled([
        allBangumi(keyword, category),
        searchNeo(keyword, category)
      ])
      if (responses.every((r) => r.status === 'rejected')) throw new Error('搜索失败，请重试')
      const unique = new Map<string, SearchResult>()
      for (const response of responses)
        if (response.status === 'fulfilled')
          for (const item of response.value) {
            const id = item.bangumiId ? 'bangumi:' + item.bangumiId : `${item.source}:${item.id}`
            const previous = unique.get(id)
            if (!previous) unique.set(id, item)
            else previous.exists ||= item.exists
          }
      const results = [...unique.values()]
      const q = normalize(keyword)
      const score = (item: SearchResult): number =>
        Math.max(
          ...[item.title, item.originalTitle].map((s) =>
            normalize(s) === q ? 2 : normalize(s).includes(q) ? 1 : 0
          )
        )
      results.sort((a, b) => score(b) - score(a))
      const warning = responses
        .map((r, i) => (r.status === 'rejected' ? `${i ? 'NeoDB' : 'Bangumi'} 暂时不可用` : ''))
        .filter(Boolean)
        .join('；')
      return { results, total: results.length, warning }
    })()
    entry = { time: Date.now(), value }
    cache.set(key, entry)
    if (cache.size > 20) cache.delete(cache.keys().next().value!)
    void value.catch(() => cache.delete(key))
  }
  const page = await entry.value
  const existing = listItems()
  return {
    ...page,
    results: page.results
      .slice(offset, offset + 10)
      .map((item) => ({
        ...item,
        exists:
          item.exists ||
          existing.some((i) => i.source === item.source && i.sourceId === String(item.id))
      }))
  }
}
export function importCatalog(source: string, id: string | number): Promise<ImportDraft> {
  if (source === 'bangumi') return importBangumi(Number(id))
  if (source === 'neodb' && typeof id === 'string') return importNeo(id)
  throw new Error('无效来源')
}
