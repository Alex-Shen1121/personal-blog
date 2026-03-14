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

/* ===== ENHANCED FEATURES 31-45 ===== */

// 31. Global Search (CMD+K / CTRL+K)
function initGlobalSearch() {
  const searchOverlay = document.createElement('div');
  searchOverlay.className = 'search-overlay';
  searchOverlay.innerHTML = `
    <div class="search-modal">
      <div class="search-modal__header">
        <input type="text" class="search-input" placeholder="搜索文章、项目、标签..." aria-label="搜索">
        <button class="search-close" aria-label="关闭搜索">✕</button>
      </div>
      <div class="search-results">
        <div class="search-results__empty">输入关键词开始搜索</div>
      </div>
      <div class="search-footer">
        <span class="search-hint"><kbd>↑</kbd> <kbd>↓</kbd> 导航</span>
        <span class="search-hint"><kbd>↵</kbd> 选择</span>
        <span class="search-hint"><kbd>ESC</kbd> 关闭</span>
      </div>
    </div>
  `;
  document.body.appendChild(searchOverlay);

  const searchInput = searchOverlay.querySelector('.search-input');
  const searchResults = searchOverlay.querySelector('.search-results');
  const searchClose = searchOverlay.querySelector('.search-close');
  const searchModal = searchOverlay.querySelector('.search-modal');

  // Generate mock search index from page content
  const searchIndex = [];
  document.querySelectorAll('.post-card, .project-card, .tag').forEach(item => {
    const title = item.querySelector('h3, h4, a')?.textContent || '';
    const desc = item.querySelector('p')?.textContent || '';
    const link = item.querySelector('a')?.href || '';
    if (title && link) {
      searchIndex.push({ title: title.trim(), desc: desc.trim(), link });
    }
  });

  // Search history
  const searchHistoryKey = 'personal-blog-search-history';
  const getSearchHistory = () => JSON.parse(localStorage.getItem(searchHistoryKey) || '[]');
  const addSearchHistory = (query) => {
    if (!query.trim()) return;
    let history = getSearchHistory();
    history = [query, ...history.filter(h => h !== query)].slice(0, 5);
    localStorage.setItem(searchHistoryKey, JSON.stringify(history));
  };

  const performSearch = (query) => {
    if (!query.trim()) {
      const history = getSearchHistory();
      if (history.length > 0) {
        searchResults.innerHTML = `
          <div class="search-results__section">
            <div class="search-results__title">最近搜索</div>
            ${history.map(h => `<a href="?q=${encodeURIComponent(h)}" class="search-result" data-search-history="${h}">${highlightMatch(h, h)}</a>`).join('')}
          </div>
        `;
      } else {
        searchResults.innerHTML = '<div class="search-results__empty">输入关键词开始搜索</div>';
      }
      return;
    }

    const results = searchIndex.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.desc.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10);

    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-results__empty">未找到相关结果</div>';
      return;
    }

    searchResults.innerHTML = `
      <div class="search-results__section">
        <div class="search-results__title">搜索结果</div>
        ${results.map((item, i) => `
          <a href="${item.link}" class="search-result${i === 0 ? ' is-active' : ''}" data-index="${i}">
            <span class="search-result__title">${highlightMatch(item.title, query)}</span>
            <span class="search-result__desc">${highlightMatch(item.desc, query)}</span>
          </a>
        `).join('')}
      </div>
    `;
  };

  const highlightMatch = (text, query) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  const openSearch = () => {
    searchOverlay.classList.add('is-open');
    searchInput.focus();
    document.body.style.overflow = 'hidden';
  };

  const closeSearch = () => {
    searchOverlay.classList.remove('is-open');
    searchInput.value = '';
    searchResults.innerHTML = '<div class="search-results__empty">输入关键词开始搜索</div>';
    document.body.style.overflow = '';
  };

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape' && searchOverlay.classList.contains('is-open')) {
      closeSearch();
    }
  });

  // Click on search button
  document.querySelector('[data-search-trigger]')?.addEventListener('click', openSearch);

  // Search input
  let selectedIndex = -1;
  searchInput.addEventListener('input', (e) => {
    performSearch(e.target.value);
    selectedIndex = -1;
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    const results = searchResults.querySelectorAll('.search-result');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
      updateSelection(results);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection(results);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        addSearchHistory(searchInput.value);
        window.location.href = results[selectedIndex].href;
      } else if (searchInput.value.trim()) {
        addSearchHistory(searchInput.value);
        window.location.href = `/search.html?q=${encodeURIComponent(searchInput.value)}`;
      }
    }
  });

  const updateSelection = (results) => {
    results.forEach((r, i) => r.classList.toggle('is-active', i === selectedIndex));
  };

  // Close handlers
  searchClose.addEventListener('click', closeSearch);
  searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) closeSearch();
  });
}

