/** 列表回归：模拟请求乱序，确保旧响应和旧错误不会覆盖当前筛选结果。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as vue from 'vue'
import { loadSource } from './load-source.mjs'

test('仅接受最新请求，卸载后忽略仍未完成的响应', async (context) => {
  const requests = []
  const originalWindow = globalThis.window
  globalThis.window = {
    api: {
      items: {
        list: (filter) =>
          new Promise((resolve, reject) => {
            requests.push({ filter, resolve, reject })
          })
      }
    }
  }
  const scope = vue.effectScope()
  let unmount
  context.after(() => {
    scope.stop()
    if (originalWindow === undefined) {
      delete globalThis.window
    } else {
      globalThis.window = originalWindow
    }
  })
  const { useLibrary } = loadSource('src/renderer/src/composables/useLibrary.ts', {
    vue: {
      ...vue,
      onBeforeUnmount: (callback) => {
        unmount = callback
      }
    }
  })
  const keyword = vue.ref('旧查询')
  const library = scope.run(() =>
    useLibrary({
      activeTabId: vue.ref(1),
      category: vue.ref('all'),
      status: vue.ref('all'),
      keyword,
      sortOrder: vue.ref('created')
    })
  )
  keyword.value = ' 新查询 '
  await vue.nextTick()
  assert.deepEqual(requests[1].filter, {
    category: undefined,
    status: undefined,
    keyword: '新查询'
  })
  requests[1].resolve([{ id: 2, title: '新结果' }])
  await Promise.resolve()
  requests[0].reject(new Error('旧错误'))
  await Promise.resolve()
  assert.equal(library.items.value[0].id, 2)
  assert.equal(library.loadError.value, '')
  const pending = library.load()
  unmount()
  requests[2].resolve([{ id: 3, title: '过期结果' }])
  await pending
  assert.equal(library.items.value[0].id, 2)
})
