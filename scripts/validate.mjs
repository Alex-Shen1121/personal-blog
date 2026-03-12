import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = ['index.html', 'styles.css', 'script.js'];
const requiredSectionIds = ['about', 'highlights', 'projects', 'contact'];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.error(`Missing required file: ${file}`);
    process.exit(1);
  }
}

const html = readFileSync('index.html', 'utf8');

for (const id of requiredSectionIds) {
  if (!html.includes(`id="${id}"`)) {
    console.error(`Missing required section id: ${id}`);
    process.exit(1);
  }
}

if (!html.includes('styles.css') || !html.includes('script.js')) {
  console.error('index.html must reference styles.css and script.js');
  process.exit(1);
}

console.log('Validation passed. Required files and sections are present.');
