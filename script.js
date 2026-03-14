const root = document.documentElement;
const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');
const themeToggle = document.querySelector('[data-theme-toggle]');
const yearNode = document.querySelector('[data-current-year]');
const themeStorageKey = 'personal-blog-theme';
const pageLanguage = (root.lang || '').toLowerCase();
const isEnglishPage = pageLanguage.startsWith('en');
const runtimeThemeConfig = window.__PERSONAL_BLOG_THEME__ || {};
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

const getDefaultThemeMode = () => {
  const configuredMode = runtimeThemeConfig.defaultMode;
  return configuredMode === 'light' || configuredMode === 'dark' || configuredMode === 'system'
    ? configuredMode
    : 'system';
};

const getThemeColor = (theme) => {
  const configuredThemeColor = runtimeThemeConfig.themeColor?.[theme];
  if (typeof configuredThemeColor === 'string' && configuredThemeColor.trim()) {
    return configuredThemeColor.trim();
  }

  return theme === 'light' ? '#f4f7fb' : '#07111f';
};

const getPreferredTheme = () => {
  const savedTheme = getSavedTheme();
  if (savedTheme) {
    return savedTheme;
  }

  const defaultThemeMode = getDefaultThemeMode();
  return defaultThemeMode === 'system' ? (systemThemeQuery.matches ? 'light' : 'dark') : defaultThemeMode;
};

const syncThemeLabel = (theme) => {
  if (!themeToggle) return;
  const nextLabel = isEnglishPage
    ? theme === 'light'
      ? 'Switch to dark mode'
      : 'Switch to light mode'
    : theme === 'light'
      ? '切换到深色模式'
      : '切换到浅色模式';
  themeToggle.setAttribute('aria-label', nextLabel);
  themeToggle.setAttribute('title', nextLabel);
  themeToggle.textContent = theme === 'light' ? '☀︎' : '☾';
};

