<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, ref, watch, nextTick } from 'vue'
import type { Category, Item, ItemInput, Status } from '../../../shared/types'
import { CHROME_COLORS } from '../../../shared/theme'
import BangumiSearch from './components/BangumiSearch.vue'
import type { ImportDraft } from '../../../shared/bangumi'
import HighlightText from './components/HighlightText.vue'
import ItemEditor from './components/ItemEditor.vue'
import { CATEGORIES, statusesFor, coverUrl } from './constants'

import { sortItems, type SortOrder } from './sort'
import CategoryNavigation from './components/CategoryNavigation.vue'

type HomeCategory = Category | 'all'
const categoryOptions: { value: HomeCategory; label: string }[] = [
  { value: 'all', label: '全部' },
  ...CATEGORIES
]
const savedInitial = localStorage.getItem('initialCategory')
const initialCategory = ref<HomeCategory>(
  categoryOptions.find((c) => c.value === savedInitial)?.value ?? 'all'
)
watch(initialCategory, (value) => {
  localStorage.setItem('initialCategory', value)
  if (value !== 'all' && !visibleCategories.value.includes(value))
    visibleCategories.value.push(value)
})
interface HomeTab {
  id: number
  category: HomeCategory
  status: Status | 'all'
  keyword: string
  sortOrder: SortOrder
  scroll: number
}
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
  if (id === activeTabId.value || batchBusy.value) return
  activeTab.value.scroll = window.scrollY
  cancelManagement()
  menuOpen.value = false
  filterMenu.value?.removeAttribute('open')
  activeTabId.value = id
  void nextTick(() => {
    window.scrollTo(0, activeTab.value.scroll)
    document
      .getElementById(`home-tab-${id}`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}
function addHomeTab(): void {
  const tab = createHomeTab()
  homeTabs.value.push(tab)
  selectTab(tab.id)
}
function closeHomeTab(id: number): void {
  const index = homeTabs.value.findIndex((tab) => tab.id === id)
  if (index <= 0 || batchBusy.value) return
  if (activeTabId.value === id) selectTab(homeTabs.value[index - 1].id)
  homeTabs.value.splice(index, 1)
}
const filterMenu = ref<HTMLDetailsElement | null>(null)
function dismissFilter(event: PointerEvent): void {
  if (event.target instanceof Node && !filterMenu.value?.contains(event.target))
    filterMenu.value?.removeAttribute('open')
}
onMounted(() => document.addEventListener('pointerdown', dismissFilter))
onBeforeUnmount(() => document.removeEventListener('pointerdown', dismissFilter))
const isWindows = window.api.platform === 'win32'
const managing = ref(false)
const selectedIds = ref(new Set<number>())
const batchDialog = ref<HTMLDialogElement | null>(null)
const batchOpen = ref(false)
const batchBusy = ref(false)
const batchError = ref('')
function cancelManagement(): void {
  if (batchBusy.value) return
  managing.value = false
  selectedIds.value = new Set()
}
function manage(): void {
  if (locked.value) return
  if (!managing.value) {
    managing.value = true
    return
  }
  if (!selectedIds.value.size) return
  batchError.value = ''
  batchOpen.value = true
  batchDialog.value?.showModal()
}
function clickItem(item: Item): void {
  if (!managing.value) {
    openEditor(item)
    return
  }
  if (selectedIds.value.has(item.id)) selectedIds.value.delete(item.id)
  else selectedIds.value.add(item.id)
}
async function deleteSelected(): Promise<void> {
  if (batchBusy.value || locked.value || !selectedIds.value.size) return
  batchBusy.value = true
  batchError.value = ''
  try {
    await window.api.items.deleteMany([...selectedIds.value])
    batchDialog.value?.close()
    managing.value = false
    selectedIds.value = new Set()
    await load()
  } catch {
    batchError.value = '删除失败，请重试'
  } finally {
    batchBusy.value = false
  }
}
const locked = ref(false)
function toggleMode(): void {
  cancelManagement()
  locked.value = !locked.value
  menuOpen.value = false
}
const items = ref<Item[]>([])
const sortedItems = computed(() => sortItems(items.value, sortOrder.value))
function loadVisibleCategories(): Category[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('visibleCategories') ?? 'null')
    if (Array.isArray(saved)) return CATEGORIES.map((c) => c.value).filter((c) => saved.includes(c))
  } catch {
    /* Use defaults for invalid settings. */
  }
  return CATEGORIES.map((c) => c.value)
}
const visibleCategories = ref<Category[]>(loadVisibleCategories())
const navigationCategories = computed(() =>
  categoryOptions.filter((c) => c.value === 'all' || visibleCategories.value.includes(c.value))
)
if (initialCategory.value !== 'all' && !visibleCategories.value.includes(initialCategory.value))
  visibleCategories.value.push(initialCategory.value)
