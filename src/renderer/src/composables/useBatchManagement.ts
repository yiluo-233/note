/** 批量管理：维护选择状态、忙碌保护和删除确认。 */
import { ref, type Ref } from 'vue'
import type { Item } from '../../../../shared/types'

interface BatchManagementState {
  managing: Ref<boolean>
  selectedIds: Ref<Set<number>>
  batchOpen: Ref<boolean>
  batchBusy: Ref<boolean>
  batchError: Ref<string>
  cancelManagement: () => void
  manage: () => void
  toggleSelection: (item: Item) => void
  deleteSelected: () => Promise<void>
}

export function useBatchManagement(
  locked: Ref<boolean>,
  load: () => Promise<void>
): BatchManagementState {
  const managing = ref(false)
  const selectedIds = ref(new Set<number>())
  const batchOpen = ref(false)
  const batchBusy = ref(false)
  const batchError = ref('')
  function cancelManagement(): void {
    if (batchBusy.value) {
      return
    }
    managing.value = false
    selectedIds.value.clear()
  }

  function manage(): void {
    if (locked.value || batchBusy.value) {
      return
    }
    if (!managing.value) {
      managing.value = true
      return
    }
    if (!selectedIds.value.size) {
      return
    }
    batchError.value = ''
    batchOpen.value = true
  }

  async function deleteSelected(): Promise<void> {
    if (batchBusy.value || locked.value || !selectedIds.value.size) {
      return
    }
    batchBusy.value = true
    batchError.value = ''
    try {
      await window.api.items.deleteMany([...selectedIds.value])
      batchOpen.value = false
      managing.value = false
      selectedIds.value.clear()
      await load()
    } catch {
      batchError.value = '删除失败，请重试'
    } finally {
      batchBusy.value = false
    }
  }

  function toggleSelection(item: Item): void {
    if (selectedIds.value.has(item.id)) {
      selectedIds.value.delete(item.id)
    } else {
      selectedIds.value.add(item.id)
    }
  }

  return {
    managing,
    selectedIds,
    batchOpen,
    batchBusy,
    batchError,
    cancelManagement,
    manage,
    toggleSelection,
    deleteSelected
  }
}
