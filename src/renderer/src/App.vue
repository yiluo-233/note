<script setup lang="ts">
/** 应用主界面：组合主页导航、作品列表和弹窗，协调编辑及批量管理。 */
import { onMounted, onBeforeUnmount, computed, ref, watch } from 'vue'
import type { Item } from '../../../shared/types'
import { useItemEditing } from './composables/useItemEditing'
import { useBatchManagement } from './composables/useBatchManagement'
import HomeTitleBar from './components/HomeTitleBar.vue'
import LibraryWall from './components/LibraryWall.vue'
import BangumiSearch from './components/BangumiSearch.vue'
import ItemEditor from './components/ItemEditor.vue'
import CategoryNavigation from './components/CategoryNavigation.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { statusesFor } from './constants'
import { useHomeTabs } from './composables/useHomeTabs'
import { useLibrary } from './composables/useLibrary'
import { useAppearance, useNavigationPreferences } from './composables/usePreferences'

const isWindows = window.api.platform === 'win32'
const filterMenu = ref<HTMLDetailsElement | null>(null)
const gearButton = ref<HTMLButtonElement | null>(null)
const menuOpen = ref(false)
const settingsOpen = ref(false)
const locked = ref(false)
const {
  managing,
  selectedIds,
  batchOpen,
  batchBusy,
  batchError,
  cancelManagement,
  manage,
  toggleSelection,
  deleteSelected
} = useBatchManagement(locked, () => load())

const {
  initialCategory,
  visibleCategories,
  navigationCategories,
  navigationReset,
  isVisible,
  resetNavigation
} = useNavigationPreferences()
const {
  homeTabs,
  activeTabId,
  category,
  status,
  keyword,
  sortOrder,
  selectTab,
  addHomeTab,
  closeHomeTab
} = useHomeTabs(initialCategory, {
  canSwitch: () => !batchBusy.value,
  beforeSwitch: () => {
    cancelManagement()
    menuOpen.value = false
    filterMenu.value?.removeAttribute('open')
  }
})
const { items, sortedItems, loadError, load } = useLibrary({
  activeTabId,
  category,
  status,
  keyword,
  sortOrder
})
const {
  editing,
  showEditor,
  showSearch,
  draft,
  importWarning,
  manualAdd,
  importSelected,
  openEditor,
  onSaved
} = useItemEditing(locked, load)
const modalOpen = computed(
  () => showSearch.value || showEditor.value || settingsOpen.value || batchOpen.value
)
const { theme, font, themeError, applyTheme, resetAppearance, syncTitleBar } =
  useAppearance(modalOpen)

// 隐藏分类时同步所有标签页，避免界面停留在不可见分类。
watch(
  visibleCategories,
  () => {
    for (const tab of homeTabs.value) {
      if (!isVisible(tab.category)) {
        tab.category = 'all'
      }
    }
  },
  { deep: true }
)
watch([category, status, keyword], () => selectedIds.value.clear())

function clickItem(item: Item): void {
  if (!managing.value) {
    openEditor(item)
    return
  }
  toggleSelection(item)
}

function toggleMode(): void {
  if (batchBusy.value) {
    return
  }
  cancelManagement()
  locked.value = !locked.value
  menuOpen.value = false
}

function openSettings(): void {
  menuOpen.value = false
  settingsOpen.value = true
}

async function checkUpdates(): Promise<void> {
  menuOpen.value = false
  await window.api.updates.check()
}

function resetSettings(): void {
  resetNavigation()
  resetAppearance()
  locked.value = false
  status.value = 'all'
  category.value = 'all'
  keyword.value = ''
  sortOrder.value = 'created'
}

function dismissFilter(event: PointerEvent): void {
  if (event.target instanceof Node && !filterMenu.value?.contains(event.target)) {
    filterMenu.value?.removeAttribute('open')
  }
}

function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
    event.preventDefault()
    if (!document.querySelector('dialog[open]')) {
      closeHomeTab(activeTabId.value)
    }
    return
  }
  if (event.key !== 'Escape') {
    return
  }
  if (filterMenu.value?.open) {
    filterMenu.value.open = false
    filterMenu.value.querySelector('summary')?.focus()
  }
  if (!menuOpen.value) {
    return
  }
  menuOpen.value = false
  gearButton.value?.focus()
}

