import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentTemplates, getContentTemplate } from '../src/data/content-templates.mjs';
import { home, nowFeed, pages, site } from '../src/data/site.mjs';
import { siteEn } from '../src/data/site.en.mjs';
import { buildCanonicalUrl, validateCanonicalConfig } from '../src/utils/canonical.mjs';
import { auditGeneratedHtml } from './html-audit.mjs';
import { parseAndValidateFrontmatter } from './frontmatter.mjs';
import { validateMarkdownContentQuality } from './markdown-quality.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist');
const postsDir = path.join(rootDir, 'content', 'posts');
const postsEnDir = path.join(rootDir, 'content', 'posts-en');
const assetsDir = path.join(rootDir, 'src', 'assets');
const publicDir = path.join(rootDir, 'public');
const rawCriticalCssSource = readFileSync(path.join(rootDir, 'critical.css'), 'utf8');
const canonicalConfig = validateCanonicalConfig(site);
const englishRouteMap = new Map([
  ['/', '/en/'],
  ['/about/', '/en/about/'],
  ['/projects/', '/en/projects/'],
  ['/blog/', '/en/blog/'],
  ['/now/', '/en/now/']
]);

const chineseRouteMap = new Map(Array.from(englishRouteMap.entries(), ([zhPath, enPath]) => [enPath, zhPath]));

const normalizeLanguageRouteKey = (value = '') => {
  if (!value) return '';
  if (value === '/404.html' || value === '/en/404.html') return value;
  return value.endsWith('/') ? value : `${value}/`;
};

const registerLanguagePair = (zhPath, enPath) => {
  englishRouteMap.set(normalizeLanguageRouteKey(zhPath), normalizeLanguageRouteKey(enPath));
  chineseRouteMap.set(normalizeLanguageRouteKey(enPath), normalizeLanguageRouteKey(zhPath));
};

const zhUi = {
  skipToContent: '跳到正文',
  toggleTheme: '切换主题',
  openNavigation: '展开导航',
  footerSite: '站内导航',
  footerLinks: '联系与链接',
  footerMeta: '以轻量静态站方式构建，持续更新中。',
  backToTop: '返回顶部',
  languageSwitchLabel: 'EN',
  rssLabel: 'RSS 订阅',
  emailLabel: '邮件订阅',
  feedbackLabel: site.feedback?.footerLabel ?? '留言反馈',
  analyticsTitle: '访问统计',
  analyticsLoading: site.analytics?.loadingText ?? '访问统计加载中…',
  analyticsReady: site.analytics?.readyText ?? '统计已更新，数据可能有短暂延迟。',
  analyticsUnavailable: site.analytics?.unavailableText ?? '统计服务暂时不可用。'
};

const enUi = {
  skipToContent: siteEn.ui?.skipToContent ?? 'Skip to content',
  toggleTheme: siteEn.ui?.toggleTheme ?? 'Toggle theme',
  openNavigation: siteEn.ui?.openNavigation ?? 'Open navigation',
  footerSite: siteEn.ui?.footerSite ?? 'Site',
  footerLinks: siteEn.ui?.footerLinks ?? 'Links',
  footerMeta: siteEn.ui?.footerMeta ?? 'Built as a lightweight static site and updated continuously.',
  backToTop: siteEn.ui?.backToTop ?? 'Back to top',
  languageSwitchLabel: siteEn.ui?.languageSwitchLabel ?? '中文',
  rssLabel: siteEn.ui?.rssLabel ?? 'RSS',
  emailLabel: siteEn.ui?.emailLabel ?? 'Email subscription',
  feedbackLabel: siteEn.feedback?.footerLabel ?? 'Feedback',
  analyticsTitle: 'Analytics',
  analyticsLoading: 'Loading analytics…',
  analyticsReady: 'Analytics updated. Numbers may be slightly delayed.',
  analyticsUnavailable: 'Analytics are temporarily unavailable.',
  analyticsMetricLabels: {
    site_pv: 'Page views',
    site_uv: 'Visitors'
  }
};

const normalizeFatalBuildError = (error) => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : JSON.stringify(error));
};

const inferBuildFailureStage = (message = '') => {
  if (message.startsWith('Missing static resource:')) return '静态资源检查';
  if (message.startsWith('HTML semantics/accessibility audit failed:')) return 'HTML 语义与可访问性审计';
  if (message.includes('Canonical') || message.includes('canonical')) return '站点 canonical 配置';
  if (message.includes('frontmatter')) return '文章 frontmatter 校验';
  if (message.includes('slug')) return '文章路由生成';
  if (message.includes('Markdown') || message.startsWith('Post ')) return '文章内容解析';
  return '构建阶段';
};

const inferBuildFailureHints = (message = '') => {
  const hints = [];

  if (message.startsWith('Missing static resource:')) {
    hints.push('确认报错资源文件真实存在，并放在 src/assets/ 或 public/ 下。');
    hints.push('检查引用路径是否使用了正确的绝对路径、文件名和扩展名。');
  }

  if (message.startsWith('HTML semantics/accessibility audit failed:')) {
    hints.push('根据上面的页面路径逐项修复缺少的 landmark、h1、alt、aria-label 等语义化问题。');
    hints.push('如果是模板改动导致的问题，优先检查 renderLayout、页面主体结构和交互控件名称。');
  }

  if (message.includes('frontmatter')) {
    hints.push('检查 content/posts 中对应文章的 frontmatter 字段名、日期格式、tags、slug 和布尔值写法。');
  }

  if (message.includes('Markdown') || message.startsWith('Post ')) {
    hints.push('检查对应 Markdown 正文中的标题层级、图片 alt、链接目标、占位词和内容长度。');
    hints.push('可先运行 npm run validate，更快定位文章内容问题。');
  }

  if (message.includes('slug')) {
    hints.push('确保 slug 或文件名最终生成的文章路径唯一，且不会解析为空。');
  }

  if (message.includes('Canonical') || message.includes('canonical')) {
    hints.push('检查 src/data/site.mjs 中的 siteUrl、repoBasePath，以及相关页面路径是否满足 canonical 规则。');
  }

  hints.push('修复后重新执行 npm run build。');

  return [...new Set(hints)];
};

const formatBuildFailure = (error) => {
  const normalizedError = normalizeFatalBuildError(error);
  const message = normalizedError.message?.trim?.() || '未知构建错误';
  const stage = inferBuildFailureStage(message);
  const reasonLines = message.split('\n').map((line) => `- ${line}`);
  const hintLines = inferBuildFailureHints(message).map((line) => `- ${line}`);

  return ['✖ Build failed', `阶段：${stage}`, '', '原因：', ...reasonLines, '', '建议：', ...hintLines].join('\n');
};

let hasHandledFatalBuildError = false;
const exitWithBuildFailure = (error) => {
  if (hasHandledFatalBuildError) {
    return;
  }

  hasHandledFatalBuildError = true;
  console.error(formatBuildFailure(error));
  process.exit(1);
};

process.on('uncaughtException', exitWithBuildFailure);
process.on('unhandledRejection', (reason) => exitWithBuildFailure(reason));

if (canonicalConfig.errors.length > 0) {
  throw new Error(canonicalConfig.errors.join('\n'));
}

const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif']);
const BUILD_TRACKED_RESOURCE_EXTENSIONS = new Set([
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.css',
  '.js',
  '.mjs',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.pdf',
  '.json',
  '.txt',
  '.xml',
  '.mp4',
  '.webm',
  '.mp3',
  '.wav',
  '.ogg',
  '.zip'
]);
const imageMetadata = new Map();
const assetManifest = new Map();
const emittedAssetEntries = [];

const ensureDir = (dirPath) => mkdirSync(dirPath, { recursive: true });
const minifyCss = (content) =>
  content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();

const minifySvg = (content) =>
  content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();

const minifyHtml = (content) =>
  content
    .replace(/>\s*\n\s*</g, '><')
    .replace(/\n{2,}/g, '\n')
    .trim();

const optimizeTextContent = (targetPath, content) => {
  const extension = path.extname(targetPath).toLowerCase();

  if (extension === '.html') return minifyHtml(content);
  if (extension === '.css') return minifyCss(content);
  if (extension === '.svg') return minifySvg(content);
  return content;
};

const writeText = (targetPath, content) => {
  ensureDir(path.dirname(targetPath));
  writeFileSync(targetPath, optimizeTextContent(targetPath, content));
};

const createContentHash = (content) => createHash('sha256').update(content).digest('hex').slice(0, 10);

const createHashedFileName = (fileName, content) => {
  const extension = path.extname(fileName);
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
  return `${baseName}.${createContentHash(content)}${extension}`;
};

const registerEmittedAsset = (sourcePublicPath, emittedPublicPath) => {
  assetManifest.set(sourcePublicPath, emittedPublicPath);
  emittedAssetEntries.push({ source: sourcePublicPath, output: emittedPublicPath });
};

const emitStaticAsset = (sourcePath, targetDirectoryPath, publicPathPrefix = '/') => {
  const extension = path.extname(sourcePath).toLowerCase();
  const fileName = path.basename(sourcePath);
  const rawContent = readFileSync(sourcePath);
  const outputContent =
    extension === '.css' || extension === '.svg'
      ? Buffer.from(optimizeTextContent(sourcePath, rawContent.toString('utf8')))
      : rawContent;
  const hashedFileName = createHashedFileName(fileName, outputContent);
  const targetPath = path.join(targetDirectoryPath, hashedFileName);
  const normalizedPrefix = publicPathPrefix === '/' ? '' : publicPathPrefix.replace(/\/$/, '');
  const sourcePublicPath = `${normalizedPrefix}/${fileName}`;
  const emittedPublicPath = `${normalizedPrefix}/${hashedFileName}`;

  ensureDir(path.dirname(targetPath));
  writeFileSync(targetPath, outputContent);
  registerEmittedAsset(sourcePublicPath, emittedPublicPath);

  return { targetPath, publicPath: emittedPublicPath };
};

const criticalCssSource = minifyCss(rawCriticalCssSource);

