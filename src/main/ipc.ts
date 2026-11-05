import { ipcMain, nativeTheme, BrowserWindow } from 'electron'
import { addItem, deleteItems, deleteItem, listItems, listTags, updateItem } from './db'
import type { ItemFilter, ItemInput } from '../../shared/types'
import { CHROME_COLORS, CHROME_TEXT } from '../../shared/theme'
import { searchCatalog, importCatalog } from './catalog'
import { listFonts } from './fonts'
import { pickCover } from './covers'

export function registerIpc(): void {
  ipcMain.handle('fonts:list', () => listFonts())
  ipcMain.handle('bangumi:search', (_e, keyword, category, offset) =>
    searchCatalog(keyword, category, offset)
  )
  ipcMain.handle('bangumi:import', (_e, source, id) => importCatalog(source, id))
  ipcMain.handle('theme:set', (_e, theme: unknown, dimmed: unknown = false) => {
    if (theme !== 'light' && theme !== 'dark') throw new Error('Invalid theme')
    if (typeof dimmed !== 'boolean') throw new Error('Invalid modal state')
    const dim = (hex: string): string =>
      '#' +
      hex
        .slice(1)
        .match(/../g)!
        .map((c) =>
          Math.round((parseInt(c, 16) * 7) / 15)
            .toString(16)
            .padStart(2, '0')
        )
        .join('')
    nativeTheme.themeSource = theme
    if (process.platform === 'win32') {
      BrowserWindow.fromWebContents(_e.sender)?.setTitleBarOverlay({
        color: dimmed ? dim(CHROME_COLORS[theme]) : CHROME_COLORS[theme],
        symbolColor: dimmed ? dim(CHROME_TEXT[theme]) : CHROME_TEXT[theme]
      })
    }
  })
  ipcMain.handle('items:list', (_e, f?: ItemFilter) => listItems(f))
  ipcMain.handle('items:add', (_e, input: ItemInput) => addItem(input))
  ipcMain.handle('items:update', (_e, id: number, input: ItemInput) => updateItem(id, input))
  ipcMain.handle('items:delete-many', (_e, ids: number[]) => deleteItems(ids))
  ipcMain.handle('items:delete', (_e, id: number) => deleteItem(id))
  ipcMain.handle('tags:list', () => listTags())
  ipcMain.handle('cover:pick', () => pickCover())
}
