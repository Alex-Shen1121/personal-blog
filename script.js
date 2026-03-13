const root = document.documentElement;
const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');
const themeToggle = document.querySelector('[data-theme-toggle]');
const yearNode = document.querySelector('[data-current-year]');
const themeStorageKey = 'personal-blog-theme';

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

const getPreferredTheme = () => {
  const saved = localStorage.getItem(themeStorageKey);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const syncThemeLabel = (theme) => {
  if (!themeToggle) return;
  themeToggle.setAttribute('aria-label', theme === 'light' ? '切换到深色模式' : '切换到浅色模式');
  themeToggle.textContent = theme === 'light' ? '☀︎' : '☾';
};

const applyTheme = (theme) => {
  root.dataset.theme = theme;
  syncThemeLabel(theme);
};

applyTheme(getPreferredTheme());

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const nextTheme = root.dataset.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
  });
}

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

const initBlogSearch = () => {
  const searchSections = document.querySelectorAll('[data-post-search]');
  if (!searchSections.length) return;

  searchSections.forEach((section) => {
    const input = section.querySelector('[data-post-search-input]');
    const grid = section.querySelector('[data-post-search-grid]');
    const cards = [...section.querySelectorAll('[data-post-card]')];
    const feedback = section.querySelector('[data-post-search-feedback]');
    const emptyState = section.querySelector('[data-post-search-empty]');
    const emptySummary = section.querySelector('[data-post-search-empty-summary]');
    const resetButton = section.querySelector('[data-post-search-reset]');
    const filterButtons = [...section.querySelectorAll('[data-filter-option]')];
    const sortSelect = section.querySelector('[data-post-sort]');
    const total = Number(section.dataset.postSearchTotal || cards.length);
    const defaultSort = sortSelect?.value || 'date-desc';
    const state = { tag: 'all', category: 'all', sort: defaultSort };

    if (!input || !grid || !cards.length || !feedback || !emptyState || !emptySummary) return;

    const sortCards = () => {
      const sorters = {
        'date-desc': (a, b) => Number(b.dataset.date || 0) - Number(a.dataset.date || 0),
        'date-asc': (a, b) => Number(a.dataset.date || 0) - Number(b.dataset.date || 0),
        'updated-desc': (a, b) => Number(b.dataset.updated || 0) - Number(a.dataset.updated || 0)
      };
      const sorter = sorters[state.sort] || sorters['date-desc'];
      cards.sort(sorter).forEach((card) => grid.appendChild(card));
    };

    const syncFilterButtons = () => {
      filterButtons.forEach((button) => {
        const isActive = state[button.dataset.filterGroup] === button.dataset.filterValue;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });
    };

    const buildFeedback = (query, visibleCount) => {
      const activeFilters = [];
      if (state.tag !== 'all') activeFilters.push(`标签 “${state.tag}”`);
      if (state.category !== 'all') activeFilters.push(`分类 “${state.category}”`);

      if (!query && !activeFilters.length) {
        return `当前共 ${total} 篇文章。`;
      }

      const parts = [];
      if (query) parts.push(`关键词 “${input.value.trim()}”`);
      if (activeFilters.length) parts.push(activeFilters.join('，'));
      return `${parts.join(' + ')} 共找到 ${visibleCount} / ${total} 篇文章。`;
    };

    const buildEmptySummary = () => {
      const parts = [];
      const rawQuery = input.value.trim();
      if (rawQuery) parts.push(`关键词 “${rawQuery}”`);
      if (state.tag !== 'all') parts.push(`标签 “${state.tag}”`);
      if (state.category !== 'all') parts.push(`分类 “${state.category}”`);
      return parts.length
        ? `当前没有符合 ${parts.join(' + ')} 的文章，可以先清空条件再继续浏览。`
        : '当前筛选条件下还没有匹配内容。';
    };

    const updateResults = () => {
      const query = input.value.trim().toLowerCase();
      let visibleCount = 0;

      sortCards();

      cards.forEach((card) => {
        const searchIndex = card.dataset.searchIndex || '';
        const cardCategory = card.dataset.category || '';
        const cardTags = (card.dataset.tags || '').split('|').filter(Boolean);
        const matchesQuery = !query || searchIndex.includes(query);
        const matchesTag = state.tag === 'all' || cardTags.includes(state.tag);
        const matchesCategory = state.category === 'all' || cardCategory === state.category;
        const matched = matchesQuery && matchesTag && matchesCategory;
        card.hidden = !matched;
        if (matched) visibleCount += 1;
      });

      const isEmpty = visibleCount === 0;
      grid.hidden = isEmpty;
      emptyState.hidden = !isEmpty;
      emptySummary.textContent = buildEmptySummary();
      feedback.textContent = buildFeedback(query, visibleCount);
      syncFilterButtons();
    };

    input.addEventListener('input', updateResults);
    input.addEventListener('search', updateResults);

    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state[button.dataset.filterGroup] = button.dataset.filterValue;
        updateResults();
      });
    });

    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        state.sort = sortSelect.value;
        updateResults();
      });
    }

    if (resetButton) {
      resetButton.addEventListener('click', () => {
        input.value = '';
        state.tag = 'all';
        state.category = 'all';
        state.sort = defaultSort;
        if (sortSelect) sortSelect.value = defaultSort;
        updateResults();
        input.focus();
      });
    }

    updateResults();
  });
};

initBlogSearch();

const initProjectFilters = () => {
  const filterSections = document.querySelectorAll('[data-project-filter]');
  if (!filterSections.length) return;

  filterSections.forEach((section) => {
    const input = section.querySelector('[data-project-filter-input]');
    const grid = section.querySelector('[data-project-filter-grid]');
    const cards = [...section.querySelectorAll('[data-project-card]')];
    const feedback = section.querySelector('[data-project-filter-feedback]');
    const emptyState = section.querySelector('[data-project-filter-empty]');
    const emptySummary = section.querySelector('[data-project-filter-empty-summary]');
    const resetButton = section.querySelector('[data-project-filter-reset]');
    const filterButtons = [...section.querySelectorAll('[data-filter-option]')];
    const total = Number(section.dataset.projectFilterTotal || cards.length);
    const state = { category: 'all', status: 'all' };

    if (!grid || !cards.length || !feedback || !emptyState || !emptySummary) return;

    const syncFilterButtons = () => {
      filterButtons.forEach((button) => {
        const isActive = state[button.dataset.filterGroup] === button.dataset.filterValue;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });
    };

    const buildFeedback = (query, visibleCount) => {
      const activeFilters = [];
      if (state.category !== 'all') activeFilters.push(`方向 “${state.category}”`);
      if (state.status !== 'all') activeFilters.push(`状态 “${state.status}”`);

      if (!query && !activeFilters.length) {
        return `当前共 ${total} 个项目。`;
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
        if (matched) visibleCount += 1;
      });

      const isEmpty = visibleCount === 0;
      grid.hidden = isEmpty;
      emptyState.hidden = !isEmpty;
      emptySummary.textContent = buildEmptySummary();
      feedback.textContent = buildFeedback(query, visibleCount);
      syncFilterButtons();
    };

    input?.addEventListener('input', updateResults);
    input?.addEventListener('search', updateResults);

    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state[button.dataset.filterGroup] = button.dataset.filterValue;
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

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = document.querySelectorAll('.reveal');

if (prefersReducedMotion) {
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
    { threshold: 0.16 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}
