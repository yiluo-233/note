<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import type { Category, Item, ItemInput } from '../../../../shared/types'
import SelectMenu from './SelectMenu.vue'
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
  const t = tagInput.value.trim()
  if (t && !form.tags.includes(t)) form.tags.push(t)
  tagInput.value = ''
}

async function pickCover(): Promise<void> {
  try {
    const name = await window.api.cover.pick()
    if (name) form.coverPath = name
  } catch {
    error.value = '选择封面失败，请重试'
  }
}

async function save(): Promise<void> {
  if (busy.value) return
  error.value = ''
  if (!form.title.trim()) {
    error.value = '请填写标题'
    return
  }

  const r = String(ratingStr.value ?? '').trim()
  if (r === '') {
    form.rating = null
  } else {
    const n = Number(r)
    if (Number.isNaN(n) || n < 0 || n > 10 || (n * 2) % 1 !== 0) {
      error.value = '评分需为 0~10，且以 0.5 为步进'
      return
    }
    form.rating = n
  }

  const y = String(yearStr.value ?? '').trim()
  if (y !== '' && (!Number.isInteger(Number(y)) || Number(y) < 1 || Number(y) > 9999)) {
    error.value = '年份需为 1~9999 的整数'
    return
  }
  form.year = y === '' ? null : Number(y)

  addTag() // 输入框里没按回车的标签也一并收进来
  busy.value = true
  try {
    const data: ItemInput = JSON.parse(JSON.stringify(form))
    if (props.item) {
      const updated = await window.api.items.update(props.item.id, data)
      if (!updated) throw new Error('条目已不存在')
    } else {
      await window.api.items.add(data)
    }
    emit('saved')
  } catch (cause) {
    error.value = cause instanceof Error ? `保存失败：${cause.message}` : '保存失败，请重试'
  } finally {
    busy.value = false
  }
}

const confirmDialog = ref<HTMLDialogElement | null>(null)
const confirmAction = ref<'delete' | 'cover'>('delete')
const confirmError = ref('')
function askConfirmation(action: 'delete' | 'cover'): void {
  if (busy.value) return
  confirmAction.value = action
  confirmError.value = ''
  confirmDialog.value?.showModal()
}
async function confirmChange(): Promise<void> {
  if (busy.value) return
  if (confirmAction.value === 'cover') {
    form.coverPath = ''
    confirmDialog.value?.close()
    return
  }
  await remove()
}
async function remove(): Promise<void> {
  if (busy.value || !props.item) return
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
    @click="
      (e) => {
        if (e.target === editorDialog && !busy) emit('close')
      }
    "
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
          <div class="chips" v-if="form.tags.length">
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
  <dialog
    ref="confirmDialog"
    class="confirm-dialog"
    aria-labelledby="confirm-message"
    @cancel.prevent="!busy && confirmDialog?.close()"
  >
    <div class="confirm-content">
      <p id="confirm-message">
        {{ confirmAction === 'delete' ? '是否删除该作品？' : '是否移除该封面' }}
      </p>
      <p v-if="confirmError" role="alert">{{ confirmError }}</p>
      <div class="confirm-actions">
        <button class="confirm-danger" :disabled="busy" @click="confirmChange">
          {{ confirmAction === 'delete' ? '删除' : '移除' }}
        </button>
        <button class="confirm-cancel" autofocus :disabled="busy" @click="confirmDialog?.close()">
          取消
        </button>
      </div>
    </div>
  </dialog>
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
.confirm-dialog {
  width: min(380px, calc(100vw - 48px));
  padding: 0;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 20px 64px #0005;
}
.confirm-dialog::backdrop {
  background: #0008;
}
.confirm-content {
  min-height: 170px;
  padding: 26px 22px 18px;
  display: flex;
  flex-direction: column;
}
.confirm-content p {
  margin: 10px 0 24px;
  font-size: 16px;
}
.confirm-content p[role='alert'] {
  color: var(--danger);
  font-size: 12px;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: auto;
}
.confirm-danger {
  color: #d32f2f;
  border-color: #d32f2f;
}
.confirm-cancel {
  color: #111;
  background: #fff;
  border-color: #bfc3ca;
}
.confirm-actions button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.confirm-actions button:disabled {
  opacity: 0.5;
  cursor: default;
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
