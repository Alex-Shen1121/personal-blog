# 沈晨玙的个人主页与博客

一个适合长期维护的静态个人站，定位为 **个人主页 + 博客 / 内容站**。当前版本已经从单页 landing page 升级为多页面结构，支持中文首页、博客列表、文章详情页、项目页、关于页、近况页，以及适配 GitHub Pages 的静态构建输出。

## 技术方案

- 原生 HTML / CSS / JavaScript
- Node.js 构建脚本生成静态页面
- Markdown 驱动文章内容
- GitHub Actions + GitHub Pages 自动部署

## 目录结构

```text
content/posts/          # Markdown 文章
public/                 # favicon 等直接拷贝资源
scripts/                # build / validate 脚本
src/assets/             # 本地插画与装饰素材
src/data/site.mjs       # 站点信息、页面内容与导航配置
dist/                   # 构建产物（构建时生成）
```

## 本地使用

```bash
npm run validate
npm run build
npm run preview
```

预览地址：<http://127.0.0.1:4173>

## 内容维护方式

### 1. 修改站点基础信息

编辑 `src/data/site.mjs`：

- 站点标题、描述、SEO 基础信息
- 首页 Hero / 项目 / 近况 / 联系方式
- 关于页、项目页、近况页文案
- 导航与作者信息

### 2. 新增文章

在 `content/posts/` 新建 Markdown 文件，包含以下 frontmatter：

```md
---
title: 文章标题
date: 2026-03-13
summary: 一句话摘要
tags: 标签一, 标签二
cover: /assets/illustration-wave.svg
---

正文内容……
```

当前支持的基础 Markdown 能力：

- 二级 / 三级标题
- 段落
- 无序列表 / 有序列表
- 引用
- 行内代码
- 粗体 / 斜体

## 已包含能力

- 中文首页与更完整的信息架构
- 博客列表页与文章详情页
- 本地插画装饰素材
- 深浅色主题切换
- 减少动态偏好兼容（prefers-reduced-motion）
- favicon / canonical / Open Graph 基础元信息
- sitemap.xml / robots.txt / 404.html / .nojekyll
- GitHub Pages 项目路径 `/personal-blog/` 下可正常部署

## 部署

推送到 `main` 分支后，GitHub Actions 会自动执行：

1. `npm run validate`
2. `npm run build`
3. 将 `dist/` 作为 Pages artifact 部署

如果仓库名或 Pages 域名发生变化，请同步修改 `src/data/site.mjs` 中的 `siteUrl` 与 `repoBasePath`。
