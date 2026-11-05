import { ElectronAPI } from '@electron-toolkit/preload'
import type { Category, Item, ItemFilter, ItemInput } from '../../shared/types'

import type { SearchPage, ImportDraft } from '../../shared/bangumi'
declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      fonts: { list: () => Promise<string[]> }
      bangumi: {
        search: (keyword: string, category?: Category, offset?: number) => Promise<SearchPage>
        import: (source: string, id: string | number) => Promise<ImportDraft>
      }
      platform: string
      theme: { set: (theme: 'light' | 'dark', dimmed?: boolean) => Promise<void> }
      items: {
        deleteMany: (ids: number[]) => Promise<void>
        list: (f?: ItemFilter) => Promise<Item[]>
        add: (input: ItemInput) => Promise<Item>
        update: (id: number, input: ItemInput) => Promise<Item | null>
        delete: (id: number) => Promise<void>
      }
      cover: { pick: () => Promise<string | null> }
      tags: { list: () => Promise<string[]> }
    }
  }
}
