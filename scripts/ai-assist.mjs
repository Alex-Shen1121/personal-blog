import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseAndValidateFrontmatter } from './frontmatter.mjs';
import { getContentTemplate } from '../src/data/content-templates.mjs';

const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
const postsDir = path.join(rootDir, 'content', 'posts');
const aiAssistDir = path.join(rootDir, '.openclaw', 'ai-assist');
const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
const FIELD_ORDER = [
  'title',
  'date',
  'updated',
  'summary',
  'slug',
  'category',
  'tags',
  'cover',
  'template',
  'ogTitle',
  'ogDescription',
  'ogImage',
  'draft',
  'pinned',
  'series',
  'seriesOrder'
];
const STOP_WORDS = new Set([
  '一个',
  '一些',
  '一种',
  '这个',
  '这个时候',
  '我们',
  '你们',
  '他们',
  '自己',
  '可以',
  '如果',
  '因为',
  '所以',
  '然后',
  '就是',
  '不是',
  '没有',
  '需要',
  '进行',
  '已经',
  '文章',
  '内容',
  '事情',
  '这样',
  '时候',
  '问题',
  '方式',
  '感觉',
  '现在',
  '后续',
  '这里',
  '这里会',
  '自己',
  'really',
  'that',
  'this',
  'with',
  'from',
  'into',
  'about',
  'your',
  'have',
  'will'
]);

const usage = `用法：
  npm run ai:assist -- suggest content/posts/your-post.md
  npm run ai:assist -- apply content/posts/your-post.md [response-json-path]

说明：
  suggest 会在 .openclaw/ai-assist/ 下生成 prompt 与 response 模板。
  apply 会读取 JSON 响应并回填 summary / tags 到 frontmatter。`;

const normalizeText = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`*_>#~\-\[\]()!]/g, ' ')
    .replace(/[，。、“”‘’；：！？,.!?/\\|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripMarkdownForExcerpt = (content = '') =>
  String(content)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const createSummaryFallback = (content, maxLength = 90) => {
  const paragraphs = String(content)
    .split(/\n\s*\n/)
    .map((block) => stripMarkdownForExcerpt(block))
    .filter(Boolean);

  const source = paragraphs[0] ?? stripMarkdownForExcerpt(content);
  if (!source) {
    return '这篇文章正在整理中。';
  }

  if (source.length <= maxLength) {
    return source;
  }

  return `${source.slice(0, maxLength).trim()}…`;
};

const slugify = (value = '') =>
  String(value)
    .replace(/\.md$/, '')
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const resolvePostPath = (inputPath = '') => {
  if (!inputPath) {
    throw new Error('缺少文章路径。');
  }

  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(rootDir, inputPath);
  if (!absolutePath.startsWith(postsDir) || !absolutePath.endsWith('.md')) {
    throw new Error('文章路径必须指向 content/posts/ 下的 .md 文件。');
  }

  if (!existsSync(absolutePath)) {
    throw new Error(`文章文件不存在：${absolutePath}`);
  }

  return absolutePath;
};

const ensureAiAssistDir = () => {
  mkdirSync(aiAssistDir, { recursive: true });
};

const parseFrontmatterMap = (rawMeta = '') => {
  const entries = [];

  for (const rawLine of rawMeta.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries.push([key, value]);
  }

  return new Map(entries);
};

const collectHeadings = (body = '') =>
  Array.from(body.matchAll(/^#{2,3}\s+(.+)$/gm))
    .map((match) => stripMarkdownForExcerpt(match[1]))
    .filter(Boolean)
    .slice(0, 8);

const collectEmphasisTokens = (body = '') => {
  const matches = [
    ...Array.from(body.matchAll(/\*\*([^*]{2,30})\*\*/g), (match) => match[1]),
    ...Array.from(body.matchAll(/`([^`]{2,30})`/g), (match) => match[1])
  ];

  return matches
    .map((item) => stripMarkdownForExcerpt(item))
    .filter(Boolean)
    .slice(0, 10);
};

