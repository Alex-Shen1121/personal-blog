const root = document.documentElement;
const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');
const themeToggle = document.querySelector('[data-theme-toggle]');
const yearNode = document.querySelector('[data-current-year]');
const themeStorageKey = 'personal-blog-theme';
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: light)');
const prefersReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const currentScriptUrl = document.currentScript?.src || document.querySelector('script[src$="/script.js"], script[src="script.js"]')?.src || '';

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

const getSavedTheme = () => {
  const saved = localStorage.getItem(themeStorageKey);
  return saved === 'light' || saved === 'dark' ? saved : null;
};

const getPreferredTheme = () => getSavedTheme() ?? (systemThemeQuery.matches ? 'light' : 'dark');

const syncThemeLabel = (theme) => {
  if (!themeToggle) return;
  const nextLabel = theme === 'light' ? '切换到深色模式' : '切换到浅色模式';
  themeToggle.setAttribute('aria-label', nextLabel);
  themeToggle.setAttribute('title', nextLabel);
  themeToggle.textContent = theme === 'light' ? '☀︎' : '☾';
};

const syncThemeColor = (theme) => {
  if (!themeColorMeta) return;
  themeColorMeta.setAttribute('content', theme === 'light' ? '#f4f7fb' : '#07111f');
};

const applyTheme = (theme) => {
  root.dataset.theme = theme;
  syncThemeLabel(theme);
  syncThemeColor(theme);
};

applyTheme(getPreferredTheme());

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const nextTheme = root.dataset.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
  });
}

systemThemeQuery.addEventListener('change', (event) => {
  if (getSavedTheme()) return;
  applyTheme(event.matches ? 'light' : 'dark');
});

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('is-open', !expanded);
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const revealItems = document.querySelectorAll('.reveal');
const revealStepSelectors = [
  '.card-grid > *',
  '.project-grid > *',
  '.post-grid > *',
  '.skills-grid > *',
  '.nav-guide-grid > *',
  '.featured-posts__sidebar > *',
  '.featured-projects__sidebar > *',
  '.metrics > *',
  '.stats-grid > *',
  '.contact-grid > *',
  '.split-grid > *',
  '.project-media-grid > *',
  '.archive-list > *',
  '.tag-directory > *',
  '.timeline > *',
  '.post-pagination > *',
  '.project-facts > *'
];
const revealDirectContainers = ['.hero-copy', '.hero-visual', '.page-hero', '.post-header'];
const revealNestedGroups = [
  '.card-grid',
  '.project-grid',
  '.post-grid',
  '.skills-grid',
  '.nav-guide-grid',
  '.featured-posts__sidebar',
  '.featured-projects__sidebar',
  '.metrics',
  '.stats-grid',
  '.contact-grid',
  '.split-grid',
  '.project-media-grid',
  '.archive-list',
  '.tag-directory',
  '.timeline',
  '.post-pagination',
  '.project-facts'
];

revealItems.forEach((item) => {
  const revealSteps = new Set();

  if (revealDirectContainers.some((selector) => item.matches(selector))) {
    [...item.children]
      .filter((child) => !revealNestedGroups.some((selector) => child.matches(selector)))
      .forEach((child) => revealSteps.add(child));
  }

  item.querySelectorAll(revealStepSelectors.join(',')).forEach((child) => revealSteps.add(child));

  [...revealSteps].forEach((child, index) => {
    child.classList.add('reveal-step');
    child.style.setProperty('--reveal-delay', `${Math.min(index, 7) * 70}ms`);
  });
});

if (prefersReducedMotionQuery.matches) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.14,
      rootMargin: '0px 0px -8% 0px'
    }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

let enhancementsRequested = false;

const loadEnhancements = () => {
  if (enhancementsRequested) return;
  enhancementsRequested = true;

  const script = document.createElement('script');
  script.src = new URL('enhancements.js', currentScriptUrl || window.location.href).toString();
  script.defer = true;
  script.dataset.siteEnhancements = 'true';
  document.head.append(script);
};

const queueEnhancements = () => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadEnhancements, { timeout: 1500 });
    return;
  }

  window.setTimeout(loadEnhancements, 1);
};

if (document.readyState === 'complete') {
  queueEnhancements();
} else {
  window.addEventListener('load', queueEnhancements, { once: true });
}
