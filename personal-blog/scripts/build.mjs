import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { home, pages, site } from '../src/data/site.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist');
const postsDir = path.join(rootDir, 'content', 'posts');
const assetsDir = path.join(rootDir, 'src', 'assets');
const publicDir = path.join(rootDir, 'public');

const ensureDir = (dirPath) => mkdirSync(dirPath, { recursive: true });
const writeText = (targetPath, content) => {
  ensureDir(path.dirname(targetPath));
  writeFileSync(targetPath, content);
};

const formatDate = (dateString) =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(`${dateString}T00:00:00+08:00`));

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const slugify = (value) => value.replace(/\.md$/, '');
const slugifyTag = (value) => encodeURIComponent(value.trim().toLowerCase().replace(/\s+/g, '-'));
const slugifyCategory = (value) => encodeURIComponent(value.trim().toLowerCase().replace(/\s+/g, '-'));

const renderTagLinks = (tags, basePath = '') =>
  `<ul class="tag-list">${tags
    .map((tag) => `<li><a class="tag tag-link" href="${basePath}tags/${slugifyTag(tag)}/">${tag}</a></li>`)
    .join('')}</ul>`;

const parseFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Post missing frontmatter block.');

  const [, rawMeta, rawBody] = match;
  const meta = {};

  for (const line of rawMeta.split('\n')) {
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim();
    const value = rest.join(':').trim();
    if (!key) continue;
    meta[key] = key === 'tags' ? value.split(',').map((item) => item.trim()).filter(Boolean) : value;
  }

  return { meta, body: rawBody.trim() };
};

const markdownToHtml = (markdown) => {
  const lines = markdown.split('\n');
  const blocks = [];
  let paragraph = [];
  let listItems = [];
  let inQuote = false;
  let quoteLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
    listItems = [];
  };

  const flushQuote = () => {
    if (!quoteLines.length) return;
    blocks.push(`<blockquote>${inlineMarkdown(quoteLines.join(' '))}</blockquote>`);
    quoteLines = [];
    inQuote = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushList();
      flushQuote();
      blocks.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      flushParagraph();
      flushList();
      flushQuote();
      blocks.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      flushParagraph();
      flushList();
      inQuote = true;
      quoteLines.push(trimmed.slice(2));
      continue;
    }

    if (trimmed.startsWith('- ')) {
      flushParagraph();
      flushQuote();
      listItems.push(trimmed.slice(2));
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      listItems.push(trimmed.replace(/^\d+\.\s+/, ''));
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushQuote();

  return blocks.join('\n');
};

const inlineMarkdown = (value) => {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
};

const getRelativePrefix = (outputPath) => {
  const relative = path.relative(path.dirname(outputPath), outDir) || '.';
  return relative.replaceAll('\\', '/');
};