const normalizeImagePath = (assetPath = '') => {
  if (!assetPath || /^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith('data:') || assetPath.startsWith('#')) {
    return '';
  }

  const [cleanPath] = assetPath.split(/[?#]/);
  const normalizedRepoBasePath = site.repoBasePath.replace(/\/$/, '');

  if (normalizedRepoBasePath && cleanPath.startsWith(normalizedRepoBasePath)) {
    const trimmedPath = cleanPath.slice(normalizedRepoBasePath.length);
    return trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
  }

  if (cleanPath.startsWith('/')) {
    return cleanPath;
  }

  return `/${cleanPath.replace(/^\.?\/+/, '')}`;
};

const isBuildTrackedResourcePath = (assetPath = '') =>
  BUILD_TRACKED_RESOURCE_EXTENSIONS.has(path.extname(assetPath.split(/[?#]/)[0]).toLowerCase());

const getExpectedResourceLocation = (assetPath = '') => (assetPath.startsWith('/assets/') ? 'src/assets/' : 'public/');

const getEmittedAssetPath = (assetPath = '') => {
  if (!assetPath || /^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith('data:') || assetPath.startsWith('#')) {
    return assetPath;
  }

  const match = assetPath.match(/^([^?#]+)(.*)$/);
  const cleanPath = match?.[1] ?? assetPath;
  const suffix = match?.[2] ?? '';
  const normalizedPath = normalizeImagePath(cleanPath);

  if (!normalizedPath) {
    return assetPath;
  }

  const emittedPath = assetManifest.get(normalizedPath);
  if (!emittedPath && isBuildTrackedResourcePath(normalizedPath)) {
    throw new Error(
      `Missing static resource: "${assetPath}" resolved to "${normalizedPath}". Add the file to ${getExpectedResourceLocation(normalizedPath)} before building.`
    );
  }

  return `${emittedPath ?? normalizedPath}${suffix}`;
};

const parseSvgDimensions = (filePath) => {
  const source = readFileSync(filePath, 'utf8');
  const svgTag = source.match(/<svg\b[^>]*>/i)?.[0] ?? '';
  const widthMatch = svgTag.match(/\bwidth=["']([\d.]+)(?:px)?["']/i);
  const heightMatch = svgTag.match(/\bheight=["']([\d.]+)(?:px)?["']/i);

  if (widthMatch && heightMatch) {
    return {
      width: Number(widthMatch[1]),
      height: Number(heightMatch[1])
    };
  }

  const viewBoxMatch = svgTag.match(/\bviewBox=["'][-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)["']/i);
  if (!viewBoxMatch) return null;

  return {
    width: Number(viewBoxMatch[1]),
    height: Number(viewBoxMatch[2])
  };
};

const registerImageMetadata = (assetPath, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return;

  const normalizedPath = normalizeImagePath(assetPath);
  if (!normalizedPath) return;

  let dimensions = null;
  if (extension === '.svg') {
    dimensions = parseSvgDimensions(filePath);
  }

  if (!dimensions?.width || !dimensions?.height) return;
  imageMetadata.set(normalizedPath, dimensions);
};

const registerImagesFromDirectory = (directoryPath, publicPathPrefix = '/') => {
  for (const file of readdirSync(directoryPath)) {
    const filePath = path.join(directoryPath, file);
    const publicPath = `${publicPathPrefix.replace(/\/$/, '')}/${file}`;
    registerImageMetadata(publicPath, filePath);
  }
};

const getImageAttributes = ({ src = '', loading = '', decoding = 'async', fetchpriority = '' } = {}) => {
  const attributes = [];
  const metadataEntry = imageMetadata.get(normalizeImagePath(src));
  const resolvedLoading = loading || (fetchpriority === 'high' ? 'eager' : 'lazy');

  if (metadataEntry) {
    attributes.push(`width="${metadataEntry.width}"`, `height="${metadataEntry.height}"`);
  }

  if (resolvedLoading) {
    attributes.push(`loading="${resolvedLoading}"`);
  }

  if (decoding) {
    attributes.push(`decoding="${decoding}"`);
  }

  if (fetchpriority) {
    attributes.push(`fetchpriority="${fetchpriority}"`);
  }

  return attributes.length ? ` ${attributes.join(' ')}` : '';
};

const formatDate = (dateString) =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Shanghai'
  }).format(new Date(`${dateString}T00:00:00+08:00`));

const formatWordCount = (count) => `${count.toLocaleString('zh-CN')} 字`;
const formatDateEn = (dateString) =>
  new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Shanghai'
  }).format(new Date(`${dateString}T00:00:00+08:00`));
const formatWordCountEn = (count) => `${count.toLocaleString('en-US')} words`;
const estimateReadingTimeEn = (content) => {
  const plainText = content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(wordCount / 180));
  return `${minutes} min read`;
};

const renderPostMeta = (post) => {
  const items = [formatDate(post.date)];
  if (post.updated && post.updated !== post.date) {
    items.push(`更新于 ${formatDate(post.updated)}`);
  }
  items.push(post.readingTime);
  items.push(formatWordCount(post.wordCount));
  return items.map((item) => `<span>${item}</span>`).join('');
};

const parseBusuanziPayload = (value = '') => {
  const payloadMatch = value.match(/\((\{.*\})\)/);
  if (!payloadMatch?.[1]) return null;

  try {
    return JSON.parse(payloadMatch[1]);
  } catch {
    return null;
  }
};

const fetchPostPageViews = async (post) => {
  try {
    const response = await fetch(BUSUANZI_POPULARITY_ENDPOINT, {
      headers: {
        referer: buildCanonicalUrl(site, `/blog/${post.slug}/`)
      },
      signal: AbortSignal.timeout(2500)
    });

    if (!response.ok) {
      return null;
    }

    const payload = parseBusuanziPayload(await response.text());
    const pageViews = Number(payload?.page_pv);
    return Number.isFinite(pageViews) ? pageViews : null;
  } catch {
    return null;
  }
};

const attachPopularityMetrics = async (posts) => {
  const pageViewsList = await Promise.all(posts.map((post) => fetchPostPageViews(post)));

  return posts.map((post, index) => ({
    ...post,
    pageViews: pageViewsList[index]
  }));
};

const comparePostsByPopularity = (leftPost, rightPost) => {
  const leftViews = Number.isFinite(leftPost.pageViews) ? leftPost.pageViews : -1;
  const rightViews = Number.isFinite(rightPost.pageViews) ? rightPost.pageViews : -1;

  if (rightViews !== leftViews) {
    return rightViews - leftViews;
  }

  if (leftPost.pinned !== rightPost.pinned) {
    return Number(rightPost.pinned) - Number(leftPost.pinned);
  }

  const leftUpdatedAt = new Date(`${leftPost.updated ?? leftPost.date}T00:00:00+08:00`);
  const rightUpdatedAt = new Date(`${rightPost.updated ?? rightPost.date}T00:00:00+08:00`);

  return rightUpdatedAt - leftUpdatedAt;
};

const getPopularPosts = (posts, { limit = POPULAR_POST_LIMIT, excludeSlug = '' } = {}) =>
  [...posts]
    .filter((post) => post.slug !== excludeSlug)
    .sort(comparePostsByPopularity)
    .slice(0, limit);

const hasPopularityMetrics = (posts) => posts.some((post) => Number.isFinite(post.pageViews));

const renderPopularPostMetric = (post) => {
  if (Number.isFinite(post.pageViews)) {
    return `${post.pageViews.toLocaleString('zh-CN')} 次阅读`;
  }

  if (post.pinned) {
    return '当前主推';
  }

  if (post.updated && post.updated !== post.date) {
    return `更新于 ${formatDate(post.updated)}`;
  }

  return `发布于 ${formatDate(post.date)}`;
};

const renderPopularPostsSection = (posts, { basePath = '' } = {}) => {
  const popularPosts = getPopularPosts(posts);
  if (!popularPosts.length) return '';

  const hasMetrics = hasPopularityMetrics(popularPosts);
  const sectionIntro = hasMetrics
    ? '结合当前访问数据整理出最近更常被打开的内容，第一次来到博客时可以先从这里读起。'
    : '如果访问统计暂时不可用，这里会优先展示当前主推和更值得先读的内容。';

  return `<section class="section reveal" id="popular-posts"><div class="post-list__header"><div class="section-heading"><p class="kicker">热门文章</p><h2>先看这几篇，更容易快速建立整体印象。</h2><p class="section-intro">${sectionIntro}</p></div><div class="post-list__filters"><span class="tag">${hasMetrics ? '访问热度' : '推荐排序'}</span><a class="button button-ghost button-small" href="#post-search-input">继续搜索</a></div></div><div class="post-grid popular-posts-grid">${popularPosts
    .map(
      (post, index) => `<article class="post-card popular-post-card"><div class="popular-post-card__header"><span class="feature-label">热门 ${String(index + 1).padStart(2, '0')}</span><span class="popular-post-card__metric">${renderPopularPostMetric(post)}</span></div><p class="kicker"><a href="${basePath}categories/${post.category.slug}/">${post.category.name}</a></p><h3>${post.title}</h3><p>${post.summary}</p>${renderTagLinks(post.tags, basePath)}<a class="button button-ghost" href="${basePath}${post.slug}/">阅读详情</a></article>`
    )
    .join('')}</div></section>`;
};

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const slugify = (value) =>
  value
    .replace(/\.md$/, '')
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const resolvePostSlug = ({ fileName = '', customSlug = '', hasCustomSlug = false } = {}) => {
  const normalizedCustomSlug = customSlug.trim();
  if (hasCustomSlug && !normalizedCustomSlug) {
    throw new Error(`Post ${fileName} has an empty slug field.`);
  }

  const resolvedSlug = slugify(normalizedCustomSlug || fileName);
  if (!resolvedSlug) {
    throw new Error(
      `Post ${fileName} resolved to an empty slug${hasCustomSlug ? ` from custom slug "${customSlug}"` : ''}.`
    );
  }

  return resolvedSlug;
};

const assertUniquePostSlugs = (posts) => {
  const slugMap = new Map();

  for (const post of posts) {
    const existingSource = slugMap.get(post.slug);
    if (existingSource) {
      throw new Error(`Duplicate post slug detected: "${post.slug}" (${existingSource} and ${post.sourceFile}).`);
    }
    slugMap.set(post.slug, post.sourceFile);
  }
};

const slugifyTag = (value) => encodeURIComponent(value.trim().toLowerCase().replace(/\s+/g, '-'));
const slugifyCategory = (value) => encodeURIComponent(value.trim().toLowerCase().replace(/\s+/g, '-'));

const renderTagLinks = (tags, basePath = '') =>
  `<ul class="tag-list">${tags
    .map((tag) => `<li><a class="tag tag-link" href="${basePath}tags/${slugifyTag(tag)}/">${tag}</a></li>`)
    .join('')}</ul>`;

const getTemplateDisplayName = (template, locale = 'zh') => {
  if (!template) return '';
  return locale === 'en' ? template.nameEn || template.name : template.name;
};

const renderTemplateBadge = ({ template, basePath = '', locale = 'zh' } = {}) => {
  if (!template) return '';
  const label = locale === 'en' ? 'Template' : '模板';
  return `<span class="feature-label feature-label--template"><a href="${basePath}templates/${template.slug}/">${label} · ${getTemplateDisplayName(template, locale)}</a></span>`;
};

const renderTemplateNoteCard = ({ template, locale = 'zh' } = {}) => {
  if (!template) return '';

  const title = locale === 'en' ? 'Content template' : '内容模板';
  const description = template.description;
  const summaryLabel = locale === 'en' ? 'How this template is usually used' : '这个模板通常怎么用';
  const outlineLabel = locale === 'en' ? 'Suggested structure' : '推荐结构';
  const recommendedLabel = locale === 'en' ? 'Good for' : '适合场景';

  return `<div class="note-card template-note-card"><h3>${title}</h3><p><strong>${getTemplateDisplayName(template, locale)}</strong> · ${description}</p><div class="template-note-card__summary"><span>${summaryLabel}</span><p>${template.summary}</p></div><div class="template-note-card__summary"><span>${recommendedLabel}</span><p>${template.recommendedFor.join(' / ')}</p></div><div class="template-outline"><span>${outlineLabel}</span><ol>${template.outline.map((item) => `<li>${item}</li>`).join('')}</ol></div></div>`;
};

const normalizeProjectStatus = (status) => {
  if (!status) return null;
  if (typeof status === 'string') {
    return { label: status, tone: 'neutral' };
  }

  const label = status.label?.trim?.();
  if (!label) return null;
  return {
    label,
    tone: status.tone?.trim?.() || 'neutral'
  };
};

const getProjectStatusLabel = (status) => normalizeProjectStatus(status)?.label ?? '';

const renderProjectStatusBadge = (status) => {
  const normalizedStatus = normalizeProjectStatus(status);
  if (!normalizedStatus) return '';

  return `<span class="status-badge status-badge--${normalizedStatus.tone}"><span class="status-badge__dot" aria-hidden="true"></span>${normalizedStatus.label}</span>`;
};

const normalizeProjectMedia = (media) => {
  if (!Array.isArray(media)) return [];

  return media
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const src = item.src?.trim?.();
      if (!src) return null;

      return {
        src,
        alt: item.alt?.trim?.() || '',
        caption: item.caption?.trim?.() || ''
      };
    })
    .filter(Boolean);
};

const resolveStaticAssetPath = (assetPath, prefix = '') => {
  if (!assetPath) return '';
  if (/^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
    return assetPath;
  }

  const emittedAssetPath = getEmittedAssetPath(assetPath);

  if (emittedAssetPath.startsWith('/')) {
    return `${prefix}${emittedAssetPath.slice(1)}`;
  }

  return `${prefix}${emittedAssetPath}`;
};

const resolveLinkHref = (href, prefix = '') => {
  if (!href) return '';
  if (/^(?:[a-z]+:)?\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return href;
  }

  if (href.startsWith('/')) {
    return `${prefix}${href.slice(1)}`;
  }

  return `${prefix}${href}`;
};

const isExternalLink = (href = '') => /^(?:[a-z]+:)?\/\//i.test(href);
const getLinkTargetAttributes = (href = '') => (isExternalLink(href) ? ' target="_blank" rel="noreferrer"' : '');

const normalizeAuthorLinks = (links = []) =>
  links
    .map((link) => {
      if (!link || typeof link !== 'object') return null;
      const label = link.label?.trim?.();
      const url = link.url?.trim?.();
      if (!label || !url) return null;

      return {
        label,
        url,
        kind: link.kind?.trim?.() || 'link',
        meta: link.meta?.trim?.() || '',
        description: link.description?.trim?.() || ''
      };
    })
    .filter(Boolean);

const getAuthorLinks = (siteConfig = site) => normalizeAuthorLinks(siteConfig.author.links ?? []);
const getAuthorLinksByKind = (kind, siteConfig = site) => getAuthorLinks(siteConfig).filter((link) => link.kind === kind);

const renderAuthorLinkCards = (links) =>
  `<ul class="nav-guide-list">${links
    .map((link) => {
      const detail = [link.meta, link.description].filter(Boolean).join(' · ');
      return `<li><a class="nav-guide-link" href="${link.url}"${getLinkTargetAttributes(link.url)}><strong>${escapeHtml(link.label)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ''}</a></li>`;
    })
    .join('')}</ul>`;

const createMailtoHref = ({ email = '', subject = '', body = '' } = {}) => {
  const normalizedEmail = email?.trim?.();
  if (!normalizedEmail) return '';

  const params = new URLSearchParams();
  if (subject?.trim?.()) params.set('subject', subject.trim());
  if (body?.trim?.()) params.set('body', body.trim());

  const query = params.toString();
  return `mailto:${normalizedEmail}${query ? `?${query}` : ''}`;
};

const getEmailSubscriptionHref = (siteConfig = site) =>
  createMailtoHref({
    email: siteConfig.author.email,
    subject: siteConfig.emailSubscription?.subject,
    body: siteConfig.emailSubscription?.body
  });

const renderEmailSubscriptionLink = ({
  siteConfig = site,
  label = siteConfig.emailSubscription?.ctaLabel ?? '邮件订阅',
  className = '',
  variant = 'secondary',
  small = false
} = {}) => {
  const href = getEmailSubscriptionHref(siteConfig);
  if (!href) return '';

  const classes = ['button', `button-${variant}`, small ? 'button-small' : '', className].filter(Boolean).join(' ');
  return `<a class="${classes}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
};

const getFeedbackEmailHref = ({
  siteConfig = site,
  pageTitle = '',
  pageUrl = '',
  pageTitleLabel = '页面标题',
  pageUrlLabel = '页面链接',
  subjectSeparator = '｜'
} = {}) => {
  const subjectBase = siteConfig.feedback?.email?.subject?.trim?.() || siteConfig.feedback?.title?.trim?.() || '留言 / 反馈';
  const subject = pageTitle ? `${subjectBase}${subjectSeparator}${pageTitle}` : subjectBase;
  const bodyParts = [siteConfig.feedback?.email?.body?.trim?.() || '你好，我想反馈一些关于博客 / 站点的想法。'];

  if (pageTitle) {
    bodyParts.push(`${pageTitleLabel}：${pageTitle}`);
  }

  if (pageUrl) {
    bodyParts.push(`${pageUrlLabel}：${pageUrl}`);
  }

  return createMailtoHref({
    email: siteConfig.author.email,
    subject,
    body: bodyParts.filter(Boolean).join('\n\n')
  });
};

const getFeedbackIssueHref = ({ siteConfig = site, pageTitle = '', pageUrl = '' } = {}) => {
  const baseUrl = siteConfig.feedback?.issue?.url?.trim?.();
  if (!baseUrl) return '';

  const url = new URL(baseUrl);
  const title = pageTitle ? `[反馈] ${pageTitle}` : '[反馈] 站点建议';
  const bodyLines = [
    '## 反馈说明',
    '',
    '- 反馈类型：内容建议 / 勘误 / 体验问题 / 功能建议',
    pageTitle ? `- 页面标题：${pageTitle}` : '',
    pageUrl ? `- 页面链接：${pageUrl}` : '',
    '',
    '## 具体内容',
    '',
    '请在这里补充你的反馈。'
  ].filter(Boolean);

  url.searchParams.set('title', title);
  url.searchParams.set('body', bodyLines.join('\n'));
  return url.toString();
};

const getPrimaryFeedbackHref = (siteConfig = site) =>
  getFeedbackEmailHref({ siteConfig }) || getFeedbackIssueHref({ siteConfig });

const renderFeedbackEntry = ({
  title = site.feedback?.title ?? '留言 / 反馈',
  description = site.feedback?.description ?? '',
  note = site.feedback?.note ?? '',
  pageTitle = '',
  pageUrl = '',
  cardClassName = ''
} = {}) => {
  const emailHref = getFeedbackEmailHref({ pageTitle, pageUrl });
  const issueHref = getFeedbackIssueHref({ pageTitle, pageUrl });
  const actions = [
    emailHref
      ? `<a class="button button-primary" href="${escapeHtml(emailHref)}">${escapeHtml(site.feedback?.email?.label ?? '发邮件留言')}</a>`
      : '',
    issueHref
      ? `<a class="button button-secondary" href="${escapeHtml(issueHref)}" target="_blank" rel="noreferrer">${escapeHtml(site.feedback?.issue?.label ?? '提交反馈')}</a>`
      : ''
  ]
    .filter(Boolean)
    .join('');

  if (!description && !actions) return '';

  const cardClasses = ['note-card', cardClassName].filter(Boolean).join(' ');
  return `<div class="${cardClasses}"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${actions ? `<div class="contact-links">${actions}</div>` : ''}${note ? `<p class="muted">${escapeHtml(note)}</p>` : ''}</div>`;
};

const normalizeProjectExternalLinks = (links) => {
  if (!Array.isArray(links)) return [];

  return links
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const label = item.label?.trim?.();
      const href = item.href?.trim?.();
      if (!label || !href) return null;
      return { label, href };
    })
    .filter(Boolean);
};

const renderProjectActionLink = ({ href, label, prefix = '', variant = 'ghost', externalLabel = '外链' }) => {
  const resolvedHref = resolveLinkHref(href, prefix);
  if (!resolvedHref || !label) return '';

  const external = isExternalLink(resolvedHref);
  return `<a class="button button-${variant} button-small project-action${external ? ' project-action--external' : ''}" href="${resolvedHref}"${external ? ' target="_blank" rel="noreferrer"' : ''}><span>${escapeHtml(label)}</span>${external ? `<span class="project-action__meta">${externalLabel}</span><span class="project-action__arrow" aria-hidden="true">↗</span>` : ''}</a>`;
};

const renderNowStreamEntry = (item, { prefix = '', compact = false } = {}) => {
  const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
  const notes = compact ? [] : Array.isArray(item.notes) ? item.notes.filter(Boolean) : [];
  const action = item.link?.href && item.link?.label
    ? renderProjectActionLink({
        href: item.link.href,
        label: item.link.label,
        prefix,
        variant: item.link.variant ?? 'ghost'
      })
    : '';

  return `<li class="now-stream__entry${compact ? ' now-stream__entry--compact' : ''}"><div class="timeline-marker" aria-hidden="true"></div><div class="timeline-content"><div class="now-stream__meta"><p class="timeline-date">${formatDate(item.date)}</p>${item.status ? renderProjectStatusBadge(item.status) : ''}</div><h3>${item.title}</h3><p class="now-stream__summary">${item.summary}</p>${notes.length ? `<div class="now-stream__body">${notes.map((note) => `<p>${note}</p>`).join('')}</div>` : ''}${tags.length ? `<ul class="tag-list">${tags.map((tag) => `<li class="tag">${tag}</li>`).join('')}</ul>` : ''}${action ? `<div class="now-stream__footer">${action}</div>` : ''}</div></li>`;
};

const renderHomeNowSection = () => {
  const items = nowFeed.items.slice(0, home.updates.limit ?? 3);

  return `<section class="section reveal" id="now"><div class="post-list__header"><div class="section-heading"><p class="kicker">${home.updates.eyebrow}</p><h2>${home.updates.title}</h2><p class="section-intro">${home.updates.description}</p></div><a class="button button-ghost" href="${home.updates.cta.href.slice(1)}">${home.updates.cta.label}</a></div><div class="split-grid split-grid--timeline"><article class="note-card timeline-card"><ol class="timeline timeline--detailed now-stream now-stream--compact">${items
    .map((item) => renderNowStreamEntry(item, { compact: true }))
    .join('')}</ol></article><article class="note-card now-stream__aside"><div class="section-heading"><p class="kicker">阶段主轴</p><h2>${nowFeed.snapshot.title}</h2><p class="section-intro">${nowFeed.snapshot.description}</p></div><div class="card-grid now-stream__focus-grid">${nowFeed.snapshot.items
    .map((item) => `<article class="panel now-focus-card"><h3>${item.title}</h3><p>${item.text}</p></article>`)
    .join('')}</div><div class="contact-links"><a class="button button-secondary" href="${home.updates.cta.href.slice(1)}">查看完整动态流</a><a class="button button-ghost" href="blog/">继续看文章</a></div></article></div></section>`;
};

const renderNowPage = (page) => `<section class="page-hero reveal"><p class="kicker">${page.title}</p><h1>${page.title}</h1><p>${page.intro}</p><div class="page-hero__meta"><span class="tag">最近更新：${formatDate(nowFeed.updatedAt)}</span><span class="tag">${nowFeed.items.length} 条阶段记录</span></div></section><section class="section reveal"><div class="split-grid split-grid--timeline now-page-grid"><article class="note-card timeline-card"><div class="section-heading now-stream__section-heading"><p class="kicker">动态流</p><h2>把最近正在推进的事，按时间顺序公开记下来。</h2><p class="section-intro">${nowFeed.intro}</p></div><ol class="timeline timeline--detailed now-stream">${nowFeed.items
  .map((item) => renderNowStreamEntry(item, { prefix: '../' }))
  .join('')}</ol></article><aside class="now-stream__aside-stack"><article class="note-card now-stream__aside"><h3>${nowFeed.snapshot.title}</h3><p>${nowFeed.snapshot.description}</p><div class="card-grid now-stream__focus-grid">${nowFeed.snapshot.items
    .map((item) => `<article class="panel now-focus-card"><h4>${item.title}</h4><p>${item.text}</p></article>`)
    .join('')}</div></article><article class="note-card now-stream__aside"><h3>我怎么使用这条动态流</h3><ul class="list-card">${nowFeed.principles.map((item) => `<li>${item}</li>`).join('')}</ul></article>${renderFeedbackEntry({
      title: '如果你也在做类似的事',
      description: '欢迎直接留言告诉我你现在在推进什么，或者你还想看到这条动态流继续记录哪些内容。',
      note: '我会优先回复那些带着具体上下文的问题或项目。',
      pageTitle: page.title,
      pageUrl: buildCanonicalUrl(site, '/now/')
    })}</aside></div></section>`;

const renderStateCard = ({
  tag = 'div',
  tone = 'empty',
  icon = '',
  kicker = '',
  title = '',
  titleTag = 'h2',
  summary = '',
  summaryAttributes = '',
  tips = [],
  actions = [],
  className = '',
  compact = false,
  attributes = ''
}) => {
  const classes = ['state-card', `state-card--${tone}`, compact ? 'state-card--compact' : '', className]
    .filter(Boolean)
    .join(' ');
  const summaryBlock = summary
    ? `<p class="state-card__summary"${summaryAttributes ? ` ${summaryAttributes}` : ''}>${summary}</p>`
    : '';
  const tipsBlock = tips.length
    ? `<ul class="state-card__tips">${tips.map((item) => `<li>${item}</li>`).join('')}</ul>`
    : '';
  const actionsBlock = actions.length
    ? `<div class="state-card__actions">${actions.join('')}</div>`
    : '';

  return `<${tag} class="${classes}"${attributes ? ` ${attributes}` : ''}>${icon ? `<div class="state-card__icon" aria-hidden="true">${icon}</div>` : ''}<div class="state-card__body">${kicker ? `<p class="kicker">${kicker}</p>` : ''}${title ? `<${titleTag} class="state-card__title">${title}</${titleTag}>` : ''}${summaryBlock}${tipsBlock}${actionsBlock}</div></${tag}>`;
};

const getProjectMedia = (item) => normalizeProjectMedia(item?.gallery ?? item?.media);
const getProjectPrimaryMedia = (item) => getProjectMedia(item)[0] ?? null;
const normalizeFilterValue = (value = '') => value.trim().toLowerCase();
const collectUniqueValues = (items, getValue) => {
  const seen = new Set();
  const values = [];

  items.forEach((item) => {
    const value = getValue(item)?.trim?.();
    if (!value) return;
    const normalized = normalizeFilterValue(value);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    values.push(value);
  });

  return values;
};

const renderProjectMediaFigure = (media, prefix = '') => {
  const src = resolveStaticAssetPath(media?.src, prefix);
  if (!src) return '';

  const alt = escapeHtml(media.alt || media.caption || '项目截图或演示图');
  const caption = media.caption ? `<figcaption>${escapeHtml(media.caption)}</figcaption>` : '';
  return `<figure class="project-media-card"><img src="${src}" alt="${alt}"${getImageAttributes({ src: media?.src, loading: 'lazy' })} />${caption}</figure>`;
};

const estimateReadingTime = (content) => {
 const plainText = content
 .replace(/^#{1,6}\s+/gm, '')
 .replace(/^>\s+/gm, '')
 .replace(/^[-*]\s+/gm, '')
 .replace(/^\d+\.\s+/gm, '')
 .replace(/`([^`]+)`/g, '$1')
 .replace(/\*\*([^*]+)\*\*/g, '$1')
 .replace(/\*([^*]+)\*/g, '$1')
 .replace(/\s+/g, '');
 const characters = plainText.length;
 const minutes = Math.max(1, Math.ceil(characters /300));
 return `预计 ${minutes} 分钟读完`;
};

const stripMarkdownForExcerpt = (content) =>
  content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const createSummaryFallback = (content, maxLength = 90) => {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((block) => stripMarkdownForExcerpt(block))
    .filter(Boolean);

  const source = paragraphs[0] ?? stripMarkdownForExcerpt(content);
  if (!source) {
    return '这篇文章正在整理中。';
  }

  if (source.length <= maxLength) {
    return source;
  }

  return `${source.slice(0, maxLength).trim()}…`;
};

const resolvePostSummary = (summary, content) => {
  const normalizedSummary = summary?.trim();
  return normalizedSummary || createSummaryFallback(content);
};

const CODE_LANGUAGE_ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  plaintext: 'text',
  txt: 'text'
};

const normalizeCodeLanguage = (language = '') => {
  const normalized = language.trim().toLowerCase();
  return CODE_LANGUAGE_ALIASES[normalized] ?? normalized;
};

const highlightCode = (source, language = '') => {
  const normalizedLanguage = normalizeCodeLanguage(language);
  const preserve = (input, rules) => {
    const placeholders = [];
    let result = input;

    const stash = (className, value) => {
      const token = `__OPENCLAW_CODE_${placeholders.length}__`;
      placeholders.push({
        token,
        html: `<span class="token ${className}">${escapeHtml(value)}</span>`
      });
      return token;
    };

    for (const rule of rules.filter((item) => item.preserveFirst)) {
      result = result.replace(rule.pattern, (match) => stash(rule.className, match));
    }

    result = escapeHtml(result);

    for (const rule of rules.filter((item) => !item.preserveFirst)) {
      result = result.replace(rule.pattern, (...args) => {
        const match = args[0];
        if (typeof rule.replacer === 'function') {
          return rule.replacer(...args);
        }
        return `<span class="token ${rule.className}">${match}</span>`;
      });
    }

    for (const { token, html } of placeholders) {
      result = result.replaceAll(token, html);
    }

    return result;
  };

  if (!normalizedLanguage || normalizedLanguage === 'text' || normalizedLanguage === 'plain') {
    return escapeHtml(source);
  }

  const javascriptRules = [
    { pattern: /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, className: 'comment', preserveFirst: true },
    { pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, className: 'string', preserveFirst: true },
    { pattern: /\b(?:import|from|export|default|const|let|var|function|return|if|else|for|while|switch|case|break|continue|new|class|extends|async|await|try|catch|finally|throw|typeof|instanceof|in|of)\b/g, className: 'keyword' },
    { pattern: /\b(?:true|false|null|undefined)\b/g, className: 'boolean' },
    {
      pattern: /(^|[^\w.])(-?\d+(?:\.\d+)?)(?=$|[^\w.])/g,
      className: 'number',
      replacer: (match, prefix, number) => `${prefix}<span class="token number">${number}</span>`
    }
  ];

  const jsonRules = [
    { pattern: /"(?:\\.|[^"\\])*"/g, className: 'string', preserveFirst: true },
    { pattern: /\b(?:true|false|null)\b/g, className: 'boolean' },
    {
      pattern: /(^|[^\w.])(-?\d+(?:\.\d+)?)(?=$|[^\w.])/g,
      className: 'number',
      replacer: (match, prefix, number) => `${prefix}<span class="token number">${number}</span>`
    },
    { pattern: /[{}\[\],:]/g, className: 'punctuation' }
  ];

  const yamlRules = [
    { pattern: /#[^\n]*/g, className: 'comment', preserveFirst: true },
    { pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, className: 'string', preserveFirst: true },
    {
      pattern: /(^\s*)([A-Za-z0-9_-]+)(:\s*)/gm,
      className: 'property',
      replacer: (match, indent, key, separator) => `${indent}<span class="token property">${key}</span><span class="token punctuation">${separator}</span>`
    },
    { pattern: /\b(?:true|false|null)\b/g, className: 'boolean' },
    {
      pattern: /(^|[^\w.])(-?\d+(?:\.\d+)?)(?=$|[^\w.])/g,
      className: 'number',
      replacer: (match, prefix, number) => `${prefix}<span class="token number">${number}</span>`
    }
  ];

  const bashRules = [
    { pattern: /#[^\n]*/g, className: 'comment', preserveFirst: true },
    { pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, className: 'string', preserveFirst: true },
    { pattern: /\$[A-Za-z_][A-Za-z0-9_]*/g, className: 'variable' },
    { pattern: /\b(?:if|then|fi|for|do|done|case|esac|while|function|in|export|local|sudo|cd|ls|cat|echo|npm|node|git)\b/g, className: 'keyword' }
  ];

  const markdownRules = [
    { pattern: /`[^`]+`/g, className: 'string', preserveFirst: true },
    {
      pattern: /^(#{1,6})(\s+.+)$/gm,
      className: 'keyword',
      replacer: (match, hashes, text) => `<span class="token keyword">${hashes}</span>${text}`
    },
    {
      pattern: /^(\s*)([-*+]\s+)/gm,
      className: 'punctuation',
      replacer: (match, indent, marker) => `${indent}<span class="token punctuation">${marker}</span>`
    },
    {
      pattern: /^(\s*)(\d+\.\s+)/gm,
      className: 'number',
      replacer: (match, indent, marker) => `${indent}<span class="token number">${marker}</span>`
    }
  ];

  if (normalizedLanguage === 'javascript' || normalizedLanguage === 'typescript') {
    return preserve(source, javascriptRules);
  }

  if (normalizedLanguage === 'json') {
    return preserve(source, jsonRules);
  }

  if (normalizedLanguage === 'yaml') {
    return preserve(source, yamlRules);
  }

  if (normalizedLanguage === 'bash') {
    return preserve(source, bashRules);
  }

  if (normalizedLanguage === 'markdown') {
    return preserve(source, markdownRules);
  }

  return escapeHtml(source);
};

const renderCodeBlock = (lines, language = '') => {
  const normalizedLanguage = normalizeCodeLanguage(language);
  const label = normalizedLanguage ? escapeHtml(normalizedLanguage) : '';
  const content = highlightCode(lines.join('\n'), normalizedLanguage);
  const className = normalizedLanguage ? ` class="language-${label}"` : '';
  const dataLang = normalizedLanguage ? ` data-language="${label}"` : '';
  const preClassName = normalizedLanguage ? 'code-block has-language' : 'code-block';
  return `<pre class="${preClassName}"${dataLang}><code${className}>${content}</code></pre>`;
};

const resolveContentPath = (value = '') => {
  if (!value || /^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith('#')) {
    return value;
  }

  const emittedValue = getEmittedAssetPath(value);

  if (emittedValue.startsWith('/')) {
    return `${site.repoBasePath.replace(/\/$/, '')}${emittedValue}`;
  }

  return emittedValue;
};

const parseImageCaption = (title = '') => {
  const normalized = title.trim();
  if (!normalized) {
    return { heading: '', note: '' };
  }

  const [heading, ...noteParts] = normalized.split('|').map((item) => item.trim()).filter(Boolean);
  return {
    heading: heading ?? '',
    note: noteParts.join(' | ')
  };
};

const renderImageBlock = ({ alt, src, title }) => {
  const safeAlt = escapeHtml(alt);
  const safeSrc = escapeHtml(resolveContentPath(src));
  const { heading, note } = parseImageCaption(title);
  const titleAttr = heading ? ` title="${escapeHtml(heading)}"` : '';

  if (!heading && !note) {
    return `<p class="prose-image"><img src="${safeSrc}" alt="${safeAlt}"${getImageAttributes({ src, loading: 'lazy' })} /></p>`;
  }

  return `<figure class="prose-figure"><img src="${safeSrc}" alt="${safeAlt}"${getImageAttributes({ src, loading: 'lazy' })}${titleAttr} /><figcaption>${heading ? `<strong>${escapeHtml(heading)}</strong>` : ''}${note ? `<span>${escapeHtml(note)}</span>` : ''}</figcaption></figure>`;
};

const inlineMarkdown = (value) => {
  const codeTokens = [];
  const escaped = escapeHtml(value).replace(/`([^`]+)`/g, (_, code) => {
    const token = `__CODE_TOKEN_${codeTokens.length}__`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  const withMarkup = escaped
    .replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]+)")?\)/g, (_, alt, src, title) => renderImageBlock({ alt, src, title }))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const resolvedHref = resolveContentPath(href.trim());
      const safeHref = escapeHtml(resolvedHref);
      return `<a href="${safeHref}"${safeHref.startsWith('http') ? ' target="_blank" rel="noreferrer"' : ''}>${label}</a>`;
    })
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return codeTokens.reduce((result, _, index) => result.replace(`__CODE_TOKEN_${index}__`, codeTokens[index]), withMarkup);
};

const markdownToHtml = (markdown) => {
  const lines = markdown.split('\n');
  const blocks = [];
  const toc = [];
  const headingSlugCount = new Map();
  let paragraph = [];
  let listItems = [];
  let listType = null;
  let quoteLines = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeLines = [];

  const createHeadingId = (text) => {
    const baseSlug = slugify(text) || 'section';
    const count = headingSlugCount.get(baseSlug) ?? 0;
    headingSlugCount.set(baseSlug, count + 1);
    return count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
  };

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length || !listType) return;
    blocks.push(`<${listType}>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${listType}>`);
    listItems = [];
    listType = null;
  };

  const flushQuote = () => {
    if (!quoteLines.length) return;
    const quoteHtml = markdownToHtml(quoteLines.join('\n')).html;
    blocks.push(`<blockquote>${quoteHtml}</blockquote>`);
    quoteLines = [];
  };

  const flushCodeBlock = () => {
    if (!inCodeBlock) return;
    blocks.push(renderCodeBlock(codeLines, codeLanguage));
    inCodeBlock = false;
    codeLanguage = '';
    codeLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushParagraph();
        flushList();
        flushQuote();
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuote();
      blocks.push('<hr />');
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const id = createHeadingId(text);
      if (level <= 3) toc.push({ level, text, id });
      blocks.push(`<h${level} id="${id}">${inlineMarkdown(text)}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      flushParagraph();
      flushList();
      quoteLines.push(trimmed.slice(2));
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(orderedMatch[1]);
      continue;
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]+)")?\)$/);
    if (imageMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      const [, alt, src, title] = imageMatch;
      blocks.push(renderImageBlock({ alt, src, title }));
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushQuote();
  flushCodeBlock();

  return {
    html: blocks.join('\n'),
    toc
  };
};

const getRelativePrefix = (outputPath) => {
  const relative = path.relative(path.dirname(outputPath), outDir) || '.';
  return relative.replaceAll('\\', '/');
};

const trimLocalPrefix = (value) => value.replace(/^\.\//, '');

const withBase = (relativePath) => new URL(relativePath.replace(/^\//, ''), canonicalConfig.normalizedSiteUrl).toString();
const formatSitemapLastModified = (dateString) => {
  if (!dateString) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? dateString : '';
};

const formatRssDate = (dateString) => {
  if (!dateString) return '';
  return new Date(`${dateString}T00:00:00+08:00`).toUTCString();
};

const toIsoDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(`${dateString}T00:00:00+08:00`).toISOString();
};

const detectImageMimeType = (assetPath = '') => {
  const normalizedPath = assetPath.split('?')[0].toLowerCase();

  if (normalizedPath.endsWith('.svg')) return 'image/svg+xml';
  if (normalizedPath.endsWith('.png')) return 'image/png';
  if (normalizedPath.endsWith('.jpg') || normalizedPath.endsWith('.jpeg')) return 'image/jpeg';
  if (normalizedPath.endsWith('.webp')) return 'image/webp';
  if (normalizedPath.endsWith('.gif')) return 'image/gif';

  return '';
};

const siteHomeUrl = buildCanonicalUrl(site, '/');
const personSchemaId = `${siteHomeUrl}#person`;
const websiteSchemaId = `${siteHomeUrl}#website`;
const BUSUANZI_POPULARITY_ENDPOINT = 'https://busuanzi.ibruce.info/busuanzi?jsonpCallback=BusuanziCallback';
const POPULAR_POST_LIMIT = 3;

const normalizeStructuredData = (value) => {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
};

const serializeStructuredData = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/<\/script/gi, '<\\/script');

const resolveAbsoluteUrl = (value = '') => {
  if (!value) return '';
  if (/^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith('data:')) {
    return value;
  }

  const emittedValue = getEmittedAssetPath(value);
  return withBase(emittedValue.startsWith('/') ? emittedValue : `/${emittedValue}`);
};

const createImageObject = (image, caption = '') => {
  const url = resolveAbsoluteUrl(image);
  if (!url) return null;

  const imageObject = {
    '@type': 'ImageObject',
    url,
    contentUrl: url
  };
  const mimeType = detectImageMimeType(image);
  if (mimeType) imageObject.encodingFormat = mimeType;
  if (caption) imageObject.caption = caption;
  return imageObject;
};

const createBreadcrumbs = (items = []) =>
  items
    .map((item) => {
      if (!item?.name) return null;
      const url = item.url ?? (item.path ? buildCanonicalUrl(site, item.path) : '');
      if (!url) return null;
      return {
        name: item.name,
        url
      };
    })
    .filter(Boolean);

const buildPersonStructuredData = () => {
  const sameAs = (site.author.links ?? [])
    .map((link) => link?.url?.trim?.())
    .filter((url) => /^https?:\/\//i.test(url));

  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': personSchemaId,
    name: site.author.name,
    url: siteHomeUrl,
    description: site.author.intro,
    jobTitle: site.author.role,
    email: site.author.email
  };

  if (site.author.city) {
    person.address = {
      '@type': 'PostalAddress',
      addressLocality: site.author.city
    };
  }

  if (sameAs.length) {
    person.sameAs = sameAs;
  }

  return person;
};

const buildWebsiteStructuredData = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': websiteSchemaId,
  url: siteHomeUrl,
  name: site.shortName,
  alternateName: site.title,
  description: site.description,
  inLanguage: 'zh-CN',
  publisher: {
    '@id': personSchemaId
  }
});

const buildBreadcrumbStructuredData = (canonical, items = []) => {
  if (!items.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
};

const buildPageStructuredData = ({
  title,
  description,
  canonical,
  image,
  pageType = 'WebPage',
  breadcrumbs = [],
  mainEntityId = ''
}) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': pageType,
    '@id': `${canonical}#page`,
    url: canonical,
    name: title,
    description,
    inLanguage: 'zh-CN',
    isPartOf: {
      '@id': websiteSchemaId
    },
    about: {
      '@id': personSchemaId
    }
  };

  const imageObject = createImageObject(image);
  if (imageObject) {
    schema.primaryImageOfPage = imageObject;
  }

  if (breadcrumbs.length) {
    schema.breadcrumb = {
      '@id': `${canonical}#breadcrumb`
    };
  }

  if (mainEntityId) {
    schema.mainEntity = {
      '@id': mainEntityId
    };
  }

  return schema;
};

const buildItemListStructuredData = ({ canonical, items = [] }) => {
  if (!items.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${canonical}#itemlist`,
    url: canonical,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': item.type ?? 'Thing',
        name: item.name,
        url: item.url,
        ...(item.description ? { description: item.description } : {})
      }
    }))
  };
};

const buildPostListStructuredData = (currentPath, posts) =>
  buildItemListStructuredData({
    canonical: buildCanonicalUrl(site, currentPath),
    items: posts.map((post) => ({
      type: 'BlogPosting',
      name: post.title,
      url: buildCanonicalUrl(site, `/blog/${post.slug}/`),
      description: post.summary
    }))
  });

const buildCollectionListStructuredData = (currentPath, items, mapItem) =>
  buildItemListStructuredData({
    canonical: buildCanonicalUrl(site, currentPath),
    items: items.map(mapItem)
  });

const buildBlogPostingStructuredData = ({ post, canonical }) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${canonical}#article`,
    url: canonical,
    headline: post.title,
    description: post.summary,
    datePublished: toIsoDateTime(post.date),
    dateModified: toIsoDateTime(post.updated ?? post.date),
    author: {
      '@id': personSchemaId
    },
    publisher: {
      '@id': personSchemaId
    },
    mainEntityOfPage: {
      '@id': `${canonical}#page`
    },
    articleSection: post.category.name,
    wordCount: post.wordCount,
    inLanguage: 'zh-CN'
  };

  const imageObject = createImageObject(post.ogImage ?? post.cover, `${post.title} 的文章封面图`);
  if (imageObject) {
    schema.image = imageObject;
  }

  if (post.tags.length) {
    schema.keywords = post.tags.join(', ');
  }

  return schema;
};