const syncThemeColor = (theme) => {
  if (!themeColorMeta) return;
  themeColorMeta.setAttribute('content', getThemeColor(theme));
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
  if (getSavedTheme() || getDefaultThemeMode() !== 'system') return;
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

const initProjectFilters = () => {
  const filterSections = document.querySelectorAll('[data-project-filter]');
  if (!filterSections.length) return;

  const projectViewStorageKey = 'personal-blog-project-view';
  const getSavedProjectView = () => {
    const saved = window.localStorage?.getItem(projectViewStorageKey);
    return saved === 'theme' || saved === 'portfolio' ? saved : null;
  };

  filterSections.forEach((section) => {
    if (section.dataset.projectFilterBound === 'true') return;
    section.dataset.projectFilterBound = 'true';

    const input = section.querySelector('[data-project-filter-input]');
    const grids = [...section.querySelectorAll('[data-project-filter-grid]')];
    const cards = [...section.querySelectorAll('[data-project-card]')];
    const feedback = section.querySelector('[data-project-filter-feedback]');
    const emptyState = section.querySelector('[data-project-filter-empty]');
    const emptySummary = section.querySelector('[data-project-filter-empty-summary]');
    const resetButton = section.querySelector('[data-project-filter-reset]');
    const filterButtons = [...section.querySelectorAll('[data-filter-option]')];
    const viewButtons = [...section.querySelectorAll('[data-project-view-option]')];
    const viewPanels = [...section.querySelectorAll('[data-project-view-panel]')];
    const total = Number(section.dataset.projectFilterTotal || cards.length);
    const initialView = getSavedProjectView() || section.dataset.projectView || 'theme';
    const state = { category: 'all', status: 'all', view: initialView };

    if (!grids.length || !cards.length || !feedback || !emptyState || !emptySummary) return;

    const syncFilterButtons = () => {
      filterButtons.forEach((button) => {
        const isActive = state[button.dataset.filterGroup] === button.dataset.filterValue;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });
    };

    const syncViewButtons = () => {
      viewButtons.forEach((button) => {
        const isActive = button.dataset.projectViewValue === state.view;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });
    };

    const syncViewPanels = () => {
      viewPanels.forEach((panel) => {
        panel.hidden = panel.dataset.projectViewPanel !== state.view;
      });
    };

    const buildFeedback = (query, visibleCount) => {
      const activeFilters = [];
      if (state.category !== 'all') activeFilters.push(`方向 “${state.category}”`);
      if (state.status !== 'all') activeFilters.push(`状态 “${state.status}”`);

      if (!query && !activeFilters.length) {
        return `当前共 ${total} 个项目，正在以${state.view === 'portfolio' ? '作品集模式' : '主题模式'}查看。`;
      }

      const parts = [];
      if (query) parts.push(`关键词 “${input?.value.trim() || ''}”`);
      if (activeFilters.length) parts.push(activeFilters.join('，'));
      return `${parts.join(' + ')} 共找到 ${visibleCount} / ${total} 个项目。`;
    };

    const buildEmptySummary = () => {
      const parts = [];
      const rawQuery = input?.value.trim() || '';
      if (rawQuery) parts.push(`关键词 “${rawQuery}”`);
      if (state.category !== 'all') parts.push(`方向 “${state.category}”`);
      if (state.status !== 'all') parts.push(`状态 “${state.status}”`);
      return parts.length
        ? `当前没有符合 ${parts.join(' + ')} 的项目，可以先清空条件再继续浏览。`
        : '当前筛选条件下还没有匹配内容。';
    };

    const updateResults = () => {
      const query = input?.value.trim().toLowerCase() || '';
      let visibleCount = 0;

      cards.forEach((card) => {
        const searchIndex = card.dataset.searchIndex || '';
        const cardCategory = card.dataset.category || '';
        const cardStatus = card.dataset.status || '';
        const matchesQuery = !query || searchIndex.includes(query);
        const matchesCategory = state.category === 'all' || cardCategory === state.category;
        const matchesStatus = state.status === 'all' || cardStatus === state.status;
        const matched = matchesQuery && matchesCategory && matchesStatus;
        card.hidden = !matched;
        if (matched && card.dataset.projectViewCard === state.view) {
          visibleCount += 1;
        }
      });

      const isEmpty = visibleCount === 0;
      grids.forEach((grid) => {
        const isCurrentView = grid.dataset.projectFilterGrid === state.view;
        grid.hidden = isEmpty || !isCurrentView;
      });
      emptyState.hidden = !isEmpty;
      emptySummary.textContent = buildEmptySummary();
      feedback.textContent = buildFeedback(query, visibleCount);
      syncFilterButtons();
      syncViewButtons();
      syncViewPanels();
      section.dataset.projectView = state.view;
    };

    input?.addEventListener('input', updateResults);
    input?.addEventListener('search', updateResults);

    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state[button.dataset.filterGroup] = button.dataset.filterValue;
        updateResults();
      });
    });

    viewButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.view = button.dataset.projectViewValue || 'theme';
        window.localStorage?.setItem(projectViewStorageKey, state.view);
        updateResults();
      });
    });

    if (resetButton) {
      resetButton.addEventListener('click', () => {
        if (input) input.value = '';
        state.category = 'all';
        state.status = 'all';
        updateResults();
        input?.focus();
      });
    }

    updateResults();
  });
};

initProjectFilters();

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

/* ===== ENHANCED SCRIPT BEHAVIORS ===== */

// Page loader - remove after content loads
(function() {
  const loader = document.querySelector('[data-page-loader]');
  if (!loader) return;

  function hideLoader() {
    document.body.classList.remove('is-loading');
  }

  if (document.readyState === 'complete') {
    hideLoader();
  } else {
    window.addEventListener('load', hideLoader, { once: true });
    // Fallback timeout
    setTimeout(hideLoader, 3000);
  }
})();

// Header scroll detection
(function() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  let ticking = false;
  
  function updateHeader() {
    header.classList.toggle('is-scrolled', window.scrollY > 48);
    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }, { passive: true });
  
  // Initial check
  updateHeader();
})();