watch(
  visibleCategories,
  () => {
    localStorage.setItem('visibleCategories', JSON.stringify(visibleCategories.value))
    for (const tab of homeTabs.value)
      if (tab.category !== 'all' && !visibleCategories.value.includes(tab.category))
        tab.category = 'all'
    if (initialCategory.value !== 'all' && !visibleCategories.value.includes(initialCategory.value))
      initialCategory.value = 'all'
  },
  { deep: true }
)
watch([category, status, keyword], () => {
  selectedIds.value = new Set()
})
const editing = ref<Item | null>(null)
const showEditor = ref(false)
const showSearch = ref(false)
const draft = ref<ItemInput>()
const importWarning = ref('')
function manualAdd(): void {
  draft.value = undefined
  importWarning.value = ''
  editing.value = null
  showEditor.value = true
}
function importSelected(result: ImportDraft): void {
  if (locked.value) return
  draft.value = result.input
  importWarning.value = result.warning
  editing.value = null
  showEditor.value = true
}
const menuOpen = ref(false)
const gearButton = ref<HTMLButtonElement | null>(null)
const settingsOpen = ref(false)
const settingsSection = ref<'appearance' | 'general' | 'display'>('general')
const settingsQuery = ref('')
const resetDialog = ref<HTMLDialogElement | null>(null)
function matchesSettings(section: 'appearance' | 'general' | 'display'): boolean {
  const text = {
    appearance: '外观 主题 浅色 深色 字体 默认字体',
    general: '通用 语言 中文 English',
    display: '显示 导航栏 展示 初始界面 启动 默认 全部 动画 电影 书籍 视觉小说'
  }[section]
  return text.toLowerCase().includes(settingsQuery.value.trim().toLowerCase())
}
watch(settingsQuery, () => {
  if (!matchesSettings(settingsSection.value)) {
    const match = (['general', 'appearance', 'display'] as const).find(matchesSettings)
    if (match) settingsSection.value = match
  }
})
const navigationReset = ref(0)
const language = ref('zh')
const font = ref(localStorage.getItem('font') ?? '')
const fonts = ref<string[]>([])
const fontLoading = ref(false)
const settingsError = ref('')
function applyFont(): void {
  if (font.value) {
    document.documentElement.style.setProperty('--app-font', JSON.stringify(font.value))
    localStorage.setItem('font', font.value)
  } else {
    document.documentElement.style.removeProperty('--app-font')
    localStorage.removeItem('font')
  }
}
watch(font, applyFont)
onMounted(() => {
  applyFont()
  void loadFonts()
})
async function loadFonts(): Promise<void> {
  fontLoading.value = true
  settingsError.value = ''
  try {
    fonts.value = await window.api.fonts.list()
  } catch {
    settingsError.value = '字体加载失败'
  } finally {
    fontLoading.value = false
  }
}
function resetSettings(): void {
  resetDialog.value?.close()
  initialCategory.value = 'all'
  navigationReset.value++
  localStorage.removeItem('categoryOrder')
  visibleCategories.value = CATEGORIES.map((c) => c.value)
  font.value = ''
  applyFont()
  language.value = 'zh'
  locked.value = false
  status.value = 'all'
  category.value = 'all'
  keyword.value = ''
  sortOrder.value = 'created'
  applyTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  localStorage.removeItem('theme')
  settingsError.value = ''
}
const settingsDialog = ref<HTMLDialogElement | null>(null)
function openSettings(): void {
  menuOpen.value = false
  settingsOpen.value = true
  settingsDialog.value?.showModal()
}
function closeSettings(): void {
  settingsDialog.value?.close()
}
function onSettingsClosed(): void {
  settingsOpen.value = false
  gearButton.value?.focus()
}
function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
    event.preventDefault()
    if (!document.querySelector('dialog[open]')) closeHomeTab(activeTabId.value)
    return
  }
  if (event.key === 'Escape' && filterMenu.value?.open) {
    filterMenu.value.open = false
    filterMenu.value.querySelector('summary')?.focus()
  }
  if (event.key === 'Escape' && menuOpen.value) {
    menuOpen.value = false
    gearButton.value?.focus()
  }
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
const theme = ref<'light' | 'dark'>('light')