const buildProjectStructuredData = ({ project, canonical }) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': `${canonical}#project`,
    url: canonical,
    name: project.title,
    description: project.summary,
    creator: {
      '@id': personSchemaId
    },
    inLanguage: 'zh-CN',
    genre: project.category
  };

  const imageObject = createImageObject(getProjectPrimaryMedia(project)?.src, project.title);
  if (imageObject) {
    schema.image = imageObject;
  }

  if (project.stack?.length) {
    schema.keywords = project.stack.join(', ');
  }

  return schema;
};

const defaultCoverPool = [
  '/assets/illustration-wave.svg',
  '/assets/illustration-orbit.svg',
  '/assets/illustration-grid.svg'
];

const resolvePostCover = (post) => {
  if (post.cover) return post.cover;

  const seed = `${post.category?.name ?? ''}${post.slug ?? post.title ?? ''}`;
  const hash = Array.from(seed).reduce((total, char) => total + char.codePointAt(0), 0);
  return defaultCoverPool[hash % defaultCoverPool.length];
};

const renderNav = (currentPath, prefix, navigation = site.navigation) => {
  const normalize = (href) => (href.endsWith('/') ? href : `${href}/`);
  const resolveHref = (href) => {
    if (href === '/') return trimLocalPrefix(`${prefix}/index.html`);
    return trimLocalPrefix(`${prefix}/${href.replace(/^\//, '')}`);
  };

  return navigation
    .map(({ label, href }) => {
      const isCurrent = normalize(currentPath) === normalize(href);
      return `<a href="${resolveHref(href)}"${isCurrent ? ' aria-current="page"' : ''}>${label}</a>`;
    })
    .join('');
};

const formatMetaTitle = (...segments) => segments.filter(Boolean).join('｜');

const renderSiteAnalyticsCard = (siteConfig = site, uiText = zhUi) => {
  if (site.analytics?.provider !== 'busuanzi' || !site.analytics?.siteMetrics?.length) {
    return '';
  }

  const metrics = site.analytics.siteMetrics
    .map(
      (metric) => `<li class="site-analytics__item"><span>${escapeHtml(uiText.analyticsMetricLabels?.[metric.key] ?? metric.label)}</span><strong id="busuanzi_value_${escapeHtml(metric.key)}" data-busuanzi-value="${escapeHtml(metric.key)}">--</strong></li>`
    )
    .join('');

  return `<div class="site-analytics" data-analytics-card data-analytics-loading="${escapeHtml(uiText.analyticsLoading ?? site.analytics.loadingText ?? '访问统计加载中…')}" data-analytics-ready="${escapeHtml(uiText.analyticsReady ?? site.analytics.readyText ?? '统计已更新，数据可能有短暂延迟。')}" data-analytics-unavailable="${escapeHtml(uiText.analyticsUnavailable ?? site.analytics.unavailableText ?? '统计服务暂时不可用。')}"><span class="site-footer__heading">${escapeHtml(uiText.analyticsTitle ?? '访问统计')}</span><ul class="site-analytics__list">${metrics}</ul><p class="muted site-analytics__status" data-analytics-status>${escapeHtml(uiText.analyticsLoading ?? site.analytics.loadingText ?? '访问统计加载中…')}</p></div>`;
};

const renderPostPageAnalytics = (uiText = zhUi) => {
  if (site.analytics?.provider !== 'busuanzi' || !site.analytics?.pageMetric?.key) {
    return '';
  }

  return `<div class="meta-row" data-analytics-card data-analytics-loading="${escapeHtml(site.analytics.loadingText ?? '访问统计加载中…')}" data-analytics-ready="${escapeHtml(site.analytics.readyText ?? '统计已更新，数据可能有短暂延迟。')}" data-analytics-unavailable="${escapeHtml(site.analytics.unavailableText ?? '统计服务暂时不可用。')}"><span>${escapeHtml(site.analytics.pageMetric.label ?? uiText.analyticsTitle ?? '访问统计')}</span><span><strong class="page-analytics__value" id="busuanzi_value_${escapeHtml(site.analytics.pageMetric.key)}" data-busuanzi-value="${escapeHtml(site.analytics.pageMetric.key)}">--</strong> 次阅读</span><span class="meta-row__hint" data-analytics-status>${escapeHtml(site.analytics.loadingText ?? '访问统计加载中…')}</span></div>`;
};

