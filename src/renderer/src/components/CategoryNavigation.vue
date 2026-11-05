<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import type { Category } from '../../../../shared/types'

type Value = Category | 'all'
const props = defineProps<{ modelValue: Value; options: { value: Value; label: string }[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: Value] }>()
const defaults: Value[] = ['all', 'anime', 'novel', 'movie', 'galgame']
function readOrder(): Value[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('categoryOrder') ?? 'null')
    if (Array.isArray(saved))
      return [...new Set([...saved.filter((v): v is Value => defaults.includes(v)), ...defaults])]
  } catch {
    /* Ignore invalid stored preferences. */
  }
  return [...defaults]
}
const order = ref(readOrder())
const options = computed(() =>
  order.value.flatMap((value) => props.options.filter((c) => c.value === value))
)
const root = ref<HTMLElement>()
const dragging = ref<Value | null>(null)
const floating = ref(false)
const settling = ref(false)
const x = ref(0),
  y = ref(0),
  width = ref(0),
  height = ref(0)
let pointer: {
  id: number
  value: Value
  x: number
  y: number
  offsetX: number
  original: Value[]
} | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let suppressClick = false
// Let the gap/move animation finish before another reorder can begin.
let reorderAfter = 0
let lastReorderX = 0
const reorderDelay = 100
const crossingMargin = 8
const label = computed(() => props.options.find((c) => c.value === dragging.value)?.label)
function start(event: PointerEvent, value: Value): void {
  if (event.button !== 0 || dragging.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pointer = {
    id: event.pointerId,
    value,
    x: event.clientX,
    y: event.clientY,
    offsetX: event.clientX - rect.left,
    original: [...order.value]
  }
  width.value = rect.width
  height.value = rect.height
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', cancel)
  window.addEventListener('blur', cancel)
  window.addEventListener('keydown', escape)
}
function move(event: PointerEvent): void {
  if (!pointer || pointer.id !== event.pointerId) return
  if (!dragging.value && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 5)
    return
  event.preventDefault()
  if (!dragging.value) {
    dragging.value = pointer.value
    // Keep pointer events and the system arrow on the navigation while dragging.
    root.value?.setPointerCapture(event.pointerId)
    suppressClick = true
    reorderAfter = performance.now() + reorderDelay
    lastReorderX = event.clientX
    void nextTick(() =>
      requestAnimationFrame(() => {
        if (dragging.value && !settling.value) floating.value = true
      })
    )
  }
  const container = root.value
  if (!container) return
  const bounds = container.getBoundingClientRect()
  // Horizontal movement only; include the 10% scale in the end stops.
  const inset = width.value * 0.05
  const left = bounds.left + container.clientLeft + inset
  const right = Math.max(left, bounds.right - container.clientLeft - width.value - inset)
  x.value = Math.min(right, Math.max(left, event.clientX - pointer.offsetX))
  y.value = bounds.top + (bounds.height - height.value) / 2
  if (performance.now() < reorderAfter) return
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    return
  const localX = event.clientX - bounds.left - container.clientLeft
  const from = order.value.indexOf(dragging.value)
  const direction = Math.sign(event.clientX - lastReorderX)
  const targets = [...container.querySelectorAll<HTMLElement>('[data-category]')]
  // offsetLeft/offsetWidth reflect layout, not TransitionGroup's animated transform.
  // Require crossing the neighbour's centre and moving in that direction.
  const candidates = targets.filter((el) => {
    const index = order.value.indexOf(el.dataset.category as Value)
    const centre = el.offsetLeft + el.offsetWidth / 2
    return direction > 0
      ? index > from && localX > centre + crossingMargin
      : direction < 0 && index < from && localX < centre - crossingMargin
  })
  const target = direction > 0 ? candidates.at(-1) : candidates[0]
  if (target) {
    const to = order.value.indexOf(target.dataset.category as Value)
    order.value.splice(from, 1)
    order.value.splice(to, 0, dragging.value)
    lastReorderX = event.clientX
    reorderAfter = performance.now() + reorderDelay
  }
}
function cleanup(): void {
  if (pointer && root.value?.hasPointerCapture(pointer.id))
    root.value.releasePointerCapture(pointer.id)
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', finish)
  window.removeEventListener('pointercancel', cancel)
  window.removeEventListener('blur', cancel)
  window.removeEventListener('keydown', escape)
}
function finish(): void {
  cleanup()
  pointer = null
  if (!dragging.value) return
  localStorage.setItem('categoryOrder', JSON.stringify(order.value))
  settling.value = true
  floating.value = false
  void nextTick(() => {
    const container = root.value
    const target = container?.querySelector<HTMLElement>(`[data-category="${dragging.value}"]`)
    if (container && target) {
      const bounds = container.getBoundingClientRect()
      x.value = bounds.left + container.clientLeft + target.offsetLeft
      y.value = bounds.top + container.clientTop + target.offsetTop
    }
    timer = setTimeout(() => {
      dragging.value = null
      settling.value = false
      suppressClick = false
    }, 220)
  })
}
function cancel(): void {
  if (pointer) order.value = pointer.original
  finish()
}
function escape(event: KeyboardEvent): void {
  if (event.key === 'Escape') cancel()
}
function select(value: Value): void {
  if (!suppressClick) emit('update:modelValue', value)
}
onBeforeUnmount(() => {
  cleanup()
  clearTimeout(timer)
})
</script>

<template>
  <div
    ref="root"
    class="category-navigation"
    :class="{ separated: dragging }"
    role="group"
    aria-label="作品分类"
    @dragstart.prevent
  >
    <TransitionGroup name="category">
      <button
        v-for="c in options"
        :key="c.value"
        :data-category="c.value"
        :aria-pressed="modelValue === c.value"
        :class="{ on: modelValue === c.value, placeholder: dragging === c.value }"
        @pointerdown="start($event, c.value)"
        @click="select(c.value)"
      >
        {{ c.label }}
      </button>
    </TransitionGroup>
  </div>
  <Teleport to="body">
    <div
      v-if="dragging"
      class="category-ghost"
      :class="{ floating, settling, on: modelValue === dragging }"
      :style="{ left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` }"
      aria-hidden="true"
    >
      {{ label }}
    </div>
  </Teleport>
</template>

<style scoped>
.category-navigation {
  position: relative;
  cursor: default;
  display: flex;
  height: 34px;
  padding: 0;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  transition:
    gap 90ms,
    background 180ms,
    border-color 180ms;
}
.category-navigation button {
  height: 32px;
  line-height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  white-space: nowrap;
  touch-action: none;
  user-select: none;
  cursor: default;
}
.category-navigation button:hover {
  background: var(--bg);
}
.category-navigation button.on,
.category-ghost.on {
  background: var(--accent);
  color: white;
}
.category-navigation.separated {
  gap: 8px;
  background: transparent;
  border-color: transparent;
}
.separated button {
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--border);
}
.separated button.on {
  background: var(--accent);
}
.category-navigation button.placeholder {
  opacity: 0.18;
}
.category-move {
  transition: transform 90ms ease;
}
.category-ghost {
  position: fixed;
  z-index: 1000;
  display: grid;
  place-items: center;
  border-radius: 5px;
  background: var(--surface);
  box-shadow: 0 5px 18px #0003;
  pointer-events: none;
  transform: scale(1);
  transition:
    transform 180ms ease,
    box-shadow 180ms;
}
.category-ghost.floating {
  transform: scale(1.1);
}
.category-ghost.settling {
  transition:
    left 200ms ease,
    top 200ms ease,
    transform 200ms ease;
  box-shadow: none;
}
@media (prefers-reduced-motion: reduce) {
  .category-navigation,
  .category-move,
  .category-ghost,
  .category-ghost.settling {
    transition: none;
  }
}
</style>
