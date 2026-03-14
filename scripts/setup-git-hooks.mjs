import { chmodSync, existsSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const gitDir = path.join(rootDir, '.git');
const hooksDir = path.join(rootDir, '.githooks');
const preCommitHookPath = path.join(hooksDir, 'pre-commit');
const trackedHooksPath = '.githooks';

if (!existsSync(gitDir)) {
  console.log('Skip Git hook setup: current directory is not a Git repository.');
  process.exit(0);
}

if (!existsSync(preCommitHookPath)) {
  console.log('Skip Git hook setup: missing .githooks/pre-commit.');
  process.exit(0);
}

try {
  chmodSync(preCommitHookPath, 0o755);
} catch (error) {
  console.warn(`Warning: failed to update hook permissions: ${error.message}`);
}

try {
  const currentHooksPath = execFileSync('git', ['config', '--local', '--get', 'core.hooksPath'], {
    cwd: rootDir,
    encoding: 'utf8'
  }).trim();

  if (currentHooksPath === trackedHooksPath) {
    console.log('Git hook path already points to .githooks.');
    process.exit(0);
  }
} catch {
  // Missing config is expected on the first setup.
}

try {
  execFileSync('git', ['config', '--local', 'core.hooksPath', trackedHooksPath], {
    cwd: rootDir,
    stdio: 'ignore'
  });
  console.log('Configured Git hooks path to .githooks.');
} catch (error) {
  console.warn(`Warning: failed to configure Git hooks path automatically: ${error.message}`);
  console.warn('Run `git config core.hooksPath .githooks` manually if you want to enable the pre-commit hook.');
}