const collectKeywordCandidates = ({ title = '', body = '' } = {}) => {
  const sources = [title, ...collectHeadings(body), ...collectEmphasisTokens(body)];
  const candidates = [];
  const seen = new Set();

  for (const source of sources) {
    const normalizedSource = stripMarkdownForExcerpt(source);
    if (!normalizedSource) continue;

    const fragments = normalizedSource
      .split(/[：:、，,。！？!?/|·]/)
      .map((item) => item.trim())
      .filter(Boolean);

    for (const fragment of fragments) {
      const normalizedFragment = normalizeText(fragment);
      if (!normalizedFragment || seen.has(normalizedFragment) || STOP_WORDS.has(normalizedFragment)) continue;
      if (normalizedFragment.length < 2 || normalizedFragment.length > 24) continue;
      seen.add(normalizedFragment);
      candidates.push(fragment);
    }
  }

  return candidates.slice(0, 10);
};

const loadSiteTagPool = (currentFileName = '') => {
  if (!existsSync(postsDir)) return [];

  const tags = new Set();
  const files = readdirSync(postsDir).filter((file) => file.endsWith('.md'));

  for (const file of files) {
    if (file === currentFileName) continue;
    const raw = readFileSync(path.join(postsDir, file), 'utf8');
    const { meta } = parseAndValidateFrontmatter(raw, { fileName: file });
    for (const tag of meta.tags ?? []) {
      tags.add(tag);
    }
  }

  return Array.from(tags).sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
};

