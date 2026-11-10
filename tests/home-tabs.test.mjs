/** 标签页回归：验证独立筛选、首标签保护、忙碌锁及快速切换时的滚动恢复。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextTick, ref } from 'vue'
import { loadSource } from './load-source.mjs'

test('标签独立保存筛选，忙碌时禁止增删和切换，关闭当前标签回到前一页', async (context) => {
  const scrolls = []
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  globalThis.window = { scrollY: 0, scrollTo: (_, y) => scrolls.push(y) }
  globalThis.document = { getElementById: () => null }
  context.after(() => {
    if (originalWindow === undefined) {
      delete globalThis.window
    } else {
      globalThis.window = originalWindow
    }
    if (originalDocument === undefined) {
      delete globalThis.document
    } else {
      globalThis.document = originalDocument
    }
  })
  const { useHomeTabs } = loadSource('src/renderer/src/composables/useHomeTabs.ts')
  let busy = false
  const tabs = useHomeTabs(ref('anime'), { canSwitch: () => !busy, beforeSwitch: () => {} })
  const first = tabs.activeTabId.value
  tabs.keyword.value = '第一个标签的查询'
  globalThis.window.scrollY = 150
  tabs.addHomeTab()
  const second = tabs.activeTabId.value
  assert.equal(tabs.keyword.value, '')
  assert.equal(tabs.category.value, 'anime')
  await nextTick()
  assert.deepEqual(scrolls, [0])

  busy = true
  tabs.addHomeTab()
  tabs.selectTab(first)
  tabs.closeHomeTab(second)
  assert.equal(tabs.homeTabs.value.length, 2)
  assert.equal(tabs.activeTabId.value, second)

  busy = false
  globalThis.window.scrollY = 25
  tabs.selectTab(first)
  tabs.selectTab(second)
  await nextTick()
  assert.deepEqual(scrolls, [0, 25])
  tabs.selectTab(-1)
  assert.equal(tabs.activeTabId.value, second)
  tabs.closeHomeTab(second)
  await nextTick()
  assert.equal(tabs.activeTabId.value, first)
  assert.equal(tabs.keyword.value, '第一个标签的查询')
  tabs.closeHomeTab(first)
  assert.equal(tabs.homeTabs.value.length, 1)
})
