/** 编辑与批量管理回归：验证锁定、搜索保留、删除忙碌保护和失败重试。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ref } from 'vue'
import { loadSource } from './load-source.mjs'

test('编辑流程保留搜索结果，清理旧草稿，并尊重鉴赏模式', async () => {
  const { useItemEditing } = loadSource('src/renderer/src/composables/useItemEditing.ts')
  const locked = ref(false)
  let loads = 0
  const state = useItemEditing(locked, async () => loads++)
  state.openEditor(null)
  const input = { title: '导入作品' }
  state.importSelected({ input, warning: '封面不可用' })
  assert.equal(state.showSearch.value, true)
  assert.equal(state.showEditor.value, true)
  assert.equal(state.draft.value.title, input.title)
  state.showEditor.value = false
  assert.equal(state.showSearch.value, true)
  state.manualAdd()
  assert.equal(state.draft.value, undefined)
  assert.equal(state.importWarning.value, '')
  const item = { id: 1, title: '已有作品' }
  state.openEditor(item)
  assert.equal(state.editing.value.id, 1)
  locked.value = true
  state.manualAdd()
  state.importSelected({ input, warning: '警告' })
  state.openEditor(null)
  assert.equal(state.editing.value.id, 1)
  assert.equal(state.draft.value, undefined)
  await state.onSaved()
  assert.equal(state.showSearch.value, false)
  assert.equal(state.showEditor.value, false)
  assert.equal(loads, 1)
})

test('删除时防止重复提交与退出管理，失败后保留选择并允许重试', async (context) => {
  const previousWindow = globalThis.window
  context.after(() => {
    if (previousWindow === undefined) {
      delete globalThis.window
    } else {
      globalThis.window = previousWindow
    }
  })
  let finish
  const calls = []
  globalThis.window = {
    api: {
      items: {
        deleteMany: (ids) => {
          calls.push(ids)
          return new Promise((resolve, reject) => {
            finish = { resolve, reject }
          })
        }
      }
    }
  }
  const { useBatchManagement } = loadSource('src/renderer/src/composables/useBatchManagement.ts')
  const locked = ref(true)
  let loads = 0
  const state = useBatchManagement(locked, async () => loads++)
  state.manage()
  assert.equal(state.managing.value, false)
  locked.value = false
  state.manage()
  state.manage()
  assert.equal(state.batchOpen.value, false)
  state.toggleSelection({ id: 7 })
  state.manage()
  const failed = state.deleteSelected()
  assert.equal(state.batchBusy.value, true)
  state.cancelManagement()
  await state.deleteSelected()
  assert.equal(state.managing.value, true)
  assert.deepEqual(calls, [[7]])
  finish.reject(new Error('失败'))
  await failed
  assert.equal(state.batchError.value, '删除失败，请重试')
  assert.equal(state.selectedIds.value.has(7), true)
  assert.equal(state.batchBusy.value, false)
  const retry = state.deleteSelected()
  finish.resolve()
  await retry
  assert.equal(state.batchOpen.value, false)
  assert.equal(state.managing.value, false)
  assert.equal(state.selectedIds.value.size, 0)
  assert.equal(loads, 1)
})
