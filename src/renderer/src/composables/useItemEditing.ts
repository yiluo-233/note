/** 作品编辑流程：协调搜索、手动添加、导入草稿和保存后的刷新。 */
import { ref, type Ref } from 'vue'
import type { Item, ItemInput } from '../../../../shared/types'
import type { ImportDraft } from '../../../../shared/bangumi'

interface ItemEditingState {
  editing: Ref<Item | null>
  showEditor: Ref<boolean>
  showSearch: Ref<boolean>
  draft: Ref<ItemInput | undefined>
  importWarning: Ref<string>
  manualAdd: () => void
  importSelected: (result: ImportDraft) => void
  openEditor: (item: Item | null) => void
  onSaved: () => Promise<void>
}

export function useItemEditing(locked: Ref<boolean>, load: () => Promise<void>): ItemEditingState {
  const editing = ref<Item | null>(null)
  const showEditor = ref(false)
  const showSearch = ref(false)
  const draft = ref<ItemInput>()
  const importWarning = ref('')
  // 搜索与编辑独立显示，取消编辑后仍可返回原来的搜索结果。
  function manualAdd(): void {
    if (locked.value) {
      return
    }
    draft.value = undefined
    importWarning.value = ''
    editing.value = null
    showEditor.value = true
  }

  function importSelected(result: ImportDraft): void {
    if (locked.value) {
      return
    }
    draft.value = result.input
    importWarning.value = result.warning
    editing.value = null
    showEditor.value = true
  }

  function openEditor(item: Item | null): void {
    if (locked.value) {
      return
    }
    if (!item) {
      showSearch.value = true
      return
    }
    draft.value = undefined
    importWarning.value = ''
    editing.value = item
    showEditor.value = true
  }

  async function onSaved(): Promise<void> {
    showSearch.value = false
    showEditor.value = false
    await load()
  }

  return {
    editing,
    showEditor,
    showSearch,
    draft,
    importWarning,
    manualAdd,
    importSelected,
    openEditor,
    onSaved
  }
}
