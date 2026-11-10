<script setup lang="ts">
/** 作品编辑弹窗：维护表单、校验输入，并处理封面、标签及删除确认。 */

import { onMounted, reactive, ref, computed } from 'vue'
import type { Category, Item, ItemInput } from '../../../../shared/types'
import SelectMenu from './SelectMenu.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { CATEGORIES, statusesFor, coverUrl } from '../constants'

const props = defineProps<{
  item: Item | null
  defaultCategory: Category
  initial?: ItemInput
  importWarning?: string
}>()
const emit = defineEmits<{ (e: 'saved'): void; (e: 'close'): void }>()

const editorDialog = ref<HTMLDialogElement | null>(null)
onMounted(() => editorDialog.value?.showModal())
const initial = props.item ?? props.initial
const form = reactive<ItemInput>({
  category: initial?.category ?? props.defaultCategory,
  title: initial?.title ?? '',
  originalTitle: initial?.originalTitle ?? '',
  year: initial?.year ?? null,
  producer: initial?.producer ?? '',
  coverPath: initial?.coverPath ?? '',
  status: initial?.status ?? 'wish',
  rating: initial?.rating ?? null,
  review: initial?.review ?? '',
  tags: [...(initial?.tags ?? [])],
  source: initial?.source ?? 'manual',
  sourceId: initial?.sourceId ?? ''
})

const ratingStr = ref<string | number>(initial?.rating?.toString() ?? '')
const yearStr = ref(initial?.year?.toString() ?? '')
const busy = ref(false)
const error = ref(props.importWarning ?? '')
const tagInput = ref('')
const allTags = ref<string[]>([])

const producerLabel = computed(
  () => CATEGORIES.find((c) => c.value === form.category)?.producerLabel ?? '制作方'
)

onMounted(async () => {
  try {
    allTags.value = await window.api.tags.list()
  } catch {
    error.value = '标签加载失败'
  }
})

function addTag(): void {
  const tag = tagInput.value.trim()
  if (tag && !form.tags.includes(tag)) {
    form.tags.push(tag)
  }
  tagInput.value = ''
}

async function pickCover(): Promise<void> {
  try {
    const name = await window.api.cover.pick()
    if (name) {
      form.coverPath = name
    }
  } catch {
    error.value = '选择封面失败，请重试'
  }
}

async function save(): Promise<void> {
  if (busy.value) {
    return
  }
  error.value = ''
  if (!form.title.trim()) {
    error.value = '请填写标题'
    return
  }

  const ratingText = String(ratingStr.value ?? '').trim()
  const rating = ratingText === '' ? null : Number(ratingText)
  if (
    rating !== null &&
    (!Number.isFinite(rating) || rating < 0 || rating > 10 || (rating * 2) % 1 !== 0)
  ) {
    error.value = '评分需为 0~10，且以 0.5 为步进'
    return
  }
  form.rating = rating

  const yearText = String(yearStr.value ?? '').trim()
  const year = yearText === '' ? null : Number(yearText)
  if (year !== null && (!Number.isInteger(year) || year < 1 || year > 9999)) {
    error.value = '年份需为 1~9999 的整数'
    return
  }
  form.year = year

  addTag() // 同时保存输入框中尚未按回车确认的标签。
  busy.value = true
  try {
    const data: ItemInput = { ...form, tags: [...form.tags] }
    await persistItem(data)
    emit('saved')
  } catch (cause) {
    error.value = cause instanceof Error ? `保存失败：${cause.message}` : '保存失败，请重试'
  } finally {
    busy.value = false
  }
}

/** 只负责持久化，让保存流程专注于校验与状态恢复。 */
async function persistItem(data: ItemInput): Promise<void> {
  if (!props.item) {
    await window.api.items.add(data)
    return
  }
  const updated = await window.api.items.update(props.item.id, data)
  if (!updated) {
    throw new Error('条目已不存在')
  }
}

const confirmOpen = ref(false)
const confirmAction = ref<'delete' | 'cover'>('delete')
const confirmError = ref('')
function askConfirmation(action: 'delete' | 'cover'): void {
  if (busy.value) {
    return
  }
  confirmAction.value = action
  confirmError.value = ''
  confirmOpen.value = true
}