const collectMatchedExistingTags = ({ text = '', tagPool = [] } = {}) => {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return [];

  const scoredTags = tagPool
    .map((tag) => {
      const normalizedTag = normalizeText(tag);
      if (!normalizedTag) return null;

      if (normalizedText.includes(normalizedTag)) {
        return { tag, score: normalizedTag.length + 10 };
      }

      const parts = normalizedTag.split(' ').filter(Boolean);
      const score = parts.reduce((count, part) => count + (normalizedText.includes(part) ? 1 : 0), 0);
      return score > 0 ? { tag, score } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.tag.localeCompare(right.tag, 'zh-Hans-CN'));

  return scoredTags.slice(0, 8).map((item) => item.tag);
};

const createResponseTemplate = () => JSON.stringify({ summary: '', tags: [] }, null, 2) + '\n';

const buildPrompt = ({ postPath, post, template, summaryFallback, matchedExistingTags, keywordCandidates, allTags }) => {
  const relativePostPath = path.relative(rootDir, postPath);
  const currentTags = Array.isArray(post.meta.tags) ? post.meta.tags : [];
  const prompt = [
    '# AI 辅助摘要 / 标签生成任务',
    '',
    '你正在为一个中文个人博客补写 frontmatter 中的摘要和标签。请严格遵守下面的要求：',
    '',
    '1. summary 只写 1 句话，保留作者口吻，不要写成营销文案，也不要空泛。',
    '2. summary 最好控制在 40~70 个中文字符之间，直接说明文章核心判断或价值。',
    '3. tags 返回 3~5 个短标签，优先复用已有标签体系；只有在确实不够表达时，才新增标签。',
    '4. tags 不要出现重复含义，比如“UI / 界面设计 / 视觉界面”这类只保留最贴切的一种。',
    '5. 不要改 title、category、template，也不要编造正文里没有的信息。',
    '6. 只返回 JSON，不要带解释、Markdown 代码块或额外说明。',
    '',
    '返回格式：',
    '{',
    '  "summary": "一句话摘要",',
    '  "tags": ["标签1", "标签2", "标签3"]',
    '}',
    '',
    '## 当前文章信息',
    `- 文件：${relativePostPath}`,
    `- 标题：${post.meta.title}`,
    `- 分类：${post.meta.category}`,
    `- 模板：${template?.name ?? '未设置'}`,
    `- 当前摘要：${post.meta.summary?.trim() || '（空）'}`,
    `- 当前标签：${currentTags.length ? currentTags.join('、') : '（空）'}`,
    `- 自动摘要兜底：${summaryFallback}`,
    `- 模板说明：${template?.summary ?? '无'}`,
    '',
    '## 优先复用的已有标签',
    matchedExistingTags.length ? matchedExistingTags.map((tag) => `- ${tag}`).join('\n') : '- 暂无直接命中的已有标签，可根据正文判断是否需要新增。',
    '',
    '## 可参考的关键词 / 小标题',
    keywordCandidates.length ? keywordCandidates.map((item) => `- ${item}`).join('\n') : '- 暂无提取到明确关键词。',
    '',
    '## 全站已有标签池（节选）',
    allTags.length ? allTags.slice(0, 30).join('、') : '暂无',
    '',
    '## 正文',
    post.body.trim(),
    ''
  ];

  return prompt.join('\n');
};

const loadPostContext = (postPath) => {
  const raw = readFileSync(postPath, 'utf8');
  const fileName = path.basename(postPath);
  const parsed = parseAndValidateFrontmatter(raw, { fileName });
  const template = parsed.meta.template ? getContentTemplate(parsed.meta.template) : null;
  const summaryFallback = createSummaryFallback(parsed.body);
  const tagPool = loadSiteTagPool(fileName);
  const matchedExistingTags = collectMatchedExistingTags({
    text: `${parsed.meta.title} ${parsed.meta.category} ${parsed.body}`,
    tagPool
  });
  const keywordCandidates = collectKeywordCandidates({ title: parsed.meta.title, body: parsed.body });
  const slug = slugify(parsed.meta.slug || fileName);

  return {
    raw,
    fileName,
    slug,
    postPath,
    post: parsed,
    template,
    summaryFallback,
    matchedExistingTags,
    keywordCandidates,
    tagPool,
    promptPath: path.join(aiAssistDir, `${slug}.prompt.md`),
    responsePath: path.join(aiAssistDir, `${slug}.response.json`)
  };
};

const runSuggest = (postPath) => {
  ensureAiAssistDir();
  const context = loadPostContext(postPath);
  const prompt = buildPrompt({
    postPath,
    post: context.post,
    template: context.template,
    summaryFallback: context.summaryFallback,
    matchedExistingTags: context.matchedExistingTags,
    keywordCandidates: context.keywordCandidates,
    allTags: context.tagPool
  });

  const promptFile = [
    '# AI 辅助摘要 / 标签生成 Prompt',
    '',
    `- 文章：${path.relative(rootDir, postPath)}`,
    `- 生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`,
    `- 默认响应文件：${path.relative(rootDir, context.responsePath)}`,
    '',
    '## 使用方式',
    '',
    '1. 把下面的 prompt 原样发给你常用的 AI。',
    '2. 让它只返回 JSON。',
    `3. 把 JSON 保存到 \`${path.relative(rootDir, context.responsePath)}\`。`,
    `4. 然后执行：\`npm run ai:assist -- apply ${path.relative(rootDir, postPath)}\``,
    '',
    '---',
    '',
    prompt,
    ''
  ].join('\n');

  writeFileSync(context.promptPath, promptFile, 'utf8');
  if (!existsSync(context.responsePath)) {
    writeFileSync(context.responsePath, createResponseTemplate(), 'utf8');
  }

  console.log(`✓ 已生成 AI 辅助工作流文件：`);
  console.log(`- Prompt：${path.relative(rootDir, context.promptPath)}`);
  console.log(`- Response 模板：${path.relative(rootDir, context.responsePath)}`);
  console.log(`- 自动摘要兜底：${context.summaryFallback}`);
  console.log(`- 命中的已有标签：${context.matchedExistingTags.length ? context.matchedExistingTags.join('、') : '暂无'}`);
  console.log('');
  console.log(`下一步：`);
  console.log(`1. 打开 ${path.relative(rootDir, context.promptPath)}，把 prompt 发给 AI`);
  console.log(`2. 将 AI 返回的 JSON 粘贴到 ${path.relative(rootDir, context.responsePath)}`);
  console.log(`3. 执行 npm run ai:assist -- apply ${path.relative(rootDir, postPath)}`);
};

const validateResponsePayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('AI 响应必须是 JSON 对象。');
  }

  const summary = String(payload.summary ?? '').trim();
  if (!summary) {
    throw new Error('AI 响应缺少 summary。');
  }

  if (summary.includes('\n')) {
    throw new Error('summary 只能是一行。');
  }

  const rawTags = Array.isArray(payload.tags) ? payload.tags : [];
  if (rawTags.length < 3 || rawTags.length > 5) {
    throw new Error('tags 需要提供 3~5 个标签。');
  }

  const dedupedTags = [];
  const seen = new Set();
  for (const tag of rawTags) {
    const normalizedTag = String(tag ?? '').trim();
    if (!normalizedTag) {
      throw new Error('tags 中存在空标签。');
    }
    if (normalizedTag.includes(',')) {
      throw new Error(`标签“${normalizedTag}”不能包含英文逗号。`);
    }
    const dedupeKey = normalizedTag.toLowerCase();
    if (seen.has(dedupeKey)) {
      throw new Error(`tags 中存在重复标签：${normalizedTag}`);
    }
    seen.add(dedupeKey);
    dedupedTags.push(normalizedTag);
  }

  return {
    summary,
    tags: dedupedTags
  };
};

