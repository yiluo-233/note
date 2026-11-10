/** 预加载桥接：向渲染进程暴露受控的异步业务接口。 */
import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../../shared/api'

const api: AppApi = {
  fonts: { list: () => ipcRenderer.invoke('fonts:list') },
  bangumi: {
    search: (keyword, category, offset) =>
      ipcRenderer.invoke('bangumi:search', keyword, category, offset),
    import: (source, id) => ipcRenderer.invoke('bangumi:import', source, id)
  },
  platform: process.platform,
  theme: {
    set: (theme, dimmed = false) => ipcRenderer.invoke('theme:set', theme, dimmed)
  },
  items: {
    deleteMany: (ids) => ipcRenderer.invoke('items:delete-many', ids),
    list: (filter) => ipcRenderer.invoke('items:list', filter),
    add: (input) => ipcRenderer.invoke('items:add', input),
    update: (id, input) => ipcRenderer.invoke('items:update', id, input),
    delete: (id) => ipcRenderer.invoke('items:delete', id)
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list')
  },
  cover: {
    pick: () => ipcRenderer.invoke('cover:pick')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  Object.assign(window, { api })
}
