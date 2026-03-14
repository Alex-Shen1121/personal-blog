import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist');
const postsDir = path.join(rootDir, 'content', 'posts');
const postsEnDir = path.join(rootDir, 'content', 'posts-en');

// Site configuration - matching site.mjs
const siteUrl = 'https://alex-shen1121.github.io/personal-blog/';
const repoBasePath = '/personal-blog/';

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00+08:00`);
  return date.toISOString().split('T')[0];
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(`${dateString}T00:00:00+08:00`).toISOString();
};

const buildCanonicalUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalizedPath.replace(repoBasePath, '')}`;
};

const parseFrontmatter = (raw) => {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  
  const frontmatter = match[1];
  const body = match[2];
  const meta = {};
  
  frontmatter.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  });
  
  return { meta, body };
};

const loadPosts = (dir) => {
  if (!existsSync(dir)) return [];
  
  return readdirSync(dir)
    .filter(file => file.endsWith('.md'))
    .map(fileName => {
      const raw = readFileSync(path.join(dir, fileName), 'utf8');
      const { meta } = parseFrontmatter(raw);
      return {
        slug: meta.slug || fileName.replace('.md', ''),
        date: meta.date,
        updated: meta.updated
      };
    });
};

const generateSitemap = () => {
  const urls = [];
  const today = new Date().toISOString().split('T')[0];
  
  // Static pages
  const staticPages = [
    { loc: '/', changefreq: 'weekly', priority: 1.0 },
    { loc: '/about/', changefreq: 'monthly', priority: 0.8 },
    { loc: '/projects/', changefreq: 'weekly', priority: 0.8 },
    { loc: '/blog/', changefreq: 'daily', priority: 0.9 },
    { loc: '/now/', changefreq: 'weekly', priority: 0.7 },
    { loc: '/archive/', changefreq: 'weekly', priority: 0.6 },
    { loc: '/tags/', changefreq: 'weekly', priority: 0.6 },
    { loc: '/categories/', changefreq: 'weekly', priority: 0.6 },
    { loc: '/series/', changefreq: 'weekly', priority: 0.6 },
    { loc: '/templates/', changefreq: 'weekly', priority: 0.6 },
    { loc: '/stats/', changefreq: 'weekly', priority: 0.5 },
    { loc: '/search/', changefreq: 'weekly', priority: 0.5 },
    { loc: '/404/', changefreq: 'monthly', priority: 0.0 },
  ];
  
  staticPages.forEach(page => {
    urls.push({
      loc: buildCanonicalUrl(page.loc),
      changefreq: page.changefreq,
      priority: page.priority,
      lastmod: page.priority > 0 ? today : undefined
    });
  });
  
  // English pages
  const enPages = [
    { loc: '/en/', changefreq: 'weekly', priority: 0.9 },
    { loc: '/en/about/', changefreq: 'monthly', priority: 0.8 },
    { loc: '/en/projects/', changefreq: 'weekly', priority: 0.8 },
    { loc: '/en/blog/', changefreq: 'daily', priority: 0.9 },
    { loc: '/en/now/', changefreq: 'weekly', priority: 0.7 },
  ];
  
  enPages.forEach(page => {
    urls.push({
      loc: buildCanonicalUrl(page.loc),
      changefreq: page.changefreq,
      priority: page.priority,
      lastmod: page.priority > 0 ? today : undefined
    });
  });
  
  // Blog posts
  const posts = loadPosts(postsDir);
  posts.forEach(post => {
    urls.push({
      loc: buildCanonicalUrl(`/blog/${post.slug}/`),
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: post.updated || post.date
    });
  });
  
  // English blog posts
  const postsEn = loadPosts(postsEnDir);
  postsEn.forEach(post => {
    urls.push({
      loc: buildCanonicalUrl(`/en/blog/${post.slug}/`),
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: post.updated || post.date
    });
  });
  
  // Generate XML
  const urlEntries = urls.map(url => {
    let entry = `    <url>
      <loc>${url.loc}</loc>
      <changefreq>${url.changefreq}</changefreq>
      <priority>${url.priority}</priority>`;
    
    if (url.lastmod) {
      entry += `
      <lastmod>${formatDate(url.lastmod)}</lastmod>`;
    }
    
    entry += `
    </url>`;
    return entry;
  }).join('\n');
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
         xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>`;
  
  // Write sitemap.xml
  writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap);
  console.log(`✓ Generated sitemap.xml with ${urls.length} URLs`);
};

export { generateSitemap };