const loadError = ref('')
let loadVersion = 0

async function load(): Promise<void> {
  const version = ++loadVersion
  loadError.value = ''
  try {
    const result = await window.api.items.list({
      category: category.value === 'all' ? undefined : category.value,
      status: status.value === 'all' ? undefined : status.value,
      keyword: keyword.value.trim() || undefined
    })
    if (version === loadVersion) items.value = result
  } catch {
    if (version === loadVersion) loadError.value = '加载失败，请重试'
  }
}

function openEditor(item: Item | null): void {
  if (locked.value) return
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

function applyTheme(t: 'light' | 'dark'): void {
  theme.value = t
  document.documentElement.dataset.theme = t
  document.documentElement.style.setProperty('--chrome-bg', CHROME_COLORS[t])
  localStorage.setItem('theme', t)
  menuOpen.value = false
  void window.api.theme
    .set(t, showSearch.value || showEditor.value || settingsOpen.value || batchOpen.value)
    .catch(() => {
      loadError.value = '标题栏主题切换失败，请重试'
    })
}

onMounted(() => {
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
  applyTheme(
    saved === 'light' || saved === 'dark'
      ? saved
      : matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
  )
})

watch([showSearch, showEditor, settingsOpen, batchOpen], () => {
  void window.api.theme
    .set(theme.value, showSearch.value || showEditor.value || settingsOpen.value || batchOpen.value)
    .catch(console.error)
})

watch([activeTabId, category, status, keyword], load, { immediate: true })
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

      <p v-if="loadError" role="alert">{{ loadError }} <button @click="load">重试</button></p>
      <main class="wall">
        <div
          v-for="i in sortedItems"
          :key="i.id"
          class="card"
          :class="{ locked }"
          @click="clickItem(i)"
          :role="managing ? 'checkbox' : undefined"
          :aria-checked="managing ? selectedIds.has(i.id) : undefined"
          :aria-label="managing ? i.title : undefined"
          :tabindex="managing ? 0 : undefined"
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
    <dialog
      ref="settingsDialog"
      class="settings-dialog"
      aria-labelledby="settings-title"
      @close="onSettingsClosed"
      @click="
        (event) => {
          if (event.target === settingsDialog) closeSettings()
        }
      "
    >
      <div class="settings-inner">
        <header class="settings-header">
          <h2 id="settings-title">设置</h2>
          <button class="close-settings" aria-label="关闭设置" autofocus @click="closeSettings">
            ×
          </button>
        </header>
        <div class="settings-layout">
          <nav class="settings-nav" aria-label="设置分类">
            <input
              v-model="settingsQuery"
              type="search"
              class="settings-search"
              placeholder="搜索设置..."
              aria-label="搜索设置"
            />
            <div class="settings-nav-scroll">
              <button
                v-show="matchesSettings('general')"
                :class="{ active: settingsSection === 'general' }"
                :aria-pressed="settingsSection === 'general'"
                @click="settingsSection = 'general'"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  aria-hidden="true"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                  <circle cx="8" cy="6" r="2" fill="var(--surface)" />
                  <circle cx="16" cy="12" r="2" fill="var(--surface)" />
                  <circle cx="10" cy="18" r="2" fill="var(--surface)" /></svg
                ><HighlightText text="通用" :query="settingsQuery" />
              </button>
              <button
                v-show="matchesSettings('appearance')"
                :class="{ active: settingsSection === 'appearance' }"
                :aria-pressed="settingsSection === 'appearance'"
                @click="settingsSection = 'appearance'"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" /></svg
                ><HighlightText text="外观" :query="settingsQuery" />
              </button>
              <button
                v-show="matchesSettings('display')"
                :class="{ active: settingsSection === 'display' }"
                :aria-pressed="settingsSection === 'display'"
                @click="settingsSection = 'display'"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="13" rx="2" />
                  <path d="M8 21h8M12 17v4" /></svg
                ><HighlightText text="显示" :query="settingsQuery" />
              </button>
            </div>
            <button class="reset-settings" @click="resetDialog?.showModal()">恢复默认设置</button>
          </nav>
          <section
            v-if="settingsSection === 'appearance' && matchesSettings('appearance')"
            class="settings-content"
            aria-labelledby="appearance-title"
          >
            <h3 id="appearance-title"><HighlightText text="外观" :query="settingsQuery" /></h3>
            <div class="settings-group">
              <div class="settings-row">
                <span id="theme-label"
                  ><span class="setting-name"
                    ><HighlightText text="主题" :query="settingsQuery" /><small
                      >设置界面主题。</small
                    ></span
                  ></span
                >
                <div class="theme-options" role="group" aria-labelledby="theme-label">
                  <button
                    :class="{ active: theme === 'light' }"
                    :aria-pressed="theme === 'light'"
                    @click="applyTheme('light')"
                  >
                    <HighlightText text="浅色" :query="settingsQuery" />
                  </button>
                  <button
                    :class="{ active: theme === 'dark' }"
                    :aria-pressed="theme === 'dark'"
                    @click="applyTheme('dark')"
                  >
                    <HighlightText text="深色" :query="settingsQuery" />
                  </button>
                </div>
              </div>
              <label class="settings-row font-row"
                ><span class="setting-name"
                  ><HighlightText text="字体" :query="settingsQuery" /><small
                    >设置界面字体。</small
                  ></span
                >
                <select v-model="font" :disabled="fontLoading">
                  <option value="">默认字体</option>
                  <option v-if="font && !fonts.includes(font)" :value="font">{{ font }}</option>
                  <option v-for="name in fonts" :key="name" :value="name">{{ name }}</option>
                </select>
              </label>
            </div>
            <p v-if="settingsError" role="alert">
              {{ settingsError }} <button @click="loadFonts">重试</button>
            </p>
          </section>
          <section
            v-else-if="settingsSection === 'general' && matchesSettings('general')"
            class="settings-content"
            aria-labelledby="general-title"
          >
            <h3 id="general-title"><HighlightText text="通用" :query="settingsQuery" /></h3>
            <div class="settings-group">
              <label class="settings-row"
                ><span class="setting-name"
                  ><HighlightText text="语言" :query="settingsQuery" /><small
                    >设置界面语言。</small
                  ></span
                >
                <select v-model="language">
                  <option value="zh">简体中文</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
          </section>
          <section
            v-else-if="settingsSection === 'display' && matchesSettings('display')"
            class="settings-content"
            aria-labelledby="navigation-title"
          >
            <h3 id="navigation-title"><HighlightText text="导航栏" :query="settingsQuery" /></h3>
            <div class="settings-group">
              <div class="settings-row">
                <span class="setting-name"
                  ><HighlightText text="展示" :query="settingsQuery" /><small
                    >设置顶部导航栏显示的分类。</small
                  ></span
                >
                <div class="category-checks" role="group" aria-label="展示分类">
                  <label v-for="c in CATEGORIES" :key="c.value"
                    ><input
                      v-model="visibleCategories"
                      type="checkbox"
                      :value="c.value" /><HighlightText :text="c.label" :query="settingsQuery"
                  /></label>
                </div>
              </div>
            </div>
            <h3 class="initial-heading">
              <HighlightText text="初始界面" :query="settingsQuery" />
            </h3>
            <div class="settings-group">
              <div class="settings-row">
                <span class="setting-name"><small>设置软件启动时默认显示的界面。</small></span>
                <div class="category-checks" role="radiogroup" aria-label="初始界面">
                  <label v-for="c in categoryOptions" :key="c.value">
                    <input
                      v-model="initialCategory"
                      type="radio"
                      name="initial-category"
                      :value="c.value"
                    />
                    <HighlightText :text="c.label" :query="settingsQuery" />
                  </label>
                </div>
              </div>
            </div>
          </section>
          <p v-else class="settings-content">无匹配项</p>
        </div>
      </div>
    </dialog>
    <dialog ref="resetDialog" class="reset-dialog" aria-labelledby="reset-title">
      <h3 id="reset-title">恢复默认设置？</h3>
      <div class="reset-actions">
        <button autofocus @click="resetDialog?.close()">取消</button
        ><button class="primary" @click="resetSettings">确定</button>
      </div>
    </dialog>
    <dialog
      ref="batchDialog"
      class="batch-dialog"
      aria-labelledby="batch-title"
      @close="batchOpen = false"
      @cancel.prevent="!batchBusy && batchDialog?.close()"
    >
      <div class="batch-content">
        <p id="batch-title">是否删除选中的 {{ selectedIds.size }} 部作品？</p>
        <p v-if="batchError" role="alert">{{ batchError }}</p>
        <div class="batch-actions">
          <button class="batch-confirm" :disabled="batchBusy" @click="deleteSelected">
            {{ batchBusy ? '删除中…' : '删除' }}</button
          ><button
            class="batch-cancel"
            autofocus
            :disabled="batchBusy"
            @click="batchDialog?.close()"
          >
            取消
          </button>
        </div>
      </div>
    </dialog>
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
.settings-content .initial-heading {
  margin-top: 24px;
}
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

.category-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
}
.category-checks label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.category-checks input {
  margin: 0;
  accent-color: var(--accent);
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
.batch-dialog {
  width: min(380px, calc(100vw - 48px));
  padding: 0;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 20px 64px #0005;
}
.batch-dialog::backdrop {
  background: #0008;
}
.batch-content {
  min-height: 170px;
  padding: 26px 22px 18px;
  display: flex;
  flex-direction: column;
}
.batch-content p {
  margin: 10px 0 24px;
  font-size: 16px;
}
.batch-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: auto;
}
.batch-confirm {
  color: #d32f2f;
  border-color: #d32f2f;
}
.batch-cancel {
  color: #111;
  background: white;
  border-color: #bfc3ca;
}