const renderAnnouncementBanner = (siteConfig = site, prefix = '') => {
  const announcement = siteConfig.announcement;
  if (!announcement?.title?.trim?.()) {
    return '';
  }

  const metaItems = Array.isArray(announcement.meta) ? announcement.meta.filter(Boolean) : [];
  const actions = [announcement.primaryAction, announcement.secondaryAction]
    .filter((action) => action?.label?.trim?.() && action?.href?.trim?.())
    .map((action, index) => {
      const resolvedHref = resolveLinkHref(action.href.trim(), prefix ? `${prefix}/` : '');
      const variant = index === 0 ? 'primary' : 'ghost';
      return `<a class="button button-${variant} button-small" href="${escapeHtml(resolvedHref)}"${getLinkTargetAttributes(resolvedHref)}>${escapeHtml(action.label.trim())}</a>`;
    })
    .join('');

  return `<section class="site-announcement reveal" aria-label="站点公告"><div class="site-announcement__inner"><div class="site-announcement__copy"><div class="site-announcement__eyebrow"><p class="kicker">${escapeHtml(announcement.eyebrow?.trim?.() || '站点公告')}</p>${announcement.badge?.trim?.() ? `<span class="site-announcement__badge">${escapeHtml(announcement.badge.trim())}</span>` : ''}</div><h2>${escapeHtml(announcement.title.trim())}</h2>${announcement.description?.trim?.() ? `<p class="site-announcement__description">${escapeHtml(announcement.description.trim())}</p>` : ''}${metaItems.length ? `<ul class="site-announcement__meta">${metaItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}</div>${actions ? `<div class="site-announcement__actions">${actions}</div>` : ''}</div></section>`;
};

const renderLayout = ({
  title,
  description,
  currentPath,
  outputPath,
  body,
  image = site.brand.ogImage,
  openGraph = {},
  robots = site.seo?.robots?.default ?? 'index,follow,max-image-preview:large',
  pageType = 'WebPage',
  breadcrumbs = [],
  structuredData = [],
  mainEntityId = '',
  siteConfig = site,
  uiText = zhUi,
  documentLang = 'zh-CN',
  languageSwitch = null,
  alternateLinks = [],
  includeDefaultStructuredData = true
}) => {
  const prefix = getRelativePrefix(outputPath);
  const assetPrefix = prefix === '.' ? './' : `${prefix}/`;
  const canonical = buildCanonicalUrl(site, currentPath);
  const stylesheetHref = trimLocalPrefix(resolveStaticAssetPath('/styles.css', assetPrefix));
  const scriptHref = trimLocalPrefix(resolveStaticAssetPath('/script.js', assetPrefix));
  const enhancementsHref = trimLocalPrefix(resolveStaticAssetPath('/enhancements.js', assetPrefix));
  const analyticsScriptHref = site.analytics?.provider === 'busuanzi' ? site.analytics.scriptUrl : '';
  const fontStylesheetHref = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap';
  const faviconHref = trimLocalPrefix(resolveStaticAssetPath(site.brand.favicon, assetPrefix));
  const rssHref = site.rss?.path ? trimLocalPrefix(resolveLinkHref(site.rss.path, `${prefix}/`)) : '';
  const resolvedOpenGraph = {
    title: openGraph.title ?? title,
    description: openGraph.description ?? description,
    type: openGraph.type ?? 'website',
    image: openGraph.image ?? image,
    imageAlt: openGraph.imageAlt ?? '',
    article: openGraph.article ?? null
  };
  const ogImage = resolveAbsoluteUrl(resolvedOpenGraph.image);
  const ogImageType = detectImageMimeType(resolvedOpenGraph.image);
  const resolvedTwitter = {
    card: ogImage ? 'summary_large_image' : 'summary',
    title: resolvedOpenGraph.title,
    description: resolvedOpenGraph.description,
    image: ogImage,
    imageAlt: resolvedOpenGraph.imageAlt
  };
  const metaTitle = escapeHtml(title);
  const metaDescription = escapeHtml(description);
  const metaCanonical = escapeHtml(canonical);
  const metaOgTitle = escapeHtml(resolvedOpenGraph.title);
  const metaOgDescription = escapeHtml(resolvedOpenGraph.description);
  const metaOgType = escapeHtml(resolvedOpenGraph.type);
  const metaOgImage = escapeHtml(ogImage);
  const metaOgImageAlt = resolvedOpenGraph.imageAlt ? escapeHtml(resolvedOpenGraph.imageAlt) : '';
  const metaTwitterCard = escapeHtml(resolvedTwitter.card);
  const metaTwitterTitle = escapeHtml(resolvedTwitter.title);
  const metaTwitterDescription = escapeHtml(resolvedTwitter.description);
  const metaTwitterImage = resolvedTwitter.image ? escapeHtml(resolvedTwitter.image) : '';
  const metaTwitterImageAlt = resolvedTwitter.imageAlt ? escapeHtml(resolvedTwitter.imageAlt) : '';
  const metaRobots = robots ? escapeHtml(robots) : '';
  const structuredDataScripts = [
    ...(includeDefaultStructuredData
      ? [
          buildWebsiteStructuredData(),
          buildPersonStructuredData(),
          buildPageStructuredData({
            title,
            description,
            canonical,
            image: resolvedOpenGraph.image,
            pageType,
            breadcrumbs,
            mainEntityId
          }),
          buildBreadcrumbStructuredData(canonical, breadcrumbs)
        ]
      : []),
    ...normalizeStructuredData(structuredData)
  ]
    .filter(Boolean)
    .map((schema) => `<script type="application/ld+json">${serializeStructuredData(schema)}</script>`)
    .join('\n    ');
  const openGraphExtras = [
    ogImageType ? `<meta property="og:image:type" content="${escapeHtml(ogImageType)}" />` : '',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    metaOgImageAlt ? `<meta property="og:image:alt" content="${metaOgImageAlt}" />` : '',
    resolvedOpenGraph.type === 'article' && resolvedOpenGraph.article?.publishedTime
      ? `<meta property="article:published_time" content="${escapeHtml(resolvedOpenGraph.article.publishedTime)}" />`
      : '',
    resolvedOpenGraph.type === 'article' && resolvedOpenGraph.article?.modifiedTime
      ? `<meta property="article:modified_time" content="${escapeHtml(resolvedOpenGraph.article.modifiedTime)}" />`
      : '',
    resolvedOpenGraph.type === 'article' && resolvedOpenGraph.article?.section
      ? `<meta property="article:section" content="${escapeHtml(resolvedOpenGraph.article.section)}" />`
      : '',
    ...(resolvedOpenGraph.type === 'article'
      ? (resolvedOpenGraph.article?.tags ?? []).map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}" />`)
      : [])
  ]
    .filter(Boolean)
    .join('\n    ');
  const currentHref = currentPath === '/' ? '/' : currentPath;
  const themeBootScript = `(()=>{const storageKey='personal-blog-theme';const savedTheme=localStorage.getItem(storageKey);const theme=savedTheme==='light'||savedTheme==='dark'?savedTheme:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=theme;const themeColorMeta=document.querySelector('meta[name="theme-color"]');if(themeColorMeta){themeColorMeta.setAttribute('content',theme==='light'?'#f4f7fb':'#07111f')}})();`;
  const criticalCss = criticalCssSource.replaceAll('</style>', '<\\/style>');
  const alternateLinkTags = alternateLinks
    .filter((item) => item?.href && item?.hreflang)
    .map((item) => `<link rel="alternate" hreflang="${escapeHtml(item.hreflang)}" href="${escapeHtml(buildCanonicalUrl(site, item.href))}" />`)
    .join('\n    ');
  const languageSwitchHtml = languageSwitch?.href
    ? `<a class="button button-ghost button-small language-switch" href="${trimLocalPrefix(resolveLinkHref(languageSwitch.href, `${prefix}/`))}" lang="${escapeHtml(languageSwitch.lang ?? '')}">${escapeHtml(languageSwitch.label ?? uiText.languageSwitchLabel ?? 'EN')}</a>`
    : '';
  const brandHref = currentPath.startsWith('/en/') ? `${prefix}/index.html` : `${prefix}/index.html`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(documentLang)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#07111f" />
    <title>${metaTitle}</title>
    <meta name="description" content="${metaDescription}" />
    <meta property="og:title" content="${metaOgTitle}" />
    <meta property="og:description" content="${metaOgDescription}" />
    <meta property="og:type" content="${metaOgType}" />
    <meta property="og:site_name" content="${escapeHtml(siteConfig.shortName)}" />
    <meta property="og:url" content="${metaCanonical}" />
    <meta property="og:image" content="${metaOgImage}" />
    ${openGraphExtras}
    <meta name="twitter:card" content="${metaTwitterCard}" />
    <meta name="twitter:title" content="${metaTwitterTitle}" />
    <meta name="twitter:description" content="${metaTwitterDescription}" />
    ${metaTwitterImage ? `<meta name="twitter:image" content="${metaTwitterImage}" />` : ''}
    ${metaTwitterImageAlt ? `<meta name="twitter:image:alt" content="${metaTwitterImageAlt}" />` : ''}
    ${metaRobots ? `<meta name="robots" content="${metaRobots}" />` : ''}
    <link rel="canonical" href="${metaCanonical}" />
    ${alternateLinkTags}
    ${structuredDataScripts}
    <link rel="icon" type="image/svg+xml" href="${escapeHtml(faviconHref)}" />
    ${rssHref ? `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(documentLang.startsWith('en') ? `${siteConfig.shortName} RSS` : site.rss?.title ?? `${siteConfig.shortName} RSS`)}" href="${escapeHtml(rssHref)}" />` : ''}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <script>${themeBootScript}</script>
    <style>${criticalCss}</style>
    <link rel="preload" href="${fontStylesheetHref}" as="style" onload="this.onload=null;this.rel='stylesheet'" />
    <noscript><link rel="stylesheet" href="${fontStylesheetHref}" /></noscript>
    <link rel="preload" href="${stylesheetHref}" as="style" onload="this.onload=null;this.rel='stylesheet'" />
    <noscript><link rel="stylesheet" href="${stylesheetHref}" /></noscript>
  </head>
  <body>
    <a class="skip-link" href="#main-content">${escapeHtml(uiText.skipToContent ?? '跳到正文')}</a>
    <div class="reading-progress" data-reading-progress>
      <span class="reading-progress__bar" data-reading-progress-bar></span>
    </div>
    <div class="site-shell">
      <header class="site-header">
        <div class="site-header__inner">
          <a class="brand" href="${brandHref}">
            <span class="brand-mark">${escapeHtml(siteConfig.brandMark ?? '昱')}</span>
            <span class="brand-copy">
              <strong>${siteConfig.author.name}</strong>
              <small>${siteConfig.author.role}</small>
            </span>
          </a>
          <div class="header-actions">
            ${languageSwitchHtml}
            <button class="theme-toggle" type="button" data-theme-toggle aria-label="${escapeHtml(uiText.toggleTheme ?? '切换主题')}">☾</button>
            <button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-label="${escapeHtml(uiText.openNavigation ?? '展开导航')}">
              <span></span><span></span><span></span>
            </button>
          </div>
          <nav class="site-nav" data-nav aria-label="Main navigation">
            ${renderNav(currentHref, prefix, siteConfig.navigation)}
          </nav>
        </div>
      </header>
      ${renderAnnouncementBanner(siteConfig, prefix)}
      <main id="main-content" tabindex="-1">
        ${body}
      </main>
      <button class="back-to-top" type="button" data-back-to-top aria-label="${escapeHtml(uiText.backToTop ?? '返回顶部')}" aria-hidden="true" tabindex="-1">
        <span class="back-to-top__icon" aria-hidden="true">↑</span>
        <span>${escapeHtml(uiText.backToTop ?? '返回顶部')}</span>
      </button>
      <footer class="site-footer">
        <div class="site-footer__grid">
          <section class="site-footer__section site-footer__section--brand" aria-label="Site information">
            <strong>${siteConfig.shortName}</strong>
            <p>${siteConfig.author.role} · ${siteConfig.author.city}</p>
            <p>${siteConfig.description}</p>
            ${renderSiteAnalyticsCard(siteConfig, uiText)}
          </section>
          <section class="site-footer__section" aria-label="Site navigation">
            <span class="site-footer__heading">${escapeHtml(uiText.footerSite ?? '站内导航')}</span>
            <div class="footer-links">
              ${siteConfig.navigation
                .map(({ label, href }) => `<a href="${trimLocalPrefix(resolveLinkHref(href, `${prefix}/`))}">${label}</a>`)
                .join('')}
            </div>
          </section>
          <section class="site-footer__section" aria-label="Links">
            <span class="site-footer__heading">${escapeHtml(uiText.footerLinks ?? '联系与链接')}</span>
            <div class="footer-links">
              ${getAuthorLinks(siteConfig).map((link) => `<a href="${link.url}"${getLinkTargetAttributes(link.url)}>${escapeHtml(link.label)}</a>`).join('')}
              ${rssHref ? `<a href="${rssHref}">${escapeHtml(uiText.rssLabel ?? 'RSS 订阅')}</a>` : ''}
              ${getEmailSubscriptionHref(siteConfig) ? `<a href="${escapeHtml(getEmailSubscriptionHref(siteConfig))}">${escapeHtml(uiText.emailLabel ?? '邮件订阅')}</a>` : ''}
              ${getPrimaryFeedbackHref(siteConfig) ? `<a href="${escapeHtml(getPrimaryFeedbackHref(siteConfig))}"${getLinkTargetAttributes(getPrimaryFeedbackHref(siteConfig))}>${escapeHtml(uiText.feedbackLabel ?? '留言反馈')}</a>` : ''}
            </div>
          </section>
        </div>
        <span class="site-footer__meta">© <span data-current-year></span> ${siteConfig.author.name} · ${escapeHtml(uiText.footerMeta ?? '以轻量静态站方式构建，持续更新中。')} ${documentLang.startsWith('en') ? `Source code is released under <a class="text-link" href="${site.license.url}" target="_blank" rel="noreferrer">${site.license.name}</a>. See <a class="text-link" href="${site.changelog.url}" target="_blank" rel="noreferrer">${site.changelog.name}</a> for site updates.` : `源码采用 <a class="text-link" href="${site.license.url}" target="_blank" rel="noreferrer">${site.license.name}</a> 开源，变更记录见 <a class="text-link" href="${site.changelog.url}" target="_blank" rel="noreferrer">${site.changelog.name}</a>。`}</span>
      </footer>
    </div>
    <script src="${scriptHref}" data-site-main-script="true" data-enhancements-src="${enhancementsHref}"${analyticsScriptHref ? ` data-analytics-src="${escapeHtml(analyticsScriptHref)}"` : ''} defer></script>
  </body>
