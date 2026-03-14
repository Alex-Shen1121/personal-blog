import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const walkHtmlFiles = (directoryPath) => {
  const entries = readdirSync(directoryPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      return walkHtmlFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.html') ? [entryPath] : [];
  });
};

const stripTags = (value = '') =>
  value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

const getAttribute = (tag, attributeName) => {
  const matcher = new RegExp(`\\b${attributeName}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
  return tag.match(matcher)?.[2] ?? '';
};

const hasAttribute = (tag, attributeName) => new RegExp(`\\b${attributeName}(?:\\s*=|\\s|>)`, 'i').test(tag);

const normalizeRelTokens = (value = '') =>
  value
    .split(/\s+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const auditHtmlFile = (filePath, rootDir) => {
  const html = readFileSync(filePath, 'utf8');
  const issues = [];
  const relativePath = path.relative(rootDir, filePath).replaceAll('\\', '/');
  const report = (message) => issues.push(`${relativePath}: ${message}`);

  if (!/<html\b[^>]*\blang=["'][^"']+["']/i.test(html)) {
    report('缺少 html[lang]，无法明确页面语言。');
  }

  if (!/<a\b[^>]*class=["'][^"']*\bskip-link\b[^"']*["'][^>]*href=["']#main-content["'][^>]*>/i.test(html)) {
    report('缺少跳转到正文的 skip link。');
  }

  const mainMatches = html.match(/<main\b/gi) ?? [];
  if (mainMatches.length !== 1) {
    report(`必须且只能有一个 <main>，当前检测到 ${mainMatches.length} 个。`);
  }

  if (!/<main\b[^>]*\bid=["']main-content["'][^>]*\btabindex=["']-1["'][^>]*>/i.test(html)) {
    report('<main> 需要提供 id="main-content" 和 tabindex="-1"，以支持键盘跳转正文。');
  }

  if (!/<header\b/i.test(html)) {
    report('缺少 <header> 地标元素。');
  }

  if (!/<footer\b/i.test(html)) {
    report('缺少 <footer> 地标元素。');
  }

  const navTags = html.match(/<nav\b[^>]*>/gi) ?? [];
  if (navTags.length === 0) {
    report('缺少 <nav> 地标元素。');
  }
  navTags.forEach((tag) => {
    if (!hasAttribute(tag, 'aria-label') && !hasAttribute(tag, 'aria-labelledby')) {
      report('<nav> 需要 aria-label 或 aria-labelledby，便于辅助技术区分导航区域。');
    }
  });

  const h1Matches = html.match(/<h1\b/gi) ?? [];
  if (h1Matches.length !== 1) {
    report(`必须且只能有一个 <h1>，当前检测到 ${h1Matches.length} 个。`);
  }

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  imgTags.forEach((tag) => {
    if (!hasAttribute(tag, 'alt')) {
      report(`<img> 缺少 alt 属性：${tag}`);
    }
  });

  const buttonMatches = html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi);
  for (const [fullMatch, rawAttributes, innerHtml] of buttonMatches) {
    const buttonTag = `<button${rawAttributes}>`;
    const textContent = stripTags(innerHtml);
    if (!textContent && !hasAttribute(buttonTag, 'aria-label') && !hasAttribute(buttonTag, 'aria-labelledby')) {
      report(`<button> 缺少可访问名称：${fullMatch.slice(0, 160)}${fullMatch.length > 160 ? '…' : ''}`);
    }
  }

  const labelContents = [];
  const labelFors = new Set();
  const labelMatches = html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi);
  for (const [, rawAttributes, innerHtml] of labelMatches) {
    const labelTag = `<label${rawAttributes}>`;
    const controlId = getAttribute(labelTag, 'for');
    if (controlId) {
      labelFors.add(controlId);
    }
    labelContents.push(innerHtml);
  }

  const controlMatches = html.matchAll(/<(input|select|textarea)\b[^>]*>/gi);
  for (const controlMatch of controlMatches) {
    const controlTag = controlMatch[0];
    const tagName = controlMatch[1].toLowerCase();
    const type = getAttribute(controlTag, 'type').toLowerCase();

    if (tagName === 'input' && ['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) {
      continue;
    }

    const controlId = getAttribute(controlTag, 'id');
    const hasAccessibleName =
      hasAttribute(controlTag, 'aria-label') ||
      hasAttribute(controlTag, 'aria-labelledby') ||
      (controlId && labelFors.has(controlId)) ||
      labelContents.some((labelHtml) => labelHtml.includes(controlTag));

    if (!hasAccessibleName) {
      report(`<${tagName}> 缺少可访问名称：${controlTag}`);
    }
  }

  const linkTags = html.match(/<a\b[^>]*>/gi) ?? [];
  linkTags.forEach((tag) => {
    if (getAttribute(tag, 'target').toLowerCase() !== '_blank') return;

    const relTokens = normalizeRelTokens(getAttribute(tag, 'rel'));
    if (!relTokens.includes('noreferrer') && !relTokens.includes('noopener')) {
      report(`新窗口链接缺少 rel="noreferrer" 或 rel="noopener"：${tag}`);
    }
  });

  return issues;
};

export const auditGeneratedHtml = ({ distDir }) => {
  if (!distDir) {
    throw new Error('auditGeneratedHtml requires a distDir option.');
  }

  const directoryPath = path.resolve(distDir);
  if (!statSync(directoryPath).isDirectory()) {
    throw new Error(`HTML audit target is not a directory: ${directoryPath}`);
  }

  const htmlFiles = walkHtmlFiles(directoryPath);
  const issues = htmlFiles.flatMap((filePath) => auditHtmlFile(filePath, directoryPath));

  return {
    htmlFileCount: htmlFiles.length,
    issues
  };
};