const rebuildFrontmatter = (metaMap) => {
  const lines = [];

  for (const key of FIELD_ORDER) {
    if (!metaMap.has(key)) continue;
    const value = metaMap.get(key);
    if (value == null || value === '') continue;
    lines.push(`${key}: ${value}`);
  }

  return lines.join('\n');
};

const runApply = (postPath, responseInputPath = '') => {
  const context = loadPostContext(postPath);
  const resolvedResponsePath = responseInputPath
    ? path.resolve(rootDir, responseInputPath)
    : context.responsePath;

  if (!existsSync(resolvedResponsePath)) {
    throw new Error(`找不到 AI 响应文件：${resolvedResponsePath}`);
  }

  const payload = JSON.parse(readFileSync(resolvedResponsePath, 'utf8'));
  const validated = validateResponsePayload(payload);
  const match = context.raw.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error('文章缺少有效的 frontmatter，无法回填。');
  }

  const [, rawMeta, rawBody] = match;
  const metaMap = parseFrontmatterMap(rawMeta);
  metaMap.set('summary', validated.summary);
  metaMap.set('tags', validated.tags.join(', '));

  const nextContent = `---\n${rebuildFrontmatter(metaMap)}\n---\n\n${rawBody.trim()}\n`;
  parseAndValidateFrontmatter(nextContent, { fileName: context.fileName });
  writeFileSync(postPath, nextContent, 'utf8');

  console.log('✓ 已将 AI 结果回填到 frontmatter');
  console.log(`- 文章：${path.relative(rootDir, postPath)}`);
  console.log(`- 摘要：${validated.summary}`);
  console.log(`- 标签：${validated.tags.join('、')}`);
  console.log(`- 响应文件：${path.relative(rootDir, resolvedResponsePath)}`);
};

const main = () => {
  const [command = '', postInput = '', responseInput = ''] = process.argv.slice(2);

  if (!command || !postInput || ['-h', '--help', 'help'].includes(command)) {
    console.log(usage);
    return;
  }

  const postPath = resolvePostPath(postInput);

  if (command === 'suggest') {
    runSuggest(postPath);
    return;
  }

  if (command === 'apply') {
    runApply(postPath, responseInput);
    return;
  }

  throw new Error(`不支持的命令：${command}\n\n${usage}`);
};

try {
  main();
} catch (error) {
  console.error(`✖ ${error.message}`);
  process.exit(1);
}
