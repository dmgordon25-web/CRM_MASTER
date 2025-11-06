const GRIDSTACK_MODULE = 'https://cdn.jsdelivr.net/npm/gridstack@9.3.0/dist/gridstack-all.esm.min.js';
const GRIDSTACK_STYLES = 'https://cdn.jsdelivr.net/npm/gridstack@9.3.0/dist/gridstack.min.css';

const DEFAULT_LAYOUT = [
  { id: 'dashboard-focus', x: 0, y: 0, w: 4, h: 3 },
  { id: 'dashboard-filters', x: 4, y: 0, w: 4, h: 3 },
  { id: 'dashboard-kpis', x: 8, y: 0, w: 4, h: 3 },
  { id: 'dashboard-pipeline-overview', x: 0, y: 3, w: 6, h: 4 },
  { id: 'dashboard-today', x: 6, y: 3, w: 6, h: 4 },
  { id: 'referral-leaderboard', x: 0, y: 7, w: 4, h: 3 },
  { id: 'dashboard-stale', x: 4, y: 7, w: 4, h: 3 },
  { id: 'favorites-card', x: 8, y: 7, w: 4, h: 3 },
  { id: 'goal-progress-card', x: 0, y: 10, w: 4, h: 3 },
  { id: 'numbers-portfolio-card', x: 4, y: 10, w: 4, h: 3 },
  { id: 'numbers-referrals-card', x: 8, y: 10, w: 4, h: 3 },
  { id: 'numbers-momentum-card', x: 0, y: 13, w: 6, h: 4 },
  { id: 'pipeline-calendar-card', x: 6, y: 13, w: 6, h: 4 },
  { id: 'priority-actions-card', x: 0, y: 17, w: 6, h: 3 },
  { id: 'milestones-card', x: 6, y: 17, w: 6, h: 3 },
  { id: 'doc-pulse-card', x: 0, y: 20, w: 6, h: 3 },
  { id: 'rel-opps-card', x: 6, y: 20, w: 6, h: 3 },
  { id: 'nurture-card', x: 0, y: 23, w: 6, h: 3 },
  { id: 'closing-watch-card', x: 6, y: 23, w: 6, h: 3 },
  { id: 'doc-center-card', x: 0, y: 26, w: 6, h: 3 },
  { id: 'dashboard-status-stack', x: 0, y: 29, w: 12, h: 4 }
];

const state = {
  active: false,
  shell: null,
  grid: null,
  placeholders: new Map(),
  items: new Map(),
  layoutById: new Map(),
  scopeObserver: null,
};

let gridstackPromise = null;

function loadGridStack() {
  if (!gridstackPromise) {
    gridstackPromise = import(GRIDSTACK_MODULE);
  }
  return gridstackPromise;
}

