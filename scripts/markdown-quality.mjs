const MIN_CONTENT_CHARACTERS = 120;
const STRUCTURED_CONTENT_THRESHOLD = 400;
const PLACEHOLDER_RULES = [
  { pattern: /\bTODO\b/i, label: 'TODO' },
  { pattern: /\bTBD\b/i, label: 'TBD' },
  { pattern: /待补充|稍后补充|后续补充/, label: '待补充' },
  { pattern: /lorem ipsum/i, label: 'Lorem ipsum' }
];

const createError = (fileName, message) => new Error(`Post ${fileName} ${message}`);

const stripMarkdownToPlainText = (content) =>
  content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractHeadingEntries = (content, fileName) => {
  const headings = [];
  let inCodeBlock = false;

  for (const [index, rawLine] of content.split('\n').entries()) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock || !trimmed) continue;

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (!headingMatch) continue;

    const [, hashes, text] = headingMatch;
    const level = hashes.length;
    const headingText = text.trim();

    if (!headingText) {
      throw createError(fileName, `has an empty heading on line ${index + 1}.`);
    }

    headings.push({ level, text: headingText, lineNumber: index + 1 });
  }

  if (inCodeBlock) {
    throw createError(fileName, 'has an unclosed fenced code block.');
  }

  return headings;
};

const validateHeadings = (content, fileName, plainTextLength) => {
  const headings = extractHeadingEntries(content, fileName);

  for (const heading of headings) {
    if (heading.level === 1) {
      throw createError(fileName, `uses a level-1 heading in Markdown body on line ${heading.lineNumber}. Use frontmatter title instead.`);
    }
  }

  for (let index = 1; index < headings.length; index += 1) {
    const previousHeading = headings[index - 1];
    const currentHeading = headings[index];

    if (currentHeading.level > previousHeading.level + 1) {
      throw createError(
        fileName,
        `jumps heading levels from H${previousHeading.level} to H${currentHeading.level} on line ${currentHeading.lineNumber}.`
      );
    }
  }

  if (plainTextLength >= STRUCTURED_CONTENT_THRESHOLD && headings.length === 0) {
    throw createError(fileName, 'is long enough to require at least one section heading for readability.');
  }
};

const validateImages = (content, fileName) => {
  const imagePattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g;
  let match = imagePattern.exec(content);

  while (match) {
    const [, alt, src] = match;

    if (!alt.trim()) {
      throw createError(fileName, `has an image without alt text: ${src}.`);
    }

    if (!src.trim()) {
      throw createError(fileName, 'has an image with an empty source path.');
    }

    match = imagePattern.exec(content);
  }
};

const validateLinks = (content, fileName) => {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match = linkPattern.exec(content);

  while (match) {
    const [, label, href] = match;
    const normalizedLabel = label.trim();
    const normalizedHref = href.trim();

    if (!normalizedLabel) {
      throw createError(fileName, 'has a link with empty label text.');
    }

    if (!normalizedHref) {
      throw createError(fileName, `has a link with an empty target for label "${normalizedLabel}".`);
    }

    if (/^javascript:/i.test(normalizedHref)) {
      throw createError(fileName, `uses an unsafe javascript: link target "${normalizedHref}".`);
    }

    match = linkPattern.exec(content);
  }
};

const validatePlaceholderCopy = (content, fileName) => {
  for (const rule of PLACEHOLDER_RULES) {
    if (rule.pattern.test(content)) {
      throw createError(fileName, `contains placeholder content (${rule.label}).`);
    }
  }
};

export const validateMarkdownContentQuality = (content, { fileName = 'unknown.md' } = {}) => {
  const normalizedContent = content.trim();
  if (!normalizedContent) {
    throw createError(fileName, 'has an empty Markdown body.');
  }

  const plainText = stripMarkdownToPlainText(normalizedContent);
  if (plainText.length < MIN_CONTENT_CHARACTERS) {
    throw createError(
      fileName,
      `is too short after removing Markdown syntax. Write at least ${MIN_CONTENT_CHARACTERS} characters of substantive content.`
    );
  }

  validatePlaceholderCopy(normalizedContent, fileName);
  validateImages(normalizedContent, fileName);
  validateLinks(normalizedContent, fileName);
  validateHeadings(normalizedContent, fileName, plainText.length);

  return {
    plainTextLength: plainText.length
  };
};
