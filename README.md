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
- `prefers-reduced-motion` 兼容处理
- 基础 SEO 元信息支持
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

本项目主要依赖 Node.js 运行构建脚本。

```bash
npm install
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

## 可用脚本

```bash
npm run validate   # 校验内容与构建输入
npm run build      # 生成静态站点到 dist/
npm run preview    # 启动本地静态预览服务
```

## 贡献说明

欢迎通过 Issue 或 Pull Request 一起改进这个项目。

提交前建议先确认以下几点：

1. 改动尽量保持小而清晰，避免把无关修改混在同一次提交中
2. 如果涉及内容、导航或站点基础信息，请同步检查 `src/data/site.mjs` 与 `content/posts/`
3. 提交前本地执行以下命令，确保校验和构建都能通过：

```bash
npm run validate
npm run build
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
- 项目页、关于页、近况页文案
- 联系方式与作者信息
- GitHub Pages 部署所需路径配置

### 新增博客文章

在 `content/posts/` 下新建 Markdown 文件，并添加 frontmatter：

```md
---
title: 文章标题
date: 2026-03-13
updated: 2026-03-15 # 可选，文章有修改时再补充
summary: 一句话摘要 # 可选；不写时会自动从正文生成摘要
tags: 标签一, 标签二
cover: /assets/illustration-wave.svg
---

正文内容……
```

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

推送到 `main` 分支后，GitHub Actions 会自动执行以下流程：

1. 运行 `npm run validate`
2. 运行 `npm run build`
3. 将 `dist/` 目录作为 Pages artifact 发布

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
- [ ] RSS / 订阅能力
- [ ] 站内搜索
- [ ] 更丰富的内容展示模板

## License

本项目采用 [MIT License](./LICENSE)。

如果你基于本项目继续修改、分发或二次开发，请保留原始许可证文本。
