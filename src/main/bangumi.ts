import { net } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { coversDir } from './covers'
import { listItems } from './db'
import type { Category } from '../../shared/types'
import type { SearchPage, ImportDraft } from '../../shared/bangumi'
interface Subject {
  id: number
  type: number
  name?: string
  name_cn?: string
  date?: string
  platform?: string
  images?: { common?: string; large?: string }
  infobox?: { key: string; value: string | { v: string }[] }[]
}
const types: Record<Category, number> = { novel: 1, anime: 2, movie: 6, galgame: 4 }
const categories: Record<number, Category> = { 1: 'novel', 2: 'anime', 6: 'movie', 4: 'galgame' }
const labels: Record<number, string> = { 1: '书籍', 2: '动画', 6: '三次元', 4: '视觉小说' }
const headers = {
  'User-Agent': 'media-tracker/1.0 (personal desktop library)',
  'Content-Type': 'application/json'
}
async function request(path: string, body?: unknown): Promise<unknown> {
  try {
    const response = await net.fetch('https://api.bgm.tv/v0/' + path, {
      method: body ? 'POST' : 'GET',
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000)
    })
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? 'Bangumi 请求过于频繁，请稍后再试'
          : `Bangumi 请求失败（${response.status}）`
      )
    return await response.json()
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.includes('Bangumi')
        ? error.message
        : '无法连接 Bangumi，请稍后重试',
      { cause: error }
    )
  }
}
function imageUrl(value = ''): string {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'lain.bgm.tv' ? url.href : ''
  } catch {
    return ''
  }
}
function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
}
export async function searchBangumi(
  keyword: string,
  category?: Category,
  offset = 0,
  limit = 10
): Promise<SearchPage> {
  if (typeof keyword !== 'string' || !keyword.trim() || keyword.length > 200)
    throw new Error('请输入 1~200 字的作品名')
  if (category !== undefined && !Object.hasOwn(types, category)) throw new Error('无效分类')
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('无效页码')
  const page = (await request(`search/subjects?limit=${limit}&offset=${offset}`, {
    keyword: keyword.trim(),
    sort: 'match',
    filter: { type: category ? [types[category]] : [1, 2, 4, 6] }
  })) as { data?: Subject[]; total?: number }
  const existing = new Set(
    listItems()
      .filter((i) => i.source === 'bangumi')
      .map((i) => i.sourceId)
  )
  const query = normalize(keyword)
  const subjects = (page.data ?? []).filter((s) => categories[s.type])
  subjects.sort(
    (a, b) =>
      Number([b.name, b.name_cn].some((n) => n && normalize(n) === query)) -
      Number([a.name, a.name_cn].some((n) => n && normalize(n) === query))
  )
  return {
    total: page.total ?? subjects.length,
    results: subjects.map((s) => ({
      id: s.id,
      source: 'bangumi',
      bangumiId: String(s.id),
      title: s.name_cn || s.name || '',
      originalTitle: s.name || '',
      date: s.date || '',
      typeLabel: [labels[s.type], s.platform].filter(Boolean).join(' · '),
      image: imageUrl(s.images?.common),
      category: categories[s.type],
      exists: existing.has(String(s.id))
    }))
  }
}
export async function importBangumi(id: number): Promise<ImportDraft> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('无效作品 ID')
  if (listItems().some((i) => i.source === 'bangumi' && i.sourceId === String(id)))
    throw new Error('该作品已在书架中')
  const s = (await request(`subjects/${id}`)) as Subject
  const category = categories[s.type]
  if (!category) throw new Error('暂不支持此作品类型')
  const keys: Record<Category, string[]> = {
    anime: ['动画制作'],
    novel: ['作者'],
    movie: ['导演'],
    galgame: ['开发', '开发商', '游戏开发']
  }
  const producer = (s.infobox ?? [])
    .filter((i) => keys[category].includes(i.key))
    .map((i) => (typeof i.value === 'string' ? i.value : i.value.map((v) => v.v).join('、')))
    .filter(Boolean)
    .join('、')
  let coverPath = '',
    warning = ''
  const url = imageUrl(s.images?.large || s.images?.common)
  if (url) {
    try {
      const response = await net.fetch(url, {
        signal: AbortSignal.timeout(15000),
        redirect: 'error'
      })
      const mime = response.headers.get('content-type')?.split(';')[0]
      const ext = (
        {
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/webp': '.webp',
          'image/gif': '.gif'
        } as Record<string, string>
      )[mime || '']
      if (!response.ok || !ext) throw new Error('Invalid cover')
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length > 15 * 1024 * 1024) throw new Error('Cover too large')
      const name = randomUUID() + ext
      await writeFile(join(coversDir(), name), bytes)
      coverPath = name
    } catch {
      warning = '封面下载失败，其余资料已填写，可手动选择封面。'
    }
  }
  const year = /^([1-9]\d{3})/.exec(s.date || '')
  return {
    input: {
      category,
      title: s.name_cn || s.name || '',
      originalTitle: s.name || '',
      year: year ? Number(year[1]) : null,
      producer,
      coverPath,
      status: 'wish',
      rating: null,
      review: '',
      tags: [],
      source: 'bangumi',
      sourceId: String(id)
    },
    warning
  }
}
