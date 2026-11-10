/** 测试加载器：在内存中编译 TypeScript，并替换 Electron 等外部依赖。 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileFunction } from 'node:vm'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)

export function loadSource(path, overrides = {}) {
  const cache = new Map()

  function load(filename) {
    if (cache.has(filename)) {
      return cache.get(filename).exports
    }
    const module = { exports: {} }
    cache.set(filename, module)
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    })
    function importModule(id) {
      if (Object.hasOwn(overrides, id)) {
        return overrides[id]
      }
      if (!id.startsWith('.')) {
        return require(id)
      }
      return load(resolve(dirname(filename), `${id}.ts`))
    }
    const run = compileFunction(outputText, ['exports', 'require', 'module'], { filename })
    run(module.exports, importModule, module)
    return module.exports
  }

  return load(resolve(root, path))
}