.setting-name {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.setting-name small {
  font-size: 85%;
  color: var(--text-2);
  font-weight: normal;
}

.settings-search {
  width: calc(100% - 6px);
  min-width: 0;
  padding: 5px 6px;
  font-size: 12px;
}
.settings-nav-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: scroll;
  --scrollbar-size: 5.4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.settings-nav-scroll button {
  flex-shrink: 0;
  width: 100%;
}
.settings-nav .reset-settings {
  border: 1px solid var(--border);
  margin-right: 6px;
  flex-shrink: 0;
}
.settings-group {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
}
.settings-group > .settings-row + .settings-row {
  border-top: 1px solid var(--border);
}
.reset-dialog {
  width: min(320px, calc(100vw - 48px));
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
}
.reset-dialog::backdrop {
  background: #0008;
}
.reset-dialog h3 {
  margin: 0 0 24px;
}
.reset-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.settings-nav button,
.settings-content h3 {
  display: flex;
  align-items: center;
  gap: 7px;
}
.settings-nav svg,
.settings-content h3 svg {
  flex-shrink: 0;
}
.settings-nav .reset-settings {
  margin-top: auto;
  padding: 7px 3px;
  font-size: 12px;
  justify-content: center;
}
.font-row {
  margin-top: 0;
}
.font-row select {
  max-width: min(280px, 100%);
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
.windows-shell {
  --titlebar-height: 33px;
}
/* Continue the sidebar border through the titlebar without intercepting input. */
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
.settings-dialog {
  padding: 0;
  width: min(780px, calc(100vw - 64px));
  height: min(580px, calc(100vh - 64px));
  max-width: none;
  max-height: none;
  border: 1px solid var(--border);
  border-radius: 14px;
  color: var(--text);
  background: var(--bg);
  box-shadow: 0 24px 80px #0006;
}
.settings-dialog::backdrop {
  background: #0008;
}
.settings-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
}
.settings-header h2 {
  margin: 0;
  font-size: 20px;
}
.close-settings {
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 24px;
  background: transparent;
  border-color: transparent;
}
.settings-layout {
  display: flex;
  flex: 1;
  min-height: 0;
}
.settings-nav {
  width: 140px;
  flex-shrink: 0;
  padding: 10px 0 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--surface);
  border-right: 1px solid var(--border);
}
.settings-nav button {
  text-align: left;
  border-color: transparent;
  padding: 7px 10px;
}
.settings-nav button.active {
  color: var(--accent);
  background: var(--bg);
  border-color: var(--border);
}
.settings-content {
  flex: 1;
  min-width: 0;
  padding: 14px;
  overflow-y: auto;
}
.settings-content h3 {
  margin: 0 0 12px;
  font-size: 18px;
}
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.theme-options {
  display: flex;
  gap: 4px;
}
.theme-options button.active {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
}
.settings-row select {
  min-width: 120px;
}
@media (max-width: 560px) {
  .settings-nav {
    width: 90px;
    padding: 12px 6px;
  }
  .settings-content {
    padding: 16px;
  }
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
.tabs {
  display: flex;
  gap: 0;
  padding: 0;
  height: 34px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.tabs button {
  border: 0;
  background: transparent;
  border-radius: 5px;
  padding: 6px 10px;
  white-space: nowrap;
}
.tabs button:hover {
  background: var(--bg);
}
.tabs button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
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
.toolbar .tabs button {
  height: 32px;
  padding-top: 0;
  padding-bottom: 0;
  line-height: 32px;
}
.toolbar .brand {
  height: 34px;
}
</style>
