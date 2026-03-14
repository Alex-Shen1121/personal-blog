import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist');

// Site configuration
const siteUrl = 'https://alex-shen1121.github.io/personal-blog/';
const repoBasePath = '/personal-blog/';

const buildCanonicalUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalizedPath.replace(repoBasePath, '')}`;
};

// Known internal routes that should exist
const knownRoutes = new Set([
  '/',
  '/about/',
  '/projects/',
  '/blog/',
  '/now/',
  '/archive/',
  '/tags/',
  '/categories/',
  '/series/',
  '/templates/',
  '/stats/',
  '/search/',
  '/404/',
  '/en/',
  '/en/about/',
  '/en/projects/',
  '/en/blog/',
  '/en/now/',
  '/offline.html',
  '/manifest.json',
  '/sw.js',
  '/rss.xml',
  '/sitemap.xml',
]);

// Extract internal links from HTML content
const extractLinks = (html) => {
  const links = new Set();
  
  // Match href="..." or href='...'
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    
    // Skip external links, anchors, mailto, tel, javascript
    if (
      href.startsWith('http') ||
      href.startsWith('//') ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:')
    ) {
      continue;
    }
    
    // Normalize the path
    let normalizedHref = href;
    if (!normalizedHref.startsWith('/')) {
      normalizedHref = '/' + normalizedHref;
    }
    
    // Remove query strings and hash
    normalizedHref = normalizedHref.split('?')[0].split('#')[0];
    
    // Handle index.html -> /
    if (normalizedHref.endsWith('/index.html')) {
      normalizedHref = normalizedHref.replace('/index.html', '/');
    }
    
    links.add(normalizedHref);
  }
  
  return links;
};

// Check if a file exists for the given path
const fileExistsForPath = (path) => {
  // Normalize path
  let filePath = path;
  if (filePath === '/') {
    filePath = '/index.html';
  }
  
  // Remove leading slash
  filePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  
  // Check various possible locations
  const possiblePaths = [
    path.join(outDir, filePath),
    path.join(outDir, filePath, 'index.html'),
    path.join(outDir, filePath.replace(/\/$/, '') + '.html'),
  ];
  
  return possiblePaths.some(p => existsSync(p));
};

// Check all HTML files for dead links
const checkDeadLinks = () => {
  const htmlFiles = [];
  const collectHtmlFiles = (dir) => {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectHtmlFiles(fullPath);
        } else if (entry.name.endsWith('.html')) {
          htmlFiles.push(fullPath);
        }
      }
    } catch (e) {
      // Ignore errors
    }
  };
  
  collectHtmlFiles(outDir);
  
  const deadLinks = [];
  const checkedLinks = new Set();
  
  for (const htmlFile of htmlFiles) {
    try {
      const content = readFileSync(htmlFile, 'utf8');
      const links = extractLinks(content);
      
      for (const link of links) {
        if (checkedLinks.has(link)) continue;
        checkedLinks.add(link);
        
        // Skip known routes (dynamic pages)
        if (knownRoutes.has(link) || knownRoutes.has(link.replace(/\/$/, '') + '/')) {
          continue;
        }
        
        // Check if file exists
        if (!fileExistsForPath(link)) {
          const relativePath = htmlFile.replace(outDir, '');
          deadLinks.push({
            page: relativePath,
            link: link,
          });
        }
      }
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  return deadLinks;
};

// Main function
const runDeadLinkCheck = async () => {
  console.log('🔍 Checking for dead links...');
  
  const deadLinks = await checkDeadLinks();
  
  if (deadLinks.length > 0) {
    console.log(`\n⚠️  Found ${deadLinks.length} potential dead link(s):`);
    deadLinks.forEach(({ page, link }) => {
      console.log(`  - ${page} → ${link}`);
    });
    console.log('\n⚠️  Please verify these links or add them to knownRoutes in the script.');
  } else {
    console.log('✓ No dead links found');
  }
  
  return deadLinks;
};

export { runDeadLinkCheck };
