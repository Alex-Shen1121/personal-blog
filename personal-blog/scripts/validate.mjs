import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
const requiredSourceFiles = [
  'styles.css',
  'script.js',
  'scripts/build.mjs',
  'src/data/site.mjs',
  'public/favicon.svg'
];
const requiredPages = ['about', 'projects', 'blog', 'now'];

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
if (posts.length < 3) {
  console.error('At least 3 markdown posts are required.');
  process.exit(1);
}

for (const page of requiredPages) {
  const data = readFileSync(path.join(rootDir, 'src/data/site.mjs'), 'utf8');
  if (!data.includes(`${page}:`)) {
    console.error(`Missing page configuration for: ${page}`);
    process.exit(1);
  }
}

for (const post of posts) {
  const source = readFileSync(path.join(postsDir, post), 'utf8');
  for (const field of ['title:', 'date:', 'summary:', 'category:', 'tags:']) {
    if (!source.includes(field)) {
      console.error(`Post ${post} is missing frontmatter field: ${field}`);
      process.exit(1);
    }
  }
}

console.log(`Validation passed. ${posts.length} markdown posts detected and required site files exist.`);
