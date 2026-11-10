/** NeoDB 数据源：按分类检索、识别关联条目并生成导入草稿。 */
import { net } from 'electron'
import { downloadCover } from './covers'
import { hasSourceItem } from './db'
import type { Category } from '../../shared/types'
import type { CatalogEntry, ImportDraft } from '../../shared/bangumi'
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

async function neoRequest(path: string): Promise<unknown> {
  const response = await net.fetch('https://neodb.social/api/' + path, {
    headers: { 'Accept-Language': 'zh-CN', 'User-Agent': 'media-tracker/1.0' },
    signal: AbortSignal.timeout(15000)
  })
  if (!response.ok) {
    throw new Error(`NeoDB 请求失败（${response.status}）`)
  }
  return response.json()
}

function categoryOf(item: NeoItem): Category | undefined {
  if (item.category === 'book') {
    return 'novel'
  }
  if (item.category === 'game') {
    return 'galgame'
  }
  if (['movie', 'tv', 'tvshow'].includes(item.category)) {
    return item.genre?.some((g) => /animation|动画|動畫|アニメ/i.test(g)) ? 'anime' : 'movie'
  }
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
      if (!['bgm.tv', 'bangumi.tv', 'chii.in'].includes(url.hostname)) {
        continue
      }
      const match = /^\/subject\/(\d+)\/?$/.exec(url.pathname)
      if (match) {
        return match[1]
      }
    } catch {
      /* 跳过格式错误的外部链接。 */
    }
  }
  return undefined
}

function neoCover(url = ''): string {
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
/** 顺序获取单个远程分类的全部分页，避免同时请求过多页面。 */
async function fetchKind(keyword: string, kind: string): Promise<NeoItem[]> {
  const items: NeoItem[] = []
  let pages = 1
  for (let page = 1; page <= pages; page++) {
    const query = new URLSearchParams({ query: keyword, category: kind, page: String(page) })
    const data = (await neoRequest('catalog/search?' + query)) as {
      data?: NeoItem[]
      pages: number
    }
    pages = data.pages || 1
    items.push(...(data.data ?? []))
  }
  return items
}

export async function searchNeo(keyword: string, category?: Category): Promise<CatalogEntry[]> {
  const kindsByCategory: Record<Category, string[]> = {
    novel: ['book'],
    galgame: ['game'],
    anime: ['movie', 'tv'],
    movie: ['movie', 'tv']
  }
  const kinds = category ? kindsByCategory[category] : ['book', 'movie', 'tv', 'game']
  const items: NeoItem[] = []
  for (const kind of kinds) {
    items.push(...(await fetchKind(keyword, kind)))
  }
  const result: CatalogEntry[] = []
  for (const item of items) {
    const mapped = categoryOf(item)
    if (!mapped || (category && mapped !== category)) {
      continue
    }
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
      category: mapped
    })
  }
  return result
}

export async function importNeo(id: string): Promise<ImportDraft> {
  if (!/^(book|movie|tv|game)\/[a-zA-Z0-9]+$/.test(id)) {
    throw new Error('无效作品 ID')
  }
  const item = (await neoRequest(id)) as NeoItem
  const category = categoryOf(item)
  if (!category) {
    throw new Error('暂不支持此作品类型')
  }
  const bangumiId = bgmId(item)
  if (hasSourceItem('neodb', id) || (bangumiId && hasSourceItem('bangumi', bangumiId))) {
    throw new Error('该作品已在书架中')
  }
  const roles: Record<Category, string> = {
    novel: 'author',
    galgame: 'developer',
    anime: 'production_company',
    movie: 'director'
  }
  const peopleByCategory = {
    novel: item.author,
    galgame: item.developer,
    movie: item.director,
    anime: undefined
  }
  const role = roles[category]
  const people = peopleByCategory[category]
  const producer = (
    people ??
    item.credits?.filter((c) => c.role === role).map((c) => c.name) ??
    []
  ).join('、')
  const { coverPath, warning } = await downloadCover(neoCover(item.cover_image_url), '封面下载失败')
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