</html>`;
};

const getLanguageSwitch = (currentPath, locale = 'zh') => {
  const normalizedPath = normalizeLanguageRouteKey(currentPath);
  if (locale === 'zh') {
    const target = englishRouteMap.get(normalizedPath);
    return target ? { href: target, label: zhUi.languageSwitchLabel, lang: 'en' } : null;
  }

  const target = chineseRouteMap.get(normalizedPath);
  return target ? { href: target, label: enUi.languageSwitchLabel, lang: 'zh-CN' } : null;
};

const createAlternateLinks = (zhPath, enPath) => [
  { hreflang: 'zh-CN', href: zhPath },
  { hreflang: 'en', href: enPath },
  { hreflang: 'x-default', href: zhPath }
];

const normalizeEnglishPost = (post) => {
  const plainText = post.body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[[^\]]+\]\([^)]*\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;

  return {
    ...post,
    wordCount,
    readingTime: estimateReadingTimeEn(post.body)
  };
};

const renderEnglishHomePage = (posts) => {
  const featuredPosts = posts.slice(0, 3);
  const page = siteEn.home;

  return `
    <section class="hero">
      <div class="hero-copy reveal">
        <p class="kicker">${page.hero.eyebrow}</p>
        <h1>${page.hero.title}</h1>
        <p>${page.hero.description}</p>
        <div class="hero-actions">
          <a class="button button-primary" href="blog/">${page.hero.primaryCta.label}</a>
          <a class="button button-secondary" href="about/">${page.hero.secondaryCta.label}</a>
        </div>
        <div class="metrics">
          ${page.hero.metrics.map((metric) => `<div class="metric"><strong>${metric.value}</strong><span>${metric.label}</span></div>`).join('')}
        </div>
      </div>
      <aside class="hero-visual reveal">
        <div>
          <p class="kicker">Current focus</p>
          <p>${siteEn.author.intro}</p>
        </div>
        <img src="${resolveStaticAssetPath('/assets/illustration-wave.svg')}" alt="Abstract wave illustration"${getImageAttributes({ src: '/assets/illustration-wave.svg', fetchpriority: 'high' })} />
        <ul class="list-card">
          <li>Product structure</li>
          <li>Frontend experience</li>
          <li>Writing systems</li>
        </ul>
      </aside>
    </section>

    <section class="section reveal" id="about">
      <div class="section-heading">
        <p class="kicker">${siteEn.pages.about.title}</p>
        <h2>${page.sections.aboutTitle}</h2>
        <p class="section-intro">${page.sections.aboutText}</p>
      </div>
      <div class="card-grid">
        ${siteEn.pages.about.sections.map((section) => `<article class="panel"><h3>${section.title}</h3><p>${section.text}</p></article>`).join('')}
      </div>
    </section>

    <section class="section reveal" id="projects">
      <div class="section-heading">
        <p class="kicker">${siteEn.pages.projects.title}</p>
        <h2>${page.sections.projectsTitle}</h2>
        <p class="section-intro">${page.sections.projectsText}</p>
      </div>
      <div class="project-grid">
        ${siteEn.pages.projects.items
          .map(
            (item) => `<article class="project-panel project-card"><h3>${item.title}</h3><p>${item.summary}</p><a class="button button-ghost" href="${item.href.replace(/^\/en\//, '')}">${siteEn.ui.readMore}</a></article>`
          )
          .join('')}
      </div>
    </section>

    <section class="section reveal" id="blog">
      <div class="post-list__header">
        <div class="section-heading">
          <p class="kicker">${siteEn.pages.blog.title}</p>
          <h2>${page.sections.postsTitle}</h2>
          <p class="section-intro">${page.sections.postsText}</p>
        </div>
        <a class="button button-ghost" href="blog/">${siteEn.ui.readMore}</a>
      </div>
      <div class="post-grid">
        ${featuredPosts
          .map(
            (post) => `<article class="post-card"><div class="post-card__cover"><img src="${resolveStaticAssetPath(post.cover)}" alt="${escapeHtml(post.title)} cover illustration"${getImageAttributes({ src: post.cover })} /></div><div class="post-card__meta"><span>${formatDateEn(post.date)}</span><span>${post.readingTime}</span></div><h2>${post.title}</h2><p>${post.summary}</p><ul class="tag-list">${post.tags.map((tag) => `<li class="tag">${tag}</li>`).join('')}</ul><a class="button button-ghost" href="blog/${post.slug}/">${siteEn.ui.readPost}</a></article>`
          )
          .join('')}
      </div>
    </section>`;
};

const renderEnglishInfoPage = (pageKey) => {
  const page = siteEn.pages[pageKey];

  if (pageKey === 'projects') {
    return `<section class="page-hero reveal"><p class="kicker">${page.title}</p><h1>${page.title}</h1><p>${page.intro}</p></section>
      <section class="section reveal"><div class="project-grid">${page.items
        .map(
          (item) => `<article class="project-panel project-card"><h3>${item.title}</h3><p>${item.summary}</p><a class="button button-ghost" href="${item.href.replace(/^\/en\//, '../')}">${siteEn.ui.readMore}</a></article>`
        )
        .join('')}</div></section>`;
  }

  if (pageKey === 'now') {
    return `<section class="page-hero reveal"><p class="kicker">${page.title}</p><h1>${page.title}</h1><p>${page.intro}</p></section>
      <section class="section reveal"><div class="project-grid">${page.items
        .map((item) => `<article class="project-panel project-card"><div class="project-card__header"><span class="kicker">In progress</span></div><p>${item}</p></article>`)
        .join('')}</div></section>`;
  }

  return `<section class="page-hero reveal"><p class="kicker">${page.title}</p><h1>${page.title}</h1><p>${page.intro}</p></section>
    <section class="section reveal"><div class="card-grid">${page.sections
      .map((section) => `<article class="panel"><h3>${section.title}</h3><p>${section.text}</p></article>`)
      .join('')}</div></section>`;
};

const renderEnglishBlogIndex = (posts) => `
  <section class="page-hero reveal">
    <p class="kicker">${siteEn.pages.blog.title}</p>
    <h1>${siteEn.pages.blog.title}</h1>
    <p>${siteEn.pages.blog.intro}</p>
  </section>
  <section class="section reveal">
    <div class="post-grid">
      ${posts
        .map(
          (post) => `<article class="post-card"><div class="post-card__cover"><img src="${resolveStaticAssetPath(post.cover)}" alt="${escapeHtml(post.title)} cover illustration"${getImageAttributes({ src: post.cover })} /></div><div class="post-card__meta">${post.updated && post.updated !== post.date ? `<span>Updated ${formatDateEn(post.updated)}</span>` : ''}<span>${formatDateEn(post.date)}</span><span>${post.readingTime}</span><span>${formatWordCountEn(post.wordCount)}</span></div><p class="kicker">${post.category.name}</p><h2>${post.title}</h2><p>${post.summary}</p><ul class="tag-list">${post.tags.map((tag) => `<li class="tag">${tag}</li>`).join('')}</ul><a class="button button-ghost" href="${post.slug}/">${siteEn.ui.readPost}</a></article>`
        )
        .join('')}
    </div>
  </section>`;

const renderEnglishPostPage = (post, relatedPosts = [], navigationPosts = {}) => `
  <article class="post-detail" data-reading-progress-target>
    <section class="post-header reveal">
      <p class="kicker">Post</p>
      ${post.pinned ? '<span class="feature-label feature-label--pinned">Featured</span>' : ''}
      <h1>${post.title}</h1>
      <div class="post-header__meta"><span>${formatDateEn(post.date)}</span>${post.updated && post.updated !== post.date ? `<span>Updated ${formatDateEn(post.updated)}</span>` : ''}<span>${post.readingTime}</span><span>${formatWordCountEn(post.wordCount)}</span></div>
      <p>${post.summary}</p>
      <ul class="tag-list"><li class="tag">${post.category.name}</li>${post.series ? `<li class="tag">Series · ${post.series.name}</li>` : ''}${post.tags.map((tag) => `<li class="tag">${tag}</li>`).join('')}</ul>
    </section>
    <section class="post-layout reveal">
      <article>
        <div class="post-cover"><img src="${resolveStaticAssetPath(post.cover, '../../')}" alt="${escapeHtml(post.title)} cover illustration"${getImageAttributes({ src: post.cover, loading: 'eager', fetchpriority: 'high' })} /></div>
        <div class="prose panel">${post.html}</div>
        <nav class="post-pagination reveal" aria-label="Previous and next posts">
          ${navigationPosts.previous ? `<a class="post-nav-card" href="../${navigationPosts.previous.slug}/"><span class="kicker">Previous</span><strong>${navigationPosts.previous.title}</strong><small>${navigationPosts.previous.summary}</small></a>` : `<div class="state-card state-card--quiet state-card--compact post-nav-card post-nav-card--empty"><div class="state-card__icon" aria-hidden="true">←</div><div class="state-card__body"><p class="kicker">Previous</p><strong class="state-card__title">This is the first post</strong></div></div>`}
          ${navigationPosts.next ? `<a class="post-nav-card" href="../${navigationPosts.next.slug}/"><span class="kicker">Next</span><strong>${navigationPosts.next.title}</strong><small>${navigationPosts.next.summary}</small></a>` : `<div class="state-card state-card--quiet state-card--compact post-nav-card post-nav-card--empty"><div class="state-card__icon" aria-hidden="true">→</div><div class="state-card__body"><p class="kicker">Next</p><strong class="state-card__title">This is the latest post</strong></div></div>`}
        </nav>
      </article>
      <aside class="post-aside">
        ${post.toc?.length ? `<div class="note-card toc-card"><h3>Contents</h3><nav class="toc-nav" aria-label="Table of contents"><ol class="toc-list">${post.toc
          .map((item) => `<li class="toc-item toc-item--level-${item.level}"><a href="#${item.id}">${item.text}</a></li>`)
          .join('')}</ol></nav></div>` : ''}
        <div class="note-card"><h3>Post information</h3><div class="meta-row"><span>Published</span><span>${formatDateEn(post.date)}</span></div>${post.updated && post.updated !== post.date ? `<div class="meta-row"><span>Updated</span><span>${formatDateEn(post.updated)}</span></div>` : ''}<div class="meta-row"><span>Reading</span><span>${post.readingTime} · ${formatWordCountEn(post.wordCount)}</span></div><div class="meta-row"><span>Category</span><span>${post.category.name}</span></div></div>
        <div class="note-card"><h3>Feedback</h3><p>${siteEn.feedback.description}</p><div class="contact-links"><a class="button button-primary" href="${escapeHtml(
          getFeedbackEmailHref({
            siteConfig: siteEn,
            pageTitle: post.title,
            pageUrl: buildCanonicalUrl(site, `/en/blog/${post.slug}/`),
            pageTitleLabel: 'Page title',
            pageUrlLabel: 'Page URL',
            subjectSeparator: ' | '
          })
        )}">${siteEn.feedback.email.label}</a><a class="button button-secondary" href="${escapeHtml(siteEn.feedback.issue.url)}" target="_blank" rel="noreferrer">${siteEn.feedback.issue.label}</a></div></div>
        ${relatedPosts.length ? `<div class="note-card"><h3>Related posts</h3><ul class="list-card">${relatedPosts.map((item) => `<li><a class="text-link" href="../${item.slug}/">${item.title}</a><br /><span class="muted">${item.summary}</span></li>`).join('')}</ul></div>` : ''}
      </aside>
    </section>
  </article>`;

const renderHomePage = (posts) => {
  const recentPosts = posts.slice(0, 3);
  const recentUpdates = [...posts]
    .sort((a, b) => {
      const dateA = new Date(a.updated || a.date);
      const dateB = new Date(b.updated || b.date);
      return dateB - dateA;
    })
    .slice(0, 3);
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
        <img src="${resolveStaticAssetPath('/assets/illustration-wave.svg')}" alt="抽象波形风格插画"${getImageAttributes({ src: '/assets/illustration-wave.svg', fetchpriority: 'high' })} />
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
            ${renderProjectStatusBadge(home.featuredProjects.items[0].status)}
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
              (project) => `<article class="project-panel featured-project"><span class="feature-label">${home.featuredProjects.secondaryLabel}</span><div class="featured-project__meta"><span class="tag">${project.tag}</span>${renderProjectStatusBadge(project.status)}</div><div><h3>${project.title}</h3><p>${project.description}</p></div><ul class="tag-list">${project.highlights.map((highlight) => `<li class="tag">${highlight}</li>`).join('')}</ul><a class="text-link" href="${project.href.slice(1)}">继续查看 →</a></article>`
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
          ? `<article class="post-card post-card--featured"><div class="post-card__cover"><img src="${resolveStaticAssetPath(primaryPost.cover)}" alt="${primaryPost.title} 的封面插画"${getImageAttributes({ src: primaryPost.cover, fetchpriority: 'high' })} /></div><div class="post-card__body">${primaryPost.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : `<span class="feature-label">${home.featuredPosts.primaryLabel}</span>`}<div class="post-card__meta">${renderPostMeta(primaryPost)}</div><h2>${primaryPost.title}</h2><p>${primaryPost.summary}</p><ul class="tag-list">${primaryPost.tags.map((tag) => `<li class="tag">${tag}</li>`).join('')}</ul><a class="text-link" href="blog/${primaryPost.slug}/">优先阅读 →</a></div></article>`
          : ''}
        <div class="featured-posts__sidebar">
          <div class="featured-posts__intro panel">
            <span class="feature-label">${home.featuredPosts.secondaryLabel}</span>
            <p>如果你第一次来到这里，建议先从上面的主推文章开始，再顺着下面两篇继续看，会更容易理解我对内容站、界面气质和个人表达的整体判断。</p>
          </div>
          ${secondaryPosts
            .map(
              (post) => `<article class="post-card post-card--compact">${post.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : ''}<div class="post-card__meta">${renderPostMeta(post)}</div><h3>${post.title}</h3><p>${post.summary}</p>${renderTagLinks(post.tags, 'blog/')}<a class="text-link" href="blog/${post.slug}/">继续阅读 →</a></article>`
            )
            .join('')}
        </div>
      </div>
    </section>

    <section class="section reveal" id="updates">
      <div class="section-heading">
        <p class="kicker">最近更新</p>
        <h2>最近有更新的文章。</h2>
        <p class="section-intro">这几篇是近期做过内容更新的文章，如果有遗漏的想法或新补充的内容，会在这里体现。</p>
      </div>
      <div class="post-grid">
        ${recentUpdates
          .map(
            (post) => `<article class="post-card"><div class="post-card__cover"><img src="${resolveStaticAssetPath(post.cover)}" alt="${post.title} 的封面插画"${getImageAttributes({ src: post.cover })} /></div>${post.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : ''}<div class="post-card__meta">${post.updated && post.updated !== post.date ? `<span>更新于 ${formatDate(post.updated)}</span>` : ''}<span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><h2>${post.title}</h2><p>${post.summary}</p>${renderTagLinks(post.tags, 'blog/')}<a class="button button-ghost" href="blog/${post.slug}/">阅读详情</a></article>`
          )
          .join('')}
      </div>
    </section>

    ${renderHomeNowSection()}

    <section class="section reveal" id="feedback">
      ${renderFeedbackEntry({
        pageTitle: '首页',
        pageUrl: buildCanonicalUrl(site, '/')
      })}
    </section>`;
};

const renderProjectCard = (item, { assetPrefix = '', filterable = false } = {}) => {
  const statusBadge = renderProjectStatusBadge(item.status);
  const facts = [
    ['角色', item.role],
    ['周期', item.timeline],
    ['关注点', item.focus],
    ['当前阶段', getProjectStatusLabel(item.status)]
  ].filter(([, value]) => value);
  const previewMedia = getProjectPrimaryMedia(item);
  const externalLinks = normalizeProjectExternalLinks(item.externalLinks);

  const relatedHref = item.href ? resolveLinkHref(item.href, assetPrefix) : '';
  const primaryHref = item.slug ? `${item.slug}/` : relatedHref;
  const primaryVariant = item.slug ? 'ghost' : isExternalLink(primaryHref) ? 'secondary' : 'ghost';
  const primaryLabel = item.slug ? '查看项目详情' : item.linkLabel ?? (isExternalLink(primaryHref) ? '访问项目' : '查看项目');
  const metaItems = facts
    .slice(1)
    .map(([label, value]) => (label === '当前阶段' && statusBadge ? statusBadge : `<span class="tag">${value}</span>`))
    .join('');
  const actionLinks = [
    primaryHref
      ? renderProjectActionLink({
          href: primaryHref,
          label: primaryLabel,
          variant: primaryVariant
        })
      : '',
    ...externalLinks.map((link) =>
      renderProjectActionLink({
        href: link.href,
        label: link.label,
        variant: 'secondary'
      })
    )
  ].filter(Boolean);
  const searchIndex = [
    item.title,
    item.summary,
    item.category,
    item.role,
    item.focus,
    getProjectStatusLabel(item.status),
    ...(item.stack ?? [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const filterAttributes = filterable
    ? ` data-project-card data-search-index="${escapeHtml(searchIndex)}" data-category="${escapeHtml(normalizeFilterValue(item.category ?? ''))}" data-status="${escapeHtml(normalizeFilterValue(getProjectStatusLabel(item.status)))}"`
    : '';

  return `<article class="project-panel project-card"${filterAttributes}>${previewMedia ? `<div class="project-card__cover"><img src="${resolveStaticAssetPath(previewMedia.src, assetPrefix)}" alt="${escapeHtml(previewMedia.alt || `${item.title ?? '项目'} 预览图`)}"${getImageAttributes({ src: previewMedia.src, loading: 'lazy' })} /></div>` : ''}<div class="project-card__header"><span class="kicker">${item.category ?? item.meta ?? '更新中'}</span>${metaItems ? `<div class="project-card__meta">${metaItems}</div>` : ''}</div><h3>${item.title ?? '阶段记录'}</h3><p>${item.summary ?? item.text ?? item}</p>${facts.length ? `<dl class="project-facts">${facts
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('')}</dl>` : ''}${item.stack?.length ? `<ul class="tag-list">${item.stack.map((tech) => `<li class="tag">${tech}</li>`).join('')}</ul>` : ''}${actionLinks.length ? `<div class="project-actions">${actionLinks.join('')}</div>` : ''}</article>`;
};

const renderProjectDetailPage = (item) => {
  const statusBadge = renderProjectStatusBadge(item.status);
  const facts = [
    ['角色', item.role],
    ['周期', item.timeline],
    ['关注点', item.focus],
    ['当前阶段', getProjectStatusLabel(item.status)]
  ].filter(([, value]) => value);
  const relatedHref = item.href ? resolveLinkHref(item.href, '../../') : null;
  const externalLinks = normalizeProjectExternalLinks(item.externalLinks);
  const detailActions = [
    '<a class="button button-ghost button-small" href="../">返回项目列表</a>',
    relatedHref
      ? renderProjectActionLink({
          href: relatedHref,
          label: item.linkLabel ?? (isExternalLink(relatedHref) ? '访问项目' : '继续查看相关内容'),
          variant: isExternalLink(relatedHref) ? 'secondary' : 'secondary'
        })
      : '',
    ...externalLinks.map((link) =>
      renderProjectActionLink({
        href: link.href,
        label: link.label,
        variant: 'secondary'
      })
    )
  ].filter(Boolean);
  const metaItems = facts
    .map(([label, value]) => (label === '当前阶段' && statusBadge ? statusBadge : `<span class="tag">${value}</span>`))
    .join('');
  const mediaItems = getProjectMedia(item);

  return `
  <section class="page-hero reveal">
    <p class="kicker">项目详情</p>
    <h1>${item.title}</h1>
    <p>${item.summary ?? item.text ?? ''}</p>
    ${statusBadge ? `<div class="page-hero__meta">${statusBadge}</div>` : ''}
    <div class="project-actions project-actions--detail">
      ${detailActions.join('')}
    </div>
  </section>
  <section class="section reveal">
    <div class="split-grid project-detail-grid">
      <article class="project-panel project-detail-card">
        <div class="project-card__header">
          <span class="kicker">${item.category ?? '项目'}</span>
          <div class="project-card__meta">${metaItems}</div>
        </div>
        ${facts.length ? `<dl class="project-facts">${facts
          .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
          .join('')}</dl>` : ''}
        ${item.stack?.length ? `<div><p class="kicker">相关能力</p><ul class="tag-list">${item.stack.map((tech) => `<li class="tag">${tech}</li>`).join('')}</ul></div>` : ''}
      </article>
      <div class="project-detail-main">
        ${mediaItems.length ? `<section class="project-media-stack" aria-label="${escapeHtml(item.title)} 项目截图与演示图"><div class="project-media-heading"><p class="kicker">项目截图 / 演示图</p><h2>先快速看一下这个项目的界面与展示方式。</h2><p class="section-intro">我会优先放能说明结构、节奏或关键流程的预览图，方便在读文字前先建立直觉。</p></div><div class="project-media-grid">${mediaItems.map((media) => renderProjectMediaFigure(media, '../../')).join('')}</div></section>` : ''}
        <div class="card-grid project-detail-sections">
          ${(item.sections ?? [])
            .map((section) => `<article class="panel"><p class="kicker">${item.title}</p><h2>${section.title}</h2><p>${section.text}</p></article>`)
            .join('')}
        </div>
      </div>
    </div>
  </section>`;
};

const renderProjectsPage = (page) => {
  const projects = page.items ?? [];
  const categories = collectUniqueValues(projects, (project) => project.category);
  const statuses = collectUniqueValues(projects, (project) => getProjectStatusLabel(project.status));

  return `<section class="page-hero reveal"><p class="kicker">${page.title}</p><h1>${page.title}</h1><p>${page.intro}</p></section>
    <section class="section reveal" data-project-filter data-project-filter-total="${projects.length}">
      <div class="post-discovery panel">
        <div class="post-discovery__intro">
          <p class="kicker">项目筛选</p>
          <h2>按项目方向、阶段或关键词，快速收窄当前列表。</h2>
          <p class="section-intro">更适合先从一个具体主题切入，再决定要不要打开项目详情继续看。</p>
        </div>
        <label class="search-field" for="project-search-input">
          <span>搜索项目</span>
          <input id="project-search-input" type="search" placeholder="搜索项目名称、摘要、角色或技术栈" autocomplete="off" data-project-filter-input />
        </label>
        <div class="discovery-toolbar">
          <div class="filter-groups">
            <section class="filter-group" aria-label="按项目方向筛选">
              <div class="filter-group__header">
                <span>项目方向</span>
                <small>先按项目主题缩小范围</small>
              </div>
              <div class="filter-chips" data-filter-group="category">
                <button class="filter-chip is-active" type="button" data-filter-option data-filter-group="category" data-filter-value="all" aria-pressed="true">全部方向</button>
                ${categories
                  .map(
                    (category) => `<button class="filter-chip" type="button" data-filter-option data-filter-group="category" data-filter-value="${escapeHtml(normalizeFilterValue(category))}" aria-pressed="false">${category}</button>`
                  )
                  .join('')}
              </div>
            </section>
            <section class="filter-group" aria-label="按项目状态筛选">
              <div class="filter-group__header">
                <span>项目状态</span>
                <small>快速看目前处在哪个阶段</small>
              </div>
              <div class="filter-chips" data-filter-group="status">
                <button class="filter-chip is-active" type="button" data-filter-option data-filter-group="status" data-filter-value="all" aria-pressed="true">全部状态</button>
                ${statuses
                  .map(
                    (status) => `<button class="filter-chip" type="button" data-filter-option data-filter-group="status" data-filter-value="${escapeHtml(normalizeFilterValue(status))}" aria-pressed="false">${status}</button>`
                  )
                  .join('')}
              </div>
            </section>
          </div>
        </div>
        <p class="search-feedback" data-project-filter-feedback>当前共 ${projects.length} 个项目。</p>
      </div>
      <div class="project-grid" data-project-filter-grid>${projects
        .map((item) => renderProjectCard(item, { assetPrefix: '../', filterable: true }))
        .join('')}</div>
      ${renderStateCard({
        tone: 'empty',
        icon: '⌕',
        kicker: '暂无结果',
        title: '没有找到匹配的项目。',
        summary: '当前筛选条件下还没有匹配内容。',
        summaryAttributes: 'data-project-filter-empty-summary',
        tips: ['试试更短的关键词，或者只保留一个筛选条件。', '也可以先清空状态或方向限制，再继续浏览完整列表。'],
        actions: ['<button class="button button-secondary button-small" type="button" data-project-filter-reset>重置搜索与筛选</button>'],
        className: 'empty-state search-empty',
        attributes: 'data-project-filter-empty hidden'
      })}
    </section>`;
};

const renderInfoPage = (pageKey) => {
  const page = pages[pageKey];
  const assetPrefix = pageKey === 'projects' ? '../' : '';

  if (pageKey === 'projects') {
    return renderProjectsPage(page);
  }

  if (pageKey === 'now') {
    return renderNowPage(page);
  }

  const body = page.items
    ? `<section class="page-hero reveal"><p class="kicker">${page.title}</p><h1>${page.title}</h1><p>${page.intro}</p></section>
       <section class="section reveal"><div class="project-grid">${page.items.map((item) => renderProjectCard(item, { assetPrefix })).join('')}</div></section>`
    : `<section class="page-hero reveal"><p class="kicker">${page.title}</p><h1>${page.title}</h1><p>${page.intro}</p></section>
       <section class="section reveal"><div class="card-grid">${page.sections
         .map((section) => `<article class="panel"><h3>${section.title}</h3><p>${section.text}</p></article>`)
         .join('')}</div></section>`;
  return body;
};

const loadPosts = (directoryPath = postsDir) => {
  if (!existsSync(directoryPath)) {
    return [];
  }

  const posts = readdirSync(directoryPath)
    .filter((file) => file.endsWith('.md'))
    .map((fileName) => {
      const raw = readFileSync(path.join(directoryPath, fileName), 'utf8');
      const { meta, body } = parseAndValidateFrontmatter(raw, { fileName });
      validateMarkdownContentQuality(body, { fileName });
      const slug = resolvePostSlug({
        fileName,
        customSlug: meta.slug ?? '',
        hasCustomSlug: Object.prototype.hasOwnProperty.call(meta, 'slug')
      });
      const wordCount = body.replace(/\s+/g, '').length;
      const { html, toc } = markdownToHtml(body);
      const post = {
        sourceFile: fileName,
        slug,
        title: meta.title,
        date: meta.date,
        updated: meta.updated,
        summary: resolvePostSummary(meta.summary, body),
        ogTitle: meta.ogTitle,
        ogDescription: meta.ogDescription,
        ogImage: meta.ogImage,
        tags: meta.tags ?? [],
        category: {
          name: meta.category,
          slug: slugifyCategory(meta.category)
        },
        cover: meta.cover,
        draft: meta.draft ?? false,
        pinned: meta.pinned ?? false,
        template: meta.template ? getContentTemplate(meta.template) : null,
        series: meta.series
          ? {
              name: meta.series,
              slug: slugify(meta.series),
              order: Number.isFinite(meta.seriesOrder) ? meta.seriesOrder : Number.MAX_SAFE_INTEGER
            }
          : null,
        body,
        html,
        toc,
        wordCount,
        readingTime: estimateReadingTime(body)
      };

      return {
        ...post,
        cover: resolvePostCover(post)
      };
    });

  assertUniquePostSlugs(posts);

  return posts
    .filter((post) => !post.draft)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return Number(b.pinned) - Number(a.pinned);
      }

      return new Date(b.date) - new Date(a.date);
    });
};

