import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';

const outDir = 'dist';
const filesToCopy = ['index.html', 'styles.css', 'script.js'];

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

mkdirSync(outDir, { recursive: true });

for (const file of filesToCopy) {
  cpSync(file, `${outDir}/${file}`);
}

console.log('Build complete. Static files copied to dist/.');
