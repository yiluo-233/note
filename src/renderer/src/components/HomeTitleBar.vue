<script setup lang="ts">
/** 主页标题栏：显示标签页和新增、关闭入口，保留窗口拖拽区域。 */
defineProps<{ homeTabs: { id: number }[]; activeTabId: number }>()
const emit = defineEmits<{ select: [id: number]; close: [id: number]; add: [] }>()
</script>
<template>
  <div class="window-titlebar">
    <TransitionGroup
      name="home-tab"
      tag="div"
      class="home-tabs"
      role="tablist"
      aria-label="主页标签页"
    >
      <div
        v-for="(tab, index) in homeTabs"
        :key="tab.id"
        class="home-tab"
        :class="{ active: activeTabId === tab.id }"
      >
        <button
          :id="`home-tab-${tab.id}`"
          class="home-tab-select"
          role="tab"
          :aria-selected="activeTabId === tab.id"
          aria-controls="home-panel"
          @click="emit('select', tab.id)"
        >
          主页
        </button>
        <button
          v-if="index > 0"
          class="home-tab-close"
          aria-label="关闭主页标签页"
          title="关闭标签页 (Ctrl+W)"
          @click="emit('close', tab.id)"
        >
          ×
        </button>
      </div>
    </TransitionGroup>
    <button
      class="new-home-tab"
      aria-label="新建主页标签页"
      title="新建主页标签页"
      @click="emit('add')"
    >
      +
    </button>
  </div>
</template>
<style scoped>
.windows-shell .window-titlebar {
  padding-right: 150px;
}
.home-tabs {
  display: flex;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-app-region: no-drag;
}
.home-tab {
  display: flex;
  flex: 0 0 auto;
  width: 180px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  align-items: center;
  border-radius: 6px 6px 0 0;
  height: 30px;
  border: 1px solid transparent;
}
.home-tab-enter-active,
.home-tab-leave-active {
  transition:
    width 220ms ease,
    opacity 180ms ease,
    transform 220ms ease;
  pointer-events: none;
}
.home-tab-enter-from,
.home-tab-leave-to {
  width: 0;
  opacity: 0;
  transform: translateX(-8px);
  border-left-width: 0;
  border-right-width: 0;
}
.home-tab-close {
  flex-shrink: 0;
}
@media (prefers-reduced-motion: reduce) {
  .home-tab-enter-active,
  .home-tab-leave-active {
    transition: none;
  }
}
.home-tab.active {
  background: var(--bg);
  border-color: var(--border);
  border-bottom-color: var(--bg);
}
.home-tab-select {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 3px 10px;
  font-size: 12px;
  background: transparent;
  border: 0;
}
.home-tab-close,
.new-home-tab {
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-2);
  -webkit-app-region: no-drag;
}
.home-tab-close {
  width: 22px;
  height: 22px;
  margin-right: 5px;
  font-size: 18px;
}
.new-home-tab {
  width: 28px;
  height: 25px;
  flex-shrink: 0;
  margin: 0 4px;
  font-size: 18.4px;
  color: #aeb3bc;
}
.home-tab-close:hover,
.new-home-tab:hover {
  background: var(--border);
  color: var(--text);
}
/* 将侧边栏分隔线延伸到标题栏，同时不拦截输入事件。 */
.window-titlebar::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--sidebar-width) - 1px);
  width: 1px;
  background: var(--border);
  pointer-events: none;
}
.window-titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--titlebar-height);
  display: flex;
  align-items: center;
  padding: 3px 12px 0 var(--sidebar-width);
  background: var(--chrome-bg);
  color: var(--text-2);
  font-size: 12px;
  -webkit-app-region: drag;
  user-select: none;
  z-index: 20;
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
