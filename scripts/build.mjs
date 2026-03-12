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

const withBase = (relativePath) => new URL(relativePath.replace(/^\//, ''), site.siteUrl).toString();

const renderNav = (currentPath, prefix) => {
  const normalize = (href) => (href.endsWith('/') ? href : `${href}/`);
  const resolveHref = (href) => {
    if (href === '/') return `${prefix}/index.html`.replace('./', '');
    return `${prefix}/${href.replace(/^\//, '')}`.replace('./', '');
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
  const stylesheetHref = `${prefix}/styles.css`.replace('./', '');
  const scriptHref = `${prefix}/script.js`.replace('./', '');
  const faviconHref = `${prefix}/favicon.svg`.replace('./', '');
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
        <strong>${site.shortName}</strong>
        <div class="footer-links">
          ${site.author.links.map((link) => `<a href="${link.url}" target="_blank" rel="noreferrer">${link.label}</a>`).join('')}
        </div>
        <span>© <span data-current-year></span> ${site.author.name} · 以轻量静态站方式构建，持续更新中。</span>
      </footer>
    </div>
    <script src="${scriptHref}"></script>
  </body>
</html>`;
};

const renderHomePage = (posts) => {
  const recentPosts = posts.slice(0, 3);
  return `
    <section class="hero">
      <div class="hero-copy reveal">
        <p class="kicker">${home.hero.eyebrow}</p>
        <h1>${home.hero.title}</h1>
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

    <section class="section reveal" id="projects">
      <div class="section-heading">
        <p class="kicker">项目精选</p>
        <h2>这些方向，构成了我现在最想继续做深的工作。</h2>
      </div>
      <div class="project-grid">
        ${home.featuredProjects
          .map(
            (project) => `<article class="project-panel"><span class="kicker">${project.tag}</span><h3>${project.title}</h3><p>${project.description}</p><a class="text-link" href="${project.href.slice(1)}">继续查看 →</a></article>`
          )
          .join('')}
      </div>
    </section>

    <section class="section reveal" id="blog">
      <div class="post-list__header">
        <div class="section-heading">
          <p class="kicker">最近写了什么</p>
          <h2>把经验写下来，能帮助我更稳定地形成判断。</h2>
        </div>
        <a class="button button-ghost" href="blog/">查看全部文章</a>
      </div>
      <div class="post-grid">
        ${recentPosts
          .map(
            (post) => `<article class="post-card"><div class="post-card__cover"><img src="${post.cover.replace(/^\//, '')}" alt="${post.title} 的封面插画" /></div><div class="post-card__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><h2>${post.title}</h2><p>${post.summary}</p><ul class="tag-list">${post.tags.map((tag) => `<li class="tag">${tag}</li>`).join('')}</ul><a class="text-link" href="blog/${post.slug}/">阅读文章 →</a></article>`
          )
          .join('')}
      </div>
    </section>

    <section class="section reveal" id="now">
      <div class="split-grid">
        <article class="note-card">
          <div class="section-heading">
            <p class="kicker">近况</p>
            <h2>我近期在推进的事情</h2>
          </div>
          <ul class="timeline">
            ${home.updates.map((item, index) => `<li><strong>0${index + 1}</strong>${item}</li>`).join('')}
          </ul>
        </article>
        <article class="note-card">
          <div class="section-heading">
            <p class="kicker">联系方式</p>
            <h2>如果你也在做内容、产品或前端相关的事情，欢迎交流。</h2>
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
        cover: meta.cover,
        body,
        html: markdownToHtml(body),
        readingTime: `${Math.max(3, Math.round(words / 220))} 分钟阅读`
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
};

const renderBlogListPage = (posts) => `
  <section class="page-hero reveal">
    <p class="kicker">文章</p>
    <h1>写下来的内容，会慢慢变成自己的方法库。</h1>
    <p>目前放的是三篇中文示例文章，结构已支持标题、日期、摘要、标签与详情页，后续只需要新增 Markdown 文件即可继续扩展。</p>
  </section>
  <section class="section reveal">
    <div class="post-list__header">
      <div>
        <strong class="post-list__count">共 ${posts.length} 篇文章</strong>
      </div>
      <div class="post-list__filters">
        <span class="tag">内容站</span>
        <span class="tag">设计思考</span>
        <span class="tag">前端体验</span>
      </div>
    </div>
    <div class="post-grid">
      ${posts
        .map(
          (post) => `<article class="post-card"><div class="post-card__cover"><img src="../${post.cover.replace(/^\//, '')}" alt="${post.title} 的封面插画" /></div><div class="post-card__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><h2>${post.title}</h2><p>${post.summary}</p><ul class="tag-list">${post.tags.map((tag) => `<li class="tag">${tag}</li>`).join('')}</ul><a class="button button-ghost" href="${post.slug}/">阅读详情</a></article>`
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
    <ul class="tag-list">${post.tags.map((tag) => `<li class="tag">${tag}</li>`).join('')}</ul>
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
        <div class="meta-row"><span>标签</span><span>${post.tags.join(' / ')}</span></div>
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
    description: '沈昱的文章列表，记录产品、设计、前端体验与个人工作方式。',
    currentPath: '/blog/',
    outputPath: path.join(outDir, 'blog', 'index.html'),
    body: renderBlogListPage(posts),
    image: posts[0]?.cover ?? '/assets/illustration-wave.svg'
  })
);

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

const urls = ['/', '/about/', '/projects/', '/blog/', '/now/', ...posts.map((post) => `/blog/${post.slug}/`)];
writeText(
  path.join(outDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${withBase(url === '/' ? '' : url.slice(1))}</loc></url>`)
    .join('\n')}\n</urlset>`
);
writeText(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${withBase('sitemap.xml')}\n`);
writeText(path.join(outDir, '.nojekyll'), '');

console.log(`Build complete. Generated ${posts.length} posts and ${urls.length} routes.`);
