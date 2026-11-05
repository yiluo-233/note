import { net } from 'electron'
import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { coversDir } from './covers'
import { listItems } from './db'
import type { Category } from '../../shared/types'
import type { SearchResult, ImportDraft } from '../../shared/bangumi'
interface NeoItem {
  uuid: string
  category: string
  title?: string
  orig_title?: string
  display_title?: string
  localized_title?: { lang: string; text: string }[]
  genre?: string[]
  cover_image_url?: string
  author?: string[]
  director?: string[]
  developer?: string[]
  pub_year?: number
  year?: number
  release_date?: string
  release_year?: number
  credits?: { role: string; name: string }[]
  external_resources?: { url: string }[]
}
export async function neoRequest(path: string): Promise<unknown> {
  const response = await net.fetch('https://neodb.social/api/' + path, {
    headers: { 'Accept-Language': 'zh-CN', 'User-Agent': 'media-tracker/1.0' },
    signal: AbortSignal.timeout(15000)
  })
  if (!response.ok) throw new Error(`NeoDB 请求失败（${response.status}）`)
  return response.json()
}
function categoryOf(item: NeoItem): Category | undefined {
  if (item.category === 'book') return 'novel'
  if (item.category === 'game') return 'galgame'
  if (['movie', 'tv', 'tvshow'].includes(item.category))
    return item.genre?.some((g) => /animation|动画|動畫|アニメ/i.test(g)) ? 'anime' : 'movie'
  return undefined
}
function titleOf(item: NeoItem): string {
  const titles = item.localized_title ?? []
  return (
    titles.find((t) => ['zh-cn', 'zh-hans'].includes(t.lang.toLowerCase()))?.text ??
    titles.find((t) => t.lang.startsWith('zh'))?.text ??
    item.title ??
    item.display_title ??
    ''
  )
}
function bgmId(item: NeoItem): string | undefined {
  for (const resource of item.external_resources ?? []) {
    try {
      const url = new URL(resource.url)
      if (['bgm.tv', 'bangumi.tv', 'chii.in'].includes(url.hostname)) {
        const match = /^\/subject\/(\d+)\/?$/.exec(url.pathname)
        if (match) return match[1]
      }
    } catch {
      /* Ignore malformed external links. */
    }
  }
  return undefined
}
export function neoCover(url = ''): string {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' &&
      parsed.hostname === 'neodb.social' &&
      parsed.pathname.startsWith('/m/')
      ? parsed.href
      : ''
  } catch {
    return ''
  }
}
export async function searchNeo(keyword: string, category?: Category): Promise<SearchResult[]> {
  const kinds =
    category === 'novel'
      ? ['book']
      : category === 'galgame'
        ? ['game']
        : category
          ? ['movie', 'tv']
          : ['book', 'movie', 'tv', 'game']
  const existing = listItems()
  const result: SearchResult[] = []
  for (const kind of kinds) {
    let pages = 1
    for (let page = 1; page <= pages; page++) {
      const data = (await neoRequest(
        'catalog/search?' +
          new URLSearchParams({ query: keyword, category: kind, page: String(page) })
      )) as { data: NeoItem[]; pages: number }
      pages = data.pages || 1
      for (const item of data.data ?? []) {
        const mapped = categoryOf(item)
        if (!mapped || (category && mapped !== category)) continue
        const id = `${item.category === 'tvshow' ? 'tv' : item.category}/${item.uuid}`
        const bangumiId = bgmId(item)
        result.push({
          id,
          source: 'neodb',
          bangumiId,
          title: titleOf(item),
          originalTitle: item.orig_title || '',
          date: String(item.pub_year || item.year || item.release_year || item.release_date || ''),
          typeLabel: { anime: '动画', novel: '书籍', movie: '电影', galgame: '视觉小说' }[mapped],
          image: neoCover(item.cover_image_url),
          category: mapped,
          exists: existing.some(
            (i) =>
              (i.source === 'neodb' && i.sourceId === id) ||
              (bangumiId && i.source === 'bangumi' && i.sourceId === bangumiId)
          )
        })
      }
    }
  }
  return result
}
export async function importNeo(id: string): Promise<ImportDraft> {
  if (!/^(book|movie|tv|game)\/[a-zA-Z0-9]+$/.test(id)) throw new Error('无效作品 ID')
  const item = (await neoRequest(id)) as NeoItem
  const category = categoryOf(item)
  if (!category) throw new Error('暂不支持此作品类型')
  const bangumiId = bgmId(item)
  if (
    listItems().some(
      (i) =>
        (i.source === 'neodb' && i.sourceId === id) ||
        (bangumiId && i.source === 'bangumi' && i.sourceId === bangumiId)
    )
  )
    throw new Error('该作品已在书架中')
  const role =
    category === 'novel'
      ? 'author'
      : category === 'galgame'
        ? 'developer'
        : category === 'anime'
          ? 'production_company'
          : 'director'
  const people =
    category === 'novel'
      ? item.author
      : category === 'galgame'
        ? item.developer
        : category === 'movie'
          ? item.director
          : undefined
  const producer = (
    people ??
    item.credits?.filter((c) => c.role === role).map((c) => c.name) ??
    []
  ).join('、')
  let coverPath = '',
    warning = ''
  const url = neoCover(item.cover_image_url)
  if (url) {
    try {
      const response = await net.fetch(url, {
        signal: AbortSignal.timeout(15000),
        redirect: 'error'
      })
      const ext = (
        {
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/webp': '.webp',
          'image/gif': '.gif'
        } as Record<string, string>
      )[response.headers.get('content-type')?.split(';')[0] || '']
      if (!response.ok || !ext) throw new Error('Invalid image')
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length > 15 * 1024 * 1024) throw new Error('Image too large')
      const name = randomUUID() + ext
      await writeFile(join(coversDir(), name), bytes)
      coverPath = name
    } catch {
      warning = '封面下载失败'
    }
  }
  const year =
    Number(item.pub_year || item.year || item.release_year || item.release_date?.slice(0, 4)) ||
    null
  return {
    input: {
      category,
      title: titleOf(item),
      originalTitle: item.orig_title || '',
      year,
      producer,
      coverPath,
      status: 'wish',
      rating: null,
      review: '',
      tags: [],
      source: 'neodb',
      sourceId: id
    },
    warning
  }
}
