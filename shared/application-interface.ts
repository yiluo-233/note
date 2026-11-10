/** 进程通信契约：统一预加载实现与界面调用的参数、返回值类型。 */
import type { Category, Item, ItemFilter, ItemInput } from './types'
import type { SearchPage, ImportDraft } from './bangumi'
import type { Theme } from './theme'

export interface AppApi {
  updates: { check: () => Promise<void> }
  fonts: { list: () => Promise<string[]> }
  bangumi: {
    search: (keyword: string, category?: Category, offset?: number) => Promise<SearchPage>
    import: (source: string, id: string | number) => Promise<ImportDraft>
  }
  platform: string
  theme: { set: (theme: Theme, dimmed?: boolean) => Promise<void> }
  items: {
    deleteMany: (ids: number[]) => Promise<void>
    list: (filter?: ItemFilter) => Promise<Item[]>
    add: (input: ItemInput) => Promise<Item>
    update: (id: number, input: ItemInput) => Promise<Item | null>
    delete: (id: number) => Promise<void>
  }
  cover: { pick: () => Promise<string | null> }
  tags: { list: () => Promise<string[]> }
}
