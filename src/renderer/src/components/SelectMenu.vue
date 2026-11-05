<script setup lang="ts" generic="T extends string">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
const props = defineProps<{
  modelValue: T
  options: { value: T; label: string }[]
  label: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const opened = ref(false)
const focused = ref(0)
const id = useId()
const selectedLabel = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.label ?? ''
)
async function open(): Promise<void> {
  if (props.disabled) return
  focused.value = Math.max(
    0,
    props.options.findIndex((o) => o.value === props.modelValue)
  )
  opened.value = true
  await nextTick()
  focusOption()
}
function focusOption(): void {
  root.value?.querySelectorAll<HTMLButtonElement>('[role="option"]')[focused.value]?.focus()
}
function close(restore = false): void {
  opened.value = false
  if (restore) trigger.value?.focus()
}
function choose(value: T): void {
  emit('update:modelValue', value)
  close(true)
}
function focusOut(event: FocusEvent): void {
  if (event.relatedTarget instanceof Node && !root.value?.contains(event.relatedTarget)) close()
}
function outside(event: PointerEvent): void {
  if (event.target instanceof Node && !root.value?.contains(event.target)) close()
}
function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && opened.value) {
    event.preventDefault()
    event.stopPropagation()
    close(true)
  }
  if (event.key === 'Tab') close()
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    if (!opened.value) {
      void open()
      return
    }
    if (event.key === 'Home') focused.value = 0
    else if (event.key === 'End') focused.value = props.options.length - 1
    else
      focused.value =
        (focused.value + (event.key === 'ArrowDown' ? 1 : -1) + props.options.length) %
        props.options.length
    focusOption()
  }
}
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>
<template>
  <div ref="root" class="select-menu" @keydown="keydown" @focusout="focusOut">
    <button
      ref="trigger"
      type="button"
      class="select-trigger"
      :class="{ opened }"
      :disabled="disabled"
      :aria-label="label"
      aria-haspopup="listbox"
      :aria-expanded="opened"
      :aria-controls="id"
      @click="opened ? close() : open()"
    >
      <span>{{ selectedLabel }}</span
      ><svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#888"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <Transition name="dropdown">
      <div v-if="opened" :id="id" class="select-options" role="listbox" :aria-label="label">
        <button
          v-for="(option, index) in options"
          :key="option.value"
          type="button"
          role="option"
          :aria-selected="option.value === modelValue"
          :tabindex="index === focused ? 0 : -1"
          @focus="focused = index"
          @click="choose(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>
<style scoped>
.select-menu {
  position: relative;
  width: 100%;
  font-size: 14px;
  color: var(--text);
}
.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 34px;
  border-radius: 6px;
  text-align: left;
}
.select-trigger svg {
  flex-shrink: 0;
}
.select-trigger.opened {
  border-radius: 6px 6px 0 0;
  border-color: var(--accent);
}
.select-options {
  position: absolute;
  top: calc(100% - 1px);
  left: 0;
  right: 0;
  z-index: 30;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 0 0 6px 6px;
  background: var(--surface);
  box-shadow: 0 6px 16px #0002;
  transform-origin: top;
}
.select-options button {
  display: block;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: 3px;
  text-align: left;
}
.select-options button:hover,
.select-options button:focus {
  background: var(--bg);
  outline: none;
}
.select-options button[aria-selected='true'] {
  color: var(--accent);
}
.select-trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease,
    clip-path 0.1s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
  clip-path: inset(0 0 100% 0);
}
.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0);
  clip-path: inset(0 0 -20px 0);
}
@media (prefers-reduced-motion: reduce) {
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition: none;
  }
}
</style>
