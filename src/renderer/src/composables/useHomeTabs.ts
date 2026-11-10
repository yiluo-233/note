/** 主页标签状态：管理独立筛选条件、切换位置及首标签保护。 */
import { computed, nextTick, ref, type Ref, type WritableComputedRef } from 'vue'
import type { HomeCategory, Status } from '../../../../shared/types'
import type { SortOrder } from '../sort'
interface HomeTab {
  id: number
  category: HomeCategory
  status: Status | 'all'
  keyword: string
  sortOrder: SortOrder
  scroll: number
}

interface HomeTabsState {
  homeTabs: Ref<HomeTab[]>
  activeTabId: Ref<number>
  category: WritableComputedRef<HomeCategory>
  status: WritableComputedRef<Status | 'all'>
  keyword: WritableComputedRef<string>
  sortOrder: WritableComputedRef<SortOrder>
  selectTab: (id: number) => void
  addHomeTab: () => void
  closeHomeTab: (id: number) => void
}

export function useHomeTabs(
  initialCategory: Ref<HomeCategory>,
  hooks: { canSwitch: () => boolean; beforeSwitch: () => void }
): HomeTabsState {
  let nextTabId = 1
  function createHomeTab(): HomeTab {
    return {
      id: nextTabId++,
      category: initialCategory.value,
      status: 'all',
      keyword: '',
      sortOrder: 'created',
      scroll: 0
    }
  }
  const homeTabs = ref<HomeTab[]>([createHomeTab()])
  const activeTabId = ref(homeTabs.value[0].id)
  const activeTab = computed(() => homeTabs.value.find((tab) => tab.id === activeTabId.value)!)
  const category = computed({
    get: () => activeTab.value.category,
    set: (value: HomeCategory) => {
      activeTab.value.category = value
    }
  })
  const status = computed({
    get: () => activeTab.value.status,
    set: (value: Status | 'all') => {
      activeTab.value.status = value
    }
  })
  const keyword = computed({
    get: () => activeTab.value.keyword,
    set: (value: string) => {
      activeTab.value.keyword = value
    }
  })
  const sortOrder = computed({
    get: () => activeTab.value.sortOrder,
    set: (value: SortOrder) => {
      activeTab.value.sortOrder = value
    }
  })
  function selectTab(id: number): void {
    if (id === activeTabId.value || !hooks.canSwitch()) {
      return
    }
    const target = homeTabs.value.find((tab) => tab.id === id)
    if (!target) {
      return
    }
    activeTab.value.scroll = window.scrollY
    hooks.beforeSwitch()
    activeTabId.value = id
    void nextTick(() => {
      if (activeTabId.value !== id) {
        return
      }
      window.scrollTo(0, target.scroll)
      document
        .getElementById(`home-tab-${id}`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }
  function addHomeTab(): void {
    if (!hooks.canSwitch()) {
      return
    }
    const tab = createHomeTab()
    homeTabs.value.push(tab)
    selectTab(tab.id)
  }
  function closeHomeTab(id: number): void {
    const index = homeTabs.value.findIndex((tab) => tab.id === id)
    if (index <= 0 || !hooks.canSwitch()) {
      return
    }
    if (activeTabId.value === id) {
      selectTab(homeTabs.value[index - 1].id)
    }
    homeTabs.value.splice(index, 1)
  }
  return {
    homeTabs,
    activeTabId,
    category,
    status,
    keyword,
    sortOrder,
    selectTab,
    addHomeTab,
    closeHomeTab
  }
}