// Nav toggle animation
(function() {
  const navToggle = document.querySelector('[data-nav-toggle]');
  if (!navToggle) return;

  navToggle.addEventListener('click', function() {
    this.classList.toggle('is-open');
  });
})();

// Code block copy functionality
(function() {
  document.addEventListener('click', function(e) {
    const copyBtn = e.target.closest('[data-copy-code]');
    if (!copyBtn) return;

    const codeBlock = copyBtn.closest('.code-block');
    const codeContent = codeBlock?.querySelector('.code-block__code');
    const text = codeContent ? codeContent.innerText : '';
    const originalText = copyBtn.textContent;

    navigator.clipboard.writeText(text).then(function() {
      copyBtn.textContent = '已复制!';
      copyBtn.classList.add('is-copied');
      
      setTimeout(function() {
        copyBtn.textContent = originalText;
        copyBtn.classList.remove('is-copied');
      }, 2000);
    }).catch(function() {
      copyBtn.textContent = '复制失败';
      setTimeout(function() {
        copyBtn.textContent = originalText;
      }, 2000);
    });
  });
})();

// Lightbox for images
(function() {
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML = '<button class="lightbox__close" aria-label="关闭">&times;</button><img class="lightbox__img" src="" alt="" />';
  document.body.appendChild(lightbox);

  const lightboxImg = lightbox.querySelector('.lightbox__img');
  const closeBtn = lightbox.querySelector('.lightbox__close');

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // Click on images in prose and post cover
  document.addEventListener('click', function(e) {
    const img = e.target.closest('.prose-image img, .prose-figure img, .post-cover img');
    if (!img) return;
    
    const src = img.src || img.dataset.src;
    const alt = img.alt || '';
    if (src) openLightbox(src, alt);
  });

  // Close handlers
  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && lightbox.classList.contains('is-open')) {
      closeLightbox();
    }
  });
})();

// Smooth scroll for anchor links
(function() {
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    
    const targetId = link.getAttribute('href');
    if (targetId === '#') return;
    
    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update URL without jump
      history.pushState(null, '', targetId);
    }
  });
})();

// Enhanced button ripple effect
(function() {
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.button');
    if (!btn || btn.querySelector('.ripple')) return;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    
    btn.appendChild(ripple);
    
    ripple.addEventListener('animationend', function() {
      ripple.remove();
    });
  });
})();

/* ===== NEW FEATURES ===== */

// Mobile Navigation Toggle
function initMobileNav() {
  const navToggle = document.getElementById('nav-toggle');
  const siteNav = document.getElementById('site-nav');
  const overlay = document.getElementById('mobile-nav-overlay');
  
  if (!navToggle || !siteNav) return;
  
  navToggle.addEventListener('click', () => {
    const isOpen = siteNav.classList.contains('is-open');
    
    if (isOpen) {
      siteNav.classList.remove('is-open');
      navToggle.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      if (overlay) overlay.classList.remove('is-open');
    } else {
      siteNav.classList.add('is-open');
      navToggle.classList.add('is-open');
      navToggle.setAttribute('aria-expanded', 'true');
      if (overlay) overlay.classList.add('is-open');
    }
  });
  
  if (overlay) {
    overlay.addEventListener('click', () => {
      siteNav.classList.remove('is-open');
      navToggle.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      overlay.classList.remove('is-open');
    });
  }
  
  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && siteNav.classList.contains('is-open')) {
      siteNav.classList.remove('is-open');
      navToggle.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      if (overlay) overlay.classList.remove('is-open');
    }
  });
}

// Reading Progress Bar
function initReadingProgress() {
  const progressBar = document.querySelector('.reading-progress__bar');
  const body = document.body;
  
  if (!progressBar) return;
  
  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    
    progressBar.style.setProperty('--reading-progress-value', `${progress}%`);
    
    if (progress > 0) {
      body.classList.add('has-reading-progress');
    } else {
      body.classList.remove('has-reading-progress');
    }
  }
  
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
}