const getRelatedPosts = (currentPost, posts, limit = 2) => {
  const currentTags = new Set(currentPost.tags);

  return posts
    .filter((post) => post.slug !== currentPost.slug)
    .map((post) => {
      const sharedTags = post.tags.filter((tag) => currentTags.has(tag));
      return {
        ...post,
        sharedTags,
        recommendationReason:
          sharedTags.length > 0 ? `相同话题：${sharedTags.join(' / ')}` : '延伸阅读：最近更新'
      };
    })
    .sort((a, b) => {
      if (b.sharedTags.length !== a.sharedTags.length) {
        return b.sharedTags.length - a.sharedTags.length;
      }

      return new Date(b.date) - new Date(a.date);
    })
    .slice(0, limit);
};

const buildRssFeed = (posts) => {
  const rssPosts = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latestDate = rssPosts.reduce((latest, post) => {
    const candidate = post.updated ?? post.date;
    if (!latest) return candidate;
    return new Date(`${candidate}T00:00:00+08:00`) > new Date(`${latest}T00:00:00+08:00`) ? candidate : latest;
  }, '');
  const feedPath = site.rss?.path ?? '/rss.xml';
  const selfUrl = withBase(feedPath);
  const blogUrl = buildCanonicalUrl(site, '/blog/');
  const itemXml = rssPosts
    .map((post) => {
      const postUrl = buildCanonicalUrl(site, `/blog/${post.slug}/`);
      const categoryNames = [post.category?.name, ...(post.tags ?? [])].filter(Boolean);

      return [
        '    <item>',
        `      <title>${escapeHtml(post.title)}</title>`,
        `      <link>${escapeHtml(postUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeHtml(postUrl)}</guid>`,
        `      <pubDate>${escapeHtml(formatRssDate(post.date))}</pubDate>`,
        `      <description>${escapeHtml(post.summary)}</description>`,
        ...categoryNames.map((name) => `      <category>${escapeHtml(name)}</category>`),
        '    </item>'
      ].join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(site.rss?.title ?? `${site.shortName} RSS`)}</title>
    <link>${escapeHtml(blogUrl)}</link>
    <description>${escapeHtml(site.rss?.description ?? site.description)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${escapeHtml(formatRssDate(latestDate || rssPosts[0]?.date || ''))}</lastBuildDate>
    <atom:link href="${escapeHtml(selfUrl)}" rel="self" type="application/rss+xml" />
${itemXml}
  </channel>
</rss>`;
};

const renderBlogListPage = (posts, tags, categories, seriesList, templates) => `
  <section class="page-hero reveal">
    <p class="kicker">文章</p>
    <h1>写下来的内容，会慢慢变成自己的方法库。</h1>
    <p>现在除了标签、分类与系列，也支持通过 Markdown frontmatter 选择内容模板，让每篇文章从摘要、结构到详情页信息都更稳定。</p>
    <div class="post-list__filters">
      <a class="button button-secondary button-small" href="../rss.xml">RSS 订阅</a>
      ${renderEmailSubscriptionLink({ small: true })}
      <a class="button button-ghost button-small" href="templates/">查看模板</a>
      <a class="button button-ghost button-small" href="archive/">查看归档</a>
    </div>
  </section>
  ${renderPopularPostsSection(posts)}
  <section class="section reveal" data-post-search data-post-search-total="${posts.length}">
    ${getEmailSubscriptionHref()
      ? `<article class="note-card post-subscribe-card">
          <div class="section-heading">
            <p class="kicker">${escapeHtml(site.emailSubscription?.title ?? '邮件订阅')}</p>
            <h2>不想错过新文章，也可以直接用邮箱订阅更新。</h2>
            <p class="section-intro">${escapeHtml(site.emailSubscription?.description ?? '')}</p>
          </div>
          <div class="post-subscribe-card__actions">
            ${renderEmailSubscriptionLink({ variant: 'primary' })}
            <a class="button button-secondary" href="../rss.xml">改用 RSS 订阅</a>
          </div>
          ${site.emailSubscription?.note ? `<p class="muted">${escapeHtml(site.emailSubscription.note)}</p>` : ''}
        </article>`
      : ''}
    <div class="post-discovery panel">
      <div class="post-discovery__intro">
        <p class="kicker">站内搜索</p>
        <h2>按标题、摘要、分类和标签快速查找文章。</h2>
        <p class="section-intro">输入关键词后，列表会即时筛选，适合从一个具体话题直接找到相关内容。</p>
      </div>
      <label class="search-field" for="post-search-input">
        <span>搜索文章</span>
        <input id="post-search-input" type="search" placeholder="搜索标题、摘要、分类或标签" autocomplete="off" data-post-search-input />
      </label>
      <div class="discovery-toolbar">
        <div class="filter-groups">
          <section class="filter-group" aria-label="按标签筛选">
            <div class="filter-group__header">
              <span>标签</span>
              <small>快速按主题收窄文章列表</small>
            </div>
            <div class="filter-chips" data-filter-group="tag">
              <button class="filter-chip is-active" type="button" data-filter-option data-filter-group="tag" data-filter-value="all" aria-pressed="true">全部标签</button>
              ${tags.map((tag) => `<button class="filter-chip" type="button" data-filter-option data-filter-group="tag" data-filter-value="${escapeHtml(tag.name.toLowerCase())}" aria-pressed="false">${tag.name}</button>`).join('')}
            </div>
          </section>
          <section class="filter-group" aria-label="按分类筛选">
            <div class="filter-group__header">
              <span>分类</span>
              <small>先按内容大类筛一轮</small>
            </div>
            <div class="filter-chips" data-filter-group="category">
              <button class="filter-chip is-active" type="button" data-filter-option data-filter-group="category" data-filter-value="all" aria-pressed="true">全部分类</button>
              ${categories.map((category) => `<button class="filter-chip" type="button" data-filter-option data-filter-group="category" data-filter-value="${escapeHtml(category.name.toLowerCase())}" aria-pressed="false">${category.name}</button>`).join('')}
            </div>
          </section>
          <section class="filter-group" aria-label="按模板筛选">
            <div class="filter-group__header">
              <span>模板</span>
              <small>从内容结构角度快速切换浏览方式</small>
            </div>
            <div class="filter-chips" data-filter-group="template">
              <button class="filter-chip is-active" type="button" data-filter-option data-filter-group="template" data-filter-value="all" aria-pressed="true">全部模板</button>
              ${templates
                .filter((template) => template.count > 0)
                .map(
                  (template) => `<button class="filter-chip" type="button" data-filter-option data-filter-group="template" data-filter-value="${escapeHtml(template.key)}" aria-pressed="false">${template.name}</button>`
                )
                .join('')}
            </div>
          </section>
        </div>
        <label class="sort-field" for="post-sort-select">
          <span>排序方式</span>
          <select id="post-sort-select" data-post-sort>
            <option value="date-desc">最新发布</option>
            <option value="date-asc">最早发布</option>
            <option value="updated-desc">最近更新</option>
          </select>
        </label>
      </div>
      <p class="search-feedback" data-post-search-feedback>当前共 ${posts.length} 篇文章。</p>
    </div>
    <div class="post-list__header">
      <div>
        <strong class="post-list__count">共 ${posts.length} 篇文章</strong>
      </div>
      <div class="post-list__filters">
        <a class="button button-ghost button-small" href="tags/">查看全部标签</a>
        <a class="button button-ghost button-small" href="categories/">查看全部分类</a>
        <a class="button button-ghost button-small" href="series/">查看全部系列</a>
        <a class="button button-ghost button-small" href="templates/">查看全部模板</a>
        <a class="button button-ghost button-small" href="archive/">查看归档</a>
        ${tags.slice(0, 2).map((tag) => `<a class="tag tag-link" href="tags/${tag.slug}/">${tag.name}</a>`).join('')}
        ${categories.slice(0, 2).map((category) => `<a class="tag" href="categories/${category.slug}/">${category.name} · ${category.count}</a>`).join('')}
        ${seriesList.slice(0, 2).map((series) => `<a class="tag" href="series/${series.slug}/">系列：${series.name}</a>`).join('')}
        ${templates
          .filter((template) => template.count > 0)
          .slice(0, 2)
          .map((template) => `<a class="tag" href="templates/${template.slug}/">模板：${template.name} · ${template.count}</a>`)
          .join('')}
      </div>
    </div>
    <div class="post-grid" data-post-search-grid>
      ${posts
        .map((post) => {
          const searchIndex = escapeHtml([
            post.title,
            post.summary,
            post.category.name,
            ...(post.tags ?? []),
            post.series?.name ?? '',
            post.template?.name ?? ''
          ].join(' ').toLowerCase());
          const dateValue = new Date(`${post.date}T00:00:00+08:00`).getTime();
          const updatedValue = new Date(`${(post.updated ?? post.date)}T00:00:00+08:00`).getTime();
          return `<article class="post-card" data-post-card data-search-index="${searchIndex}" data-category="${escapeHtml(post.category.name.toLowerCase())}" data-tags="${escapeHtml((post.tags ?? []).map((tag) => tag.toLowerCase()).join('|'))}" data-template="${escapeHtml(post.template?.key ?? '')}" data-date="${dateValue}" data-updated="${updatedValue}"><div class="post-card__cover"><img src="${resolveStaticAssetPath(post.cover, '../')}" alt="${post.title} 的封面插画"${getImageAttributes({ src: post.cover })} /></div>${post.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : ''}${post.series ? `<span class="feature-label feature-label--series">系列 · <a href="series/${post.series.slug}/">${post.series.name}</a></span>` : ''}${renderTemplateBadge({ template: post.template })}<div class="post-card__meta">${renderPostMeta(post)}</div><p class="kicker"><a href="categories/${post.category.slug}/">${post.category.name}</a></p><h2>${post.title}</h2><p>${post.summary}</p>${renderTagLinks(post.tags)}<a class="button button-ghost" href="${post.slug}/">阅读详情</a></article>`;
        })
        .join('')}
    </div>
    ${renderStateCard({
      tone: 'empty',
      icon: '⌕',
      kicker: '暂无结果',
      title: '没有找到匹配的文章。',
      summary: '当前筛选条件下还没有匹配内容。',
      summaryAttributes: 'data-post-search-empty-summary',
      tips: ['试试更短的关键词，或者只保留一个筛选条件。', '也可以先从归档、标签或分类页重新挑一个入口继续浏览。'],
      actions: [
        '<button class="button button-secondary button-small" type="button" data-post-search-reset>重置搜索与筛选</button>',
        '<a class="button button-ghost button-small" href="archive/">查看归档</a>',
        '<a class="button button-ghost button-small" href="tags/">查看标签页</a>'
      ],
      className: 'empty-state search-empty',
      attributes: 'data-post-search-empty hidden'
    })}
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

const renderArchivePage = (posts) => {
  const byYearMonth = posts.reduce((acc, post) => {
    const date = new Date(`${post.date}T00:00:00+08:00`);
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month}`;
    if (!acc[key]) {
      acc[key] = { year, month, posts: [], label: `${year}年${month + 1}月` };
    }
    acc[key].posts.push(post);
    return acc;
  }, {});

  const sortedGroups = Object.values(byYearMonth).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.month - a.month;
  });

  return `
  <section class="page-hero reveal">
    <p class="kicker">文章归档</p>
    <h1>按时间浏览全部文章。</h1>
    <p>这里按月份整理了全部已发布文章，适合按时间线索一路看下来。</p>
    <div class="post-list__filters">
      <a class="button button-ghost button-small" href="../">返回文章列表</a>
    </div>
  </section>
  <section class="section reveal">
    <div class="archive-timeline">
      ${sortedGroups
        .map(
          (group) => `<div class="archive-year"><h2 class="archive-year__label">${group.label}</h2><div class="archive-list">${group.posts
            .map(
              (post) => `<article class="archive-item"><div class="archive-item__date">${formatDate(post.date)}</div><div class="archive-item__content"><h3><a href="../${post.slug}/">${post.title}</a></h3><p>${post.summary}</p></div></article>`
            )
            .join('')}</div></div>`
        )
        .join('')}
    </div>
  </section>`;
};

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
          (post) => `<article class="post-card"><div class="post-card__cover"><img src="${resolveStaticAssetPath(post.cover, '../../')}" alt="${post.title} 的封面插画"${getImageAttributes({ src: post.cover })} /></div>${post.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : ''}<div class="post-card__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><h2>${post.title}</h2><p>${post.summary}</p>${renderTagLinks(post.tags, '../../')}<a class="button button-ghost" href="../../${post.slug}/">阅读详情</a></article>`
        )
        .join('')}
    </div>
  </section>`;

const renderTemplateListPage = (templates) => `
  <section class="page-hero reveal">
    <p class="kicker">内容模板</p>
    <h1>让每篇内容先有稳定骨架，再继续长出自己的语气。</h1>
    <p>模板不是为了把文章写得一样，而是为了让写作起点、结构节奏和复用方式更稳定。这里列出当前站点支持的内容模板，以及它们各自适合承载的内容类型。</p>
    <div class="post-list__filters">
      <a class="button button-secondary button-small" href="../">返回文章列表</a>
      <a class="button button-ghost button-small" href="../archive/">查看归档</a>
    </div>
  </section>
  <section class="section reveal">
    <div class="tag-directory template-directory">
      ${templates
        .map(
          (template) => `<article class="panel tag-directory__card template-directory__card"><div class="template-directory__header"><div><p class="kicker">${template.count > 0 ? `已使用 ${template.count} 篇` : '模板已就绪'}</p><h2>${template.name}</h2></div><span class="status-badge"><span class="status-badge__dot" aria-hidden="true"></span>${template.count > 0 ? '可直接使用' : '等待内容接入'}</span></div><p>${template.description}</p><div class="template-directory__meta"><div><strong>适合场景</strong><p>${template.recommendedFor.join(' / ')}</p></div><div><strong>建议结构</strong><ol class="template-outline-list">${template.outline.map((item) => `<li>${item}</li>`).join('')}</ol></div><div><strong>模板说明</strong><p>${template.summary}</p></div></div><div class="post-list__filters">${template.count > 0 ? `<a class="button button-ghost button-small" href="${template.slug}/">查看模板下的文章</a>` : ''}${template.latestPost ? `<a class="tag" href="../${template.latestPost.slug}/">最近一篇：${template.latestPost.title}</a>` : '<span class="tag">还没有文章使用这个模板</span>'}</div></article>`
        )
        .join('')}
    </div>
  </section>`;

const renderTemplateDetailPage = (template) => `
  <section class="page-hero reveal">
    <p class="kicker">内容模板</p>
    <h1>${template.name}</h1>
    <p>${template.description} 当前已有 ${template.count} 篇文章在使用这个模板。</p>
    <div class="post-list__filters">
      <a class="button button-ghost button-small" href="../">返回模板页</a>
      <a class="button button-secondary button-small" href="../../">返回文章列表</a>
    </div>
  </section>
  <section class="section reveal">
    <div class="split-grid split-grid--template">
      <article class="panel template-detail-card">
        <h2>适合场景</h2>
        <p>${template.recommendedFor.join(' / ')}</p>
        <h2>推荐结构</h2>
        <ol class="template-outline-list">
          ${template.outline.map((item) => `<li>${item}</li>`).join('')}
        </ol>
        <h2>模板说明</h2>
        <p>${template.summary}</p>
      </article>
      <article class="panel template-detail-card">
        <h2>当前模板下的文章</h2>
        ${template.posts.length
          ? `<div class="post-grid">${template.posts
              .map(
                (post) => `<article class="post-card"><div class="post-card__cover"><img src="${resolveStaticAssetPath(post.cover, '../../')}" alt="${post.title} 的封面插画"${getImageAttributes({ src: post.cover })} /></div>${post.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : ''}${post.series ? `<span class="feature-label feature-label--series">系列 · <a href="../../series/${post.series.slug}/">${post.series.name}</a></span>` : ''}<div class="post-card__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><p class="kicker"><a href="../../categories/${post.category.slug}/">${post.category.name}</a></p><h3>${post.title}</h3><p>${post.summary}</p>${renderTagLinks(post.tags, '../../')}<a class="button button-ghost" href="../../${post.slug}/">阅读详情</a></article>`
              )
              .join('')}</div>`
          : renderStateCard({
              tone: 'quiet',
              icon: '△',
              kicker: '还没有内容',
              title: '这个模板已经就绪，但还没有文章使用。',
              summary: '后续只要在 Markdown frontmatter 里声明对应 template，就会自动进入这里。',
              compact: true
            })}
      </article>
    </div>
  </section>`;

const renderSeriesListPage = (seriesList) => `
  <section class="page-hero reveal">
    <p class="kicker">文章系列</p>
    <h1>按系列连续阅读。</h1>
    <p>适合查看同一主题下按顺序组织的文章。每个系列都包含明确顺序，方便从起点一路读到末尾。</p>
  </section>
  <section class="section reveal">
    <div class="post-list__header">
      <div>
        <strong class="post-list__count">共 ${seriesList.length} 个系列</strong>
      </div>
      <div class="post-list__filters">
        <a class="button button-ghost button-small" href="../">返回文章列表</a>
      </div>
    </div>
    <div class="card-grid">
      ${seriesList
        .map(
          (series) => `<article class="panel"><p class="kicker">${series.posts.length} 篇文章</p><h2>${series.name}</h2><p>${series.description}</p><ul class="list-card">${series.posts.map((post) => `<li><span class="muted">第 ${post.series.order} 篇</span><br /><a class="text-link" href="../${post.slug}/">${post.title}</a></li>`).join('')}</ul><a class="button button-ghost" href="${series.slug}/">查看系列</a></article>`
        )
        .join('')}
    </div>
  </section>`;

const renderSeriesDetailPage = (series) => `
  <section class="page-hero reveal">
    <p class="kicker">文章系列</p>
    <h1>${series.name}</h1>
    <p>${series.description}</p>
    <div class="post-list__filters">
      <a class="button button-ghost button-small" href="../">返回系列页</a>
      <a class="button button-secondary button-small" href="../../">返回文章列表</a>
    </div>
  </section>
  <section class="section reveal">
    <div class="series-outline">
      ${series.posts
        .map(
          (post, index) => `<article class="panel series-outline__item"><p class="kicker">第 ${index + 1} 篇</p><h2>${post.title}</h2><p>${post.summary}</p><div class="post-card__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><a class="button button-ghost" href="../../${post.slug}/">阅读本篇</a></article>`
        )
        .join('')}
    </div>
  </section>`;

const renderSeriesBlock = (post, series) => {
  if (!series) return '';

  const currentIndex = series.posts.findIndex((item) => item.slug === post.slug);
  return `<div class="note-card"><h3>所在系列</h3><p><a class="text-link" href="../series/${series.slug}/">${series.name}</a> · 共 ${series.posts.length} 篇，当前第 ${currentIndex + 1} 篇。</p><ol class="series-list">${series.posts
    .map(
      (item, index) => `<li class="${item.slug === post.slug ? 'is-current' : ''}"><span class="series-list__index">${index + 1}</span><div><a class="text-link" href="../${item.slug}/">${item.title}</a><p class="muted">${item.summary}</p></div></li>`
    )
    .join('')}</ol></div>`;
};

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
          (post) => `<article class="post-card"><div class="post-card__cover"><img src="${resolveStaticAssetPath(post.cover, '../../../')}" alt="${post.title} 的封面插画"${getImageAttributes({ src: post.cover })} /></div>${post.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : ''}<div class="post-card__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><h2>${post.title}</h2><p>${post.summary}</p>${renderTagLinks(post.tags, '../../')}<a class="button button-ghost" href="../../${post.slug}/">阅读详情</a></article>`
        )
        .join('')}
    </div>
  </section>`;

const buildPostShareLinks = (post) => {
  const canonical = buildCanonicalUrl(site, `/blog/${post.slug}/`);
  const title = `${post.title}｜${site.shortName}`;
  const encodedCanonical = encodeURIComponent(canonical);
  const encodedTitle = encodeURIComponent(title);
  const encodedSummary = encodeURIComponent(post.summary);
  const mailBody = encodeURIComponent(`推荐你读这篇文章：${post.title}\n\n${post.summary}\n\n阅读链接：${canonical}`);

  return {
    canonical,
    title,
    weibo: `https://service.weibo.com/share/share.php?url=${encodedCanonical}&title=${encodedTitle}%20${encodedSummary}`,
    x: `https://twitter.com/intent/tweet?url=${encodedCanonical}&text=${encodedTitle}`,
    mail: `mailto:?subject=${encodedTitle}&body=${mailBody}`
  };
};