function ensureGridstackStyles() {
  if (document.querySelector('link[data-labs-gridstack]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = GRIDSTACK_STYLES;
  link.setAttribute('data-labs-gridstack', '');
  document.head.appendChild(link);
}

function isLabsRequested() {
  const hash = (window.location.hash || '').toLowerCase();
  if (hash.includes('labs')) return true;
  const params = new URLSearchParams(window.location.search);
  return params.has('labs');
}

function updateLocationForLabs(enabled) {
  const url = new URL(window.location.href);
  if (enabled) {
    if (!url.hash || url.hash.toLowerCase() !== '#labs') {
      url.hash = 'labs';
      history.replaceState(null, '', url.toString());
    }
  } else {
    if (url.hash) {
      url.hash = '';
    }
    if (url.searchParams.has('labs')) {
      url.searchParams.delete('labs');
    }
    history.replaceState(null, '', url.toString());
  }
}

function createLabsShell() {
  if (state.shell) return state.shell;
  const container = document.querySelector('.container');
  if (!container) return null;
  const shell = document.createElement('section');
  shell.className = 'labs-shell';
  shell.setAttribute('data-labs-shell', '');
  shell.innerHTML = `
    <header class="labs-header">
      <div class="labs-header__left">
        <button type="button" class="labs-back" data-labs-exit>← Back to CRM</button>
        <div class="labs-title">
          <span class="labs-eyebrow">Labs</span>
          <h1>Drag &amp; Resize Dashboard</h1>
        </div>
      </div>
      <div class="labs-header__right" data-labs-scope></div>
    </header>
    <div class="labs-toolbar">
      <button type="button" class="labs-reset" data-labs-reset>Reset layout</button>
      <p class="labs-hint">Widgets are live CRM tiles. Drag to rearrange, resize with the handle. Layouts stay local to this session.</p>
    </div>
    <div class="grid-stack labs-grid" data-labs-grid></div>
  `;
  container.appendChild(shell);
  state.shell = shell;
  return shell;
}

function captureNode(node) {
  if (!node || state.placeholders.has(node)) return state.placeholders.get(node) || null;
  const parent = node.parentNode;
  if (!parent) return null;
  const marker = document.createComment(`labs-placeholder:${node.id || node.dataset.widgetId || 'node'}`);
  parent.insertBefore(marker, node);
  const record = { marker, parent };
  state.placeholders.set(node, record);
  return record;
}

function restoreNode(node) {
  const record = state.placeholders.get(node);
  if (!record) return;
  const { marker, parent } = record;
  if (parent && parent.isConnected) {
    parent.insertBefore(node, marker);
  }
  if (marker && marker.parentNode) {
    marker.parentNode.removeChild(marker);
  }
  state.placeholders.delete(node);
}

function teardownScopeObserver() {
  if (state.scopeObserver) {
    try { state.scopeObserver.disconnect(); } catch (_) {}
    state.scopeObserver = null;
  }
}

function setupScopeControls(shell) {
  const scopeHost = shell.querySelector('[data-labs-scope]');
  if (!scopeHost) return;
  scopeHost.innerHTML = '';
  const baseToday = document.querySelector('[data-dashboard-mode="today"]');
  const baseAll = document.querySelector('[data-dashboard-mode="all"]');
  const createButton = (label, target, mode) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'labs-scope-btn';
    btn.textContent = label;
    btn.dataset.mode = mode;
    btn.addEventListener('click', evt => {
      evt.preventDefault();
      if (target && typeof target.click === 'function') {
        target.click();
      }
    });
    scopeHost.appendChild(btn);
    return btn;
  };
  const todayBtn = createButton('Today', baseToday, 'today');
  const allBtn = createButton('All', baseAll, 'all');
  const update = () => {
    const todayActive = baseToday && baseToday.classList.contains('active');
    const allActive = baseAll && baseAll.classList.contains('active');
    todayBtn.classList.toggle('is-active', !!todayActive);
    allBtn.classList.toggle('is-active', !!allActive);
  };
  update();
  const observer = new MutationObserver(update);
  state.scopeObserver = observer;
  [baseToday, baseAll].forEach(node => {
    if (!node) return;
    observer.observe(node, { attributes: true, attributeFilter: ['class', 'aria-pressed'] });
  });
}

function buildLayout() {
  const available = [];
  DEFAULT_LAYOUT.forEach(spec => {
    const node = document.getElementById(spec.id);
    if (!node) return;
    available.push({ spec, node });
  });
  return available;
}

function createGridItems(gridHost, layout) {
  gridHost.innerHTML = '';
  state.items.clear();
  layout.forEach(({ spec, node }) => {
    captureNode(node);
    const item = document.createElement('div');
    item.className = 'grid-stack-item labs-grid-item';
    item.setAttribute('gs-id', spec.id);
    item.setAttribute('gs-x', String(spec.x));
    item.setAttribute('gs-y', String(spec.y));
    item.setAttribute('gs-w', String(spec.w));
    item.setAttribute('gs-h', String(spec.h));
    const content = document.createElement('div');
    content.className = 'grid-stack-item-content labs-grid-item-content';
    content.appendChild(node);
    item.appendChild(content);
    gridHost.appendChild(item);
    state.items.set(spec.id, { item, node });
  });
}

function resetLabsLayout() {
  if (!state.grid) return;
  state.grid.batchUpdate();
  state.items.forEach(({ item }, id) => {
    const defaults = state.layoutById.get(id);
    if (!defaults) return;
    state.grid.update(item, { x: defaults.x, y: defaults.y, w: defaults.w, h: defaults.h });
  });
  state.grid.commit();
}

function attachLabsEvents(shell) {
  const exitBtn = shell.querySelector('[data-labs-exit]');
  if (exitBtn) {
    exitBtn.addEventListener('click', evt => {
      evt.preventDefault();
      deactivateLabs();
    });
  }
  const resetBtn = shell.querySelector('[data-labs-reset]');
  if (resetBtn) {
    resetBtn.addEventListener('click', evt => {
      evt.preventDefault();
      resetLabsLayout();
    });
  }
}

async function activateLabs() {
  if (state.active) return;
  const main = document.querySelector('main[data-ui="dashboard-root"]');
  if (!main) return;
  const shell = createLabsShell();
  if (!shell) return;
  ensureGridstackStyles();
  const gridHost = shell.querySelector('[data-labs-grid]');
  if (!gridHost) return;
  const layout = buildLayout();
  if (!layout.length) return;
  state.layoutById = new Map(layout.map(({ spec }) => [spec.id, spec]));
  createGridItems(gridHost, layout);
  try {
    const [{ GridStack }] = await Promise.all([loadGridStack()]);
    const grid = GridStack.init({
      column: 12,
      cellHeight: 120,
      margin: 12,
      float: false,
      disableOneColumnMode: true,
      alwaysShowResizeHandle: true
    }, gridHost);
    state.grid = grid;
  } catch (err) {
    console.error('[labs] failed to load grid runtime', err);
    restoreWidgets();
    if (state.shell) {
      state.shell.remove();
      state.shell = null;
    }
    updateLocationForLabs(false);
    return;
  }
  setupScopeControls(shell);
  attachLabsEvents(shell);
  document.body.classList.add('labs-mode');
  const labsLink = document.querySelector('[data-dashboard-labs]');
  if (labsLink) {
    labsLink.classList.add('active');
    labsLink.setAttribute('aria-pressed', 'true');
  }
  state.active = true;
  updateLocationForLabs(true);
}

function teardownGrid() {
  if (!state.grid) return;
  try {
    state.grid.destroy(false);
  } catch (_) {}
  state.grid = null;
}

function restoreWidgets() {
  state.items.forEach(({ node }) => {
    restoreNode(node);
  });
  state.items.clear();
  state.placeholders.clear();
  const gridHost = state.shell ? state.shell.querySelector('[data-labs-grid]') : null;
  if (gridHost) {
    gridHost.innerHTML = '';
  }
}

function deactivateLabs() {
  if (!state.active) return;
  teardownGrid();
  restoreWidgets();
  const labsLink = document.querySelector('[data-dashboard-labs]');
  if (labsLink) {
    labsLink.classList.remove('active');
    labsLink.removeAttribute('aria-pressed');
  }
  teardownScopeObserver();
  if (state.shell) {
    state.shell.remove();
    state.shell = null;
  }
  document.body.classList.remove('labs-mode');
  state.layoutById = new Map();
  state.active = false;
  updateLocationForLabs(false);
}

function syncLabsState() {
  const requested = isLabsRequested();
  if (requested && !state.active) {
    activateLabs();
  } else if (!requested && state.active) {
    deactivateLabs();
  }
}

function handleLabsLink(evt) {
  evt.preventDefault();
  if (state.active) return;
  const url = new URL(window.location.href);
  url.hash = 'labs';
  history.pushState(null, '', url.toString());
  syncLabsState();
}

document.addEventListener('DOMContentLoaded', () => {
  const link = document.querySelector('[data-dashboard-labs]');
  if (link) {
    link.addEventListener('click', handleLabsLink);
  }
  window.addEventListener('hashchange', syncLabsState);
  window.addEventListener('popstate', syncLabsState);
  if (isLabsRequested()) {
    syncLabsState();
  }
});

export { activateLabs, deactivateLabs };
