# media-tracker

使用 Electron、Vue 和 TypeScript 开发的本地书影音管理工具。支持动画、书籍、电影和视觉小说，提供多主页标签、分类拖拽、评分、标签和 Bangumi / NeoDB 资料导入。

## 开发与检查

建议使用 Node.js 24。测试使用 Node.js 内置测试运行器和内存 SQLite，无需连接外部服务。

```sh
npm ci
npm run dev
npm run format
npm run format:check
npm run lint
npm test
npm run build
```

`npm run build` 包含主进程和界面的类型检查，也可单独运行 `npm run typecheck`。`npm start` 预览构建结果。Windows 安装包使用 `npm run build:win`；macOS 和 Linux 分别使用 `npm run build:mac`、`npm run build:linux`。

## 模块说明

以下路径均相对于项目根目录。

| 路径                                                              | 作用                                           |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| `src/main/index.ts`                                               | 应用入口、窗口创建和生命周期                   |
| `src/main/ipc.ts`                                                 | 注册作品、搜索、主题、字体和封面的进程通信接口 |
| `src/main/db.ts`                                                  | SQLite 读写、来源判重和批量删除事务            |
| `src/main/catalog.ts`                                             | 聚合搜索、去重排序、分页缓存及实时书架状态     |
| `src/main/search-text.ts`                                         | 标题标准化和匹配评分                           |
| `src/main/bangumi.ts`、`src/main/neodb.ts`                        | 数据源请求、资料转换与导入草稿                 |
| `src/main/covers.ts`                                              | 本地和远程封面缓存、内部图片协议               |
| `src/main/fonts.ts`                                               | Windows 字体查询和缓存                         |
| `src/main/window-state.ts`                                        | 窗口尺寸和最大化状态持久化                     |
| `src/preload/index.ts`、`index.d.ts`                              | 受控通信桥接与窗口接口声明                     |
| `src/renderer/index.html`、`src/renderer/src/main.ts`、`env.d.ts` | 界面入口、挂载和构建类型声明                   |
| `src/renderer/src/App.vue`                                        | 主页组合、弹窗协调和批量管理                   |
| `src/renderer/src/composables/useHomeTabs.ts`                     | 标签页独立筛选、滚动恢复和切换保护             |
| `src/renderer/src/composables/useLibrary.ts`                      | 作品列表加载、排序和过期请求保护               |
| `src/renderer/src/composables/usePreferences.ts`                  | 导航、默认分类、字体与主题偏好                 |
| `src/renderer/src/components/SettingsDialog.vue`                  | 设置搜索、字体列表和重置确认                   |
| `src/renderer/src/components/ConfirmDialog.vue`                   | 删除和移除封面的共用确认弹窗                   |
| `src/renderer/src/components/BangumiSearch.vue`                   | 聚合搜索界面、防抖分页和导入                   |
| `src/renderer/src/components/ItemEditor.vue`                      | 作品编辑、字段校验、封面和标签                 |
| `src/renderer/src/components/CategoryNavigation.vue`              | 分类排序、拖拽动画和顺序保存                   |
| `src/renderer/src/components/SelectMenu.vue`                      | 单选菜单与键盘导航                             |
| `src/renderer/src/components/HighlightText.vue`                   | 安全的文本匹配高亮                             |
| `src/renderer/src/constants.ts`、`sort.ts`、`pagination.ts`       | 界面常量、作品排序和页码生成                   |
| `src/renderer/src/assets/main.css`                                | 全局主题、基础控件和滚动条样式                 |
| `shared/types.ts`、`api.ts`                                       | 共用业务类型和进程通信契约                     |
| `shared/bangumi.ts`、`theme.ts`                                   | 搜索类型、统一页大小和窗口配色                 |
| `tests/`                                                          | 搜索缓存、标签页、异步列表和数据库回归测试     |
| `resources/`                                                      | 原始图标、窗口 PNG 和 Windows ICO              |
| `build/`                                                          | macOS 权限配置、macOS 和 Linux 打包图标        |
| `electron.vite.config.ts`、`electron-builder.yml`                 | 编译入口与分平台打包配置                       |
| `eslint.config.mjs`、`.prettierrc.yaml`、`.editorconfig`          | 静态检查、格式和编辑器约定                     |
| `tsconfig*.json`、`.vscode/`                                      | TypeScript 项目配置和开发工具设置              |

## 数据与生成文件

作品数据库 `library.db`、封面目录 `covers` 和窗口配置保存在 Electron 的用户数据目录，不在项目源码目录。显示偏好由界面的本地存储保存。

运行时图标使用 `resources/icon.png`，Windows 打包图标使用 `resources/icon.ico`。`resources/icon.webp` 为原始素材；更换原图后需要重新转换 PNG 和 ICO。`build/icon.icns` 和 `build/icon.png` 用于其他平台打包，不应作为重复图片删除。

`node_modules/` 是依赖，`out/` 是编译产物，`dist/` 是打包产物，均不提交到 Git。依赖目录与锁文件由包管理器维护。重新构建会刷新 `out/`；旧的 `.eslintcache` 可以删除，当前检查脚本不再生成该缓存。

## 维护约定

- 源码模块开头用简体中文说明职责，工具指令注释保留有效语法。
- 使用提前返回和命名函数减少嵌套；条件与循环统一使用大括号，ESLint 限制控制流最多三层嵌套。
- Prettier 统一两空格缩进、单引号、无分号和 LF 换行。
- 数据源模块只返回远程资料；排序和缓存集中在聚合层，书架状态每次读取时重新计算。
- 展示组件、显示偏好和列表加载各自维护职责；修改前先检查是否已有可复用组件。
- 提交前运行格式检查、Lint、测试和构建。测试不会访问真实作品库；打包时排除测试及共享源码。
