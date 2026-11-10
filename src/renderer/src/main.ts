/** 界面入口：加载全局样式并挂载 Vue 应用。 */
import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
