import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Category, ItemFilter, ItemInput } from '../../shared/types'

const api = {
  fonts: { list: () => ipcRenderer.invoke('fonts:list') },
  bangumi: {
    search: (keyword: string, category?: Category, offset?: number) =>
      ipcRenderer.invoke('bangumi:search', keyword, category, offset),
    import: (source: string, id: string | number) =>
      ipcRenderer.invoke('bangumi:import', source, id)
  },
  platform: process.platform,
  theme: {
    set: (theme: 'light' | 'dark', dimmed = false) => ipcRenderer.invoke('theme:set', theme, dimmed)
  },
  items: {
    deleteMany: (ids: number[]) => ipcRenderer.invoke('items:delete-many', ids),
    list: (f?: ItemFilter) => ipcRenderer.invoke('items:list', f),
    add: (input: ItemInput) => ipcRenderer.invoke('items:add', input),
    update: (id: number, input: ItemInput) => ipcRenderer.invoke('items:update', id, input),
    delete: (id: number) => ipcRenderer.invoke('items:delete', id)
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
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
