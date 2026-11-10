/** 静态检查配置：统一 TypeScript 与 Vue 的代码规则。 */
import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginVue.configs['flat/recommended'],
  eslintConfigPrettier,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser
      }
    }
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,tsx,vue}'],
    rules: {
      curly: ['error', 'all'],
      'max-depth': ['error', 3],
      'no-else-return': 'error',
      'no-nested-ternary': 'error',
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/block-lang': [
        'error',
        {
          script: {
            lang: 'ts'
          }
        }
      ]
    }
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      // JavaScript 文件不能声明 TypeScript 返回类型。
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  }
)
