import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { home, pages, site } from '../src/data/site.mjs';
import { buildCanonicalUrl, validateCanonicalConfig } from '../src/utils/canonical.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist');
const postsDir = path.join(rootDir, 'content', 'posts');
const assetsDir = path.join(rootDir, 'src', 'assets');
const publicDir = path.join(rootDir, 'public');
const rawCriticalCssSource = readFileSync(path.join(rootDir, 'critical.css'), 'utf8');
const canonicalConfig = validateCanonicalConfig(site);

if (canonicalConfig.errors.length > 0) {
  throw new Error(canonicalConfig.errors.join('\n'));
}

const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif']);
const imageMetadata = new Map();

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

const copyStaticAsset = (sourcePath, targetPath) => {
  const extension = path.extname(sourcePath).toLowerCase();
  ensureDir(path.dirname(targetPath));

  if (extension === '.css' || extension === '.svg') {
    writeFileSync(targetPath, optimizeTextContent(targetPath, readFileSync(sourcePath, 'utf8')));
    return;
  }

  copyFileSync(sourcePath, targetPath);
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
    day: 'numeric'
  }).format(new Date(`${dateString}T00:00:00+08:00`));

const formatWordCount = (count) => `${count.toLocaleString('zh-CN')} 字`;

const renderPostMeta = (post) => {
  const items = [formatDate(post.date)];
  if (post.updated && post.updated !== post.date) {
    items.push(`更新于 ${formatDate(post.updated)}`);
  }
  items.push(post.readingTime);
  items.push(formatWordCount(post.wordCount));
  return items.map((item) => `<span>${item}</span>`).join('');
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

  if (assetPath.startsWith('/')) {
    return `${prefix}${assetPath.slice(1)}`;
  }

  return `${prefix}${assetPath}`;
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

    if (key === 'tags') {
      meta[key] = value.split(',').map((item) => item.trim()).filter(Boolean);
      continue;
    }

    if (key === 'draft' || key === 'pinned') {
      meta[key] = value.toLowerCase() === 'true';
      continue;
    }

    if (key === 'seriesOrder') {
      meta[key] = Number(value);
      continue;
    }

    meta[key] = value;
  }

  return { meta, body: rawBody.trim() };
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

  if (value.startsWith('/')) {
    return `${site.repoBasePath.replace(/\/$/, '')}${value}`;
  }

  return value;
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
  return withBase(value.startsWith('/') ? value : `/${value}`);
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

