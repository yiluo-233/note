/** 构建配置：定义主进程、预加载和 Vue 界面的构建入口。 */
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [vue()]
  }
})
