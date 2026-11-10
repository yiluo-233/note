<script setup lang="ts">
/** 应用主界面：组合主页导航、作品列表和弹窗，协调编辑及批量管理。 */
import { onMounted, onBeforeUnmount, computed, ref, watch } from 'vue'
import type { Item, ItemInput } from '../../../shared/types'
import type { ImportDraft } from '../../../shared/bangumi'
import BangumiSearch from './components/BangumiSearch.vue'
import ItemEditor from './components/ItemEditor.vue'
import CategoryNavigation from './components/CategoryNavigation.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { statusesFor, coverUrl } from './constants'
import { useHomeTabs } from './composables/useHomeTabs'
import { useLibrary } from './composables/useLibrary'
import { useAppearance, useNavigationPreferences } from './composables/usePreferences'

const isWindows = window.api.platform === 'win32'
const filterMenu = ref<HTMLDetailsElement | null>(null)
const gearButton = ref<HTMLButtonElement | null>(null)
const menuOpen = ref(false)
const settingsOpen = ref(false)
const locked = ref(false)
const managing = ref(false)
const selectedIds = ref(new Set<number>())
const batchOpen = ref(false)
const batchBusy = ref(false)
const batchError = ref('')
const editing = ref<Item | null>(null)
const showEditor = ref(false)
const showSearch = ref(false)
const draft = ref<ItemInput>()
const importWarning = ref('')

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

function clickItem(item: Item): void {
  if (!managing.value) {
    openEditor(item)
    return
  }
  if (selectedIds.value.has(item.id)) {
    selectedIds.value.delete(item.id)
  } else {
    selectedIds.value.add(item.id)
  }
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

function toggleMode(): void {
  if (batchBusy.value) {
    return
  }
  cancelManagement()
  locked.value = !locked.value
  menuOpen.value = false
}

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

function openSettings(): void {
  menuOpen.value = false
  settingsOpen.value = true
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
    <div class="window-titlebar">
      <TransitionGroup
        name="home-tab"
        tag="div"
        class="home-tabs"
        role="tablist"
        aria-label="主页标签页"
      >
        <div
          v-for="(tab, index) in homeTabs"
          :key="tab.id"
          class="home-tab"
          :class="{ active: activeTabId === tab.id }"
        >
          <button
            :id="`home-tab-${tab.id}`"
            class="home-tab-select"
            role="tab"
            :aria-selected="activeTabId === tab.id"
            aria-controls="home-panel"
            @click="selectTab(tab.id)"
          >
            主页
          </button>
          <button
            v-if="index > 0"
            class="home-tab-close"
            aria-label="关闭主页标签页"
            title="关闭标签页 (Ctrl+W)"
            @click="closeHomeTab(tab.id)"
          >
            ×
          </button>
        </div>
      </TransitionGroup>
      <button
        class="new-home-tab"
        aria-label="新建主页标签页"
        title="新建主页标签页"
        @click="addHomeTab"
      >
        +
      </button>
    </div>
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
        <div class="toolbar-actions">
          <button v-if="managing" @click="cancelManagement">取消</button>
          <button
            :class="{ 'batch-delete': managing }"
            :disabled="locked || (managing && !selectedIds.size)"
            @click="manage"
          >
            {{ managing ? '删除' : '管理' }}
          </button>
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
          <button class="primary" :disabled="locked || managing" @click="openEditor(null)">
            + 添加
          </button>
        </div>
      </header>

      <p v-if="themeError" role="alert">
        {{ themeError }} <button @click="syncTitleBar">重试</button>
      </p>
      <p v-if="loadError" role="alert">{{ loadError }} <button @click="load">重试</button></p>
      <main class="wall">
        <div
          v-for="i in sortedItems"
          :key="i.id"
          class="card"
          :class="{ locked }"
          :role="managing ? 'checkbox' : undefined"
          :aria-checked="managing ? selectedIds.has(i.id) : undefined"
          :aria-label="managing ? i.title : undefined"
          :tabindex="managing ? 0 : undefined"
          @click="clickItem(i)"
          @keydown.space.prevent="managing && clickItem(i)"
          @keydown.enter.prevent="managing && clickItem(i)"
        >
          <div class="cover">
            <span
              v-if="managing"
              class="selection-box"
              :class="{ checked: selectedIds.has(i.id) }"
              aria-hidden="true"
            >
              <svg
                v-if="selectedIds.has(i.id)"
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path d="m5 12 4 4L19 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <img v-if="i.coverPath" :src="coverUrl(i.coverPath)" loading="lazy" />
            <span v-else class="ph">{{ i.title }}</span>
          </div>
          <div class="title" :title="i.title">{{ i.title }}</div>
        </div>
        <div v-if="!items.length" class="empty">还没有条目，点右上角「添加」开始吧</div>
      </main>
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

<style scoped>
.windows-shell .window-titlebar {
  padding-right: 150px;
}
.home-tabs {
  display: flex;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-app-region: no-drag;
}
.home-tab {
  display: flex;
  flex: 0 0 auto;
  width: 180px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  align-items: center;
  border-radius: 6px 6px 0 0;
  height: 30px;
  border: 1px solid transparent;
}
.home-tab-enter-active,
.home-tab-leave-active {
  transition:
    width 220ms ease,
    opacity 180ms ease,
    transform 220ms ease;
  pointer-events: none;
}
.home-tab-enter-from,
.home-tab-leave-to {
  width: 0;
  opacity: 0;
  transform: translateX(-8px);
  border-left-width: 0;
  border-right-width: 0;
}
.home-tab-close {
  flex-shrink: 0;
}
@media (prefers-reduced-motion: reduce) {
  .home-tab-enter-active,
  .home-tab-leave-active {
    transition: none;
  }
}
.home-tab.active {
  background: var(--bg);
  border-color: var(--border);
  border-bottom-color: var(--bg);
}
.home-tab-select {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 3px 10px;
  font-size: 12px;
  background: transparent;
  border: 0;
}
.home-tab-close,
.new-home-tab {
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-2);
  -webkit-app-region: no-drag;
}
.home-tab-close {
  width: 22px;
  height: 22px;
  margin-right: 5px;
  font-size: 18px;
}
.new-home-tab {
  width: 28px;
  height: 25px;
  flex-shrink: 0;
  margin: 0 4px;
  font-size: 18.4px;
  color: #aeb3bc;
}
.home-tab-close:hover,
.new-home-tab:hover {
  background: var(--border);
  color: var(--text);
}

button.batch-delete {
  background: #d32f2f;
  border-color: #d32f2f;
  color: white;
}
.selection-box {
  position: absolute;
  right: 8px;
  top: 8px;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  display: grid;
  place-items: center;
  border: 1px solid #888;
  background: transparent;
  box-shadow: 0 0 0 1px #fff9;
  z-index: 1;
}
.selection-box.checked {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}
.card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.home-placeholder,
.pen-placeholder {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  color: var(--text-2);
}
.home-placeholder {
  margin-top: 5px;
}
.pen-placeholder {
  margin-top: 8px;
  margin-bottom: auto;
}
.filter-menu {
  position: relative;
}
.filter-menu summary {
  list-style: none;
  cursor: pointer;
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.filter-menu summary::-webkit-details-marker {
  display: none;
}
.filter-menu[open] summary,
.filter-menu summary:hover {
  border-color: var(--accent);
}
.filter-menu summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.filter-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 260px;
  max-width: calc(100vw - 64px);
  padding: 16px;
  display: grid;
  gap: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 30px #0003;
  z-index: 10;
}
.filter-panel label {
  display: grid;
  gap: 8px;
  color: var(--text-2);
  font-size: 12px;
}
.filter-panel select {
  width: 100%;
  font-size: 14px;
}

.card.locked {
  cursor: default;
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.app-shell {
  --titlebar-height: 33px;
  --sidebar-width: 42px;
  padding-top: var(--titlebar-height);
}
/* 将侧边栏分隔线延伸到标题栏，同时不拦截输入事件。 */
.window-titlebar::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--sidebar-width) - 1px);
  width: 1px;
  background: var(--border);
  pointer-events: none;
}
.window-titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--titlebar-height);
  display: flex;
  align-items: center;
  padding: 3px 12px 0 var(--sidebar-width);
  background: var(--chrome-bg);
  color: var(--text-2);
  font-size: 12px;
  -webkit-app-region: drag;
  user-select: none;
  z-index: 20;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 4px;
  font-weight: 600;
}
.brand svg {
  color: var(--accent);
}
.toolbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.toolbar-actions button {
  white-space: nowrap;
}