// 32. Navigation Dropdown
function initNavDropdown() {
  const navItems = document.querySelectorAll('.site-nav > li');
  
  navItems.forEach(item => {
    const link = item.querySelector('a');
    const dropdown = item.querySelector('.nav-dropdown');
    
    if (!dropdown) return;
    
    item.classList.add('has-dropdown');
    
    link?.addEventListener('click', (e) => {
      if (window.innerWidth > 768) {
        e.preventDefault();
        item.classList.toggle('is-open');
      }
    });
    
    document.addEventListener('click', (e) => {
      if (!item.contains(e.target)) {
        item.classList.remove('is-open');
      }
    });
  });
}

// 33. Enhanced TOC (click to scroll + active highlight)
function initEnhancedToc() {
  const tocList = document.querySelector('.toc-list');
  if (!tocList) return;
  
  const tocLinks = tocList.querySelectorAll('a');
  const headings = Array.from(tocLinks).map(link => {
    const id = link.getAttribute('href').slice(1);
    return document.getElementById(id);
  }).filter(Boolean);

  // Click to scroll
  tocLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.getAttribute('href').slice(1);
      const heading = document.getElementById(id);
      if (heading) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.pushState(null, '', `#${id}`);
      }
    });
  });

  // Active highlight on scroll
  let ticking = false;
  const updateActive = () => {
    let currentIndex = 0;
    headings.forEach((heading, index) => {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= 150) {
        currentIndex = index;
      }
    });
    
    tocLinks.forEach((link, index) => {
      link.classList.toggle('is-active', index === currentIndex);
      link.style.color = index === currentIndex ? 'var(--accent)' : '';
    });
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateActive);
      ticking = true;
    }
  }, { passive: true });
  updateActive();
}

// 35. Social Share
function initSocialShare() {
  const shareButtons = document.querySelectorAll('[data-share]');
  if (shareButtons.length === 0) return;

  const pageUrl = encodeURIComponent(window.location.href);
  const pageTitle = encodeURIComponent(document.title);

  shareButtons.forEach(btn => {
    const platform = btn.dataset.share;
    let url = '';

    switch (platform) {
      case 'twitter':
      case 'x':
        url = `https://twitter.com/intent/tweet?url=${pageUrl}&text=${pageTitle}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}`;
        break;
      case 'weibo':
        url = `https://service.weibo.com/share/share.php?url=${pageUrl}&title=${pageTitle}`;
        break;
      case 'copy':
        btn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            showToast('链接已复制');
          } catch {
            showToast('复制失败');
          }
        });
        return;
    }

    if (url) {
      btn.addEventListener('click', () => {
        window.open(url, '_blank', 'width=600,height=400');
      });
    }
  });
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// 36. Giscus Comments
function initGiscusComments() {
  const giscusContainer = document.querySelector('[data-giscus]');
  if (!giscusContainer) return;

  const repo = giscusContainer.dataset.repo || 'Alex-Shen1121/blog';
  const repoId = giscusContainer.dataset.repoId || 'R_kgDOG...';
  const category = giscusContainer.dataset.category || 'Comments';
  const categoryId = giscusContainer.dataset.categoryId || 'DIC_kwDOG...';

  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.setAttribute('data-repo', repo);
  script.setAttribute('data-repo-id', repoId);
  script.setAttribute('data-category', category);
  script.setAttribute('data-category-id', categoryId);
  script.setAttribute('data-mapping', 'pathname');
  script.setAttribute('data-strict', '0');
  script.setAttribute('data-reactions-enabled', '1');
  script.setAttribute('data-emit-metadata', '0');
  script.setAttribute('data-input-position', 'top');
  script.setAttribute('data-theme', 'preferred_color_scheme');
  script.setAttribute('data-lang', 'zh-CN');
  script.setAttribute('crossorigin', 'anonymous');
  script.async = true;

  giscusContainer.appendChild(script);
}

