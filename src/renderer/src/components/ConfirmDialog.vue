<script setup lang="ts">
/** 操作确认弹窗：统一删除、移除封面的提示样式，并在提交期间阻止关闭。 */
import { onMounted, ref, useId, watch } from 'vue'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  message: string
  confirmLabel: string
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{ confirm: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const messageId = useId()

function syncOpen(): void {
  if (open.value) {
    dialog.value?.showModal()
    return
  }
  dialog.value?.close()
}

function cancel(): void {
  if (props.busy) {
    return
  }
  open.value = false
}

onMounted(syncOpen)
watch(open, syncOpen)
</script>

<template>
  <dialog ref="dialog" :aria-labelledby="messageId" @close="open = false" @cancel.prevent="cancel">
    <div class="content">
      <p :id="messageId">{{ message }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <div class="actions">
        <button class="confirm" :disabled="busy" @click="emit('confirm')">
          {{ confirmLabel }}
        </button>
        <button class="cancel" autofocus :disabled="busy" @click="cancel">取消</button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
dialog {
  width: min(380px, calc(100vw - 48px));
  padding: 0;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 20px 64px #0005;
}
dialog::backdrop {
  background: #0008;
}
.content {
  min-height: 170px;
  padding: 26px 22px 18px;
  display: flex;
  flex-direction: column;
}
.content p {
  margin: 10px 0 24px;
  font-size: 16px;
}
.content p[role='alert'] {
  color: var(--danger);
  font-size: 12px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: auto;
}
.confirm {
  color: #d32f2f;
  border-color: #d32f2f;
}
.cancel {
  color: #111;
  background: #fff;
  border-color: #bfc3ca;
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
