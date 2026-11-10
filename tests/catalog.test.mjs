/** 搜索回归：验证合并判重、缓存更新、并发请求、分页及数据源降级。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSource } from './load-source.mjs'

function entry(id, title = '测试作品', extra = {}) {
  return {
    id,
    title,
    source: 'bangumi',
    bangumiId: String(id),
    originalTitle: '',
    date: '',
    typeLabel: '动画',
    image: '',
    category: 'anime',
    ...extra
  }
}

function catalog(bangumi, neo = async () => [], existing = new Set()) {
  return loadSource('src/main/catalog.ts', {
    './bangumi': { searchBangumi: bangumi },
    './neodb': { searchNeo: neo },
    './db': { listSourceKeys: () => existing }
  })
}

test('缓存远程资料，但增删作品后立即更新书架状态，保留合并来源的标识', async () => {
  const existing = new Set(['neodb:tv/abc'])
  let requests = 0
  const api = catalog(
    async () => {
      requests++
      return { results: [entry(1)], total: 1 }
    },
    async () => [entry('tv/abc', '测试作品', { source: 'neodb', bangumiId: '1' })],
    existing
  )

  let page = await api.searchCatalog('测试')
  assert.equal(page.total, 1)
  assert.equal(page.results[0].source, 'bangumi')
  assert.equal(page.results[0].exists, true)
  existing.clear()
  page = await api.searchCatalog(' 测试 ')
  assert.equal(page.results[0].exists, false)
  existing.add('bangumi:1')
  assert.equal((await api.searchCatalog('测试')).results[0].exists, true)
  assert.equal(requests, 1)
})

test('相同查询共用请求，完整匹配优先，并按统一页大小返回结果', async () => {
  let requests = 0
  const rows = Array.from({ length: 12 }, (_, index) => entry(index + 1, `测试作品 ${index}`))
  rows.push(entry(13, '测试作品'))
  const api = catalog(async () => {
    requests++
    return { results: rows, total: rows.length }
  })
  const [first, second] = await Promise.all([
    api.searchCatalog('测试作品'),
    api.searchCatalog('测试作品', undefined, 10)
  ])
  assert.equal(first.results.length, 10)
  assert.equal(first.results[0].id, 13)
  assert.equal(second.results.length, 3)
  assert.equal(first.total, 13)
  assert.equal(requests, 1)
})

test('单个来源失败时保留可用结果，全部失败后允许重试', async () => {
  const fail = async () => {
    throw new Error('网络不可用')
  }
  const partial = catalog(fail, async () => [entry('book/abc', '作品', { source: 'neodb' })])
  assert.equal((await partial.searchCatalog('作品')).warning, 'Bangumi 暂时不可用')

  let requests = 0
  const retry = catalog(async () => {
    requests++
    if (requests === 1) {
      throw new Error('网络不可用')
    }
    return { results: [entry(1)], total: 1 }
  }, fail)
  await assert.rejects(retry.searchCatalog('测试'), /搜索失败/)
  assert.equal((await retry.searchCatalog('测试')).total, 1)
  assert.equal(requests, 2)
})

test('查询、分类和分页参数不合法时拒绝访问数据源', async () => {
  const api = catalog(() => {
    throw new Error('不应请求数据源')
  })
  await assert.rejects(api.searchCatalog('  '), /作品名/)
  await assert.rejects(api.searchCatalog('测试', ''), /分类/)
  await assert.rejects(api.searchCatalog('测试', undefined, -1), /页码/)
})

test('过期请求失败不会清除同一查询的新缓存', async (context) => {
  let now = 0
  context.mock.method(Date, 'now', () => now)
  let rejectOld
  const oldRequest = new Promise((_, reject) => {
    rejectOld = reject
  })
  let requests = 0
  const api = catalog(
    () => {
      requests++
      return requests === 1 ? oldRequest : Promise.resolve({ results: [entry(1)], total: 1 })
    },
    async () => {
      throw new Error('来源不可用')
    }
  )
  const first = assert.rejects(api.searchCatalog('测试'), /搜索失败/)
  now = 120_001
  await api.searchCatalog('测试')
  rejectOld(new Error('旧请求失败'))
  await first
  await api.searchCatalog('测试')
  assert.equal(requests, 2)
})
