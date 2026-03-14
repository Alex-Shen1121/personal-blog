const prefersReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const initBackToTop = () => {
  const backToTopButton = document.querySelector('[data-back-to-top]');
  if (!backToTopButton) return;

  const updateVisibility = () => {
    const shouldShow = window.scrollY > Math.max(320, window.innerHeight * 0.75);
    backToTopButton.classList.toggle('is-visible', shouldShow);
    backToTopButton.setAttribute('aria-hidden', String(!shouldShow));
    backToTopButton.tabIndex = shouldShow ? 0 : -1;
  };

  backToTopButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotionQuery.matches ? 'auto' : 'smooth' });
  });

  updateVisibility();
  window.addEventListener('scroll', updateVisibility, { passive: true });
};

const initReadingProgress = () => {
  const progressTrack = document.querySelector('[data-reading-progress]');
  const progressBar = document.querySelector('[data-reading-progress-bar]');
  const target = document.querySelector('[data-reading-progress-target]');

  if (!progressTrack || !progressBar || !target) return;

  document.body.classList.add('has-reading-progress');

  const clamp = (value) => Math.min(1, Math.max(0, value));
  let frameId = null;

  const syncProgress = () => {
    const targetRect = target.getBoundingClientRect();
    const headerOffset = (document.querySelector('.site-header__inner')?.offsetHeight || 0) + 36;
    const start = window.scrollY + targetRect.top - headerOffset;
    const end = start + target.offsetHeight - window.innerHeight;
    const nextProgress = end <= start ? (window.scrollY > start ? 1 : 0) : clamp((window.scrollY - start) / (end - start));

    progressTrack.style.setProperty('--reading-progress-value', String(nextProgress));
    progressTrack.setAttribute('aria-valuenow', String(Math.round(nextProgress * 100)));
  };

  const requestSync = () => {
    if (frameId !== null) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      syncProgress();
    });
  };

  progressTrack.setAttribute('role', 'progressbar');
  progressTrack.setAttribute('aria-label', '阅读进度');
  progressTrack.setAttribute('aria-valuemin', '0');
  progressTrack.setAttribute('aria-valuemax', '100');

  syncProgress();
  window.addEventListener('scroll', requestSync, { passive: true });
  window.addEventListener('resize', requestSync);
  window.addEventListener('load', requestSync, { once: true });
};

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
    const state = { tag: 'all', category: 'all', template: 'all', sort: defaultSort };

    if (!input || !grid || !cards.length || !feedback || !emptyState || !emptySummary) return;

    const getFilterLabel = (group, value) =>
      filterButtons.find((button) => button.dataset.filterGroup === group && button.dataset.filterValue === value)?.textContent?.trim() || value;

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
      if (state.tag !== 'all') activeFilters.push(`标签 “${getFilterLabel('tag', state.tag)}”`);
      if (state.category !== 'all') activeFilters.push(`分类 “${getFilterLabel('category', state.category)}”`);
      if (state.template !== 'all') activeFilters.push(`模板 “${getFilterLabel('template', state.template)}”`);

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
      if (state.tag !== 'all') parts.push(`标签 “${getFilterLabel('tag', state.tag)}”`);
      if (state.category !== 'all') parts.push(`分类 “${getFilterLabel('category', state.category)}”`);
      if (state.template !== 'all') parts.push(`模板 “${getFilterLabel('template', state.template)}”`);
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
        const cardTemplate = card.dataset.template || '';
        const matchesQuery = !query || searchIndex.includes(query);
        const matchesTag = state.tag === 'all' || cardTags.includes(state.tag);
        const matchesCategory = state.category === 'all' || cardCategory === state.category;
        const matchesTemplate = state.template === 'all' || cardTemplate === state.template;
        const matched = matchesQuery && matchesTag && matchesCategory && matchesTemplate;
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
        state.template = 'all';
        state.sort = defaultSort;
        if (sortSelect) sortSelect.value = defaultSort;
        updateResults();
        input.focus();
      });
    }

    updateResults();
  });
};

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

initBackToTop();
initReadingProgress();
initBlogSearch();
initProjectFilters();
