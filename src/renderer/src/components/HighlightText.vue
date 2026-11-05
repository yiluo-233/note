<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ text: string; query: string }>()
const parts = computed(() => {
  const query = props.query.trim().toLocaleLowerCase()
  if (!query) return [{ text: props.text, match: false }]
  const result: { text: string; match: boolean }[] = []
  const lower = props.text.toLocaleLowerCase()
  let cursor = 0
  let index = lower.indexOf(query)
  while (index !== -1) {
    if (index > cursor) result.push({ text: props.text.slice(cursor, index), match: false })
    result.push({ text: props.text.slice(index, index + query.length), match: true })
    cursor = index + query.length
    index = lower.indexOf(query, cursor)
  }
  if (cursor < props.text.length) result.push({ text: props.text.slice(cursor), match: false })
  return result
})
</script>
<template>
  <span
    ><template v-for="(part, index) in parts" :key="index"
      ><mark v-if="part.match">{{ part.text }}</mark
      ><template v-else>{{ part.text }}</template></template
    ></span
  >
</template>
<style scoped>
mark {
  background: rgb(255 115 174 / 38%);
  color: inherit;
  border-radius: 2px;
  padding: 0;
}
</style>
