/** 封面管理：选择本地图片、缓存远程封面并提供内部读取协议。 */
import { writeFile } from 'node:fs/promises'
import { app, dialog, net, protocol } from 'electron'
import { copyFileSync, mkdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

function coversDir(): string {
  const dir = join(app.getPath('userData'), 'covers')
  mkdirSync(dir, { recursive: true })
  return dir
}

// 必须在应用就绪之前注册协议权限。
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
  if (r.canceled || !r.filePaths[0]) {
    return null
  }
  const name = randomUUID() + extname(r.filePaths[0]).toLowerCase()
  copyFileSync(r.filePaths[0], join(coversDir(), name))
  return name
}
/** 下载已通过来源校验的封面；失败只返回提示，不中断作品资料导入。 */
export async function downloadCover(
  url: string,
  failureMessage: string
): Promise<{ coverPath: string; warning: string }> {
  if (!url) {
    return { coverPath: '', warning: '' }
  }
  try {
    const response = await net.fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' })
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif'
    }
    const extension = extensions[response.headers.get('content-type')?.split(';')[0] || '']
    if (!response.ok || !extension) {
      throw new Error('封面格式无效')
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length > 15 * 1024 * 1024) {
      throw new Error('封面超过大小限制')
    }
    const coverPath = randomUUID() + extension
    await writeFile(join(coversDir(), coverPath), bytes)
    return { coverPath, warning: '' }
  } catch {
    return { coverPath: '', warning: failureMessage }
  }
}
