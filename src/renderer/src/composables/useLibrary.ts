/** 作品列表：根据当前筛选读取和排序，只接受最新请求的结果。 */
import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { HomeCategory, Item, Status } from '../../../../shared/types'
import { sortItems, type SortOrder } from '../sort'

interface LibraryState {
  items: Ref<Item[]>
  sortedItems: ComputedRef<Item[]>
  loadError: Ref<string>
  load: () => Promise<void>
}

export function useLibrary(filters: {
  activeTabId: Ref<number>
  category: Ref<HomeCategory>
  status: Ref<Status | 'all'>
  keyword: Ref<string>
  sortOrder: Ref<SortOrder>
}): LibraryState {
  const items = ref<Item[]>([])
  const loadError = ref('')
  const sortedItems = computed(() => sortItems(items.value, filters.sortOrder.value))
  let loadVersion = 0

  async function load(): Promise<void> {
    const version = ++loadVersion
    loadError.value = ''
    try {
      const result = await window.api.items.list({
        category: filters.category.value === 'all' ? undefined : filters.category.value,
        status: filters.status.value === 'all' ? undefined : filters.status.value,
        keyword: filters.keyword.value.trim() || undefined
      })
      if (version === loadVersion) {
        items.value = result
      }
    } catch {
      if (version === loadVersion) {
        loadError.value = '加载失败，请重试'
      }
    }
  }

  watch([filters.activeTabId, filters.category, filters.status, filters.keyword], load, {
    immediate: true
  })
  onBeforeUnmount(() => loadVersion++)

  return { items, sortedItems, loadError, load }
}