const trimLocalPrefix = (value) => value.replace(/^\.\//, '');

const withBase = (relativePath) => new URL(relativePath.replace(/^\//, ''), site.siteUrl).toString();

const renderNav = (currentPath, prefix) => {
  const normalize = (href) => (href.endsWith('/') ? href : `${href}/`);
  const resolveHref = (href) => {
    if (href === '/') return trimLocalPrefix(`${prefix}/index.html`);
    return trimLocalPrefix(`${prefix}/${href.replace(/^\//, '')}`);
  };

  return site.navigation
    .map(({ label, href }) => {
      const isCurrent = normalize(currentPath) === normalize(href);
      return `<a href="${resolveHref(href)}"${isCurrent ? ' aria-current="page"' : ''}>${label}</a>`;
    })
    .join('');
};

const renderLayout = ({ title, description, currentPath, outputPath, body, image = '/assets/illustration-wave.svg' }) => {
  const prefix = getRelativePrefix(outputPath);
  const canonical = withBase(currentPath.replace(/^\//, '').replace(/index\.html$/, ''));
  const stylesheetHref = trimLocalPrefix(`${prefix}/styles.css`);
  const scriptHref = trimLocalPrefix(`${prefix}/script.js`);
  const faviconHref = trimLocalPrefix(`${prefix}/favicon.svg`);
  const ogImage = withBase(image);
  const currentHref = currentPath === '/' ? '/' : currentPath;

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${ogImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" type="image/svg+xml" href="${faviconHref}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${stylesheetHref}" />
  </head>
  <body>
    <div class="site-shell">
      <header class="site-header">
        <div class="site-header__inner">
          <a class="brand" href="${prefix}/index.html">
            <span class="brand-mark">昱</span>
            <span class="brand-copy">
              <strong>${site.author.name}</strong>
              <small>${site.author.role}</small>
            </span>
          </a>
          <div class="header-actions">
            <button class="theme-toggle" type="button" data-theme-toggle aria-label="切换主题">☾</button>
            <button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-label="展开导航">
              <span></span><span></span><span></span>
            </button>
          </div>
          <nav class="site-nav" data-nav aria-label="主导航">
            ${renderNav(currentHref, prefix)}
          </nav>
        </div>
      </header>
      <main>
        ${body}
      </main>
      <footer class="site-footer">
        <div class="site-footer__grid">
          <section class="site-footer__section site-footer__section--brand" aria-label="站点信息">
            <strong>${site.shortName}</strong>
            <p>${site.author.role} · ${site.author.city}</p>
            <p>${site.description}</p>
          </section>
          <section class="site-footer__section" aria-label="站内导航">
            <span class="site-footer__heading">站内导航</span>
            <div class="footer-links">
              ${site.navigation
                .map(({ label, href }) => `<a href="${href === '/' ? trimLocalPrefix(`${prefix}/index.html`) : trimLocalPrefix(`${prefix}/${href.replace(/^\//, '')}`)}">${label}</a>`)
                .join('')}
            </div>
          </section>
          <section class="site-footer__section" aria-label="联系与链接">
            <span class="site-footer__heading">联系与链接</span>
            <div class="footer-links">
              ${site.author.links.map((link) => `<a href="${link.url}"${link.url.startsWith('http') ? ' target="_blank" rel="noreferrer"' : ''}>${link.label}</a>`).join('')}
            </div>
          </section>
        </div>
        <span class="site-footer__meta">© <span data-current-year></span> ${site.author.name} · 以轻量静态站方式构建，持续更新中。</span>
      </footer>
    </div>
    <script src="${scriptHref}"></script>
  </body>
</html>`;
};

const renderHomePage = (posts) => {
  const recentPosts = posts.slice(0, 3);
  const [primaryPost, ...secondaryPosts] = recentPosts;
  return `
    <section class="hero">
      <div class="hero-copy reveal">
        <p class="kicker">${home.hero.eyebrow}</p>
        <h1>${home.hero.title}</h1>
        ${home.hero.positioning ? `<p class="hero-positioning">${home.hero.positioning}</p>` : ''}
        <p>${home.hero.description}</p>
        <div class="hero-actions">
          <a class="button button-primary" href="blog/">${home.hero.primaryCta.label}</a>
          <a class="button button-secondary" href="about/">${home.hero.secondaryCta.label}</a>
        </div>
        <div class="metrics">
          ${home.hero.metrics
            .map((metric) => `<div class="metric"><strong>${metric.value}</strong><span>${metric.label}</span></div>`)
            .join('')}
        </div>
      </div>
      <aside class="hero-visual reveal">
        <div>
          <p class="kicker">现在的关注点</p>
          <p>${site.author.intro}</p>
        </div>
        <img src="assets/illustration-wave.svg" alt="抽象波形风格插画" />
        <ul class="list-card">
          ${home.tools.map((tool) => `<li>${tool}</li>`).join('')}
        </ul>
      </aside>
    </section>

    <section class="section reveal" id="cta">
      <article class="cta-band">
        <div class="cta-band__intro">
          <p class="kicker">${home.coreCta.eyebrow}</p>
          <h2>${home.coreCta.title}</h2>
          <p class="section-intro">${home.coreCta.description}</p>
        </div>
        <div class="cta-band__actions">
          ${home.coreCta.actions
            .map(
              (action) => `<a class="cta-card button-${action.variant ?? 'secondary'}" href="${action.href.startsWith('/') ? action.href.slice(1) : action.href}"${action.href.startsWith('http') || action.href.startsWith('mailto:') ? ' target="_blank" rel="noreferrer"' : ''}><strong>${action.label}</strong><span>${action.note}</span></a>`
            )
            .join('')}
        </div>
      </article>
    </section>

    <section class="section reveal" id="guide">
      <div class="section-heading">
        <p class="kicker">${home.navigationGuide.eyebrow}</p>
        <h2>${home.navigationGuide.title}</h2>
        <p class="section-intro">${home.navigationGuide.description}</p>
      </div>
      <div class="nav-guide-grid">
        ${home.navigationGuide.groups
          .map(
            (group) => `<article class="panel nav-guide-card"><h3>${group.title}</h3><ul class="nav-guide-list">${group.items
              .map(
                (item) => `<li><a class="nav-guide-link" href="${item.href.startsWith('/') ? item.href.slice(1) : item.href}"><strong>${item.label}</strong><span>${item.note}</span></a></li>`
              )
              .join('')}</ul></article>`
          )
          .join('')}
      </div>
    </section>

    <section class="section reveal" id="about">
      <div class="section-heading">
        <p class="kicker">关于我</p>
        <h2>我更愿意把自己理解为“连接内容、设计与实现的人”。</h2>
        <p class="section-intro">${home.about.join(' ')}</p>
      </div>
      <div class="card-grid">
        ${home.highlights.map((item) => `<article class="panel"><h3>${item.title}</h3><p>${item.text}</p></article>`).join('')}
      </div>
    </section>

    <section class="section reveal" id="skills">
      <div class="section-heading">
        <p class="kicker">${home.skills.eyebrow}</p>
        <h2>${home.skills.title}</h2>
        <p class="section-intro">${home.skills.description}</p>
      </div>
      <div class="skills-grid">
        ${home.skills.groups
          .map(
            (group) => `<article class="panel skill-card"><h3>${group.title}</h3><p>${group.description}</p><ul class="tag-list">${group.items.map((item) => `<li class="tag">${item}</li>`).join('')}</ul></article>`
          )
          .join('')}
      </div>
      <article class="panel skills-stack">
        <div>
          <p class="kicker">${home.skills.stackLabel}</p>
          <h3>保持轻量，但不牺牲完整度。</h3>
        </div>
        <ul class="tag-list">
          ${home.skills.stack.map((item) => `<li class="tag">${item}</li>`).join('')}
        </ul>
      </article>
    </section>

    <section class="section reveal" id="projects">
      <div class="post-list__header">
        <div class="section-heading">
          <p class="kicker">${home.featuredProjects.eyebrow}</p>
          <h2>${home.featuredProjects.title}</h2>
          <p class="section-intro">${home.featuredProjects.description}</p>
        </div>
        <a class="button button-ghost" href="${home.featuredProjects.cta.href.slice(1)}">${home.featuredProjects.cta.label}</a>
      </div>
      <div class="featured-projects">
        <article class="project-panel featured-project featured-project--primary">
          <span class="feature-label">${home.featuredProjects.primaryLabel}</span>
          <div class="featured-project__meta">
            <span class="tag">${home.featuredProjects.items[0].tag}</span>
            <span class="tag">${home.featuredProjects.items[0].status}</span>
          </div>
          <div>
            <h3>${home.featuredProjects.items[0].title}</h3>
            <p>${home.featuredProjects.items[0].description}</p>
          </div>
          <ul class="tag-list">
            ${home.featuredProjects.items[0].highlights.map((highlight) => `<li class="tag">${highlight}</li>`).join('')}
          </ul>
          <a class="text-link" href="${home.featuredProjects.items[0].href.slice(1)}">继续查看 →</a>
        </article>
        <div class="featured-projects__sidebar">
          ${home.featuredProjects.items
            .slice(1)
            .map(
              (project) => `<article class="project-panel featured-project"><span class="feature-label">${home.featuredProjects.secondaryLabel}</span><div class="featured-project__meta"><span class="tag">${project.tag}</span><span class="tag">${project.status}</span></div><div><h3>${project.title}</h3><p>${project.description}</p></div><ul class="tag-list">${project.highlights.map((highlight) => `<li class="tag">${highlight}</li>`).join('')}</ul><a class="text-link" href="${project.href.slice(1)}">继续查看 →</a></article>`
            )
            .join('')}
        </div>
      </div>
    </section>

    <section class="section reveal" id="blog">
      <div class="post-list__header">
        <div class="section-heading">
          <p class="kicker">${home.featuredPosts.eyebrow}</p>
          <h2>${home.featuredPosts.title}</h2>
          <p class="section-intro">${home.featuredPosts.description}</p>
        </div>
        <a class="button button-ghost" href="blog/">查看全部文章</a>
      </div>
      <div class="featured-posts">
        ${primaryPost
          ? `<article class="post-card post-card--featured"><div class="post-card__cover"><img src="${primaryPost.cover.replace(/^\//, '')}" alt="${primaryPost.title} 的封面插画" /></div><div class="post-card__body"><span class="feature-label">${home.featuredPosts.primaryLabel}</span><div class="post-card__meta"><span>${formatDate(primaryPost.date)}</span><span>${primaryPost.readingTime}</span></div><h2>${primaryPost.title}</h2><p>${primaryPost.summary}</p><ul class="tag-list">${primaryPost.tags.map((tag) => `<li class="tag">${tag}</li>`).join('')}</ul><a class="text-link" href="blog/${primaryPost.slug}/">优先阅读 →</a></div></article>`
          : ''}
        <div class="featured-posts__sidebar">
          <div class="featured-posts__intro panel">
            <span class="feature-label">${home.featuredPosts.secondaryLabel}</span>
            <p>如果你第一次来到这里，建议先从上面的主推文章开始，再顺着下面两篇继续看，会更容易理解我对内容站、界面气质和个人表达的整体判断。</p>
          </div>
          ${secondaryPosts
            .map(
              (post) => `<article class="post-card post-card--compact"><div class="post-card__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><h3>${post.title}</h3><p>${post.summary}</p>${renderTagLinks(post.tags, 'blog/')}<a class="text-link" href="blog/${post.slug}/">继续阅读 →</a></article>`
            )
            .join('')}
        </div>
      </div>
    </section>

    <section class="section reveal" id="now">
      <div class="post-list__header">
        <div class="section-heading">
          <p class="kicker">${home.updates.eyebrow}</p>
          <h2>${home.updates.title}</h2>
          <p class="section-intro">${home.updates.description}</p>
        </div>
        <a class="button button-ghost" href="${home.updates.cta.href.slice(1)}">${home.updates.cta.label}</a>
      </div>
      <div class="split-grid split-grid--timeline">
        <article class="note-card timeline-card">
          <ol class="timeline timeline--detailed">
            ${home.updates.items
              .map(
                (item) => `<li><div class="timeline-marker" aria-hidden="true"></div><div class="timeline-content"><p class="timeline-date">${item.date}</p><h3>${item.label}</h3><p>${item.summary}</p><ul class="tag-list">${item.meta.map((meta) => `<li class="tag">${meta}</li>`).join('')}</ul></div></li>`
              )
              .join('')}
          </ol>
        </article>
        <article class="note-card">
          <div class="section-heading">
            <p class="kicker">保持联系</p>
            <h2>如果你也在做内容、产品或前端相关的事情，欢迎交流。</h2>
            <p class="section-intro">我更喜欢基于具体项目、内容想法或正在解决的问题展开对话，这样会更快进入有效交流。</p>
          </div>
          <div class="contact-links">
            ${site.author.links.map((link) => `<a class="button button-secondary" href="${link.url}" target="_blank" rel="noreferrer">${link.label}</a>`).join('')}
          </div>
          <p>${site.author.city}</p>
        </article>
      </div>
    </section>`;
};

const renderInfoPage = (pageKey) => {
  const page = pages[pageKey];
  const body = page.items
    ? `<section class="page-hero reveal"><p class="kicker">${page.title}</p><h1>${page.title}</h1><p>${page.intro}</p></section>
       <section class="section reveal"><div class="project-grid">${page.items
         .map((item) => `<article class="project-panel"><span class="kicker">${item.meta ?? '更新中'}</span><h3>${item.title ?? '阶段记录'}</h3><p>${item.text ?? item}</p></article>`)
         .join('')}</div></section>`
    : `<section class="page-hero reveal"><p class="kicker">${page.title}</p><h1>${page.title}</h1><p>${page.intro}</p></section>
       <section class="section reveal"><div class="card-grid">${page.sections
         .map((section) => `<article class="panel"><h3>${section.title}</h3><p>${section.text}</p></article>`)
         .join('')}</div></section>`;
  return body;
};

const loadPosts = () => {
  return readdirSync(postsDir)
    .filter((file) => file.endsWith('.md'))
    .map((fileName) => {
      const raw = readFileSync(path.join(postsDir, fileName), 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      const slug = slugify(fileName);
      const words = body.replace(/\s+/g, '').length;
      return {
        slug,
        title: meta.title,
        date: meta.date,
        summary: meta.summary,
        tags: meta.tags ?? [],
        category: {
          name: meta.category,
          slug: slugifyCategory(meta.category)
        },
        cover: meta.cover,
        body,
        html: markdownToHtml(body),
        readingTime: `${Math.max(3, Math.round(words / 220))} 分钟阅读`
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
};

const renderBlogListPage = (posts, tags, categories) => `
  <section class="page-hero reveal">
    <p class="kicker">文章</p>
    <h1>写下来的内容，会慢慢变成自己的方法库。</h1>
    <p>目前已支持文章标签与分类系统：文章列表、标签/分类索引页与详情页都会基于 Markdown frontmatter 自动生成。</p>
  </section>
  <section class="section reveal">
    <div class="post-list__header">
      <div>
        <strong class="post-list__count">共 ${posts.length} 篇文章</strong>
      </div>
      <div class="post-list__filters">
        <a class="button button-ghost button-small" href="tags/">查看全部标签</a>
        <a class="button button-ghost button-small" href="categories/">查看全部分类</a>
        ${tags.slice(0, 3).map((tag) => `<a class="tag tag-link" href="tags/${tag.slug}/">${tag.name}</a>`).join('')}
        ${categories.slice(0, 3).map((category) => `<a class="tag" href="categories/${category.slug}/">${category.name} · ${category.count}</a>`).join('')}
      </div>
    </div>
    <div class="post-grid">
      ${posts
        .map(
          (post) => `<article class="post-card"><div class="post-card__cover"><img src="../${post.cover.replace(/^\//, '')}" alt="${post.title} 的封面插画" /></div><div class="post-card__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><p class="kicker"><a href="categories/${post.category.slug}/">${post.category.name}</a></p><h2>${post.title}</h2><p>${post.summary}</p>${renderTagLinks(post.tags)}<a class="button button-ghost" href="${post.slug}/">阅读详情</a></article>`
        )
        .join('')}
    </div>
  </section>`;

const renderCategoryListPage = (categories) => `
  <section class="page-hero reveal">
    <p class="kicker">文章分类</p>
    <h1>按主题浏览文章。</h1>
    <p>每篇文章都归属于一个主分类，方便从更稳定的主题维度查看内容。</p>
  </section>
  <section class="section reveal">
    <div class="card-grid">
      ${categories
        .map(
          (category) => `<article class="panel"><p class="kicker">${category.count} 篇文章</p><h2>${category.name}</h2><p>${category.latestPost ? `最近更新：${category.latestPost.title}` : '正在整理中。'}</p><a class="button button-ghost" href="${category.slug}/">查看该分类</a></article>`
        )
        .join('')}
    </div>
  </section>`;

const renderCategoryPage = (category, posts) => `
  <section class="page-hero reveal">
    <p class="kicker">文章分类</p>
    <h1>${category.name}</h1>
    <p>当前分类下共 ${posts.length} 篇文章，可从这里集中浏览这一主题。</p>
  </section>
  <section class="section reveal">
    <div class="post-list__header">
      <div>
        <strong class="post-list__count">${category.name} · ${posts.length} 篇</strong>
      </div>
      <div class="post-list__filters">
        <a class="tag" href="../">全部分类</a>
        <a class="tag" href="../../">全部文章</a>
      </div>
    </div>
    <div class="post-grid">
      ${posts
        .map(
          (post) => `<article class="post-card"><div class="post-card__cover"><img src="../../${post.cover.replace(/^\//, '')}" alt="${post.title} 的封面插画" /></div><div class="post-card__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><h2>${post.title}</h2><p>${post.summary}</p>${renderTagLinks(post.tags, '../../')}<a class="button button-ghost" href="../../${post.slug}/">阅读详情</a></article>`
        )
        .join('')}
    </div>
  </section>`;

const renderTagListPage = (tags) => `
  <section class="page-hero reveal">
    <p class="kicker">文章标签</p>
    <h1>按标签浏览文章。</h1>
    <p>这里把当前文章里已经使用的标签集中起来，适合从主题切入继续阅读。</p>
  </section>
  <section class="section reveal">
    <div class="post-list__header">
      <div>
        <strong class="post-list__count">共 ${tags.length} 个标签</strong>
      </div>
      <div class="post-list__filters">
        <a class="button button-ghost button-small" href="../">返回文章列表</a>
      </div>
    </div>
    <div class="tag-directory">
      ${tags
        .map(
          (tag) => `<article class="panel tag-directory__card"><div><h2><a class="text-link" href="${tag.slug}/">${tag.name}</a></h2><p>${tag.posts.length} 篇文章</p></div><ul class="tag-list"><li><a class="tag tag-link" href="${tag.slug}/">${tag.name}</a></li></ul><ul class="list-card">${tag.posts.map((post) => `<li><a class="text-link" href="../${post.slug}/">${post.title}</a><br /><span class="muted">${formatDate(post.date)}</span></li>`).join('')}</ul></article>`
        )
        .join('')}
    </div>
  </section>`;

const renderTagDetailPage = (tag) => `
  <section class="page-hero reveal">
    <p class="kicker">标签归档</p>
    <h1>${tag.name}</h1>
    <p>当前共有 ${tag.posts.length} 篇文章使用了这个标签，可以从这里继续按主题阅读。</p>
    <div class="post-list__filters">
      <a class="button button-ghost button-small" href="../">返回标签页</a>
      <a class="button button-secondary button-small" href="../../">返回文章列表</a>
    </div>
  </section>
  <section class="section reveal">
    <div class="post-grid">
      ${tag.posts
        .map(
          (post) => `<article class="post-card"><div class="post-card__cover"><img src="../../../${post.cover.replace(/^\//, '')}" alt="${post.title} 的封面插画" /></div><div class="post-card__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><h2>${post.title}</h2><p>${post.summary}</p>${renderTagLinks(post.tags, '../../')}<a class="button button-ghost" href="../../${post.slug}/">阅读详情</a></article>`
        )
        .join('')}
    </div>
  </section>`;

const renderPostPage = (post, relatedPosts) => `
  <section class="post-header reveal">
    <p class="kicker">文章详情</p>
    <h1>${post.title}</h1>
    <div class="post-header__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div>
    <p>${post.summary}</p>
    <ul class="tag-list"><li class="tag"><a href="../categories/${post.category.slug}/">${post.category.name}</a></li>${post.tags.map((tag) => `<li><a class="tag tag-link" href="../tags/${slugifyTag(tag)}/">${tag}</a></li>`).join('')}</ul>
  </section>
  <section class="post-layout reveal">
    <article>
      <div class="post-cover"><img src="../../${post.cover.replace(/^\//, '')}" alt="${post.title} 的配图" /></div>
      <div class="prose panel">${post.html}</div>
    </article>
    <aside class="post-aside">
      <div class="note-card">
        <h3>文章信息</h3>
        <div class="meta-row"><span>发布时间</span><span>${formatDate(post.date)}</span></div>
        <div class="meta-row"><span>分类</span><span><a class="text-link" href="../categories/${post.category.slug}/">${post.category.name}</a></span></div>
        <div class="meta-row meta-row--stack"><span>标签</span><span class="meta-tags">${renderTagLinks(post.tags, '../')}</span></div>
      </div>
      <div class="note-card">
        <h3>继续阅读</h3>
        <p>想看更多内容，可以回到文章列表，或者去看看我近期在做的项目与近况。</p>
        <div class="contact-links">
          <a class="button button-secondary" href="../">返回文章列表</a>
          <a class="button button-ghost" href="../../projects/">查看项目</a>
        </div>
      </div>
      <div class="note-card">
        <h3>相关文章</h3>
        <ul class="list-card">
          ${relatedPosts
            .map((item) => `<li><a class="text-link" href="../${item.slug}/">${item.title}</a><br /><span class="muted">${item.summary}</span></li>`)
            .join('')}
        </ul>
      </div>
    </aside>
  </section>`;

const collectCategories = (posts) =>
  Array.from(
    posts.reduce((map, post) => {
      const existing = map.get(post.category.slug) ?? {
        ...post.category,
        count: 0,
        posts: []
      };
      existing.count += 1;
      existing.posts.push(post);
      map.set(post.category.slug, existing);
      return map;
    }, new Map()).values()
  )
    .map((category) => ({
      ...category,
      latestPost: category.posts[0]
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));

const render404 = () => `
  <section class="page-hero reveal">
    <p class="kicker">404</p>
    <h1>这个页面暂时不存在。</h1>
    <p>你可以回到首页继续浏览，或者直接查看文章列表。</p>
    <div class="hero-actions">
      <a class="button button-primary" href="./index.html">返回首页</a>
      <a class="button button-secondary" href="./blog/">查看文章</a>
    </div>
  </section>`;

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

ensureDir(outDir);
ensureDir(path.join(outDir, 'assets'));
copyFileSync(path.join(rootDir, 'styles.css'), path.join(outDir, 'styles.css'));
copyFileSync(path.join(rootDir, 'script.js'), path.join(outDir, 'script.js'));

for (const file of readdirSync(assetsDir)) {
  copyFileSync(path.join(assetsDir, file), path.join(outDir, 'assets', file));
}

for (const file of readdirSync(publicDir)) {
  copyFileSync(path.join(publicDir, file), path.join(outDir, file));
}

const posts = loadPosts();
const tags = Array.from(new Map(posts.flatMap((post) => post.tags.map((tag) => [tag, tag]))).values())
  .sort((a, b) => a.localeCompare(b, 'zh-CN'))
  .map((tag) => ({
    name: tag,
    slug: slugifyTag(tag),
    posts: posts.filter((post) => post.tags.includes(tag))
  }));
const categories = collectCategories(posts);

writeText(
  path.join(outDir, 'index.html'),
  renderLayout({
    title: site.title,
    description: site.description,
    currentPath: '/',
    outputPath: path.join(outDir, 'index.html'),
    body: renderHomePage(posts)
  })
);

for (const [key, page] of Object.entries(pages).filter(([key]) => key !== 'blog')) {
  writeText(
    path.join(outDir, key, 'index.html'),
    renderLayout({
      title: `${page.title}｜${site.shortName}`,
      description: page.description,
      currentPath: `/${key}/`,
      outputPath: path.join(outDir, key, 'index.html'),
      body: renderInfoPage(key)
    })
  );
}

writeText(
  path.join(outDir, 'blog', 'index.html'),
  renderLayout({
    title: `文章｜${site.shortName}`,
    description: '沈晨玙的文章列表，记录产品、设计、前端体验与个人工作方式。',
    currentPath: '/blog/',
    outputPath: path.join(outDir, 'blog', 'index.html'),
    body: renderBlogListPage(posts, tags, categories),
    image: posts[0]?.cover ?? '/assets/illustration-wave.svg'
  })
);

writeText(
  path.join(outDir, 'blog', 'tags', 'index.html'),
  renderLayout({
    title: `文章标签｜${site.shortName}`,
    description: '按标签浏览文章归档。',
    currentPath: '/blog/tags/',
    outputPath: path.join(outDir, 'blog', 'tags', 'index.html'),
    body: renderTagListPage(tags),
    image: posts[0]?.cover ?? '/assets/illustration-wave.svg'
  })
);

for (const tag of tags) {
  writeText(
    path.join(outDir, 'blog', 'tags', tag.slug, 'index.html'),
    renderLayout({
      title: `${tag.name}｜标签｜${site.shortName}`,
      description: `浏览标签“${tag.name}”下的文章。`,
      currentPath: `/blog/tags/${tag.slug}/`,
      outputPath: path.join(outDir, 'blog', 'tags', tag.slug, 'index.html'),
      body: renderTagDetailPage(tag),
      image: tag.posts[0]?.cover ?? '/assets/illustration-wave.svg'
    })
  );
}

writeText(
  path.join(outDir, 'blog', 'categories', 'index.html'),
  renderLayout({
    title: `文章分类｜${site.shortName}`,
    description: '按分类浏览博客文章。',
    currentPath: '/blog/categories/',
    outputPath: path.join(outDir, 'blog', 'categories', 'index.html'),
    body: renderCategoryListPage(categories)
  })
);

for (const category of categories) {
  writeText(
    path.join(outDir, 'blog', 'categories', category.slug, 'index.html'),
    renderLayout({
      title: `${category.name}｜文章分类｜${site.shortName}`,
      description: `${category.name} 分类下的文章列表。`,
      currentPath: `/blog/categories/${category.slug}/`,
      outputPath: path.join(outDir, 'blog', 'categories', category.slug, 'index.html'),
      body: renderCategoryPage(category, category.posts),
      image: category.latestPost?.cover ?? '/assets/illustration-wave.svg'
    })
  );
}

for (const post of posts) {
  const relatedPosts = posts.filter((item) => item.slug !== post.slug).slice(0, 2);
  writeText(
    path.join(outDir, 'blog', post.slug, 'index.html'),
    renderLayout({
      title: `${post.title}｜${site.shortName}`,
      description: post.summary,
      currentPath: `/blog/${post.slug}/`,
      outputPath: path.join(outDir, 'blog', post.slug, 'index.html'),
      body: renderPostPage(post, relatedPosts),
      image: post.cover
    })
  );
}

writeText(
  path.join(outDir, '404.html'),
  renderLayout({
    title: `页面未找到｜${site.shortName}`,
    description: '你访问的页面不存在。',
    currentPath: '/404.html',
    outputPath: path.join(outDir, '404.html'),
    body: render404()
  })
);

const urls = [
  '/',
  '/about/',
  '/projects/',
  '/blog/',
  '/blog/tags/',
  '/blog/categories/',
  '/now/',
  ...tags.map((tag) => `/blog/tags/${tag.slug}/`),
  ...categories.map((category) => `/blog/categories/${category.slug}/`),
  ...posts.map((post) => `/blog/${post.slug}/`)
];
writeText(
  path.join(outDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${withBase(url === '/' ? '' : url.slice(1))}</loc></url>`)
    .join('\n')}\n</urlset>`
);
writeText(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${withBase('sitemap.xml')}\n`);
writeText(path.join(outDir, '.nojekyll'), '');

console.log(`Build complete. Generated ${posts.length} posts and ${urls.length} routes.`);
