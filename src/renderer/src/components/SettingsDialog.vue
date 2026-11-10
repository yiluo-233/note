<script setup lang="ts">
/** 设置面板：展示和搜索设置项，管理字体列表、重置确认及弹窗焦点。 */
import { onMounted, ref, watch } from 'vue'
import type { Category, HomeCategory } from '../../../../shared/types'
import type { Theme } from '../../../../shared/theme'
import { CATEGORIES, HOME_CATEGORIES } from '../constants'
import HighlightText from './HighlightText.vue'

const open = defineModel<boolean>('open', { required: true })
const font = defineModel<string>('font', { required: true })
const initialCategory = defineModel<HomeCategory>('initialCategory', { required: true })
const visibleCategories = defineModel<Category[]>('visibleCategories', { required: true })
defineProps<{ theme: Theme }>()
const emit = defineEmits<{ theme: [value: Theme]; reset: []; closed: [] }>()

type SettingsSection = 'appearance' | 'general' | 'display'
const settingsSection = ref<SettingsSection>('general')
const settingsQuery = ref('')
const settingsDialog = ref<HTMLDialogElement | null>(null)
const resetDialog = ref<HTMLDialogElement | null>(null)
const language = ref('zh')
const fonts = ref<string[]>([])
const fontLoading = ref(false)
const settingsError = ref('')

function matchesSettings(section: SettingsSection): boolean {
  const text = {
    appearance: '外观 主题 浅色 深色 字体 默认字体',
    general: '通用 语言 中文 English',
    display: '显示 导航栏 展示 初始界面 启动 默认 全部 动画 电影 书籍 视觉小说'
  }[section]
  return text.toLowerCase().includes(settingsQuery.value.trim().toLowerCase())
}

watch(settingsQuery, () => {
  if (matchesSettings(settingsSection.value)) {
    return
  }
  const match = (['general', 'appearance', 'display'] as const).find(matchesSettings)
  if (match) {
    settingsSection.value = match
  }
})
watch(open, (value) => {
  if (value) {
    settingsDialog.value?.showModal()
  } else {
    settingsDialog.value?.close()
  }
})
onMounted(() => {
  if (open.value) {
    settingsDialog.value?.showModal()
  }
  void loadFonts()
})

async function loadFonts(): Promise<void> {
  if (fontLoading.value) {
    return
  }
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
  language.value = 'zh'
  settingsError.value = ''
  emit('reset')
}

function closeSettings(): void {
  settingsDialog.value?.close()
}

function onSettingsClosed(): void {
  open.value = false
  emit('closed')
}
</script>

<template>
  <dialog
    ref="settingsDialog"
    class="settings-dialog"
    aria-labelledby="settings-title"
    @close="onSettingsClosed"
    @click.self="closeSettings"
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
                  @click="emit('theme', 'light')"
                >
                  <HighlightText text="浅色" :query="settingsQuery" />
                </button>
                <button
                  :class="{ active: theme === 'dark' }"
                  :aria-pressed="theme === 'dark'"
                  @click="emit('theme', 'dark')"
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
                <label v-for="c in HOME_CATEGORIES" :key="c.value">
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
</template>

<style scoped>
.settings-content .initial-heading {
  margin-top: 24px;
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
  border: 1px solid var(--border);
  margin-right: 6px;
  flex-shrink: 0;
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
</style>
