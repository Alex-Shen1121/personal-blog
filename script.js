const root = document.documentElement;
const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');
const themeToggle = document.querySelector('[data-theme-toggle]');
const yearNode = document.querySelector('[data-current-year]');
const themeStorageKey = 'personal-blog-theme';
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: light)');
const prefersReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const currentScript = document.currentScript || document.querySelector('script[data-site-main-script]');
const currentScriptUrl = currentScript?.src || '';
const enhancementsScriptUrl = currentScript?.dataset.enhancementsSrc || '';
const analyticsScriptUrl = currentScript?.dataset.analyticsSrc || '';

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

const postShareCard = document.querySelector('[data-post-share]');
const nativeShareButton = postShareCard?.querySelector('[data-share-native]');
const copyShareButton = postShareCard?.querySelector('[data-share-copy]');
const shareFeedback = postShareCard?.querySelector('[data-share-feedback]');
let shareFeedbackTimer = 0;

const setShareFeedback = (message) => {
  if (!shareFeedback) return;

  shareFeedback.textContent = message;
  if (shareFeedbackTimer) {
    window.clearTimeout(shareFeedbackTimer);
  }

  shareFeedbackTimer = window.setTimeout(() => {
    shareFeedback.textContent = '也可以把链接直接发到聊天窗口。';
  }, 2400);
};

const copyText = async (value) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const success = document.execCommand('copy');
  textarea.remove();

  if (!success) {
    throw new Error('copy_failed');
  }
};

if (postShareCard) {
  const shareTitle = postShareCard.dataset.shareTitle || document.title;
  const shareText = postShareCard.dataset.shareText || shareTitle;
  const shareUrl = postShareCard.dataset.shareUrl || window.location.href;

  if (nativeShareButton) {
    if (typeof navigator.share !== 'function') {
      nativeShareButton.hidden = true;
    } else {
      nativeShareButton.addEventListener('click', async () => {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
          });
          setShareFeedback('已调用系统分享面板。');
        } catch (error) {
          if (error?.name === 'AbortError') return;
          setShareFeedback('系统分享暂时不可用，请改用复制链接。');
        }
      });
    }
  }

  if (copyShareButton) {
    copyShareButton.addEventListener('click', async () => {
      try {
        await copyText(shareUrl);
        setShareFeedback('链接已复制，可以直接发送给别人。');
      } catch (error) {
        setShareFeedback('复制失败，请手动复制浏览器地址栏链接。');
      }
    });
  }
}

const initAnalytics = () => {
  const analyticsCards = [...document.querySelectorAll('[data-analytics-card]')];
  const analyticsValues = [...document.querySelectorAll('[data-busuanzi-value]')];

  if (!analyticsCards.length || !analyticsValues.length) {
    return;
  }

  const loadingText = analyticsCards[0]?.dataset.analyticsLoading || '访问统计加载中…';
  const readyText = analyticsCards[0]?.dataset.analyticsReady || '统计已更新，数据可能有短暂延迟。';
  const unavailableText = analyticsCards[0]?.dataset.analyticsUnavailable || '统计服务暂时不可用。';
  let finished = false;
  let pollTimer = 0;
  let fallbackTimer = 0;

  const updateCardStatus = (message, state) => {
    analyticsCards.forEach((card) => {
      card.dataset.analyticsState = state;
      const status = card.querySelector('[data-analytics-status]');
      if (status) {
        status.textContent = message;
      }
    });
  };

  const hasAnalyticsValue = () =>
    analyticsValues.some((node) => {
      const value = (node.textContent || '').trim();
      return /^\d[\d,]*$/.test(value);
    });

  const finishWithReady = () => {
    if (finished) return;
    finished = true;
    updateCardStatus(readyText, 'ready');
    if (pollTimer) window.clearInterval(pollTimer);
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
  };

  const finishWithUnavailable = () => {
    if (finished) return;
    finished = true;
    analyticsValues.forEach((node) => {
      const value = (node.textContent || '').trim();
      if (!/^\d[\d,]*$/.test(value)) {
        node.textContent = '--';
      }
    });
    updateCardStatus(unavailableText, 'unavailable');
    if (pollTimer) window.clearInterval(pollTimer);
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
  };

  updateCardStatus(loadingText, 'loading');

  if (hasAnalyticsValue()) {
    finishWithReady();
    return;
  }

  pollTimer = window.setInterval(() => {
    if (hasAnalyticsValue()) {
      finishWithReady();
    }
  }, 250);

  fallbackTimer = window.setTimeout(() => {
    finishWithUnavailable();
  }, 5000);

  if (!analyticsScriptUrl) {
    finishWithUnavailable();
    return;
  }

  const existingScript = document.querySelector('script[data-analytics-script="busuanzi"]');
  if (existingScript) {
    existingScript.addEventListener('error', finishWithUnavailable, { once: true });
    return;
  }

  const analyticsScript = document.createElement('script');
  analyticsScript.src = analyticsScriptUrl;
  analyticsScript.async = true;
  analyticsScript.defer = true;
  analyticsScript.dataset.analyticsScript = 'busuanzi';
  analyticsScript.addEventListener('error', finishWithUnavailable, { once: true });
  document.head.append(analyticsScript);
};

initAnalytics();

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
  script.src = enhancementsScriptUrl || new URL('enhancements.js', currentScriptUrl || window.location.href).toString();
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