async function confirmChange(): Promise<void> {
  if (busy.value) {
    return
  }
  if (confirmAction.value === 'cover') {
    form.coverPath = ''
    confirmOpen.value = false
    return
  }
  await remove()
}

async function remove(): Promise<void> {
  if (busy.value || !props.item) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    await window.api.items.delete(props.item.id)
    emit('saved')
  } catch {
    confirmError.value = '删除失败，请重试'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <dialog
    ref="editorDialog"
    class="editor-modal"
    aria-label="编辑作品"
    @cancel.prevent="!busy && emit('close')"
    @click.self="!busy && emit('close')"
  >
    <div class="dialog">
      <h3>{{ item ? '编辑条目' : '添加条目' }}</h3>
      <div class="body">
        <div class="cover-col">
          <div class="cover-preview">
            <img v-if="form.coverPath" :src="coverUrl(form.coverPath)" />
            <span v-else>无封面</span>
          </div>
          <button @click="pickCover">选择封面</button>
          <button v-if="form.coverPath" :disabled="busy" @click="askConfirmation('cover')">
            移除
          </button>
        </div>
        <div class="fields">
          <div class="select-field">
            分类
            <SelectMenu
              v-model="form.category"
              :options="CATEGORIES"
              label="分类"
              :disabled="busy"
            />
          </div>
          <label>标题 <input v-model="form.title" /></label>
          <label>原名 <input v-model="form.originalTitle" /></label>
          <div class="row">
            <label>年份 <input v-model="yearStr" /></label>
            <label>{{ producerLabel }} <input v-model="form.producer" /></label>
          </div>
          <div class="row">
            <div class="select-field">
              状态
              <SelectMenu
                v-model="form.status"
                :options="statusesFor(form.category)"
                label="状态"
                :disabled="busy"
              />
            </div>
            <label
              >评分
              <input v-model="ratingStr" type="text" inputmode="decimal" />
            </label>
          </div>
          <label
            >标签（回车添加）
            <input
              v-model="tagInput"
              list="tag-list"
              @keydown.enter.prevent="addTag"
              @change="addTag"
            />
            <datalist id="tag-list">
              <option v-for="t in allTags" :key="t" :value="t" />
            </datalist>
          </label>
          <div v-if="form.tags.length" class="chips">
            <span v-for="t in form.tags" :key="t" class="chip">
              {{ t }} <a @click="form.tags.splice(form.tags.indexOf(t), 1)">×</a>
            </span>
          </div>
          <label>备注 <textarea v-model="form.review" rows="4" /></label>
        </div>
      </div>
      <p v-if="error" role="alert">{{ error }}</p>
      <div class="footer">
        <button v-if="item" class="danger" :disabled="busy" @click="askConfirmation('delete')">
          删除
        </button>
        <span style="flex: 1" />
        <button :disabled="busy" @click="emit('close')">取消</button>
        <button class="primary" :disabled="busy" @click="save">
          {{ busy ? '保存中…' : '保存' }}
        </button>
      </div>
    </div>
  </dialog>
  <ConfirmDialog
    v-model:open="confirmOpen"
    :message="confirmAction === 'delete' ? '是否删除该作品？' : '是否移除该封面？'"
    :confirm-label="confirmAction === 'delete' ? '删除' : '移除'"
    :busy="busy"
    :error="confirmError"
    @confirm="confirmChange"
  />
</template>

<style scoped>
.select-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--text-2);
  font-size: 12px;
}
.row > .select-field {
  flex: 1;
  min-width: 0;
}

.editor-modal {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  max-width: 94vw;
  max-height: 92vh;
}
.editor-modal::backdrop {
  background: #0008;
}
.dialog {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 720px;
  max-width: 94vw;
  max-height: 92vh;
  overflow: auto;
  padding: 18px 20px;
}
h3 {
  margin: 0 0 14px;
}
.body {
  display: flex;
  gap: 18px;
}
.cover-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 160px;
  flex-shrink: 0;
}
.cover-preview {
  width: 160px;
  aspect-ratio: 2 / 3;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  overflow: hidden;
}
.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--text-2);
  font-size: 12px;
}
label input,
label select,
label textarea {
  font-size: 14px;
}
.row {
  display: flex;
  gap: 10px;
}
.row label {
  flex: 1;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2px 10px;
}
.chip a {
  cursor: pointer;
  color: var(--text-2);
  margin-left: 4px;
}
.footer {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
</style>