const renderPostShareCard = (post) => {
  const shareLinks = buildPostShareLinks(post);

  return `<div class="note-card"><h3>分享这篇文章</h3><p>如果这篇内容对你有帮助，可以直接复制链接，或者转发到常用社交平台。</p><div class="post-share-actions" data-post-share data-share-title="${escapeHtml(post.title)}" data-share-text="${escapeHtml(shareLinks.title)}" data-share-url="${escapeHtml(shareLinks.canonical)}"><button class="button button-secondary button-small" type="button" data-share-native>系统分享</button><button class="button button-ghost button-small" type="button" data-share-copy>复制链接</button><a class="button button-ghost button-small" href="${escapeHtml(shareLinks.weibo)}" target="_blank" rel="noreferrer">分享到微博</a><a class="button button-ghost button-small" href="${escapeHtml(shareLinks.x)}" target="_blank" rel="noreferrer">分享到 X</a><a class="button button-ghost button-small" href="${escapeHtml(shareLinks.mail)}">邮件分享</a></div><p class="muted post-share-feedback" data-share-feedback role="status" aria-live="polite">也可以把链接直接发到聊天窗口。</p></div>`;
};

const renderPostNavigation = (navigationPosts) => {
  const items = [
    navigationPosts.previous
      ? `<a class="post-nav-card" href="../${navigationPosts.previous.slug}/"><span class="kicker">上一篇</span><strong>${navigationPosts.previous.title}</strong><small>${navigationPosts.previous.summary}</small></a>`
      : renderStateCard({
          tone: 'quiet',
          icon: '←',
          kicker: '上一篇',
          title: '已经是第一篇',
          titleTag: 'strong',
          summary: '这里已经没有更早的内容了，可以回到文章列表继续挑一篇。',
          actions: ['<a class="text-link" href="../">返回文章列表</a>'],
          className: 'post-nav-card post-nav-card--empty',
          compact: true
        }),
    navigationPosts.next
      ? `<a class="post-nav-card" href="../${navigationPosts.next.slug}/"><span class="kicker">下一篇</span><strong>${navigationPosts.next.title}</strong><small>${navigationPosts.next.summary}</small></a>`
      : renderStateCard({
          tone: 'quiet',
          icon: '→',
          kicker: '下一篇',
          title: '已经是最后一篇',
          titleTag: 'strong',
          summary: '当前已经没有更后面的文章了，可以去看看项目页或返回文章列表。',
          actions: ['<a class="text-link" href="../">返回文章列表</a>', '<a class="text-link" href="../../projects/">看看项目页</a>'],
          className: 'post-nav-card post-nav-card--empty',
          compact: true
        })
  ];

  return `<nav class="post-pagination reveal" aria-label="文章上一篇和下一篇导航">${items.join('')}</nav>`;
};

const renderPostPage = (post, relatedPosts, navigationPosts, series) => `
  <article class="post-detail" data-reading-progress-target>
    <section class="post-header reveal">
      <p class="kicker">文章详情</p>
      ${post.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : ''}
      <h1>${post.title}</h1>
      <div class="post-header__meta">${renderPostMeta(post)}</div>
      <p>${post.summary}</p>
      <ul class="tag-list"><li class="tag"><a href="../categories/${post.category.slug}/">${post.category.name}</a></li>${post.series ? `<li class="tag"><a href="../series/${post.series.slug}/">系列 · ${post.series.name}</a></li>` : ''}${post.template ? `<li class="tag"><a href="../templates/${post.template.slug}/">模板 · ${post.template.name}</a></li>` : ''}${post.tags.map((tag) => `<li><a class="tag tag-link" href="../tags/${slugifyTag(tag)}/">${tag}</a></li>`).join('')}</ul>
    </section>
    <section class="post-layout reveal">
      <article>
        <div class="post-cover"><img src="${resolveStaticAssetPath(post.cover, '../../')}" alt="${post.title} 的配图"${getImageAttributes({ src: post.cover, fetchpriority: 'high' })} /></div>
        <div class="prose panel">${post.html}</div>
        ${renderPostNavigation(navigationPosts)}
      </article>
      <aside class="post-aside">
        ${post.toc.length
          ? `<div class="note-card toc-card"><h3>文章目录</h3><nav class="toc-nav" aria-label="文章目录"><ol class="toc-list">${post.toc
              .map(
                (item) => `<li class="toc-item toc-item--level-${item.level}"><a href="#${item.id}">${item.text}</a></li>`
              )
              .join('')}</ol></nav></div>`
          : ''}
        ${renderSeriesBlock(post, series)}
        ${renderTemplateNoteCard({ template: post.template })}
        <div class="note-card">
          <h3>文章信息</h3>
          <div class="meta-row"><span>发布时间</span><span>${formatDate(post.date)}</span></div>
          ${post.updated ? `<div class="meta-row"><span>更新时间</span><span>${formatDate(post.updated)}</span></div>` : ''}
          <div class="meta-row"><span>阅读信息</span><span>${post.readingTime} · ${formatWordCount(post.wordCount)}</span></div>
          ${renderPostPageAnalytics()}
          <div class="meta-row"><span>分类</span><span><a class="text-link" href="../categories/${post.category.slug}/">${post.category.name}</a></span></div>
          ${post.template ? `<div class="meta-row"><span>模板</span><span><a class="text-link" href="../templates/${post.template.slug}/">${post.template.name}</a></span></div>` : ''}
          <div class="meta-row meta-row--stack"><span>标签</span><span class="meta-tags">${renderTagLinks(post.tags, '../')}</span></div>
        </div>
        ${renderPostShareCard(post)}
        ${renderFeedbackEntry({
          title: '对这篇文章有想法？',
          description: '如果你发现勘误、想继续追问某个细节，或者希望我展开写某个相关主题，可以直接从这里留言。',
          note: '邮件会自动带上当前文章标题和链接，方便我回看上下文。',
          pageTitle: post.title,
          pageUrl: buildCanonicalUrl(site, `/blog/${post.slug}/`)
        })}
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
              .map(
                (item) => `<li><a class="text-link" href="../${item.slug}/">${item.title}</a><br /><span class="muted">${item.recommendationReason}</span><br /><span class="muted">${item.summary}</span></li>`
              )
              .join('')}
          </ul>
        </div>
      </aside>
    </section>
  </article>`;


const collectSeries = (posts) =>
  Array.from(
    posts.reduce((map, post) => {
      if (!post.series) return map;
      const existing = map.get(post.series.slug) ?? {
        ...post.series,
        posts: []
      };
      existing.posts.push(post);
      map.set(post.series.slug, existing);
      return map;
    }, new Map()).values()
  )
    .map((series) => ({
      ...series,
      posts: series.posts.sort((a, b) => a.series.order - b.series.order || new Date(a.date) - new Date(b.date)),
      description: `按顺序阅读 “${series.name}” 主题下的 ${series.posts.length} 篇文章。`
    }))
    .sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name, 'zh-CN'));

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

