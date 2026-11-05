import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)
let cached: Promise<string[]> | undefined
export function listFonts(): Promise<string[]> {
  if (process.platform !== 'win32') return Promise.resolve([])
  if (!cached) {
    const script =
      '[Console]::OutputEncoding = [Text.Encoding]::UTF8; Add-Type -AssemblyName System.Drawing; $collection = New-Object System.Drawing.Text.InstalledFontCollection; try { ConvertTo-Json -InputObject @($collection.Families | ForEach-Object { $_.Name } | Sort-Object -Unique) -Compress } finally { $collection.Dispose() }'
    cached = run(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64')
      ],
      { windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }
    )
      .then(({ stdout }) => {
        const result: unknown = JSON.parse(stdout.replace(/^\uFEFF/, '').trim())
        if (!Array.isArray(result)) throw new Error('Invalid font list')
        return result.filter(
          (name): name is string => typeof name === 'string' && !!name && !name.startsWith('@')
        )
      })
      .catch((error) => {
        cached = undefined
        throw error
      })
  }
  return cached
}
