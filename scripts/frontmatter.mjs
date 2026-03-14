import { contentTemplateKeys } from '../src/data/content-templates.mjs';

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const FIELD_SCHEMA = {
  title: { required: true, type: 'string' },
  date: { required: true, type: 'date' },
  updated: { required: false, type: 'date' },
  summary: { required: false, type: 'string' },
  slug: { required: false, type: 'string' },
  category: { required: true, type: 'string' },
  tags: { required: true, type: 'tags' },
  cover: { required: false, type: 'string' },
  template: { required: false, type: 'contentTemplate' },
  ogTitle: { required: false, type: 'string' },
  ogDescription: { required: false, type: 'string' },
  ogImage: { required: false, type: 'string' },
  draft: { required: false, type: 'boolean' },
  pinned: { required: false, type: 'boolean' },
  series: { required: false, type: 'string' },
  seriesOrder: { required: false, type: 'positiveInteger' }
};

const allowedFields = new Set(Object.keys(FIELD_SCHEMA));

const createError = (fileName, message) => new Error(`Post ${fileName} ${message}`);

const parseYamlLikeLine = (line, fileName) => {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex === -1) {
    throw createError(fileName, `has invalid frontmatter line "${line}". Use key: value.`);
  }

  const key = line.slice(0, separatorIndex).trim();
  const value = line.slice(separatorIndex + 1).trim();
  if (!key) {
    throw createError(fileName, `has invalid frontmatter line "${line}". Missing field name.`);
  }

  return { key, value };
};

const parseIsoDate = (value) => {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const parseTags = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeFieldValue = ({ key, value, fileName }) => {
  const rule = FIELD_SCHEMA[key];
  if (!rule) {
    throw createError(fileName, `uses unsupported frontmatter field "${key}".`);
  }

  if (rule.type === 'string') {
    if (!value) {
      throw createError(fileName, `has empty ${key} field.`);
    }
    return value;
  }

  if (rule.type === 'date') {
    const parsedDate = parseIsoDate(value);
    if (!parsedDate) {
      throw createError(fileName, `has invalid ${key} field. Use YYYY-MM-DD.`);
    }
    return value;
  }

  if (rule.type === 'boolean') {
    if (!['true', 'false'].includes(value)) {
      throw createError(fileName, `has invalid ${key} field. Use ${key}: true or ${key}: false.`);
    }
    return value === 'true';
  }

  if (rule.type === 'positiveInteger') {
    if (!/^[1-9]\d*$/.test(value)) {
      throw createError(fileName, `has invalid ${key} field. Use a positive integer.`);
    }
    return Number(value);
  }

  if (rule.type === 'tags') {
    const tags = parseTags(value);
    if (!tags.length) {
      throw createError(fileName, 'must provide at least one tag in tags field.');
    }

    const normalizedTags = new Set();
    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase();
      if (normalizedTags.has(normalizedTag)) {
        throw createError(fileName, `has duplicate tag "${tag}".`);
      }
      normalizedTags.add(normalizedTag);
    }

    return tags;
  }

  if (rule.type === 'contentTemplate') {
    if (!value) {
      throw createError(fileName, 'has empty template field.');
    }

    if (!contentTemplateKeys.has(value)) {
      throw createError(
        fileName,
        `uses unsupported template "${value}". Supported templates: ${Array.from(contentTemplateKeys).join(', ')}.`
      );
    }

    return value;
  }

  return value;
};

export const parseAndValidateFrontmatter = (content, { fileName = 'unknown.md' } = {}) => {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw createError(fileName, 'is missing a valid frontmatter block.');
  }

  const [, rawMeta, rawBody] = match;
  const meta = {};
  const seenFields = new Set();

  for (const rawLine of rawMeta.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const { key, value } = parseYamlLikeLine(line, fileName);

    if (!allowedFields.has(key)) {
      throw createError(fileName, `uses unsupported frontmatter field "${key}".`);
    }

    if (seenFields.has(key)) {
      throw createError(fileName, `has duplicate frontmatter field "${key}".`);
    }
    seenFields.add(key);

    meta[key] = normalizeFieldValue({ key, value, fileName });
  }

  for (const [key, rule] of Object.entries(FIELD_SCHEMA)) {
    if (rule.required && !seenFields.has(key)) {
      throw createError(fileName, `is missing frontmatter field: ${key}.`);
    }
  }

  const hasSeries = Object.prototype.hasOwnProperty.call(meta, 'series');
  const hasSeriesOrder = Object.prototype.hasOwnProperty.call(meta, 'seriesOrder');
  if (hasSeries !== hasSeriesOrder) {
    throw createError(fileName, 'must provide both series and seriesOrder together.');
  }

  if (meta.updated && meta.date) {
    const publishedAt = parseIsoDate(meta.date);
    const updatedAt = parseIsoDate(meta.updated);
    if (publishedAt && updatedAt && updatedAt < publishedAt) {
      throw createError(fileName, 'has updated earlier than date.');
    }
  }

  return {
    meta,
    body: rawBody.trim()
  };
};
