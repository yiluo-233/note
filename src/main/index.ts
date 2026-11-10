/** 主进程入口：初始化数据库、窗口、协议及应用生命周期。 */
import { app, shell, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { CHROME_COLORS, CHROME_TEXT } from '../../shared/theme'
import { loadWindowState, rememberWindowState } from './window-state'
import { initDb } from './database'
import { registerIpc } from './interprocess-communication'
import { registerCoverProtocol, registerCoverScheme } from './covers'
import { checkForUpdates } from './updates'

function createWindow(): void {
  const windowState = loadWindowState()

  const mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'win32'
      ? {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: CHROME_COLORS[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'],
            symbolColor: CHROME_TEXT[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'],
            height: 33
          }
        }
      : {}),
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  rememberWindowState(mainWindow)
  mainWindow.on('ready-to-show', () => {
    if (windowState.maximized) {
      mainWindow.maximize()
    }
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initDb()
  registerIpc()
  registerCoverProtocol()

  electronApp.setAppUserModelId('com.note.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  if (app.isPackaged && process.platform === 'win32') {
    setTimeout(() => void checkForUpdates(false), 15000).unref()
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

registerCoverScheme()