const collectTemplates = (posts) =>
  contentTemplates
    .map((template) => ({
      ...template,
      posts: posts.filter((post) => post.template?.key === template.key),
      count: posts.filter((post) => post.template?.key === template.key).length
    }))
    .map((template) => ({
      ...template,
      latestPost: template.posts[0] ?? null
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));

const render404 = (posts = []) => {
  const suggestedRoutes = [
    {
      label: '首页总览',
      href: './',
      note: '回到站点总览，重新选择要继续看的入口。'
    },
    {
      label: '文章列表',
      href: './blog/',
      note: '支持按标题、摘要、分类和标签快速筛选内容。'
    },
    {
      label: '项目页',
      href: './projects/',
      note: '适合先看正在持续迭代的主题和案例方向。'
    },
    {
      label: '近况页',
      href: './now/',
      note: '快速了解最近在推进什么，以及站点目前的更新重点。'
    }
  ];
  const recentPosts = posts.slice(0, 3);

  return `
  <section class="page-hero reveal">
    <p class="kicker">404</p>
    <h1>这个页面暂时不存在。</h1>
    <p>可能是链接写错了，或者这部分内容还没有发布。</p>
    ${renderStateCard({
      tone: 'error',
      icon: '404',
      kicker: '错误提示',
      title: '没有找到你要访问的页面。',
      summary: '可以先回到首页、文章页或项目页继续浏览，也可以直接从最近更新的内容重新进入。',
      tips: [
        '如果你是从旧链接跳转过来的，建议重新从导航或目录页进入对应内容。',
        '文章列表页支持关键词、分类和标签筛选，适合重新定位一篇文章。'
      ],
      actions: [
        '<a class="button button-primary button-small" href="./index.html">返回首页</a>',
        '<a class="button button-secondary button-small" href="./blog/">查看文章</a>',
        '<a class="button button-ghost button-small" href="./projects/">查看项目</a>'
      ]
    })}
  </section>
  <section class="section reveal">
    <div class="section-heading">
      <p class="kicker">继续浏览</p>
      <h2>先回到稳定入口，再重新定位你想看的内容。</h2>
      <p class="section-intro">如果你是从旧链接、收藏夹或搜索结果进来的，优先回到目录页会更快找到正确路径。</p>
    </div>
    <div class="nav-guide-grid">
      <article class="panel nav-guide-card">
        <h3>常用入口</h3>
        <ul class="nav-guide-list">
          ${suggestedRoutes
            .map(
              (item) => `<li><a class="nav-guide-link" href="${item.href}"><strong>${item.label}</strong><span>${item.note}</span></a></li>`
            )
            .join('')}
        </ul>
      </article>
      <article class="panel nav-guide-card">
        <h3>你也可以这样排查</h3>
        <ul class="nav-guide-list">
          <li><a class="nav-guide-link" href="./blog/"><strong>先去文章列表搜索标题或标签</strong><span>文章页支持按关键词、分类和标签筛选，适合重新找回一篇内容。</span></a></li>
          <li><a class="nav-guide-link" href="./projects/"><strong>从项目页重新进入案例详情</strong><span>如果你记得主题但不记得具体链接，先看项目目录通常更稳妥。</span></a></li>
          <li><a class="nav-guide-link" href="mailto:alex@example.com"><strong>仍然找不到？可以直接联系我</strong><span>如果这是我刚分享给你的内容，可能只是链接已调整或页面还在整理。</span></a></li>
        </ul>
      </article>
    </div>
  </section>
  ${recentPosts.length
    ? `<section class="section reveal">
        <div class="section-heading">
          <p class="kicker">最近更新</p>
          <h2>如果你只是想继续浏览，可以先读这几篇。</h2>
          <p class="section-intro">这里放最近可直接打开的文章入口，避免停在 404 页面上没有下一步。</p>
        </div>
        <div class="card-grid">
          ${recentPosts
            .map(
              (post) => `<article class="post-card post-card--compact"><div class="post-card__meta">${renderPostMeta(post)}</div><p class="kicker"><a href="./blog/categories/${post.category.slug}/">${post.category.name}</a></p><h3>${post.title}</h3><p>${post.summary}</p>${renderTagLinks(post.tags, './blog/')}<a class="text-link" href="./blog/${post.slug}/">继续阅读 →</a></article>`
            )
            .join('')}
        </div>
      </section>`
    : ''}`;
};

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

registerImagesFromDirectory(assetsDir, '/assets');
registerImagesFromDirectory(publicDir, '/');

ensureDir(outDir);
ensureDir(path.join(outDir, 'assets'));
emitStaticAsset(path.join(rootDir, 'styles.css'), outDir);
emitStaticAsset(path.join(rootDir, 'script.js'), outDir);
emitStaticAsset(path.join(rootDir, 'enhancements.js'), outDir);

for (const file of readdirSync(assetsDir)) {
  emitStaticAsset(path.join(assetsDir, file), path.join(outDir, 'assets'), '/assets');
}

for (const file of readdirSync(publicDir)) {
  emitStaticAsset(path.join(publicDir, file), outDir);
}

const posts = await attachPopularityMetrics(loadPosts());
const postsEn = loadPosts(postsEnDir).map(normalizeEnglishPost);
postsEn.forEach((post) => registerLanguagePair(`/blog/${post.slug}/`, `/en/blog/${post.slug}/`));
const tags = Array.from(new Map(posts.flatMap((post) => post.tags.map((tag) => [tag, tag]))).values())
  .sort((a, b) => a.localeCompare(b, 'zh-CN'))
  .map((tag) => ({
    name: tag,
    slug: slugifyTag(tag),
    posts: posts.filter((post) => post.tags.includes(tag))
  }));
const categories = collectCategories(posts);
const seriesList = collectSeries(posts);
const templates = collectTemplates(posts);

writeText(
  path.join(outDir, 'index.html'),
  renderLayout({
    title: site.seo?.home?.title ?? site.title,
    description: site.seo?.home?.description ?? site.description,
    currentPath: '/',
    outputPath: path.join(outDir, 'index.html'),
    body: renderHomePage(posts),
    mainEntityId: personSchemaId,
    languageSwitch: getLanguageSwitch('/', 'zh'),
    alternateLinks: createAlternateLinks('/', '/en/')
  })
);

for (const [key, page] of Object.entries(pages).filter(([key]) => key !== 'blog')) {
  writeText(
    path.join(outDir, key, 'index.html'),
    renderLayout({
      title: page.seo?.title ?? formatMetaTitle(page.title, site.shortName),
      description: page.seo?.description ?? page.description,
      currentPath: `/${key}/`,
      outputPath: path.join(outDir, key, 'index.html'),
      body: renderInfoPage(key),
      pageType: key === 'about' ? 'AboutPage' : key === 'projects' ? 'CollectionPage' : 'WebPage',
      breadcrumbs: createBreadcrumbs([
        { name: '首页', path: '/' },
        { name: page.title, path: `/${key}/` }
      ]),
      structuredData:
        key === 'projects'
          ? [
              buildCollectionListStructuredData(
                '/projects/',
                (page.items ?? []).filter((item) => item.slug),
                (item) => ({
                  type: 'CreativeWork',
                  name: item.title,
                  url: buildCanonicalUrl(site, `/projects/${item.slug}/`),
                  description: item.summary
                })
              )
            ]
          : [],
      mainEntityId: key === 'about' ? personSchemaId : '',
      languageSwitch: getLanguageSwitch(`/${key}/`, 'zh'),
      alternateLinks: createAlternateLinks(`/${key}/`, `/en/${key}/`)
    })
  );
}

for (const project of pages.projects.items ?? []) {
  if (!project.slug) continue;
  writeText(
    path.join(outDir, 'projects', project.slug, 'index.html'),
    renderLayout({
      title: project.seo?.title ?? formatMetaTitle(project.title, '项目详情', site.shortName),
      description: project.seo?.description ?? project.summary ?? pages.projects.seo?.description ?? pages.projects.description,
      currentPath: `/projects/${project.slug}/`,
      outputPath: path.join(outDir, 'projects', project.slug, 'index.html'),
      body: renderProjectDetailPage(project),
      image: getProjectPrimaryMedia(project)?.src ?? '/assets/illustration-wave.svg',
      breadcrumbs: createBreadcrumbs([
        { name: '首页', path: '/' },
        { name: '项目', path: '/projects/' },
        { name: project.title, path: `/projects/${project.slug}/` }
      ]),
      structuredData: [buildProjectStructuredData({ project, canonical: buildCanonicalUrl(site, `/projects/${project.slug}/`) })],
      mainEntityId: `${buildCanonicalUrl(site, `/projects/${project.slug}/`)}#project`
    })
  );
}

writeText(
  path.join(outDir, 'blog', 'index.html'),
  renderLayout({
    title: pages.blog.seo?.title ?? site.seo?.blog?.title ?? formatMetaTitle('文章', site.shortName),
    description:
      pages.blog.seo?.description ??
      `沈晨玙的博客文章列表，当前收录 ${posts.length} 篇文章，覆盖产品、设计、前端体验与内容系统。`,
    currentPath: '/blog/',
    outputPath: path.join(outDir, 'blog', 'index.html'),
    body: renderBlogListPage(posts, tags, categories, seriesList, templates),
    image: posts[0]?.cover ?? '/assets/illustration-wave.svg',
    pageType: 'CollectionPage',
    breadcrumbs: createBreadcrumbs([
      { name: '首页', path: '/' },
      { name: '文章', path: '/blog/' }
    ]),
    structuredData: [buildPostListStructuredData('/blog/', posts)],
    languageSwitch: getLanguageSwitch('/blog/', 'zh'),
    alternateLinks: createAlternateLinks('/blog/', '/en/blog/')
  })
);

writeText(
  path.join(outDir, 'blog', 'tags', 'index.html'),
  renderLayout({
    title: site.seo?.tags?.title ?? formatMetaTitle('文章标签', site.shortName),
    description: site.seo?.tags?.description ?? `按标签浏览 ${tags.length} 个主题下的 ${posts.length} 篇文章归档。`,
    currentPath: '/blog/tags/',
    outputPath: path.join(outDir, 'blog', 'tags', 'index.html'),
    body: renderTagListPage(tags),
    image: posts[0]?.cover ?? '/assets/illustration-wave.svg',
    pageType: 'CollectionPage',
    breadcrumbs: createBreadcrumbs([
      { name: '首页', path: '/' },
      { name: '文章', path: '/blog/' },
      { name: '标签', path: '/blog/tags/' }
    ]),
    structuredData: [
      buildCollectionListStructuredData('/blog/tags/', tags, (tag) => ({
        type: 'CollectionPage',
        name: tag.name,
        url: buildCanonicalUrl(site, `/blog/tags/${tag.slug}/`),
        description: `标签“${tag.name}”下共 ${tag.posts.length} 篇文章。`
      }))
    ]
  })
);

for (const tag of tags) {
  writeText(
    path.join(outDir, 'blog', 'tags', tag.slug, 'index.html'),
    renderLayout({
      title: formatMetaTitle(`标签：${tag.name}`, '博客文章', site.shortName),
      description: `浏览标签“${tag.name}”下的 ${tag.posts.length} 篇文章，查看我围绕「${tag.name}」主题的持续写作。`,
      currentPath: `/blog/tags/${tag.slug}/`,
      outputPath: path.join(outDir, 'blog', 'tags', tag.slug, 'index.html'),
      body: renderTagDetailPage(tag),
      image: tag.posts[0]?.cover ?? '/assets/illustration-wave.svg',
      pageType: 'CollectionPage',
      breadcrumbs: createBreadcrumbs([
        { name: '首页', path: '/' },
        { name: '文章', path: '/blog/' },
        { name: '标签', path: '/blog/tags/' },
        { name: tag.name, path: `/blog/tags/${tag.slug}/` }
      ]),
      structuredData: [buildPostListStructuredData(`/blog/tags/${tag.slug}/`, tag.posts)]
    })
  );
}

writeText(
  path.join(outDir, 'blog', 'series', 'index.html'),
  renderLayout({
    title: site.seo?.series?.title ?? formatMetaTitle('文章系列', site.shortName),
    description: site.seo?.series?.description ?? `按系列顺序浏览 ${seriesList.length} 个文章主题。`,
    currentPath: '/blog/series/',
    outputPath: path.join(outDir, 'blog', 'series', 'index.html'),
    body: renderSeriesListPage(seriesList),
    pageType: 'CollectionPage',
    breadcrumbs: createBreadcrumbs([
      { name: '首页', path: '/' },
      { name: '文章', path: '/blog/' },
      { name: '系列', path: '/blog/series/' }
    ]),
    structuredData: [
      buildCollectionListStructuredData('/blog/series/', seriesList, (series) => ({
        type: 'CollectionPage',
        name: series.name,
        url: buildCanonicalUrl(site, `/blog/series/${series.slug}/`),
        description: series.description
      }))
    ]
  })
);

for (const series of seriesList) {
  writeText(
    path.join(outDir, 'blog', 'series', series.slug, 'index.html'),
    renderLayout({
      title: formatMetaTitle(`系列：${series.name}`, '博客文章', site.shortName),
      description: series.description,
      currentPath: `/blog/series/${series.slug}/`,
      outputPath: path.join(outDir, 'blog', 'series', series.slug, 'index.html'),
      body: renderSeriesDetailPage(series),
      image: series.posts[0]?.cover ?? '/assets/illustration-wave.svg',
      pageType: 'CollectionPage',
      breadcrumbs: createBreadcrumbs([
        { name: '首页', path: '/' },
        { name: '文章', path: '/blog/' },
        { name: '系列', path: '/blog/series/' },
        { name: series.name, path: `/blog/series/${series.slug}/` }
      ]),
      structuredData: [buildPostListStructuredData(`/blog/series/${series.slug}/`, series.posts)]
    })
  );
}

writeText(
  path.join(outDir, 'blog', 'templates', 'index.html'),
  renderLayout({
    title: site.seo?.templates?.title ?? formatMetaTitle('内容模板', site.shortName),
    description: site.seo?.templates?.description ?? `查看当前站点支持的 ${templates.length} 个内容模板，以及每种模板对应的文章入口。`,
    currentPath: '/blog/templates/',
    outputPath: path.join(outDir, 'blog', 'templates', 'index.html'),
    body: renderTemplateListPage(templates),
    image: posts[0]?.cover ?? '/assets/illustration-wave.svg',
    pageType: 'CollectionPage',
    breadcrumbs: createBreadcrumbs([
      { name: '首页', path: '/' },
      { name: '文章', path: '/blog/' },
      { name: '模板', path: '/blog/templates/' }
    ]),
    structuredData: [
      buildCollectionListStructuredData('/blog/templates/', templates, (template) => ({
        type: 'CollectionPage',
        name: template.name,
        url: buildCanonicalUrl(site, `/blog/templates/${template.slug}/`),
        description: template.description
      }))
    ]
  })
);

for (const template of templates) {
  writeText(
    path.join(outDir, 'blog', 'templates', template.slug, 'index.html'),
    renderLayout({
      title: formatMetaTitle(`模板：${template.name}`, '博客文章', site.shortName),
      description: `${template.description} 当前已有 ${template.count} 篇文章使用这个模板。`,
      currentPath: `/blog/templates/${template.slug}/`,
      outputPath: path.join(outDir, 'blog', 'templates', template.slug, 'index.html'),
      body: renderTemplateDetailPage(template),
      image: template.latestPost?.cover ?? '/assets/illustration-wave.svg',
      pageType: 'CollectionPage',
      breadcrumbs: createBreadcrumbs([
        { name: '首页', path: '/' },
        { name: '文章', path: '/blog/' },
        { name: '模板', path: '/blog/templates/' },
        { name: template.name, path: `/blog/templates/${template.slug}/` }
      ]),
      structuredData: [buildPostListStructuredData(`/blog/templates/${template.slug}/`, template.posts)]
    })
  );
}

writeText(
  path.join(outDir, 'blog', 'categories', 'index.html'),
  renderLayout({
    title: site.seo?.categories?.title ?? formatMetaTitle('文章分类', site.shortName),
    description: site.seo?.categories?.description ?? `按 ${categories.length} 个分类浏览 ${posts.length} 篇博客文章。`,
    currentPath: '/blog/categories/',
    outputPath: path.join(outDir, 'blog', 'categories', 'index.html'),
    body: renderCategoryListPage(categories),
    pageType: 'CollectionPage',
    breadcrumbs: createBreadcrumbs([
      { name: '首页', path: '/' },
      { name: '文章', path: '/blog/' },
      { name: '分类', path: '/blog/categories/' }
    ]),
    structuredData: [
      buildCollectionListStructuredData('/blog/categories/', categories, (category) => ({
        type: 'CollectionPage',
        name: category.name,
        url: buildCanonicalUrl(site, `/blog/categories/${category.slug}/`),
        description: `分类“${category.name}”下共 ${category.posts.length} 篇文章。`
      }))
    ]
  })
);

writeText(
  path.join(outDir, 'blog', 'archive', 'index.html'),
  renderLayout({
    title: site.seo?.archive?.title ?? formatMetaTitle('文章归档', site.shortName),
    description: site.seo?.archive?.description ?? `按时间顺序归档浏览全部 ${posts.length} 篇博客文章。`,
    currentPath: '/blog/archive/',
    outputPath: path.join(outDir, 'blog', 'archive', 'index.html'),
    body: renderArchivePage(posts),
    image: posts[0]?.cover ?? '/assets/illustration-wave.svg',
    pageType: 'CollectionPage',
    breadcrumbs: createBreadcrumbs([
      { name: '首页', path: '/' },
      { name: '文章', path: '/blog/' },
      { name: '归档', path: '/blog/archive/' }
    ]),
    structuredData: [buildPostListStructuredData('/blog/archive/', posts)]
  })
);

for (const category of categories) {
  writeText(
    path.join(outDir, 'blog', 'categories', category.slug, 'index.html'),
    renderLayout({
      title: formatMetaTitle(`分类：${category.name}`, '博客文章', site.shortName),
      description: `浏览「${category.name}」分类下的 ${category.posts.length} 篇文章，查看这一主题方向的全部归档。`,
      currentPath: `/blog/categories/${category.slug}/`,
      outputPath: path.join(outDir, 'blog', 'categories', category.slug, 'index.html'),
      body: renderCategoryPage(category, category.posts),
      image: category.latestPost?.cover ?? '/assets/illustration-wave.svg',
      pageType: 'CollectionPage',
      breadcrumbs: createBreadcrumbs([
        { name: '首页', path: '/' },
        { name: '文章', path: '/blog/' },
        { name: '分类', path: '/blog/categories/' },
        { name: category.name, path: `/blog/categories/${category.slug}/` }
      ]),
      structuredData: [buildPostListStructuredData(`/blog/categories/${category.slug}/`, category.posts)]
    })
  );
}

for (const [index, post] of posts.entries()) {
  const relatedPosts = getRelatedPosts(post, posts);
  const series = post.series ? seriesList.find((item) => item.slug === post.series.slug) ?? null : null;
  const navigationPosts = {
    previous: posts[index - 1] ?? null,
    next: posts[index + 1] ?? null
  };

  writeText(
    path.join(outDir, 'blog', post.slug, 'index.html'),
    renderLayout({
      title: formatMetaTitle(post.title, '博客文章', site.shortName),
      description: post.summary,
      currentPath: `/blog/${post.slug}/`,
      outputPath: path.join(outDir, 'blog', post.slug, 'index.html'),
      body: renderPostPage(post, relatedPosts, navigationPosts, series),
      image: post.cover,
      breadcrumbs: createBreadcrumbs([
        { name: '首页', path: '/' },
        { name: '文章', path: '/blog/' },
        { name: post.title, path: `/blog/${post.slug}/` }
      ]),
      structuredData: [buildBlogPostingStructuredData({ post, canonical: buildCanonicalUrl(site, `/blog/${post.slug}/`) })],
      mainEntityId: `${buildCanonicalUrl(site, `/blog/${post.slug}/`)}#article`,
      openGraph: {
        title: post.ogTitle ?? post.title,
        description: post.ogDescription ?? post.summary,
        image: post.ogImage ?? post.cover,
        imageAlt: `${post.title} 的文章封面图`,
        type: 'article',
        article: {
          publishedTime: toIsoDateTime(post.date),
          modifiedTime: toIsoDateTime(post.updated ?? post.date),
          section: post.category.name,
          tags: post.tags
        }
      },
      languageSwitch: englishRouteMap.has(`/blog/${post.slug}/`) ? getLanguageSwitch(`/blog/${post.slug}/`, 'zh') : null,
      alternateLinks: englishRouteMap.has(`/blog/${post.slug}/`)
        ? createAlternateLinks(`/blog/${post.slug}/`, `/en/blog/${post.slug}/`)
        : []
    })
  );
}

writeText(
  path.join(outDir, 'en', 'index.html'),
  renderLayout({
    title: siteEn.seo?.home?.title ?? siteEn.title,
    description: siteEn.seo?.home?.description ?? siteEn.description,
    currentPath: '/en/',
    outputPath: path.join(outDir, 'en', 'index.html'),
    body: renderEnglishHomePage(postsEn),
    image: postsEn[0]?.cover ?? site.brand.ogImage,
    siteConfig: siteEn,
    uiText: enUi,
    documentLang: 'en',
    includeDefaultStructuredData: false,
    languageSwitch: getLanguageSwitch('/en/', 'en'),
    alternateLinks: createAlternateLinks('/', '/en/')
  })
);

for (const pageKey of ['about', 'projects', 'now']) {
  const page = siteEn.pages[pageKey];
  writeText(
    path.join(outDir, 'en', pageKey, 'index.html'),
    renderLayout({
      title: formatMetaTitle(page.title, siteEn.shortName),
      description: page.description,
      currentPath: `/en/${pageKey}/`,
      outputPath: path.join(outDir, 'en', pageKey, 'index.html'),
      body: renderEnglishInfoPage(pageKey),
      siteConfig: siteEn,
      uiText: enUi,
      documentLang: 'en',
      includeDefaultStructuredData: false,
      languageSwitch: getLanguageSwitch(`/en/${pageKey}/`, 'en'),
      alternateLinks: createAlternateLinks(`/${pageKey}/`, `/en/${pageKey}/`)
    })
  );
}

writeText(
  path.join(outDir, 'en', 'blog', 'index.html'),
  renderLayout({
    title: siteEn.seo?.blog?.title ?? formatMetaTitle(siteEn.pages.blog.title, siteEn.shortName),
    description: siteEn.seo?.blog?.description ?? siteEn.pages.blog.description,
    currentPath: '/en/blog/',
    outputPath: path.join(outDir, 'en', 'blog', 'index.html'),
    body: renderEnglishBlogIndex(postsEn),
    image: postsEn[0]?.cover ?? site.brand.ogImage,
    siteConfig: siteEn,
    uiText: enUi,
    documentLang: 'en',
    includeDefaultStructuredData: false,
    languageSwitch: getLanguageSwitch('/en/blog/', 'en'),
    alternateLinks: createAlternateLinks('/blog/', '/en/blog/')
  })
);

for (const [index, post] of postsEn.entries()) {
  const relatedPosts = getRelatedPosts(post, postsEn);
  const navigationPosts = {
    previous: postsEn[index - 1] ?? null,
    next: postsEn[index + 1] ?? null
  };

  writeText(
    path.join(outDir, 'en', 'blog', post.slug, 'index.html'),
    renderLayout({
      title: formatMetaTitle(post.title, 'Blog', siteEn.shortName),
      description: post.summary,
      currentPath: `/en/blog/${post.slug}/`,
      outputPath: path.join(outDir, 'en', 'blog', post.slug, 'index.html'),
      body: renderEnglishPostPage(post, relatedPosts, navigationPosts),
      image: post.cover,
      siteConfig: siteEn,
      uiText: enUi,
      documentLang: 'en',
      includeDefaultStructuredData: false,
      languageSwitch: getLanguageSwitch(`/en/blog/${post.slug}/`, 'en'),
      alternateLinks: createAlternateLinks(`/blog/${post.slug}/`, `/en/blog/${post.slug}/`),
      openGraph: {
        title: post.title,
        description: post.summary,
        image: post.cover,
        imageAlt: `${post.title} cover illustration`,
        type: 'article',
        article: {
          publishedTime: toIsoDateTime(post.date),
          modifiedTime: toIsoDateTime(post.updated ?? post.date),
          section: post.category.name,
          tags: post.tags
        }
      }
    })
  );
}

writeText(
  path.join(outDir, '404.html'),
  renderLayout({
    title: site.seo?.notFound?.title ?? formatMetaTitle('页面未找到', site.shortName),
    description: site.seo?.notFound?.description ?? '你访问的页面不存在。',
    currentPath: '/404.html',
    outputPath: path.join(outDir, '404.html'),
    body: render404(posts),
    robots: site.seo?.robots?.notFound ?? 'noindex,follow'
  })
);

writeText(path.join(outDir, (site.rss?.path ?? '/rss.xml').replace(/^\//, '')), buildRssFeed(posts));

const sitemapEntries = [
  { path: '/' },
  { path: '/about/' },
  { path: '/projects/' },
  ...((pages.projects.items ?? []).filter((project) => project.slug).map((project) => ({ path: `/projects/${project.slug}/` }))),
  { path: '/blog/' },
  { path: '/blog/tags/' },
  { path: '/blog/categories/' },
  { path: '/blog/series/' },
  { path: '/blog/templates/' },
  { path: '/blog/archive/' },
  { path: '/now/' },
  { path: '/en/' },
  { path: '/en/about/' },
  { path: '/en/projects/' },
  { path: '/en/blog/' },
  { path: '/en/now/' },
  ...tags.map((tag) => ({ path: `/blog/tags/${tag.slug}/` })),
  ...categories.map((category) => ({ path: `/blog/categories/${category.slug}/` })),
  ...seriesList.map((series) => ({ path: `/blog/series/${series.slug}/` })),
  ...templates.map((template) => ({ path: `/blog/templates/${template.slug}/` })),
  ...posts.map((post) => ({
    path: `/blog/${post.slug}/`,
    lastModified: formatSitemapLastModified(post.updated ?? post.date)
  })),
  ...postsEn.map((post) => ({
    path: `/en/blog/${post.slug}/`,
    lastModified: formatSitemapLastModified(post.updated ?? post.date)
  }))
];
writeText(
  path.join(outDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries
    .map(({ path: url, lastModified }) => {
      const loc = withBase(url === '/' ? '' : url.slice(1));
      const lastmodTag = lastModified ? `<lastmod>${lastModified}</lastmod>` : '';
      return `  <url><loc>${loc}</loc>${lastmodTag}</url>`;
    })
    .join('\n')}\n</urlset>`
);
writeText(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${withBase('sitemap.xml')}\n`);
writeText(path.join(outDir, '.nojekyll'), '');
writeText(
  path.join(outDir, 'asset-manifest.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      assets: emittedAssetEntries
        .slice()
        .sort((a, b) => a.source.localeCompare(b.source))
        .reduce((manifest, entry) => {
          manifest[entry.source] = entry.output;
          return manifest;
        }, {})
    },
    null,
    2
  )}\n`
);

const htmlAudit = auditGeneratedHtml({ distDir: outDir });
if (htmlAudit.issues.length > 0) {
  throw new Error(`HTML semantics/accessibility audit failed:\n- ${htmlAudit.issues.join('\n- ')}`);
}

console.log(
  `Build complete. Generated ${posts.length} posts, ${sitemapEntries.length} sitemap entries, ${emittedAssetEntries.length} fingerprinted assets, and audited ${htmlAudit.htmlFileCount} HTML files.`
);
