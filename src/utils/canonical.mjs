const CANONICAL_HTML_EXCEPTIONS = new Set(['/404.html']);

export const normalizeRepoBasePath = (value = '/') => {
  const normalized = value.trim();
  if (!normalized || normalized === '/') {
    return '/';
  }

  return `/${normalized.replace(/^\/+|\/+$/g, '')}/`;
};

export const normalizeSiteUrl = (value = '') => {
  const url = new URL(value);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Canonical siteUrl must use http or https: ${value}`);
  }

  if (url.search || url.hash) {
    throw new Error(`Canonical siteUrl must not contain query or hash: ${value}`);
  }

  url.pathname = normalizeRepoBasePath(url.pathname || '/');
  return url.toString();
};

export const validateCanonicalConfig = ({ siteUrl, repoBasePath }) => {
  const errors = [];
  let normalizedSiteUrl = '';
  let normalizedRepoBasePath = '/';

  try {
    normalizedRepoBasePath = normalizeRepoBasePath(repoBasePath);
  } catch (error) {
    errors.push(error.message);
  }

  try {
    normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  } catch (error) {
    errors.push(error.message);
  }

  if (!normalizedSiteUrl) {
    return { errors, normalizedSiteUrl, normalizedRepoBasePath };
  }

  const parsedSiteUrl = new URL(normalizedSiteUrl);
  if (parsedSiteUrl.pathname !== normalizedRepoBasePath) {
    errors.push(
      `site.siteUrl pathname (${parsedSiteUrl.pathname}) must match site.repoBasePath (${normalizedRepoBasePath}) for canonical URLs.`
    );
  }

  return { errors, normalizedSiteUrl, normalizedRepoBasePath };
};

export const validateCanonicalPath = (currentPath, { repoBasePath = '/' } = {}) => {
  const normalizedRepoBasePath = normalizeRepoBasePath(repoBasePath);
  const errors = [];

  if (!currentPath || typeof currentPath !== 'string') {
    return ['Canonical path must be a non-empty string.'];
  }

  if (!currentPath.startsWith('/')) {
    errors.push(`Canonical path must start with "/": ${currentPath}`);
  }

  if (/[?#]/.test(currentPath)) {
    errors.push(`Canonical path must not contain query or hash: ${currentPath}`);
  }

  if (currentPath.includes('//')) {
    errors.push(`Canonical path must not contain duplicate slashes: ${currentPath}`);
  }

  if (normalizedRepoBasePath !== '/' && currentPath.startsWith(normalizedRepoBasePath)) {
    errors.push(
      `Canonical path should be site-root relative and must not repeat repoBasePath (${normalizedRepoBasePath}): ${currentPath}`
    );
  }

  if (currentPath.endsWith('/index.html')) {
    errors.push(`Canonical path must not end with /index.html: ${currentPath}`);
  }

  const isHtmlException = CANONICAL_HTML_EXCEPTIONS.has(currentPath);
  if (currentPath !== '/' && !isHtmlException && !currentPath.endsWith('/')) {
    errors.push(`Canonical path must end with a trailing slash unless explicitly exempted: ${currentPath}`);
  }

  if (currentPath !== '/' && !isHtmlException && /\.html$/i.test(currentPath)) {
    errors.push(`Canonical path must not expose .html files unless explicitly exempted: ${currentPath}`);
  }

  return errors;
};

export const assertValidCanonicalPath = (currentPath, options = {}) => {
  const errors = validateCanonicalPath(currentPath, options);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
};

export const buildCanonicalUrl = (siteConfig, currentPath) => {
  const { siteUrl, repoBasePath } = siteConfig;
  const configValidation = validateCanonicalConfig({ siteUrl, repoBasePath });
  if (configValidation.errors.length > 0) {
    throw new Error(configValidation.errors.join('\n'));
  }

  assertValidCanonicalPath(currentPath, { repoBasePath: configValidation.normalizedRepoBasePath });
  return new URL(currentPath === '/' ? '' : currentPath.slice(1), configValidation.normalizedSiteUrl).toString();
};
