# Personal Blog

一个面向长期维护的静态个人网站项目，定位为 **个人主页 + 博客 + 内容展示站**。

项目使用原生 HTML、CSS、JavaScript 配合 Node.js 构建脚本，将 Markdown 文章编译为适合 GitHub Pages 部署的静态页面。当前版本已支持首页、博客列表、文章详情、项目页、关于页、近况页等基础内容结构，适合作为个人品牌展示与内容沉淀的起点。

## 在线预览

- GitHub Pages: <http://alex-shen1121.github.io/personal-blog/>

## 项目目标

这个项目主要解决以下几类需求：

- 搭建一个简洁、可长期维护的个人主页
- 以较低复杂度持续发布 Markdown 博客内容
- 在不依赖重量级前端框架的前提下完成静态站点构建
- 使用 GitHub Actions 实现自动化校验与部署
- 兼顾中文内容表达、基础 SEO 和 GitHub Pages 兼容性

## 功能特性

- 多页面静态站点结构
- 中文首页与完整导航信息架构
- Markdown 驱动的博客内容发布
- 博客列表页与文章详情页生成
- 项目页、关于页、近况页展示
- 深浅色主题切换
- 支持通过 `src/data/site.mjs` 自定义主题默认模式、主题色与 CSS 变量令牌
- 支持文章草稿预览：`draft: true` 的文章可直接通过正式 URL 预览，但不会进入公开列表、RSS 与 sitemap
- `prefers-reduced-motion` 兼容处理
- 基础 SEO 元信息支持
- 支持 RSS 订阅、邮件订阅与社交媒体跳转入口，并自动生成 `rss.xml`
- 支持访问统计：页脚展示站点累计访问 / 访客数，文章详情页展示当前页访问次数
- 自动生成 `sitemap.xml`、`robots.txt`、`404.html`、`.nojekyll`
- 适配 GitHub Pages 项目路径 `/personal-blog/`
- GitHub Actions 自动校验与部署

## 技术栈

- HTML
- CSS
- JavaScript
- Node.js
- Markdown
- GitHub Actions
- GitHub Pages

## 项目结构

```text
.
├─ .github/workflows/    # CI 校验与 GitHub Pages 部署流程
├─ .githooks/            # 本地 Git hooks
├─ .nvmrc                # 本地与 CI 共用的 Node.js 版本基线
├─ content/posts/        # Markdown 博客文章
├─ public/               # 直接拷贝到产物目录的静态资源
├─ scripts/              # 构建与校验脚本
├─ src/assets/           # 本地图像与装饰素材
├─ src/data/site.mjs     # 站点配置、导航、页面内容数据
├─ CHANGELOG.md          # 项目更新记录
├─ dist/                 # 构建产物目录（自动生成）
├─ package.json
└─ README.md
```

## 快速开始

### 1. 安装依赖

本项目主要依赖 Node.js 运行构建脚本，当前推荐使用 **Node.js 22.x**（仓库根目录已提供 `.nvmrc`，`package.json` 也声明了 `engines`）。

如果你本地使用 `nvm`，可以先执行：

```bash
nvm use
npm install
```

如果不使用 `nvm`，请先确认本地 `node -v` 为 22.x 再安装依赖。

安装完成后会自动执行一次 `prepare`，将仓库内置的 Git hooks 路径配置到 `.githooks`，默认启用提交前检查。
如果本地 hooks 因环境原因未生效，可手动执行：

```bash
npm run setup:hooks
```

### 2. 本地校验

```bash
npm run validate
```

### 3. 本地构建

```bash
npm run build
```

### 4. 本地预览

```bash
npm run preview
```

默认预览地址：<http://127.0.0.1:4173>

## 环境与配置说明

### 开发环境基线

- **Node.js：22.x**（本地通过 `.nvmrc` 对齐，CI 通过 `node-version-file: .nvmrc` 读取同一版本）
- **npm：10+**
- **Python 3：可选**，仅用于 `npm run preview` 启动本地静态预览服务
- **Git：建议安装**，用于启用 `.githooks/pre-commit` 与本地提交前检查

### 当前配置方式

项目当前 **不依赖运行时 `.env` 文件**。因为这是一个面向 GitHub Pages 的静态站，绝大多数配置都直接保存在仓库内，便于构建脚本与部署流程稳定复现。

| 配置位置 | 主要用途 |
| --- | --- |
| `src/data/site.mjs` | 站点标题、`siteUrl`、`repoBasePath`、导航、作者信息、品牌资源、主题配置、页面文案、访问统计配置 |
| `content/posts/*.md` | 文章 frontmatter 与正文内容 |
| `public/` | 直接发布的静态文件，如 favicon、robots、分享图等 |
| `.github/workflows/*.yml` | CI 校验、Node 版本、GitHub Pages 部署流程 |
| `.githooks/pre-commit` | 本地提交前自动执行 `npm run precommit` |

