import { app, screen, type BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface WindowState {
  width: number
  height: number
  maximized: boolean
}
const defaults: WindowState = { width: 900, height: 670, maximized: false }

export function loadWindowState(): WindowState {
  let state = { ...defaults }
  try {
    const saved = JSON.parse(
      readFileSync(join(app.getPath('userData'), 'window-state.json'), 'utf8')
    )
    if (
      Number.isInteger(saved.width) &&
      saved.width > 0 &&
      Number.isInteger(saved.height) &&
      saved.height > 0
    ) {
      state = { width: saved.width, height: saved.height, maximized: saved.maximized === true }
    }
  } catch {
    /* First launch or invalid settings: use defaults. */
  }
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  state.width = Math.min(width, Math.max(400, state.width))
  state.height = Math.min(height, Math.max(300, state.height))
  return state
}

export function rememberWindowState(window: BrowserWindow): void {
  window.on('close', () => {
    const { width, height } = window.getNormalBounds()
    try {
      writeFileSync(
        join(app.getPath('userData'), 'window-state.json'),
        JSON.stringify({ width, height, maximized: window.isMaximized() }),
        'utf8'
      )
    } catch (error) {
      console.error('Failed to save window size', error)
    }
  })
}
