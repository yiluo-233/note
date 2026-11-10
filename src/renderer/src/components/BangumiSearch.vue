<script setup lang="ts">
/** 作品搜索弹窗：聚合来源检索、防抖分页并导入选中的条目。 */

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { paginationPages } from '../pagination'
import type { Category } from '../../../../shared/types'
import { SEARCH_PAGE_SIZE, type SearchResult, type ImportDraft } from '../../../../shared/bangumi'
const props = defineProps<{ category?: Category }>()
const emit = defineEmits<{ close: []; manual: []; selected: [draft: ImportDraft] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const keyword = ref('')
const results = ref<SearchResult[]>([])
const busy = ref(false)
const importing = ref(false)
const error = ref('')
const searched = ref(false)
const total = ref(0)
let active = true
const currentPage = ref(1)
const pageCount = computed(() => Math.ceil(total.value / SEARCH_PAGE_SIZE))
const visiblePages = computed(() => paginationPages(pageCount.value, currentPage.value))
let version = 0
let timer: ReturnType<typeof setTimeout> | undefined
watch(keyword, () => {
  clearTimeout(timer)
  version++
  results.value = []
  currentPage.value = 1
  total.value = 0
  searched.value = false
  error.value = ''
  busy.value = false
  if (keyword.value.trim()) {
    timer = setTimeout(() => {
      void search()
    }, 350)
  }
})
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => {
  active = false
  version++
  clearTimeout(timer)
})
async function search(pageNumber = 1): Promise<void> {
  clearTimeout(timer)
  if (importing.value || !keyword.value.trim()) {
    return
  }
  const query = keyword.value.trim()
  const requestVersion = ++version
  busy.value = true
  error.value = ''
  try {
    const page = await window.api.bangumi.search(
      query,
      props.category,
      (pageNumber - 1) * SEARCH_PAGE_SIZE
    )
    if (!active || requestVersion !== version) {
      return
    }
    error.value = page.warning ?? ''
    results.value = page.results
    total.value = page.total
    currentPage.value = pageNumber
    searched.value = true
    dialog.value?.querySelector('.results')?.scrollTo(0, 0)
  } catch (e) {
    if (active && requestVersion === version) {
      error.value = e instanceof Error ? e.message : '搜索失败，请重试'
    }
  } finally {
    if (active && requestVersion === version) {
      busy.value = false
    }
  }
}

async function select(result: SearchResult): Promise<void> {
  if (importing.value || result.exists) {
    return
  }
  importing.value = true
  error.value = ''
  try {
    const draft = await window.api.bangumi.import(result.source, result.id)
    if (active) {
      emit('selected', draft)
    }
  } catch (e) {
    if (active) {
      error.value = e instanceof Error ? e.message : '获取资料失败，请重试'
    }
  } finally {
    importing.value = false
  }
}
</script>
<template>
  <dialog
    ref="dialog"
    aria-labelledby="search-title"
    @cancel.prevent="emit('close')"
    @click.self="emit('close')"
  >
    <div class="inner">
      <header>
        <h2 id="search-title">添加作品</h2>
        <button aria-label="关闭" @click="emit('close')">×</button>
      </header>
      <form @submit.prevent="search()">
        <input
          v-model="keyword"
          autofocus
          maxlength="200"
          placeholder="输入中文名或原标题"
          aria-label="作品名称"
          :disabled="importing"
        /><button class="primary" :disabled="busy || importing || !keyword.trim()">
          {{ busy ? '搜索中…' : '搜索' }}</button
        ><button type="button" :disabled="importing" @click="emit('manual')">手动添加</button>
      </form>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="importing" role="status">加载中…</p>
      <p v-if="searched && !results.length && !busy && !error">未找到作品</p>
      <div class="results">
        <button
          v-for="r in results"
          :key="`${r.source}:${r.id}`"
          class="result"
          :disabled="importing || busy || r.exists"
          @click="select(r)"
        >
          <img v-if="r.image" :src="r.image" alt="" loading="lazy" referrerpolicy="no-referrer" />
          <div v-else class="placeholder">无封面</div>
          <span class="info"
            ><strong>{{ r.title }}</strong
            ><span v-if="r.originalTitle !== r.title">{{ r.originalTitle }}</span
            ><small
              >{{ r.date || '年份未知' }} · {{ r.typeLabel }} ·
              {{ r.source === 'neodb' ? 'NeoDB' : 'Bangumi' }}</small
            ><small v-if="r.exists">已在书架</small></span
          >
        </button>
      </div>
      <nav v-if="pageCount" class="pagination" aria-label="搜索结果分页">
        <button
          aria-label="第一页"
          :disabled="busy || importing || currentPage === 1"
          @click="search(1)"
        >
          &lt;&lt;
        </button>
        <button
          aria-label="上一页"
          :disabled="busy || importing || currentPage === 1"
          @click="search(currentPage - 1)"
        >
          &lt;
        </button>
        <div class="page-numbers">
          <button
            v-for="page in visiblePages"
            :key="page"
            :class="{ selected: currentPage === page }"
            :aria-current="currentPage === page ? 'page' : undefined"
            :disabled="busy || importing || page === '…'"
            @click="typeof page === 'number' && search(page)"
          >
            {{ page }}
          </button>
        </div>
        <button
          aria-label="下一页"
          :disabled="busy || importing || currentPage === pageCount"
          @click="search(currentPage + 1)"
        >
          &gt;
        </button>
        <button
          aria-label="最后一页"
          :disabled="busy || importing || currentPage === pageCount"
          @click="search(pageCount)"
        >
          &gt;&gt;
        </button>
      </nav>
    </div>
  </dialog>
</template>
<style scoped>
.pagination {
  --page-size: clamp(18px, 4vw, 34px);
  display: flex;
  gap: clamp(2px, 0.6vw, 6px);
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding-top: 12px;
}
.pagination button {
  width: var(--page-size);
  height: var(--page-size);
  font-size: clamp(10px, 2vw, 14px);
  padding: 0;
  border-radius: 3px;
  flex-shrink: 0;
}
.page-numbers {
  display: flex;
  gap: clamp(2px, 0.6vw, 6px);
  align-items: center;
  min-width: 0;
}
.pagination button.selected {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

dialog {
  overflow: hidden;
  width: min(760px, calc(100vw - 64px));
  max-height: calc(100vh - 64px);
  padding: 0;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 24px 80px #0006;
}
dialog::backdrop {
  background: #0008;
}
.inner {
  padding: 24px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 66px);
  box-sizing: border-box;
}
header,
form {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
header {
  justify-content: space-between;
  margin-bottom: 20px;
}
h2 {
  font-size: 20px;
  margin: 0;
}
input {
  flex: 1;
  min-width: 0;
}
small {
  color: var(--text-2);
  font-size: 12px;
}
.results {
  overflow-y: auto;
  min-height: 0;
  display: grid;
  flex: 1;
  gap: 10px;
  margin: 16px 0;
}
.result {
  display: flex;
  gap: 16px;
  padding: 12px;
  text-align: left;
  width: 100%;
}
.result img,
.placeholder {
  width: 60px;
  height: 84px;
  object-fit: cover;
  flex-shrink: 0;
  border-radius: 4px;
}
.placeholder {
  display: grid;
  place-items: center;
  background: var(--bg);
  font-size: 12px;
}
.info {
  display: flex;
  flex-direction: column;
  gap: clamp(2px, 0.6vw, 6px);
  overflow-wrap: anywhere;
}
button:disabled {
  opacity: 0.55;
  cursor: default;
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