### 最常改的配置项

1. **仓库名、域名或 Pages 部署路径变化**
   - 修改 `src/data/site.mjs` 中的 `siteUrl` 与 `repoBasePath`
   - 两者的 pathname 需要保持一致，否则 `npm run validate` / `npm run build` 会在 canonical 校验阶段失败
2. **站点标题、导航、作者信息、品牌资源、主题色、访问统计变化**
   - 统一修改 `src/data/site.mjs`
3. **文章内容与文章元信息变化**
   - 在 `content/posts/` 中维护 Markdown 与 frontmatter
4. **Node.js 版本基线变化**
   - 同步更新 `.nvmrc`、`package.json` 的 `engines`，并保留 GitHub Actions 对 `.nvmrc` 的读取方式

### 环境调整建议

- 新机器第一次拉起项目时，建议先执行 `node -v`、`npm -v`，再运行 `npm install`
- 如果 `git commit` 前没有触发预提交检查，可手动执行 `npm run setup:hooks`
- 如果只需要本地查看产物，不需要额外后端服务，直接执行 `npm run build && npm run preview` 即可

## 可用脚本

```bash
npm run validate     # 校验内容与构建输入
npm run build        # 生成静态站点到 dist/
npm run ai:assist -- suggest content/posts/your-post.md # 生成 AI 辅助摘要 / 标签 prompt
npm run precommit    # 执行提交前的完整检查（validate + build）
npm run setup:hooks  # 手动配置本地 Git hooks 到 .githooks
npm run preview      # 启动本地静态预览服务
```

## 贡献说明

欢迎通过 Issue 或 Pull Request 一起改进这个项目。

仓库已提供标准化的 GitHub Issue / PR 模板，方便补充背景、验证结果与影响范围。
同时已配置独立的 GitHub Actions 校验工作流：Pull Request 发往 `main` 时会自动执行 `npm run validate` 与 `npm run build`，非 `main` 分支的 push 也会自动跑同样的检查。

提交前建议先确认以下几点：

1. 改动尽量保持小而清晰，避免把无关修改混在同一次提交中
2. 如果涉及内容、导航或站点基础信息，请同步检查 `src/data/site.mjs` 与 `content/posts/`
3. 仓库默认会在 `git commit` 前自动执行 `npm run precommit`，也就是串行运行 `npm run validate` 与 `npm run build`
4. 如果你想在正式提交前手动预跑一次，可执行：

```bash
npm run precommit
```

如果你准备提交 PR，建议在描述中说明：

- 改动目的
- 主要修改文件
- 验证结果
- 是否影响 GitHub Pages 部署产物

仓库级变更记录统一维护在 [CHANGELOG.md](./CHANGELOG.md)。提交涉及用户可感知行为、构建流程、文档规则或部署方式的改动时，建议同步更新对应条目。

## 内容维护

### 修改站点基础信息

编辑 `src/data/site.mjs` 可维护以下内容：

- 站点标题、描述、站点链接等基础信息
- 首页 Hero 区域内容
- 导航配置
- 首页内容导览与精选项目会自动复用关于 / 项目 / 文章 / 近况的数据，无需额外维护一份重复摘要
- 项目页、关于页、近况页文案
- 联系方式、作者信息、留言 / 反馈入口与社交媒体跳转配置
- GitHub Pages 部署所需路径配置
- 主题配置：`theme.defaultMode` 可控制默认跟随系统 / 固定浅色 / 固定深色；`theme.light.tokens` 与 `theme.dark.tokens` 可按 CSS 变量名（不带 `--`）覆盖主题令牌，例如 `accent`、`accent-2`、`body-glow-1`

示例：

```js
theme: {
  defaultMode: 'system',
  light: {
    themeColor: '#f4f7fb',
    tokens: {
      accent: '#0ea5e9',
      'accent-2': '#6366f1'
    }
  },
  dark: {
    themeColor: '#07111f',
    tokens: {
      accent: '#7dd3fc',
      'accent-2': '#a78bfa'
    }
  }
}
```

### 新增博客文章

在 `content/posts/` 下新建 Markdown 文件，并添加 frontmatter：

```md
---
title: 文章标题
date: 2026-03-13
updated: 2026-03-15 # 可选，文章有修改时再补充
summary: 一句话摘要 # 可选；不写时会自动从正文生成摘要
category: 写作方法
tags: 标签一, 标签二
cover: /assets/illustration-wave.svg
template: insight # 可选；支持 insight / playbook / field-note
draft: true # 可选；为 true 时生成 noindex 草稿预览页，但不会进入公开文章列表
---

正文内容……
```

如果你想从统一骨架开始写，也可以直接复制 `content/templates/` 下的模板文件。目前内置三种模板：