.sidebar {
  position: fixed;
  inset: var(--titlebar-height) auto 0 0;
  width: var(--sidebar-width);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-direction: column;
  padding: 10px 0;
  background: var(--chrome-bg);
  border-right: 1px solid var(--border);
  z-index: 8;
}
.gear {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 6px;
  background: transparent;
  border-color: transparent;
  color: var(--text-2);
}
.gear:hover,
.gear[aria-expanded='true'] {
  background: var(--bg);
  color: var(--text);
  border-color: var(--border);
}
.workspace {
  margin-left: var(--sidebar-width);
  min-width: 0;
}
.menu-dismiss {
  position: fixed;
  inset: 0;
  z-index: 6;
}
.app-menu {
  position: fixed;
  left: 50px;
  bottom: 12px;
  z-index: 9;
  width: 180px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 8px 30px #0003;
}
.app-menu button {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  padding: 6px 10px;
}
.app-menu button:hover {
  background: var(--bg);
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.toolbar {
  position: sticky;
  top: var(--titlebar-height);
  z-index: 5;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 16px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.search {
  width: clamp(130px, 18vw, 220px);
}
.wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
  padding: 16px;
}
.card {
  cursor: pointer;
}
.cover {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}
.card:not(.locked):hover .cover {
  border-color: var(--accent);
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ph {
  padding: 10px;
  text-align: center;
  color: var(--text-2);
  word-break: break-all;
}
.title {
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-2);
  padding: 60px 0;
}
.toolbar > .search,
.toolbar-actions > button,
.toolbar .filter-menu > summary {
  height: 34px;
  padding-top: 0;
  padding-bottom: 0;
  line-height: 32px;
}
.toolbar .brand {
  height: 34px;
}
</style>
