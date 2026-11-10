/** 更新回归：模拟发布服务与原生弹窗，验证确认、重试和并发保护。 */
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { loadSource } from './load-source.mjs'

function updater({ packaged = true, available = true, responses = [] } = {}) {
  const messages = []
  const progress = []
  const calls = { check: 0, download: 0, install: 0 }
  const autoUpdater = Object.assign(new EventEmitter(), {
    async checkForUpdates() {
      calls.check++
      return { isUpdateAvailable: available, updateInfo: { version: '1.0.3' } }
    },
    async downloadUpdate() {
      calls.download++
      autoUpdater.emit('download-progress', { percent: 50 })
    },
    quitAndInstall() {
      calls.install++
    }
  })
  const window = { setProgressBar: (value) => progress.push(value) }
  const api = loadSource('src/main/updates.ts', {
    electron: {
      app: { isPackaged: packaged, getVersion: () => '1.0.2' },
      BrowserWindow: { getFocusedWindow: () => window, getAllWindows: () => [window] },
      dialog: {
        async showMessageBox(_window, options) {
          messages.push(options)
          return { response: responses.shift() ?? 0 }
        }
      }
    },
    'electron-updater': { autoUpdater }
  })
  return { api, autoUpdater, calls, messages, progress }
}

test('开发环境不联网检查更新', async () => {
  const { api, calls, messages } = updater({ packaged: false })
  await api.checkForUpdates(false)
  assert.equal(messages.length, 0)
  await api.checkForUpdates()
  assert.equal(calls.check, 0)
  assert.match(messages[0].message, /安装后的 Windows/)
})

// 实际更新功能只针对 Windows；其他平台仍验证上面的开发环境保护。
test(
  '更新需确认下载和安装，已下载版本可稍后安装',
  { skip: process.platform !== 'win32' },
  async () => {
    const { api, autoUpdater, calls, progress } = updater({ responses: [1, 0, 1] })
    await api.checkForUpdates()
    assert.deepEqual(calls, { check: 1, download: 1, install: 0 })
    assert.equal(autoUpdater.autoInstallOnAppQuit, false)
    assert.equal(autoUpdater.autoDownload, false)
    assert.deepEqual(progress, [0.5, -1])
    await api.checkForUpdates()
    assert.deepEqual(calls, { check: 1, download: 1, install: 1 })
  }
)

test(
  '取消下载不会安装，后台检查无更新时保持安静',
  { skip: process.platform !== 'win32' },
  async () => {
    const cancelled = updater({ responses: [0] })
    await cancelled.api.checkForUpdates()
    assert.deepEqual(cancelled.calls, { check: 1, download: 0, install: 0 })
    const latest = updater({ available: false })
    await latest.api.checkForUpdates(false)
    assert.equal(latest.messages.length, 0)
    await latest.api.checkForUpdates()
    assert.match(latest.messages[0].message, /最新版本/)
  }
)

test(
  '下载失败可重试，重复操作不会重复请求',
  { skip: process.platform !== 'win32' },
  async (context) => {
    const fixture = updater({ responses: [1, 1, 0] })
    const originalError = console.error
    console.error = () => {}
    context.after(() => {
      console.error = originalError
    })
    fixture.autoUpdater.downloadUpdate = async () => {
      throw new Error('离线')
    }
    await fixture.api.checkForUpdates()
    assert.match(fixture.messages.at(-1).message, /无法完成更新/)
    let resolveCheck
    fixture.autoUpdater.checkForUpdates = () =>
      new Promise((resolve) => {
        resolveCheck = resolve
      })
    const checking = fixture.api.checkForUpdates()
    await fixture.api.checkForUpdates()
    assert.match(fixture.messages.at(-1).message, /请稍候/)
    resolveCheck({ isUpdateAvailable: false })
    await checking
    assert.equal(fixture.calls.install, 0)
  }
)

test(
  '分别提示未发布、缺少更新文件和网络故障',
  { skip: process.platform !== 'win32' },
  async (context) => {
    const originalError = console.error
    console.error = () => {}
    context.after(() => {
      console.error = originalError
    })
    const cases = [
      [new Error('No published versions on GitHub'), '尚未发布可用的更新'],
      [
        Object.assign(new Error('missing'), { code: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' }),
        '发布版本缺少更新文件'
      ],
      [new Error('net::ERR_CONNECTION_TIMED_OUT'), '无法连接更新服务']
    ]
    for (const [error, expected] of cases) {
      const fixture = updater()
      fixture.autoUpdater.checkForUpdates = async () => {
        throw error
      }
      await fixture.api.checkForUpdates(false)
      assert.equal(fixture.messages.length, 0)
      await fixture.api.checkForUpdates()
      assert.equal(fixture.messages.at(-1).message, expected)
    }
  }
)
