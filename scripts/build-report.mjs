/**
 * 构建产物大小报告
 * 在构建完成后输出资源大小统计
 */

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist');

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 获取目录大小
 */
function getDirSize(dirPath) {
  let totalSize = 0;
  
  try {
    const items = readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = statSync(itemPath);
      
      if (stat.isDirectory()) {
        totalSize += getDirSize(itemPath);
      } else {
        totalSize += stat.size;
      }
    }
  } catch (e) {
    // 忽略权限错误
  }
  
  return totalSize;
}

/**
 * 递归获取所有文件
 */
function getAllFiles(dirPath, baseDir = dirPath) {
  const files = [];
  
  try {
    const items = readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = statSync(itemPath);
      
      if (stat.isDirectory()) {
        files.push(...getAllFiles(itemPath, baseDir));
      } else {
        const relativePath = path.relative(baseDir, itemPath);
        files.push({
          path: relativePath,
          size: stat.size,
          sizeFormatted: formatSize(stat.size)
        });
      }
    }
  } catch (e) {
    // 忽略权限错误
  }
  
  return files;
}

/**
 * 按类型分组文件
 */
function groupByType(files) {
  const groups = {
    html: { ext: '.html', files: [], totalSize: 0 },
    css: { ext: '.css', files: [], totalSize: 0 },
    js: { ext: '.js', files: [], totalSize: 0 },
    images: { ext: ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'], files: [], totalSize: 0 },
    fonts: { ext: ['.woff', '.woff2', '.ttf', '.eot', '.otf'], files: [], totalSize: 0 },
    other: { ext: [], files: [], totalSize: 0 }
  };
  
  for (const file of files) {
    const ext = path.extname(file.path).toLowerCase();
    let placed = false;
    
    for (const [groupName, group] of Object.entries(groups)) {
      if (groupName === 'other') continue;
      
      const matches = Array.isArray(group.ext) 
        ? group.ext.includes(ext)
        : group.ext === ext;
      
      if (matches) {
        group.files.push(file);
        group.totalSize += file.size;
        placed = true;
        break;
      }
    }
    
    if (!placed) {
      groups.other.files.push(file);
      groups.other.totalSize += file.size;
    }
  }
  
  return groups;
}

/**
 * 输出构建报告
 */
export function printBuildReport() {
  console.log('\n📦 构建产物大小报告\n' + '='.repeat(50));
  
  // 检查 dist 目录是否存在
  try {
    statSync(outDir);
  } catch (e) {
    console.log('⚠️ dist 目录不存在，跳过大小报告');
    return;
  }
  
  // 获取所有文件
  const allFiles = getAllFiles(outDir);
  const totalSize = getDirSize(outDir);
  
  // 按类型分组
  const groups = groupByType(allFiles);
  
  // 输出总体统计
  console.log(`📊 总体统计:`);
  console.log(`   总文件数: ${allFiles.length}`);
  console.log(`   总大小: ${formatSize(totalSize)}\n`);
  
  // 输出分类统计
  console.log(`📁 按类型统计:`);
  
  const typeLabels = {
    html: 'HTML 文件',
    css: 'CSS 样式',
    js: 'JavaScript',
    images: '图片资源',
    fonts: '字体文件',
    other: '其他文件'
  };
  
  for (const [groupName, group] of Object.entries(groups)) {
    if (group.files.length > 0) {
      const label = typeLabels[groupName] || groupName;
      console.log(`   ${label}: ${group.files.length} 个文件, ${formatSize(group.totalSize)}`);
    }
  }
  
  // 输出大文件列表（超过 50KB）
  const largeFiles = allFiles
    .filter(f => f.size > 50 * 1024)
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);
  
  if (largeFiles.length > 0) {
    console.log(`\n⚠️ 大文件列表 (>50KB):`);
    for (const file of largeFiles) {
      console.log(`   ${file.path}: ${file.sizeFormatted}`);
    }
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  printBuildReport();
}
