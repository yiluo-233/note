<script setup lang="ts">
/** 作品卡片列表：展示封面、标题、批量选择和空列表提示。 */
import type { Item } from '../../../../shared/types'
import { coverUrl } from '../constants'
defineProps<{
  items: Item[]
  empty: boolean
  locked: boolean
  managing: boolean
  selectedIds: Set<number>
}>()
const emit = defineEmits<{ select: [item: Item] }>()
</script>
<template>
  <main class="wall">
    <div
      v-for="i in items"
      :key="i.id"
      class="card"
      :class="{ locked }"
      :role="managing ? 'checkbox' : undefined"
      :aria-checked="managing ? selectedIds.has(i.id) : undefined"
      :aria-label="managing ? i.title : undefined"
      :tabindex="managing ? 0 : undefined"
      @click="emit('select', i)"
      @keydown.space.prevent="managing && emit('select', i)"
      @keydown.enter.prevent="managing && emit('select', i)"
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
    <div v-if="empty" class="empty">还没有条目，点右上角「添加」开始吧</div>
  </main>
</template>
<style scoped>
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

.card.locked {
  cursor: default;
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
</style>