// Back to Top Button
function initBackToTop() {
  const backToTop = document.getElementById('back-to-top');
  
  if (!backToTop) return;
  
  function toggleVisibility() {
    if (window.scrollY > 300) {
      backToTop.classList.add('is-visible');
    } else {
      backToTop.classList.remove('is-visible');
    }
  }
  
  backToTop.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
  
  window.addEventListener('scroll', toggleVisibility, { passive: true });
  toggleVisibility();
}

// Lightbox for Images
function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox?.querySelector('.lightbox__img');
  const lightboxClose = lightbox?.querySelector('.lightbox__close');
  
  if (!lightbox) return;
  
  // Open on image click
  document.addEventListener('click', (e) => {
    const img = e.target.closest('img[data-lightbox]') || 
                (e.target.tagName === 'IMG' && e.target.closest('.prose-image, .post-cover'));
    
    if (img && !img.hasAttribute('data-no-lightbox')) {
      const src = img.src || img.dataset.src;
      if (src && lightboxImg) {
        lightboxImg.src = src;
        lightbox.classList.add('is-open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }
    }
  });
  
  // Close functions
  const closeLightbox = () => {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };
  
  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }
  
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('is-open')) {
      closeLightbox();
    }
  });
}

// Filter Chips Interaction
function initFilterChips() {
  const filterChips = document.querySelectorAll('.filter-chip');
  
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const parent = chip.closest('.filter-chips') || chip.closest('.filter-group');
      if (!parent) return;
      
      // Remove active from siblings
      parent.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('is-active'));
      
      // Add active to clicked
      chip.classList.add('is-active');
    });
  });
}

// Search Highlight (demo)
function initSearchHighlight() {
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q');
  
  if (!query) return;
  
  // In a real implementation, this would highlight search terms
  console.log('Searching for:', query);
}

// TOC Active State
function initTocHighlighting() {
  const tocLinks = document.querySelectorAll('.toc-list a');
  
  if (tocLinks.length === 0) return;
  
  const headings = Array.from(tocLinks).map(link => {
    const id = link.getAttribute('href').slice(1);
    return document.getElementById(id);
  }).filter(Boolean);
  
  function updateActiveLink() {
    let currentIndex = 0;
    
    headings.forEach((heading, index) => {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= 120) {
        currentIndex = index;
      }
    });
    
    tocLinks.forEach((link, index) => {
      if (index === currentIndex) {
        link.style.color = 'var(--accent)';
        link.style.fontWeight = '600';
      } else {
        link.style.color = '';
        link.style.fontWeight = '';
      }
    });
  }
  
  window.addEventListener('scroll', updateActiveHighlighting, { passive: true });
  
  let ticking = false;
  function updateActiveHighlighting() {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateActiveLink();
        ticking = false;
      });
      ticking = true;
    }
  }
}

// Scroll Reveal Animation
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  
  if (reveals.length === 0) return;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });
  
  reveals.forEach(el => observer.observe(el));
}

// Header Scroll State
function initHeaderScroll() {
  const header = document.getElementById('site-header');
  
  if (!header) return;
  
  function toggleScrolled() {
    if (window.scrollY > 50) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  }
  
  window.addEventListener('scroll', toggleScrolled, { passive: true });
  toggleScrolled();
}

// Page Loader
function initPageLoader() {
  const loader = document.querySelector('.page-loader');
  
  if (!loader) return;
  
  window.addEventListener('load', () => {
    document.body.classList.add('is-loading');
    
    setTimeout(() => {
      loader.style.opacity = '0';
      loader.style.visibility = 'hidden';
      document.body.classList.remove('is-loading');
    }, 500);
  });
}

// Initialize all features
document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initReadingProgress();
  initBackToTop();
  initLightbox();
  initFilterChips();
  initSearchHighlight();
  initTocHighlighting();
  initScrollReveal();
  initHeaderScroll();
  initPageLoader();
});