- `insight`：观点文章，适合先给出判断、再展开论证
- `playbook`：方法清单，适合步骤、原则和工作流内容
- `field-note`：阶段记录，适合项目迭代、复盘和近况类内容

站点构建时会读取 frontmatter 中的 `template` 字段，并自动生成模板索引页、模板详情页，以及博客列表里的模板筛选入口。

### AI 辅助摘要 / 标签工作流

如果正文已经写完，但还没决定要不要手写 `summary` / `tags`，可以先走一遍 AI 辅助工作流：

```bash
npm run ai:assist -- suggest content/posts/your-post.md
```

执行后会在 `.openclaw/ai-assist/` 下生成两份文件：

- `your-post.prompt.md`：已经带上标题、分类、模板、自动摘要兜底、命中的已有标签池与正文内容，可直接发给常用 AI
- `your-post.response.json`：AI 需要回填的 JSON 模板，格式固定为 `{ "summary": "...", "tags": ["...", "..."] }`

等你确认 AI 返回的 JSON 没问题后，再执行：

```bash
npm run ai:assist -- apply content/posts/your-post.md
```

这个步骤只会回填 frontmatter 里的 `summary` 和 `tags`，不会改动正文，方便把 AI 当成“提案助手”而不是直接接管内容。

### 草稿预览流程

如果文章还没准备正式发布，但想先给自己或协作者预览，可以在 frontmatter 中加上：

```md
draft: true
```

此时构建结果会遵循下面的规则：

- 文章仍会生成静态详情页，访问地址就是它未来正式发布时的 URL，例如 `/blog/my-post/`
- 页面会显示“草稿预览”提示，并输出 `noindex,nofollow`，避免被搜索引擎收录
- 草稿不会进入博客列表、标签 / 分类聚合页、RSS、sitemap，也不会参与首页精选文章
- 当你准备正式发布时，只需要把 `draft: true` 改成 `draft: false`（或删除该字段），原地址会直接切换成正式文章

如果需要给图片增加可见标题与注释，可使用独占一行的图片语法，并在 title 位置通过 `标题 | 注释` 传入：

```md
![图片替代文本](/assets/illustration-grid.svg "页面层次草图 | 这张图用于说明内容分区、留白和视觉节奏。")
```

### 当前支持的内容能力

- 二级 / 三级标题
- 普通段落
- 无序列表 / 有序列表
- 引用
- 行内代码
- 粗体 / 斜体
- 代码块高亮
- 独占一行的图片标题与注释

## 构建与部署

项目面向 GitHub Pages 部署。

仓库当前有两条 GitHub Actions 自动化流程：

- **Validate site changes**：在 Pull Request 合并前，以及非 `main` 分支 push 时自动执行 `npm run validate` 与 `npm run build`
- **Deploy static site to GitHub Pages**：在推送到 `main` 分支后负责校验、构建并发布 Pages

推送到 `main` 分支后，GitHub Actions 会自动执行以下部署流程：

1. 运行 `npm run validate`
2. 运行 `npm run build`
3. 将 `dist/` 目录作为 Pages artifact 发布

构建完成后，站点根目录会额外生成 RSS 订阅地址：`/rss.xml`，博客列表、首页联系区、文章详情页与页脚也会提供 RSS / 邮件订阅 / 留言反馈 / 社交媒体跳转入口。
例如当前 GitHub Pages 地址为：<https://alex-shen1121.github.io/personal-blog/rss.xml>

如果仓库名、站点域名或部署路径发生变化，需要同步修改 `src/data/site.mjs` 中的：

- `siteUrl`
- `repoBasePath`

## 适用场景

这个项目适合以下类型的使用者：

- 想搭建个人主页和博客的开发者
- 希望使用 Markdown 持续写作的人
- 想以尽量简单的技术栈维护静态内容站的人
- 需要兼容 GitHub Pages 自动部署流程的个人项目

## 开发说明

本项目优先追求：

- 结构清晰
- 易于长期维护
- 内容更新成本低
- 对 GitHub Pages 友好
- 尽量减少不必要的框架复杂度

如果后续要扩展能力，可以在现有结构上继续演进，例如：

- 更完整的文章标签与分类系统
- RSS 输出
- 搜索能力
- 更丰富的 SEO 与社交分享信息
- 更自动化的内容校验与发布流程

## Roadmap

- [x] 多页面静态站点结构
- [x] Markdown 博客文章支持
- [x] GitHub Pages 自动部署
- [x] 基础 SEO 与静态资源支持
- [ ] 更完整的文章信息架构
- [x] RSS / 订阅能力
- [ ] 站内搜索
- [ ] 更丰富的内容展示模板

## License

本项目采用 [MIT License](./LICENSE)。

如果你基于本项目继续修改、分发或二次开发，请保留原始许可证文本。
