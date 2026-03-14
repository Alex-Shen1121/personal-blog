import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pages, site } from '../src/data/site.mjs';
import { validateCanonicalConfig, validateCanonicalPath } from '../src/utils/canonical.mjs';
import { parseAndValidateFrontmatter } from './frontmatter.mjs';

const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
const requiredSourceFiles = [
  'styles.css',
  'script.js',
  'scripts/build.mjs',
  'scripts/frontmatter.mjs',
  'scripts/html-audit.mjs',
  'src/data/site.mjs',
  'src/utils/canonical.mjs',
  'public/favicon.svg'
];
const requiredPages = ['about', 'projects', 'blog', 'now'];

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

for (const file of requiredSourceFiles) {
  const filePath = path.join(rootDir, file);
  if (!existsSync(filePath)) {
    console.error(`Missing required source file: ${file}`);
    process.exit(1);
  }
}

const postsDir = path.join(rootDir, 'content', 'posts');
if (!existsSync(postsDir)) {
  console.error('Missing content/posts directory.');
  process.exit(1);
}

const posts = readdirSync(postsDir).filter((file) => file.endsWith('.md'));
const parsedPosts = posts.map((post) => {
  const source = readFileSync(path.join(postsDir, post), 'utf8');

  try {
    return {
      fileName: post,
      ...parseAndValidateFrontmatter(source, { fileName: post })
    };
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
});
const publishedPosts = parsedPosts.filter((post) => !post.meta.draft);

if (publishedPosts.length < 3) {
  console.error('At least 3 non-draft markdown posts are required.');
  process.exit(1);
}

for (const page of requiredPages) {
  if (!pages[page]) {
    console.error(`Missing page configuration for: ${page}`);
    process.exit(1);
  }
}

const canonicalConfig = validateCanonicalConfig(site);
if (canonicalConfig.errors.length > 0) {
  console.error(`Invalid canonical configuration:\n- ${canonicalConfig.errors.join('\n- ')}`);
  process.exit(1);
}

const requiredCanonicalPaths = ['/', '/about/', '/projects/', '/blog/', '/blog/tags/', '/blog/categories/', '/blog/series/', '/blog/archive/', '/now/', '/404.html'];
for (const canonicalPath of requiredCanonicalPaths) {
  const errors = validateCanonicalPath(canonicalPath, { repoBasePath: canonicalConfig.normalizedRepoBasePath });
  if (errors.length > 0) {
    console.error(`Invalid canonical path ${canonicalPath}:\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
}

const resolvedPostSlugs = new Map();

for (const post of parsedPosts) {
  const hasCustomSlug = Object.prototype.hasOwnProperty.call(post.meta, 'slug');
  let resolvedSlug = '';
  try {
    resolvedSlug = resolvePostSlug({
      fileName: post.fileName,
      customSlug: post.meta.slug ?? '',
      hasCustomSlug
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const existingSlugSource = resolvedPostSlugs.get(resolvedSlug);
  if (existingSlugSource) {
    console.error(`Duplicate post slug detected: "${resolvedSlug}" (${existingSlugSource} and ${post.fileName}).`);
    process.exit(1);
  }
  resolvedPostSlugs.set(resolvedSlug, post.fileName);

  const canonicalPath = `/blog/${resolvedSlug}/`;
  const canonicalPathErrors = validateCanonicalPath(canonicalPath, {
    repoBasePath: canonicalConfig.normalizedRepoBasePath
  });
  if (canonicalPathErrors.length > 0) {
    console.error(`Post ${post.fileName} resolved to invalid canonical path ${canonicalPath}:\n- ${canonicalPathErrors.join('\n- ')}`);
    process.exit(1);
  }
}

console.log(`Validation passed. ${publishedPosts.length} published / ${posts.length} total markdown posts detected, required site files exist, and canonical rules are valid.`);
