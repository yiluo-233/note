/** 显示偏好：保存默认分类、导航可见性、字体与主题，并同步原生标题栏。 */
import { computed, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { Category, HomeCategory } from '../../../../shared/types'
import { CHROME_COLORS, type Theme } from '../../../../shared/theme'
import { CATEGORIES, HOME_CATEGORIES } from '../constants'

interface NavigationPreferences {
  initialCategory: Ref<HomeCategory>
  visibleCategories: Ref<Category[]>
  navigationCategories: ComputedRef<{ value: HomeCategory; label: string }[]>
  navigationReset: Ref<number>
  isVisible: (category: HomeCategory) => boolean
  resetNavigation: () => void
}

interface AppearanceState {
  theme: Ref<Theme>
  font: Ref<string>
  themeError: Ref<string>
  applyTheme: (value: Theme) => void
  resetAppearance: () => void
  syncTitleBar: () => Promise<void>
}

function readVisibleCategories(): Category[] {
  const defaults = CATEGORIES.map((category) => category.value)
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('visibleCategories') ?? 'null')
    return Array.isArray(saved) ? defaults.filter((category) => saved.includes(category)) : defaults
  } catch {
    return defaults
  }
}

export function useNavigationPreferences(): NavigationPreferences {
  const savedInitial = localStorage.getItem('initialCategory')
  const initialCategory = ref<HomeCategory>(
    HOME_CATEGORIES.find((category) => category.value === savedInitial)?.value ?? 'all'
  )
  const visibleCategories = ref(readVisibleCategories())
  const navigationReset = ref(0)
  const navigationCategories = computed(() =>
    HOME_CATEGORIES.filter((category) => isVisible(category.value))
  )

  function isVisible(category: HomeCategory): boolean {
    return category === 'all' || visibleCategories.value.includes(category)
  }

  function revealInitialCategory(): void {
    if (initialCategory.value === 'all' || isVisible(initialCategory.value)) {
      return
    }
    visibleCategories.value.push(initialCategory.value)
  }

  revealInitialCategory()
  watch(initialCategory, (value) => {
    localStorage.setItem('initialCategory', value)
    revealInitialCategory()
  })
  watch(
    visibleCategories,
    (value) => {
      localStorage.setItem('visibleCategories', JSON.stringify(value))
      if (!isVisible(initialCategory.value)) {
        initialCategory.value = 'all'
      }
    },
    { deep: true }
  )

  function resetNavigation(): void {
    initialCategory.value = 'all'
    visibleCategories.value = CATEGORIES.map((category) => category.value)
    localStorage.removeItem('categoryOrder')
    navigationReset.value++
  }

  return {
    initialCategory,
    visibleCategories,
    navigationCategories,
    navigationReset,
    isVisible,
    resetNavigation
  }
}

function systemTheme(): Theme {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readTheme(): Theme {
  const saved = localStorage.getItem('theme')
  return saved === 'light' || saved === 'dark' ? saved : systemTheme()
}

export function useAppearance(modalOpen: Ref<boolean>): AppearanceState {
  const theme = ref<Theme>(readTheme())
  const font = ref(localStorage.getItem('font') ?? '')
  const themeError = ref('')
  let syncVersion = 0

  async function syncTitleBar(): Promise<void> {
    const version = ++syncVersion
    themeError.value = ''
    try {
      await window.api.theme.set(theme.value, modalOpen.value)
    } catch {
      if (version === syncVersion) {
        themeError.value = '标题栏主题切换失败，请重试'
      }
    }
  }

  function applyTheme(value: Theme): void {
    theme.value = value
    document.documentElement.dataset.theme = value
    document.documentElement.style.setProperty('--chrome-bg', CHROME_COLORS[value])
    localStorage.setItem('theme', value)
    void syncTitleBar()
  }

  function applyFont(): void {
    if (!font.value) {
      document.documentElement.style.removeProperty('--app-font')
      localStorage.removeItem('font')
      return
    }
    document.documentElement.style.setProperty('--app-font', JSON.stringify(font.value))
    localStorage.setItem('font', font.value)
  }

  function resetAppearance(): void {
    font.value = ''
    applyFont()
    applyTheme(systemTheme())
    localStorage.removeItem('theme')
  }

  watch(font, applyFont)
  watch(modalOpen, syncTitleBar)
  onMounted(() => {
    applyFont()
    applyTheme(theme.value)
  })

  return { theme, font, themeError, applyTheme, resetAppearance, syncTitleBar }
}