onMounted(() => {
  document.addEventListener('pointerdown', dismissFilter)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', dismissFilter)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="app-shell" :class="{ 'windows-shell': isWindows }">
    <HomeTitleBar
      :home-tabs="homeTabs"
      :active-tab-id="activeTabId"
      @select="selectTab"
      @close="closeHomeTab"
      @add="addHomeTab"
    />
    <aside class="sidebar" aria-label="应用导航">
      <span class="home-placeholder" role="img" aria-label="主页" title="主页">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          aria-hidden="true"
        >
          <path
            d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="pen-placeholder" role="img" aria-label="笔记" title="笔记">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m16 3 5 5L8 21H3v-5L16 3ZM13 6l5 5M3 16l5 5" />
        </svg>
      </span>
      <button
        ref="gearButton"
        class="gear"
        aria-label="打开应用菜单"
        title="应用菜单"
        :aria-expanded="menuOpen"
        aria-controls="app-menu"
        @click="menuOpen = !menuOpen"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          aria-hidden="true"
        >
          <path
            d="m9.5 3-.6 2.3-1.5.9-2.3-.6-2.5 4.3 1.7 1.7v1.8l-1.7 1.7 2.5 4.3 2.3-.6 1.5.9.6 2.3h5l.6-2.3 1.5-.9 2.3.6 2.5-4.3-1.7-1.7v-1.8l1.7-1.7-2.5-4.3-2.3.6-1.5-.9L14.5 3Z"
          />
          <circle cx="12" cy="12.5" r="3" />
        </svg>
      </button>
    </aside>
    <div v-if="menuOpen" class="menu-dismiss" @click="menuOpen = false" />
    <nav v-if="menuOpen" id="app-menu" class="app-menu" aria-label="应用菜单">
      <button @click="toggleMode">切换编辑/鉴赏模式</button>
      <button @click="openSettings">设置</button>
      <button :disabled="modalOpen" @click="checkUpdates">检查更新</button>
    </nav>
    <div
      id="home-panel"
      class="workspace"
      role="tabpanel"
      :aria-labelledby="`home-tab-${activeTabId}`"
    >
      <header class="toolbar">
        <div class="brand">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
          >
            <rect x="4" y="3" width="16" height="18" rx="3" />
            <path d="M8 7h8M8 11h8M8 15h4" /></svg
          ><span>note</span>
        </div>
        <CategoryNavigation
          :key="navigationReset"
          v-model="category"
          :options="navigationCategories"
        />

        <input
          v-model="keyword"
          placeholder="搜索标题 / 原名"
          aria-label="搜索标题或原名"
          class="search"
        />
        <details ref="filterMenu" class="filter-menu">
          <summary>筛选</summary>
          <div class="filter-panel">
            <label
              >状态<select v-model="status" aria-label="状态筛选">
                <option value="all">全部</option>
                <option v-for="s in statusesFor(category)" :key="s.value" :value="s.value">
                  {{ category !== 'galgame' && s.value === 'done' ? '已看' : s.label }}
                </option>
              </select></label
            >
            <label
              >排序<select v-model="sortOrder" aria-label="排序方式">
                <option value="rating">评分</option>
                <option value="created">添加时间</option>
                <option value="title">作品首字母（中文标题）</option>
                <option value="original">作品首字母（原文标题）</option>
              </select></label
            >
          </div>
        </details>
        <div class="toolbar-actions">
          <button v-if="managing" @click="cancelManagement">取消</button>
          <button
            :class="{ 'batch-delete': managing }"
            :disabled="locked || (managing && !selectedIds.size)"
            @click="manage"
          >
            {{ managing ? '删除' : '管理' }}
          </button>

          <button class="primary" :disabled="locked || managing" @click="openEditor(null)">
            + 添加
          </button>
        </div>
      </header>

      <p v-if="themeError" role="alert">
        {{ themeError }} <button @click="syncTitleBar">重试</button>
      </p>
      <p v-if="loadError" role="alert">{{ loadError }} <button @click="load">重试</button></p>
      <LibraryWall
        :items="sortedItems"
        :empty="!items.length"
        :locked="locked"
        :managing="managing"
        :selected-ids="selectedIds"
        @select="clickItem"
      />
    </div>
    <SettingsDialog
      v-model:open="settingsOpen"
      v-model:font="font"
      v-model:initial-category="initialCategory"
      v-model:visible-categories="visibleCategories"
      :theme="theme"
      @theme="applyTheme"
      @reset="resetSettings"
      @closed="gearButton?.focus()"
    />
    <ConfirmDialog
      v-model:open="batchOpen"
      :message="`是否删除选中的 ${selectedIds.size} 部作品？`"
      :confirm-label="batchBusy ? '删除中…' : '删除'"
      :busy="batchBusy"
      :error="batchError"
      @confirm="deleteSelected"
    />
    <BangumiSearch
      v-if="showSearch"
      :category="category === 'all' ? undefined : category"
      @close="showSearch = false"
      @manual="manualAdd"
      @selected="importSelected"
    />
    <ItemEditor
      v-if="showEditor"
      :item="editing"
      :initial="draft"
      :import-warning="importWarning"
      :default-category="category === 'all' ? 'anime' : category"
      @saved="onSaved"
      @close="showEditor = false"
    />
  </div>
</template>

<style scoped src="./assets/application.css"></style>
