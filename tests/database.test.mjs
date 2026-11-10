/** 数据层回归：使用内存数据库验证来源判重、标签归一化和批量删除原子性。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { loadSource } from './load-source.mjs'

function database(context) {
  const connection = new DatabaseSync(':memory:')
  context.after(() => connection.close())
  const api = loadSource('src/main/db.ts', {
    electron: { app: { getPath: () => '.' } },
    'node:sqlite': {
      DatabaseSync: class {
        constructor() {
          return connection
        }
      }
    }
  })
  api.initDb()
  return { api, connection }
}

function input(extra = {}) {
  return {
    category: 'anime',
    title: ' 测试作品 ',
    originalTitle: '',
    year: null,
    producer: '',
    coverPath: '',
    status: 'wish',
    rating: null,
    review: '',
    tags: [' 标签 ', '标签', ''],
    source: 'bangumi',
    sourceId: '1',
    ...extra
  }
}

test('来源判重与条目更新保持原有数据格式，过滤条件可以组合', (context) => {
  const { api } = database(context)
  const item = api.addItem(input())
  assert.equal(item.title, '测试作品')
  assert.deepEqual(item.tags, ['标签'])
  assert.equal(api.hasSourceItem('bangumi', '1'), true)
  assert.deepEqual([...api.listSourceKeys()], ['bangumi:1'])
  assert.throws(() => api.addItem(input()), /已在书架/)
  api.updateItem(item.id, input({ rating: 8.5, status: 'done' }))
  assert.equal(
    api.listItems({ category: 'anime', status: 'done', keyword: '测试', tag: '标签' })[0].rating,
    8.5
  )
  assert.deepEqual(api.listTags(), ['标签'])
  assert.equal(api.updateItem(999, input()), null)
})

test('批量删除先验证全部参数，去重后执行，并支持空列表', (context) => {
  const { api } = database(context)
  const first = api.addItem(input())
  const second = api.addItem(input({ sourceId: '2' }))
  assert.throws(() => api.deleteItems([first.id, -1]), /无效作品/)
  assert.equal(api.listItems().length, 2)
  api.deleteItems([])
  api.deleteItems([first.id, first.id, second.id])
  assert.equal(api.listItems().length, 0)
  assert.equal(api.listSourceKeys().size, 0)
})

test('批量删除中途失败时回滚已经删除的作品', (context) => {
  const { api, connection } = database(context)
  const first = api.addItem(input())
  const second = api.addItem(input({ sourceId: '2' }))
  connection.exec(`CREATE TRIGGER block_delete BEFORE DELETE ON items
    WHEN OLD.id = ${second.id} BEGIN SELECT RAISE(ABORT, '模拟删除失败'); END`)
  assert.throws(() => api.deleteItems([first.id, second.id]), /模拟删除失败/)
  assert.equal(api.listItems().length, 2)
})