const formatMetaTitle = (...segments) => segments.filter(Boolean).join('｜');

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
  mainEntityId = ''
}) => {
  const prefix = getRelativePrefix(outputPath);
  const assetPrefix = prefix === '.' ? './' : `${prefix}/`;
  const canonical = buildCanonicalUrl(site, currentPath);
  const stylesheetHref = trimLocalPrefix(`${prefix}/styles.css`);
  const scriptHref = trimLocalPrefix(`${prefix}/script.js`);
  const fontStylesheetHref = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap';
  const faviconHref = trimLocalPrefix(resolveStaticAssetPath(site.brand.favicon, assetPrefix));
  const resolvedOpenGraph = {
    title: openGraph.title ?? title,
    description: openGraph.description ?? description,
    type: openGraph.type ?? 'website',
    image: openGraph.image ?? image,
    imageAlt: openGraph.imageAlt ?? '',
    article: openGraph.article ?? null
  };
  const ogImage = withBase(resolvedOpenGraph.image);
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
    buildBreadcrumbStructuredData(canonical, breadcrumbs),
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

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#07111f" />
    <title>${metaTitle}</title>
    <meta name="description" content="${metaDescription}" />
    <meta property="og:title" content="${metaOgTitle}" />
    <meta property="og:description" content="${metaOgDescription}" />
    <meta property="og:type" content="${metaOgType}" />
    <meta property="og:site_name" content="${escapeHtml(site.shortName)}" />
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
    ${structuredDataScripts}
    <link rel="icon" type="image/svg+xml" href="${escapeHtml(faviconHref)}" />
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
    <div class="reading-progress" data-reading-progress>
      <span class="reading-progress__bar" data-reading-progress-bar></span>
    </div>
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
      <button class="back-to-top" type="button" data-back-to-top aria-label="返回顶部" aria-hidden="true" tabindex="-1">
        <span class="back-to-top__icon" aria-hidden="true">↑</span>
        <span>返回顶部</span>
      </button>
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
    <script src="${scriptHref}" defer></script>
  </body>
</html>`;
};

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
        <img src="assets/illustration-wave.svg" alt="抽象波形风格插画"${getImageAttributes({ src: '/assets/illustration-wave.svg', fetchpriority: 'high' })} />
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
          ? `<article class="post-card post-card--featured"><div class="post-card__cover"><img src="${primaryPost.cover.replace(/^\//, '')}" alt="${primaryPost.title} 的封面插画"${getImageAttributes({ src: primaryPost.cover, fetchpriority: 'high' })} /></div><div class="post-card__body">${primaryPost.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : `<span class="feature-label">${home.featuredPosts.primaryLabel}</span>`}<div class="post-card__meta">${renderPostMeta(primaryPost)}</div><h2>${primaryPost.title}</h2><p>${primaryPost.summary}</p><ul class="tag-list">${primaryPost.tags.map((tag) => `<li class="tag">${tag}</li>`).join('')}</ul><a class="text-link" href="blog/${primaryPost.slug}/">优先阅读 →</a></div></article>`
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
            (post) => `<article class="post-card"><div class="post-card__cover"><img src="${post.cover.replace(/^\//, '')}" alt="${post.title} 的封面插画"${getImageAttributes({ src: post.cover })} /></div>${post.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : ''}<div class="post-card__meta">${post.updated && post.updated !== post.date ? `<span>更新于 ${formatDate(post.updated)}</span>` : ''}<span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><h2>${post.title}</h2><p>${post.summary}</p>${renderTagLinks(post.tags, 'blog/')}<a class="button button-ghost" href="blog/${post.slug}/">阅读详情</a></article>`
          )
          .join('')}
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

  const body = page.items
    ? `<section class="page-hero reveal"><p class="kicker">${page.title}</p><h1>${page.title}</h1><p>${page.intro}</p></section>
       <section class="section reveal"><div class="project-grid">${page.items.map((item) => renderProjectCard(item, { assetPrefix })).join('')}</div></section>`
    : `<section class="page-hero reveal"><p class="kicker">${page.title}</p><h1>${page.title}</h1><p>${page.intro}</p></section>
       <section class="section reveal"><div class="card-grid">${page.sections
         .map((section) => `<article class="panel"><h3>${section.title}</h3><p>${section.text}</p></article>`)
         .join('')}</div></section>`;
  return body;
};

const loadPosts = () => {
  const posts = readdirSync(postsDir)
    .filter((file) => file.endsWith('.md'))
    .map((fileName) => {
      const raw = readFileSync(path.join(postsDir, fileName), 'utf8');
      const { meta, body } = parseFrontmatter(raw);
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

const renderBlogListPage = (posts, tags, categories, seriesList) => `
  <section class="page-hero reveal">
    <p class="kicker">文章</p>
    <h1>写下来的内容，会慢慢变成自己的方法库。</h1>
    <p>目前已支持文章标签与分类系统：文章列表、标签/分类索引页与详情页都会基于 Markdown frontmatter 自动生成。</p>
  </section>
  <section class="section reveal" data-post-search data-post-search-total="${posts.length}">
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
        <a class="button button-ghost button-small" href="archive/">查看归档</a>
        ${tags.slice(0, 2).map((tag) => `<a class="tag tag-link" href="tags/${tag.slug}/">${tag.name}</a>`).join('')}
        ${categories.slice(0, 2).map((category) => `<a class="tag" href="categories/${category.slug}/">${category.name} · ${category.count}</a>`).join('')}
        ${seriesList.slice(0, 2).map((series) => `<a class="tag" href="series/${series.slug}/">系列：${series.name}</a>`).join('')}
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
            post.series?.name ?? ''
          ].join(' ').toLowerCase());
          const dateValue = new Date(`${post.date}T00:00:00+08:00`).getTime();
          const updatedValue = new Date(`${(post.updated ?? post.date)}T00:00:00+08:00`).getTime();
          return `<article class="post-card" data-post-card data-search-index="${searchIndex}" data-category="${escapeHtml(post.category.name.toLowerCase())}" data-tags="${escapeHtml((post.tags ?? []).map((tag) => tag.toLowerCase()).join('|'))}" data-date="${dateValue}" data-updated="${updatedValue}"><div class="post-card__cover"><img src="../${post.cover.replace(/^\//, '')}" alt="${post.title} 的封面插画"${getImageAttributes({ src: post.cover })} /></div>${post.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : ''}${post.series ? `<span class="feature-label feature-label--series">系列 · <a href="series/${post.series.slug}/">${post.series.name}</a></span>` : ''}<div class="post-card__meta">${renderPostMeta(post)}</div><p class="kicker"><a href="categories/${post.category.slug}/">${post.category.name}</a></p><h2>${post.title}</h2><p>${post.summary}</p>${renderTagLinks(post.tags)}<a class="button button-ghost" href="${post.slug}/">阅读详情</a></article>`;
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
          (post) => `<article class="post-card"><div class="post-card__cover"><img src="../../${post.cover.replace(/^\//, '')}" alt="${post.title} 的封面插画"${getImageAttributes({ src: post.cover })} /></div>${post.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : ''}<div class="post-card__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><h2>${post.title}</h2><p>${post.summary}</p>${renderTagLinks(post.tags, '../../')}<a class="button button-ghost" href="../../${post.slug}/">阅读详情</a></article>`
        )
        .join('')}
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
          (post) => `<article class="post-card"><div class="post-card__cover"><img src="../../../${post.cover.replace(/^\//, '')}" alt="${post.title} 的封面插画"${getImageAttributes({ src: post.cover })} /></div>${post.pinned ? '<span class="feature-label feature-label--pinned">置顶文章</span>' : ''}<div class="post-card__meta"><span>${formatDate(post.date)}</span><span>${post.readingTime}</span></div><h2>${post.title}</h2><p>${post.summary}</p>${renderTagLinks(post.tags, '../../')}<a class="button button-ghost" href="../../${post.slug}/">阅读详情</a></article>`
        )
        .join('')}
    </div>
  </section>`;

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
      <ul class="tag-list"><li class="tag"><a href="../categories/${post.category.slug}/">${post.category.name}</a></li>${post.series ? `<li class="tag"><a href="../series/${post.series.slug}/">系列 · ${post.series.name}</a></li>` : ''}${post.tags.map((tag) => `<li><a class="tag tag-link" href="../tags/${slugifyTag(tag)}/">${tag}</a></li>`).join('')}</ul>
    </section>
    <section class="post-layout reveal">
      <article>
        <div class="post-cover"><img src="../../${post.cover.replace(/^\//, '')}" alt="${post.title} 的配图"${getImageAttributes({ src: post.cover, fetchpriority: 'high' })} /></div>
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
        <div class="note-card">
          <h3>文章信息</h3>
          <div class="meta-row"><span>发布时间</span><span>${formatDate(post.date)}</span></div>
          ${post.updated ? `<div class="meta-row"><span>更新时间</span><span>${formatDate(post.updated)}</span></div>` : ''}
          <div class="meta-row"><span>阅读信息</span><span>${post.readingTime} · ${formatWordCount(post.wordCount)}</span></div>
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
copyStaticAsset(path.join(rootDir, 'styles.css'), path.join(outDir, 'styles.css'));
copyStaticAsset(path.join(rootDir, 'script.js'), path.join(outDir, 'script.js'));
copyStaticAsset(path.join(rootDir, 'enhancements.js'), path.join(outDir, 'enhancements.js'));

for (const file of readdirSync(assetsDir)) {
  copyStaticAsset(path.join(assetsDir, file), path.join(outDir, 'assets', file));
}

for (const file of readdirSync(publicDir)) {
  copyStaticAsset(path.join(publicDir, file), path.join(outDir, file));
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
const seriesList = collectSeries(posts);

writeText(
  path.join(outDir, 'index.html'),
  renderLayout({
    title: site.seo?.home?.title ?? site.title,
    description: site.seo?.home?.description ?? site.description,
    currentPath: '/',
    outputPath: path.join(outDir, 'index.html'),
    body: renderHomePage(posts),
    mainEntityId: personSchemaId
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
      mainEntityId: key === 'about' ? personSchemaId : ''
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
    body: renderBlogListPage(posts, tags, categories, seriesList),
    image: posts[0]?.cover ?? '/assets/illustration-wave.svg',
    pageType: 'CollectionPage',
    breadcrumbs: createBreadcrumbs([
      { name: '首页', path: '/' },
      { name: '文章', path: '/blog/' }
    ]),
    structuredData: [buildPostListStructuredData('/blog/', posts)]
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

const sitemapEntries = [
  { path: '/' },
  { path: '/about/' },
  { path: '/projects/' },
  ...((pages.projects.items ?? []).filter((project) => project.slug).map((project) => ({ path: `/projects/${project.slug}/` }))),
  { path: '/blog/' },
  { path: '/blog/tags/' },
  { path: '/blog/categories/' },
  { path: '/blog/series/' },
  { path: '/blog/archive/' },
  { path: '/now/' },
  ...tags.map((tag) => ({ path: `/blog/tags/${tag.slug}/` })),
  ...categories.map((category) => ({ path: `/blog/categories/${category.slug}/` })),
  ...seriesList.map((series) => ({ path: `/blog/series/${series.slug}/` })),
  ...posts.map((post) => ({
    path: `/blog/${post.slug}/`,
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

console.log(`Build complete. Generated ${posts.length} posts and ${sitemapEntries.length} sitemap entries.`);
