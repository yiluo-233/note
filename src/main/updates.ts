/** 应用更新：检查 GitHub 发布版本，确认下载并在用户同意后重启安装。 */
import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

let busy = false
let downloadedVersion = ''
let initialized = false

function updateFailure(error: unknown): Electron.MessageBoxOptions {
  const failure = error as { code?: string; message?: string } | null
  const code = failure?.code ?? ''
  const detail = failure?.message ?? String(error)
  if (
    code === 'ERR_UPDATER_NO_PUBLISHED_VERSIONS' ||
    /No published versions on GitHub/i.test(detail)
  ) {
    return {
      type: 'info',
      message: '尚未发布可用的更新',
      detail: 'GitHub Releases 中还没有正式版本。发布安装包和 latest.yml 后才能检查更新。'
    }
  }
  if (code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND') {
    return {
      type: 'warning',
      message: '发布版本缺少更新文件',
      detail: '最新 GitHub Release 中缺少 latest.yml，请将它与对应安装包一起上传。'
    }
  }
  if (
    /ERR_(INTERNET|NETWORK|CONNECTION|NAME|TIMED_OUT|PROXY)|ECONN|ENOTFOUND|ETIMEDOUT/i.test(
      `${code} ${detail}`
    )
  ) {
    return {
      type: 'error',
      message: '无法连接更新服务',
      detail: '请检查网络或代理是否能访问 GitHub，然后重试。'
    }
  }
  return {
    type: 'error',
    message: '暂时无法完成更新',
    detail: `无法获取或验证更新文件，请稍后重试。${code ? `错误代码：${code}` : ''}`
  }
}

async function message(options: Electron.MessageBoxOptions): Promise<number> {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const result = await (window
    ? dialog.showMessageBox(window, { title: 'note 更新', ...options })
    : dialog.showMessageBox({ title: 'note 更新', ...options }))
  return result.response
}

async function offerInstall(): Promise<void> {
  const response = await message({
    type: 'info',
    message: `note ${downloadedVersion} 已下载`,
    detail: '重启后安装更新。请先保存正在编辑的内容；作品库和设置会保留。',
    buttons: ['稍后', '重启并安装'],
    defaultId: 0,
    cancelId: 0
  })
  if (response === 1) {
    autoUpdater.quitAndInstall(true, true)
  }
}

export function initUpdates(): void {
  if (initialized) {
    return
  }
  initialized = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false
  // error 事件必须被消费；操作失败的提示由调用处统一处理，避免重复弹窗。
  autoUpdater.on('error', (error) => console.error('应用更新失败', error))
  autoUpdater.on('download-progress', (progress) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.setProgressBar(progress.percent / 100)
    }
  })
}

export async function checkForUpdates(manual = true): Promise<void> {
  if (busy) {
    if (manual) {
      await message({ type: 'info', message: '正在检查或下载更新，请稍候。' })
    }
    return
  }
  if (!app.isPackaged || process.platform !== 'win32') {
    if (manual) {
      await message({ type: 'info', message: '请在安装后的 Windows 版 note 中检查更新。' })
    }
    return
  }
  initUpdates()
  busy = true
  let updateAvailable = false
  try {
    if (downloadedVersion) {
      await offerInstall()
      return
    }
    const result = await autoUpdater.checkForUpdates()
    if (!result?.isUpdateAvailable) {
      if (manual) {
        await message({ type: 'info', message: `当前已是最新版本（${app.getVersion()}）。` })
      }
      return
    }
    updateAvailable = true
    const version = result.updateInfo.version
    const response = await message({
      type: 'info',
      message: `发现新版本 note ${version}`,
      detail: `当前版本为 ${app.getVersion()}。下载期间可以继续使用，进度显示在任务栏。`,
      buttons: ['稍后', '下载更新'],
      defaultId: 1,
      cancelId: 0
    })
    if (response !== 1) {
      return
    }
    await autoUpdater.downloadUpdate()
    downloadedVersion = version
    await offerInstall()
  } catch (error) {
    console.error('检查或下载更新失败', error)
    if (manual || updateAvailable) {
      await message(updateFailure(error))
    }
  } finally {
    busy = false
    for (const window of BrowserWindow.getAllWindows()) {
      window.setProgressBar(-1)
    }
  }
}
