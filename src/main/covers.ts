import { app, dialog, net, protocol } from 'electron'
import { copyFileSync, mkdirSync } from 'fs'
import { basename, extname, join } from 'path'
import { pathToFileURL } from 'url'
import { randomUUID } from 'crypto'

export function coversDir(): string {
  const dir = join(app.getPath('userData'), 'covers')
  mkdirSync(dir, { recursive: true })
  return dir
}

// 必须在 app ready 之前调用
export function registerCoverScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'cover', privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

export function registerCoverProtocol(): void {
  protocol.handle('cover', (req) => {
    const name = basename(decodeURIComponent(new URL(req.url).pathname))
    return net.fetch(pathToFileURL(join(coversDir(), name)).toString())
  })
}

export async function pickCover(): Promise<string | null> {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
  })
  if (r.canceled || !r.filePaths[0]) return null
  const name = randomUUID() + extname(r.filePaths[0]).toLowerCase()
  copyFileSync(r.filePaths[0], join(coversDir(), name))
  return name
}