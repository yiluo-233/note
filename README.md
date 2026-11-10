# note

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

Windows 安装界面由 `build/installer.nsh` 定义：同一页选择安装位置、是否创建桌面快捷方式、是否添加到开始菜单；“浏览”使用 Windows 现代文件夹选择器，选择父目录时自动补上 `note` 子目录。添加到开始菜单不等于固定到开始。自动更新和静默安装跳过选项页，并保留现有快捷方式状态。

## 模块说明

以下路径均相对于项目根目录。

### 目录怎么读

- `src`：源代码（source 的通用缩写）；`main` 是桌面程序主进程，`preload` 是界面与主进程之间的桥梁，`renderer/src` 是界面代码。
- `components`：可独立维护的界面组件；`composables`：管理界面状态和操作流程的函数。
- `shared`：前后两部分共用的类型；`tests`：回归测试；`resources`：图片等资源；`build`：打包资源。
- 项目自有的缩写名称已展开，例如 `database`（数据库）、`interprocess-communication`（进程通信）、`application-interface`（应用接口）。
- 业界惯用名称、工具固定名称及格式扩展名保留：`src`、`App.vue`、`env.d.ts`，以及例如 `.git`、`.vscode`、`.npmrc`、`tsconfig*.json`、`electron.vite.config.ts`、`node_modules`、`out`、`dist` 和 `.ts`、`.css`。Bangumi、NeoDB 是数据源专名。运行时的 `library.db` 名称也保留，以继续读取原有作品库。

### 主界面如何拆分

`src/renderer/src/App.vue` 负责组合界面、筛选条件和弹窗：

- `components/HomeTitleBar.vue`：主页标签栏及对应样式。
- `components/LibraryWall.vue`：作品卡片、选择标记、空列表提示及对应样式。
- `composables/useItemEditing.ts`：搜索、手动添加、导入草稿和保存流程。
- `composables/useBatchManagement.ts`：批量选择、删除确认及忙碌保护。
- `assets/application.css`：主界面布局样式，通过 `scoped` 引入，仅作用于主界面。

| 路径                                                              | 作用                                           |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| `src/main/index.ts`                                               | 应用入口、窗口创建和生命周期                   |
| `src/main/interprocess-communication.ts`                          | 注册作品、搜索、主题、字体和封面的进程通信接口 |
| `src/main/database.ts`                                            | SQLite 读写、来源判重和批量删除事务            |
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
| `shared/types.ts`、`application-interface.ts`                     | 共用业务类型和进程通信契约                     |
| `shared/bangumi.ts`、`theme.ts`                                   | 搜索类型、统一页大小和窗口配色                 |
| `tests/`                                                          | 搜索缓存、标签页、异步列表和数据库回归测试     |
| `resources/`                                                      | 原始图标、窗口 PNG 和 Windows ICO              |
| `build/`                                                          | macOS 权限配置、macOS 和 Linux 打包图标        |
| `electron.vite.config.ts`、`electron-builder.yml`                 | 编译入口与分平台打包配置                       |
| `eslint.config.mjs`、`.prettierrc.yaml`、`.editorconfig`          | 静态检查、格式和编辑器约定                     |
| `tsconfig*.json`、`.vscode/`                                      | TypeScript 项目配置和开发工具设置              |

## 数据与生成文件

### Windows 自动更新

安装版启动 15 秒后检查 `yiluo-233/note` 的 GitHub Releases，也可通过应用菜单的“检查更新”手动触发。发现正式新版本后询问是否下载，下载进度显示在任务栏；下载完成后可选择稍后或重启安装，普通退出不会自动安装。开发模式不下载或安装更新。更新程序与作品库分开保存。

首次启用更新需要手动安装一次带更新功能的版本。之后每次发布：

1. 运行 `npm version patch --no-git-tag-version` 更新版本号和锁文件。
2. 运行 `npm run build:win`，将 `dist/` 中的安装包、对应 `.exe.blockmap` 和 `latest.yml` 上传到 GitHub 同一正式 Release，标签使用 `v` 加版本号，例如 `v1.0.1`。草稿和预发布不会作为稳定更新。
3. 或在本机配置有仓库发布权限的 `GH_TOKEN` 环境变量，再运行 `npm run release:win` 自动上传并发布。令牌只用于发布，不写进源码、配置或安装包。

`build:win` 只构建，不会发布。保留 `appId: com.note.app` 和 `productName: note`，让后续版本继续识别已有安装及数据目录。完整更新验证需要先安装较低版本，再发布较高版本并检查下载、重启和作品库保留情况。

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