// 37. Donation Support
function initDonation() {
  const donationBtn = document.querySelector('[data-donation]');
  const donationModal = document.getElementById('donation-modal');
  if (!donationBtn || !donationModal) return;

  const closeBtn = donationModal.querySelector('.modal-close');

  donationBtn.addEventListener('click', () => {
    donationModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  });

  const closeModal = () => {
    donationModal.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', closeModal);
  donationModal.addEventListener('click', (e) => {
    if (e.target === donationModal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// 38. Newsletter Subscription
function initNewsletter() {
  const subscribeBtn = document.querySelector('[data-subscribe]');
  const subscribeModal = document.getElementById('subscribe-modal');
  if (!subscribeBtn || !subscribeModal) return;

  // Check if user has already subscribed (don't show again)
  const hasSubscribed = localStorage.getItem('personal-blog-subscribed');
  if (hasSubscribed) return;

  // Show after 5 seconds
  setTimeout(() => {
    subscribeModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }, 5000);

  const closeBtn = subscribeModal.querySelector('.modal-close');
  const closeModal = () => {
    subscribeModal.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', closeModal);
  subscribeModal.addEventListener('click', (e) => {
    if (e.target === subscribeModal) closeModal();
  });

  // Form submission
  const form = subscribeModal.querySelector('form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]')?.value;
    if (email) {
      localStorage.setItem('personal-blog-subscribed', 'true');
      showToast('订阅成功！');
      closeModal();
    }
  });

  // Don't show again checkbox
  const dontShowAgain = subscribeModal.querySelector('[data-dont-show]');
  dontShowAgain?.addEventListener('change', (e) => {
    if (e.target.checked) {
      localStorage.setItem('personal-blog-subscribed', 'true');
    }
  });
}

// 40. Parallax Hero Effect
function initParallaxHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const heroVisual = hero.querySelector('.hero-visual, .hero-card');
  if (!heroVisual) return;

  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        if (scrollY < 600) {
          heroVisual.style.transform = `translateY(${scrollY * 0.15}px)`;
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// 41. Custom Scrollbar
function initCustomScrollbar() {
  const style = document.createElement('style');
  style.textContent = `
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: var(--surface-soft); }
    ::-webkit-scrollbar-thumb { 
      background: var(--accent); 
      border-radius: 5px; 
      border: 2px solid var(--surface-soft);
    }
    ::-webkit-scrollbar-thumb:hover { background: var(--accent-2); }
  `;
  document.head.appendChild(style);
}

// 43. Lazy Load Images with Intersection Observer
function initLazyLoadImages() {
  const images = document.querySelectorAll('img[data-src]');
  if (images.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        img.classList.add('is-loaded');
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '50px' });

  images.forEach(img => observer.observe(img));
}

// 44. Prefetch Adjacent Pages
function initPrefetchAdjacent() {
  const prefetchLinks = document.querySelectorAll('a[rel="next"], a[rel="prev"]');
  
  prefetchLinks.forEach(link => {
    link.addEventListener('mouseenter', () => {
      const url = link.href;
      if (url) {
        const linkEl = document.createElement('link');
        linkEl.rel = 'prefetch';
        linkEl.href = url;
        document.head.appendChild(linkEl);
      }
    }, { once: true });
  });
}

// 45. Print Styles
function initPrintStyles() {
  // Add print-specific class
  window.matchMedia('print').addEventListener('change', (e) => {
    document.body.classList.toggle('is-printing', e.matches);
  });
}

// 34. Reading Progress Section Indicator
function initSectionIndicator() {
  const tocList = document.querySelector('.toc-list');
  if (!tocList) return;

  const tocItems = tocList.querySelectorAll('.toc-item');
  if (tocItems.length === 0) return;

  // Create section indicator
  const indicator = document.createElement('div');
  indicator.className = 'section-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  document.body.appendChild(indicator);

  const headings = Array.from(tocItems).map(item => {
    const link = item.querySelector('a');
    const id = link?.getAttribute('href')?.slice(1);
    return id ? document.getElementById(id) : null;
  }).filter(Boolean);

  const updateIndicator = () => {
    let currentIndex = 0;
    headings.forEach((heading, index) => {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= 200) {
        currentIndex = index;
      }
    });

    const activeItem = tocItems[currentIndex];
    if (activeItem) {
      const link = activeItem.querySelector('a');
      indicator.textContent = link?.textContent || '';
    }
  };

  window.addEventListener('scroll', updateIndicator, { passive: true });
  updateIndicator();
}

/* ========================================
   Content Presentation Enhancements (46-60)
   ======================================== */

// 50. Word Count & Reading Time Display
function initWordCount() {
  const postMain = document.querySelector('.post-main');
  if (!postMain) return;
  
  const prose = postMain.querySelector('.prose');
  if (!prose) return;
  
  // Get meta stats container
  const metaContainer = document.querySelector('.post-header__meta');
  if (!metaContainer) return;
  
  // Calculate word count
  const text = prose.textContent || '';
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  
  // Calculate reading time (average 200 words per minute for Chinese, 250 for English)
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = words.filter(w => /^[a-zA-Z]+$/.test(w)).length;
  const totalChars = chineseChars + englishWords * 5; // average English word ~5 chars
  const readingTimeMinutes = Math.max(1, Math.ceil(totalChars / 400));
  
  // Find or create stats container
  let statsContainer = metaContainer.querySelector('.post-meta__stats');
  if (!statsContainer) {
    statsContainer = document.createElement('div');
    statsContainer.className = 'post-meta__stats';
    metaContainer.appendChild(statsContainer);
  }
  
  // Add word count
  const wordCountEl = document.createElement('span');
  wordCountEl.className = 'post-meta__stat';
  wordCountEl.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
    ${wordCount.toLocaleString()} 字
  `;
  
  // Add divider
  const divider = document.createElement('span');
  divider.className = 'post-meta__divider';
  
  // Append elements
  statsContainer.appendChild(wordCountEl);
  statsContainer.appendChild(divider);
}

// 49/51. Enhanced Code Block with Line Numbers
function initCodeBlockEnhancements() {
  const codeBlocks = document.querySelectorAll('.code-block');
  
  codeBlocks.forEach(block => {
    // Check if already processed
    if (block.dataset.processed) return;
    block.dataset.processed = 'true';
    
    const pre = block.querySelector('pre');
    if (!pre) return;
    
    // Get code content
    const code = pre.textContent || '';
    const lines = code.split('\n');
    
    // Create line numbers and content
    const lineNumbers = [];
    const lineContents = [];
    
    lines.forEach((line, index) => {
      lineNumbers.push(`<span class="code-block__line-number">${index + 1}</span>`);
      lineContents.push(`<span class="code-block__line-content">${escapeHtml(line)}</span>`);
    });
    
    // Build new structure
    const lineHtml = lines.map((line, index) => {
      return `<div class="code-block__line">
        <span class="code-block__line-number">${index + 1}</span>
        <span class="code-block__line-content">${escapeHtml(line)}</span>
      </div>`;
    }).join('');
    
    // Replace content
    const newPre = document.createElement('div');
    newPre.className = 'code-block__pre';
    newPre.innerHTML = lineHtml;
    
    // Clear and append
    pre.innerHTML = '';
    pre.appendChild(newPre);
  });
}

// Escape HTML entities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Copy code functionality
function initCodeCopy() {
  document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.code-block__copy');
    if (!copyBtn) return;
    
    const codeBlock = copyBtn.closest('.code-block');
    if (!codeBlock) return;
    
    // Get code content
    const codeContent = codeBlock.querySelector('.code-block__line-content');
    if (!codeContent) return;
    
    const text = Array.from(codeBlock.querySelectorAll('.code-block__line-content'))
      .map(el => el.textContent)
      .join('\n');
    
    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.classList.add('is-copied');
      copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        已复制
      `;
      
      setTimeout(() => {
        copyBtn.classList.remove('is-copied');
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          复制
        `;
      }, 2000);
    });
  });
}

// 58. Footnote Handling
function initFootnotes() {
  const prose = document.querySelector('.prose');
  if (!prose) return;
  
  // Find all footnote references
  const footnoteRefs = prose.querySelectorAll('.footnote-ref');
  if (footnoteRefs.length === 0) return;
  
  // Find footnotes section
  const footnotes = prose.querySelector('.footnotes');
  if (!footnotes) return;
  
  // Add click handlers for footnote refs (scroll to footnote)
  footnoteRefs.forEach(ref => {
    ref.addEventListener('click', (e) => {
      e.preventDefault();
      const link = ref.querySelector('a');
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href) return;
      
      const targetId = href.slice(1);
      const target = document.getElementById(targetId);
      
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the footnote
        target.classList.add('is-highlighted');
        setTimeout(() => target.classList.remove('is-highlighted'), 2000);
      }
    });
  });
  
  // Add back links for footnotes
  const footnoteItems = footnotes.querySelectorAll('.footnote-item');
  footnoteItems.forEach(item => {
    const backLink = item.querySelector('.footnote-back');
    if (!backLink) return;
    
    const href = backLink.getAttribute('href');
    if (!href) return;
    
    const targetId = href.slice(1);
    const target = document.getElementById(targetId);
    
    if (target) {
      backLink.addEventListener('click', (e) => {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  });
}

// 60. Enhanced TOC with Active Class
function initEnhancedToc() {
  const tocItems = document.querySelectorAll('.toc-item');
  if (tocItems.length === 0) return;
  
  // Get all heading elements referenced by TOC
  const tocLinks = document.querySelectorAll('.toc-list a');
  const headings = Array.from(tocLinks).map(link => {
    const id = link.getAttribute('href')?.slice(1);
    return id ? document.getElementById(id) : null;
  }).filter(Boolean);
  
  if (headings.length === 0) return;
  
  function updateActiveItem() {
    const scrollY = window.scrollY;
    const headerOffset = 120;
    
    let currentIndex = 0;
    headings.forEach((heading, index) => {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= headerOffset) {
        currentIndex = index;
      }
    });
    
    tocItems.forEach((item, index) => {
      if (index === currentIndex) {
        item.classList.add('is-active');
      } else {
        item.classList.remove('is-active');
      }
    });
  }
  
  // Initial update
  updateActiveItem();
  
  // Update on scroll with throttle
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateActiveItem();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// 57. Video Embed Handling
function initVideoEmbeds() {
  // Auto-convert video links to embeds
  const prose = document.querySelector('.prose');
  if (!prose) return;
  
  // Find Bilibili links and convert to embed
  const bilibiliLinks = prose.querySelectorAll('a[href*="bilibili.com"]');
  bilibiliLinks.forEach(link => {
    const href = link.getAttribute('href');
    const match = href.match(/bilibili\.com\/video\/(BV[\w]+)/);
    
    if (match) {
      const bvid = match[1];
      const embed = document.createElement('div');
      embed.className = 'prose-embed prose-embed--bilibili';
      embed.innerHTML = `<iframe src="//player.bilibili.com/player.html?bvid=${bvid}&page=1" scrolling="no" allowfullscreen></iframe>`;
      link.parentNode?.insertBefore(embed, link);
    }
  });
  
  // Find YouTube links and convert to embed
  const youtubeLinks = prose.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]');
  youtubeLinks.forEach(link => {
    const href = link.getAttribute('href');
    let videoId = '';
    
    if (href.includes('youtu.be/')) {
      videoId = href.split('youtu.be/')[1]?.split('?')[0];
    } else if (href.includes('youtube.com/watch')) {
      const url = new URL(href);
      videoId = url.searchParams.get('v');
    }
    
    if (videoId) {
      const embed = document.createElement('div');
      embed.className = 'prose-embed prose-embed--youtube';
      embed.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
      link.parentNode?.insertBefore(embed, link);
    }
  });
}

// 56. Image Alignment
function initImageAlignment() {
  const prose = document.querySelector('.prose');
  if (!prose) return;
  
  // Find images with alignment classes
  const alignedImages = prose.querySelectorAll('img[align="left"], img[align="right"], img[align="center"]');
  
  alignedImages.forEach(img => {
    const align = img.getAttribute('align');
    const wrapper = document.createElement('figure');
    wrapper.className = `align-${align}`;
    
    // If there's a caption
    const caption = img.getAttribute('alt');
    if (caption) {
      wrapper.innerHTML = `<figcaption>${caption}</figcaption>`;
    }
    
    img.parentNode?.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    img.removeAttribute('align');
  });
}

// 59. Chinese-English Spacing
function initTextSpacing() {
  const prose = document.querySelector('.prose');
  if (!prose) return;
  
  // Add spacing class to prose for mixed content
  const textElements = prose.querySelectorAll('p, li, td, th, span, a');
  
  textElements.forEach(el => {
    const text = el.textContent || '';
    // Check if contains both Chinese and English
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    const hasEnglish = /[a-zA-Z]/.test(text);
    
    if (hasChinese && hasEnglish) {
      el.classList.add('text-spacing');
    }
  });
}

// 47. Excerpt Read More Enhancement
function initExcerptReadMore() {
  const excerpts = document.querySelectorAll('.post-card__excerpt');
  
  excerpts.forEach(excerpt => {
    // Check if already has read more button
    if (excerpt.querySelector('.excerpt__read-more')) return;
    
    const card = excerpt.closest('.post-card');
    if (!card) return;
    
    const link = card.querySelector('h3 a');
    if (!link) return;
    
    const readMore = document.createElement('a');
    readMore.className = 'excerpt__read-more';
    readMore.href = link.href;
    readMore.innerHTML = '阅读全文 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    
    excerpt.appendChild(readMore);
  });
}

// 53. Alert/Notice Box Processing
function initAlertBoxes() {
  const prose = document.querySelector('.prose');
  if (!prose) return;
  
  // Find blockquotes or divs with alert classes
  const alertElements = prose.querySelectorAll('blockquote.alert, div.alert, blockquote[data-type]');
  
  alertElements.forEach(el => {
    // Determine alert type
    let alertType = 'info';
    if (el.classList.contains('alert--warning') || el.dataset.type === 'warning') {
      alertType = 'warning';
    } else if (el.classList.contains('alert--error') || el.dataset.type === 'error') {
      alertType = 'error';
    } else if (el.classList.contains('alert--success') || el.dataset.type === 'success') {
      alertType = 'success';
    }
    
    // Add alert class if not present
    if (!el.classList.contains('alert')) {
      el.classList.add('alert', `alert--${alertType}`);
    }
    
    // Add icon based on type
    const icons = {
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
    };
    
    // Add icon if not present
    if (!el.querySelector('.alert__icon')) {
      const icon = document.createElement('span');
      icon.className = 'alert__icon';
      icon.innerHTML = icons[alertType] || icons.info;
      el.insertBefore(icon, el.firstChild);
    }
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
  
  // New features 31-45
  initGlobalSearch();
  initNavDropdown();
  initEnhancedToc();
  initSocialShare();
  initGiscusComments();
  initDonation();
  initNewsletter();
  initParallaxHero();
  initCustomScrollbar();
  initLazyLoadImages();
  initPrefetchAdjacent();
  initPrintStyles();
  initSectionIndicator();
  
  // Content presentation enhancements (46-60)
  initWordCount();
  initCodeBlockEnhancements();
  initCodeCopy();
  initFootnotes();
  initEnhancedToc();
  initVideoEmbeds();
  initImageAlignment();
  initTextSpacing();
  initExcerptReadMore();
  initAlertBoxes();
});
