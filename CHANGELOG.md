# Changelog

此文件记录本项目的重要变更，方便后续维护、回溯与发布说明。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 新增“现在在做什么”动态流：首页近况与 `/now/` 页面改为复用同一份时间流数据，支持展示最近更新、阶段主轴与后续推进方向。
- 新增内容模板系统：Markdown frontmatter 支持 `template` 字段，博客列表页增加模板筛选，构建时自动生成 `/blog/templates/` 模板索引页与各模板详情页。
- 新增 `content/templates/` 内容起稿模板，提供观点文章、方法清单与阶段记录三种起步骨架。
- 新增 RSS 订阅能力：构建时自动生成 `rss.xml`，并在页面中补充 RSS 自动发现与订阅入口。
- 新增邮件订阅入口：博客列表页与全站页脚增加预填邮件订阅入口，便于通过邮箱接收站点更新提醒。
- 新增社交媒体跳转入口：首页联系区增加带说明的社交媒体跳转卡片，页脚与联系按钮统一复用作者链接配置。
- 新增访问统计：全站页脚展示累计访问 / 访客数，文章详情页展示当前页访问次数，并兼容统计服务不可用时的降级提示。
- 新增留言 / 反馈入口：首页、文章详情页与全站页脚增加邮件反馈 / GitHub Issue 入口，便于提交勘误、选题建议与体验反馈。
- 新增自定义主题配置：`src/data/site.mjs` 支持配置默认主题模式、浏览器主题色以及按 CSS 变量覆盖浅色 / 深色主题令牌。

### Changed

- GitHub Pages 工作流增加 `npm` 依赖缓存与 `npm ci` 安装步骤，减少后续 CI 重复安装开销。
- 新增独立的 GitHub Actions 自动校验工作流，在 Pull Request 发往 `main` 和非 `main` 分支 push 时自动执行 `npm run validate` 与 `npm run build`。
- 增加仓库级 Git pre-commit 检查：`npm install` 后会自动配置 `.githooks`，并在提交前执行 `npm run validate` 与 `npm run build`。
- 新增 `.nvmrc` 并让 GitHub Actions 改为读取同一份 Node.js 版本基线，减少本地与 CI 环境不一致的风险。

### Documentation

- 后续未发布的文档、构建、内容结构与部署相关变更，统一先记录在这里。
- 增加 GitHub Issue 模板、Pull Request 模板与模板入口说明，统一贡献信息收集格式。
- README 新增“环境与配置说明”，明确 Node.js 版本基线、无 `.env` 的配置方式，以及常见配置修改入口。

## [1.0.0] - 2026-03-14

### Added

- 搭建个人主页、关于页、项目页、文章页与近况页等多页面静态站结构。
- 支持 Markdown 驱动的博客内容生成，包括标签、分类、系列、归档、上一篇 / 下一篇与相关文章。
- 增加项目详情页、状态标记、截图展示与筛选能力。
- 补齐基础 SEO、Open Graph、Twitter Card、结构化数据、sitemap、robots 与 404 页面。
- 增加搜索、筛选、阅读进度、返回顶部、懒加载、资源指纹与构建期资源检查等体验与工程化能力。

### Changed

- 优化首页信息架构，补充 Hero、精选文章、精选项目、时间线近况与技能展示。
- 改进深浅色主题、移动端排版、卡片布局一致性与交互动效细节。
- 完善构建失败提示、HTML 语义化与可访问性审计、frontmatter 校验与 Markdown 内容质量校验。

### Documentation

- 补充 README 贡献说明与本地校验流程。
- 增加 MIT License，明确仓库开源许可。
- 建立 CHANGELOG 文档，作为后续版本变更记录入口。
