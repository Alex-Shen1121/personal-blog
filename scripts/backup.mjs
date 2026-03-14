/**
 * 备份脚本
 * 定期备份源文件到云存储
 * 
 * 支持的备份目标：
 * - GitHub Releases (作为发布资产)
 * - 飞书云空间 (通过飞书 API)
 * - 本地备份
 * 
 * 使用方式：
 * node scripts/backup.mjs [--target github|feishu|local]
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { basename } from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const backupDir = path.join(rootDir, '.backups');

// 需要备份的目录和文件
const backupSources = [
  'content/',
  'src/',
  'public/',
  'scripts/',
  'package.json',
  'package-lock.json',
  '.nvmrc',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  '.github/'
];

/**
 * 创建备份文件名
 */
function getBackupFilename() {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return `backup-${timestamp}`;
}

/**
 * 创建备份目录
 */
function ensureBackupDir() {
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }
}

/**
 * 收集需要备份的文件
 */
function collectFiles() {
  const files = [];
  
  for (const source of backupSources) {
    const sourcePath = path.join(rootDir, source);
    
    if (existsSync(sourcePath)) {
      const stat = statSync(sourcePath);
      
      if (stat.isDirectory()) {
        // 递归收集目录下的文件
        collectDirFiles(sourcePath, rootDir, files);
      } else {
        // 单个文件
        files.push({
          relativePath: source,
          absolutePath: sourcePath
        });
      }
    }
  }
  
  return files;
}

/**
 * 递归收集目录文件
 */
function collectDirFiles(dirPath, baseDir, files) {
  const items = readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = statSync(itemPath);
    
    if (stat.isDirectory()) {
      // 跳过 node_modules, dist 等目录
      if (item === 'node_modules' || item === 'dist' || item.startsWith('.')) {
        continue;
      }
      collectDirFiles(itemPath, baseDir, files);
    } else {
      files.push({
        relativePath: path.relative(baseDir, itemPath),
        absolutePath: itemPath
      });
    }
  }
}

/**
 * 创建备份清单
 */
function createBackupManifest(files) {
  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    branch: getCurrentBranch(),
    commit: getCurrentCommit(),
    files: files.map(f => ({
      path: f.relativePath,
      size: statSync(f.absolutePath).size
    })),
    totalFiles: files.length,
    totalSize: files.reduce((sum, f) => sum + statSync(f.absolutePath).size, 0)
  };
}

/**
 * 获取当前 Git 分支
 */
function getCurrentBranch() {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * 获取当前 Git 提交
 */
function getCurrentCommit() {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * 导出备份清单为 JSON
 */
function exportBackupManifest(manifest) {
  const backupFilename = getBackupFilename();
  const manifestPath = path.join(backupDir, `${backupFilename}-manifest.json`);
  
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`📋 备份清单已保存: ${manifestPath}`);
  
  return backupFilename;
}

/**
 * 打包备份文件为 tar.gz
 */
async function createBackupArchive(backupFilename) {
  const archivePath = path.join(backupDir, `${backupFilename}.tar.gz`);
  const files = collectFiles();
  
  console.log(`📦 正在创建备份压缩包...`);
  console.log(`   包含 ${files.length} 个文件`);
  
  // 使用 tar 命令创建压缩包
  const { execSync } = require('child_process');
  
  const fileList = files.map(f => f.relativePath).join('\n');
  const tarCommand = `cd ${rootDir} && echo -e "${fileList}" | tar -czf ${archivePath} -T -`;
  
  execSync(tarCommand, { encoding: 'utf8' });
  
  const archiveSize = statSync(archivePath).size;
  console.log(`✅ 备份压缩包已创建: ${archivePath}`);
  console.log(`   大小: ${(archiveSize / 1024).toFixed(2)} KB`);
  
  return {
    path: archivePath,
    size: archiveSize,
    filename: basename(archivePath)
  };
}

/**
 * 上传到 GitHub Release（需要 GitHub CLI）
 */
async function uploadToGitHubRelease(archivePath) {
  try {
    const { execSync } = require('child_process');
    
    // 获取当前版本标签
    const tag = `backup-${getBackupFilename()}`;
    
    // 创建 Release
    console.log(`📤 正在上传到 GitHub Releases...`);
    
    // 检查是否有 gh 命令
    try {
      execSync('gh --version', { stdio: 'ignore' });
    } catch {
      console.log(`⚠️ 未安装 GitHub CLI，跳过上传到 GitHub`);
      return null;
    }
    
    // 创建 Release
    const releaseBody = `自动备份
- 创建时间: ${new Date().toISOString()}
- 分支: ${getCurrentBranch()}
- 提交: ${getCurrentCommit()}`;

    execSync(`gh release create "${tag}" "${archivePath}" --title "Backup ${tag}" --notes "${releaseBody}"`, { 
      cwd: rootDir,
      encoding: 'utf8' 
    });
    
    console.log(`✅ 已上传到 GitHub Releases`);
    return `https://github.com/Alex-Shen1121/personal-blog/releases/tag/${tag}`;
  } catch (e) {
    console.log(`⚠️ 上传到 GitHub 失败: ${e.message}`);
    return null;
  }
}

/**
 * 上传到飞书云空间（需要配置）
 */
async function uploadToFeishu(archivePath) {
  console.log(`📤 飞书云空间上传功能需要额外配置`);
  console.log(`   请在飞书开放平台创建应用并配置云空间权限`);
  console.log(`   当前仅创建本地备份`);
  return null;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const target = args[0] || 'local';
  
  console.log(`
🔒 站点备份工具
================
目标: ${target}
时间: ${new Date().toISOString()}
`);
  
  // 确保备份目录存在
  ensureBackupDir();
  
  // 收集文件
  const files = collectFiles();
  console.log(`📁 找到 ${files.length} 个需要备份的文件`);
  
  // 创建备份清单
  const manifest = createBackupManifest(files);
  const backupFilename = exportBackupManifest(manifest);
  
  // 创建压缩包
  const archive = await createBackupArchive(backupFilename);
  
  // 上传到目标
  let uploadResult = null;
  
  switch (target) {
    case 'github':
      uploadResult = await uploadToGitHubRelease(archive.path);
      break;
    case 'feishu':
      uploadResult = await uploadToFeishu(archive.path);
      break;
    case 'local':
    default:
      console.log(`📂 本地备份位置: ${backupDir}`);
      break;
  }
  
  console.log(`
✅ 备份完成!
============
备份文件: ${archive.filename}
文件数量: ${files.length}
总大小: ${(manifest.totalSize / 1024).toFixed(2)} KB
压缩后: ${(archive.size / 1024).toFixed(2)} KB
${uploadResult ? `上传位置: ${uploadResult}` : ''}
`);
}

// 运行
main().catch(console.error);
