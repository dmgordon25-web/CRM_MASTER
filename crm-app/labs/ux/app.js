const GRID_COLUMNS = 12;
const GRID_CELL_HEIGHT = 120;
const GRID_GAP = 16;
const LAYOUT_STORAGE_KEY = 'labs:layout:v1';

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
  gridHost: null,
  placeholders: new Map(),
  items: new Map(),
  layout: new Map(),
  scopeObserver: null,
  pointer: null
};

function logLabsError(message, error) {
  if (error) {
    console.error(`[Labs] ${message}`, error);
  } else {
    console.error(`[Labs] ${message}`);
  }
}

function wrapHandler(label, handler) {
  return function wrappedHandler(...args) {
    try {
      return handler.apply(this, args);
    } catch (err) {
      logLabsError(label, err);
      return undefined;
    }
  };
}

function isLabsRequested() {
  const hash = (window.location.hash || '').toLowerCase();
  if (hash.includes('labs')) return true;
  const params = new URLSearchParams(window.location.search || '');
  return params.has('labs');
}

function updateLocationForLabs(enabled) {
  try {
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
  } catch (_) {}
}

function ensureShell() {
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
      <p class="labs-hint">Widgets are live CRM tiles. Drag with the handle, resize from the corner. Layouts stay local to this session.</p>
    </div>
    <div class="labs-grid" data-labs-grid></div>
  `;
  container.appendChild(shell);
  state.shell = shell;
  return shell;
}

function captureNode(node) {
  if (!node) return null;
  if (state.placeholders.has(node)) {
    return state.placeholders.get(node);
  }
  const parent = node.parentNode;
  if (!parent) return null;
  const marker = document.createComment(`labs-placeholder:${node.id || node.dataset?.widgetId || 'node'}`);
  parent.insertBefore(marker, node);
  const record = { parent, marker };
  state.placeholders.set(node, record);
  return record;
}

function restoreNode(node) {
  const record = state.placeholders.get(node);
  if (!record) return;
  const { parent, marker } = record;
  if (parent && parent.isConnected) {
    parent.insertBefore(node, marker);
  }
  if (marker && marker.parentNode) {
    marker.parentNode.removeChild(marker);
  }
  state.placeholders.delete(node);
}

function loadStoredLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();
    const map = new Map();
    parsed.forEach(entry => {
      if (!Array.isArray(entry) || entry.length < 2) return;
      const [id, spec] = entry;
      if (!id || typeof spec !== 'object' || spec == null) return;
      const normalized = normalizeSpec(spec, { id });
      map.set(String(id), normalized);
    });
    return map;
  } catch (_) {
    return new Map();
  }
}

function persistLayout() {
  if (!state.active) return;
  try {
    const payload = [];
    state.layout.forEach((spec, id) => {
      payload.push([id, { x: spec.x, y: spec.y, w: spec.w, h: spec.h }]);
    });
    if (payload.length) {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }
  } catch (_) {}
}

function clearStoredLayout() {
  try {
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
  } catch (_) {}
}

function normalizeSpec(value, fallback = {}) {
  const base = {
    id: typeof fallback.id === 'string' ? fallback.id : String(fallback.id || value.id || ''),
    x: Number.isFinite(fallback.x) ? fallback.x : 0,
    y: Number.isFinite(fallback.y) ? fallback.y : 0,
    w: Number.isFinite(fallback.w) ? fallback.w : 1,
    h: Number.isFinite(fallback.h) ? fallback.h : 1
  };
  const spec = {
    id: base.id || '',
    x: Number.isFinite(value?.x) ? Number(value.x) : base.x,
    y: Number.isFinite(value?.y) ? Number(value.y) : base.y,
    w: Number.isFinite(value?.w) ? Number(value.w) : base.w,
    h: Number.isFinite(value?.h) ? Number(value.h) : base.h
  };
  if (spec.x < 0) spec.x = 0;
  if (spec.y < 0) spec.y = 0;
  if (spec.w < 1) spec.w = 1;
  if (spec.h < 1) spec.h = 1;
  if (spec.x + spec.w > GRID_COLUMNS) {
    spec.x = Math.max(0, Math.min(spec.x, GRID_COLUMNS - 1));
    spec.w = Math.max(1, GRID_COLUMNS - spec.x);
  }
  return spec;
}

function buildLayout() {
  const defaults = new Map();
  DEFAULT_LAYOUT.forEach(spec => {
    if (!spec || !spec.id) return;
    defaults.set(spec.id, normalizeSpec(spec));
  });
  const stored = loadStoredLayout();
  stored.forEach((spec, id) => {
    if (!defaults.has(id)) return;
    defaults.set(id, normalizeSpec(spec, defaults.get(id)));
  });
  const entries = [];
  defaults.forEach((spec, id) => {
    const node = document.getElementById(id);
    if (!node) {
      defaults.delete(id);
      return;
    }
    entries.push({ id, spec, node });
  });
  return { entries, layout: defaults };
}

function applySpecToElement(id) {
  const entry = state.items.get(id);
  const spec = state.layout.get(id);
  if (!entry || !spec) return;
  entry.wrapper.style.gridColumn = `${spec.x + 1} / span ${spec.w}`;
  entry.wrapper.style.gridRow = `${spec.y + 1} / span ${spec.h}`;
}

function applyAllSpecs() {
  state.layout.forEach((_, id) => applySpecToElement(id));
}

function collides(id, proposed) {
  if (!proposed) return false;
  let collision = false;
  state.layout.forEach((spec, otherId) => {
    if (collision || otherId === id) return;
    if (!spec) return;
    const overlap = !(
      proposed.x + proposed.w <= spec.x ||
      proposed.x >= spec.x + spec.w ||
      proposed.y + proposed.h <= spec.y ||
      proposed.y >= spec.y + spec.h
    );
    if (overlap) collision = true;
  });
  return collision;
}

function computeGridMetrics() {
  const grid = state.gridHost;
  if (!grid) {
    return {
      colWidth: 0,
      rowHeight: GRID_CELL_HEIGHT,
      gapX: GRID_GAP,
      gapY: GRID_GAP,
      colStep: GRID_CELL_HEIGHT,
      rowStep: GRID_CELL_HEIGHT
    };
  }
  const styles = window.getComputedStyle(grid);
  const gapX = Number.parseFloat(styles.columnGap || styles.gap || GRID_GAP) || 0;
  const gapY = Number.parseFloat(styles.rowGap || styles.gap || GRID_GAP) || 0;
  const autoRows = styles.gridAutoRows || `${GRID_CELL_HEIGHT}px`;
  const rowHeight = Number.parseFloat(autoRows) || GRID_CELL_HEIGHT;
  const width = grid.clientWidth || grid.offsetWidth || 0;
  const colWidth = GRID_COLUMNS > 0
    ? (width - gapX * (GRID_COLUMNS - 1)) / GRID_COLUMNS
    : width;
  const colStep = (colWidth || GRID_CELL_HEIGHT) + gapX;
  const rowStep = rowHeight + gapY;
  return {
    colWidth: colWidth || GRID_CELL_HEIGHT,
    rowHeight,
    gapX,
    gapY,
    colStep: colStep || GRID_CELL_HEIGHT,
    rowStep: rowStep || GRID_CELL_HEIGHT
  };
}

function cancelPointerInteraction() {
  const pointer = state.pointer;
  if (!pointer) return;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerEnd);
  window.removeEventListener('pointercancel', onPointerEnd);
  const item = state.items.get(pointer.id);
  if (item) {
    item.wrapper.classList.remove('labs-grid-item--dragging');
    item.wrapper.classList.remove('labs-grid-item--resizing');
  }
  state.pointer = null;
}

function onPointerMove(evt) {
  const pointer = state.pointer;
  if (!pointer || evt.pointerId !== pointer.pointerId) return;
  try {
    const spec = state.layout.get(pointer.id);
    if (!spec) return;
    const metrics = pointer.metrics;
    const deltaX = evt.clientX - pointer.startX;
    const deltaY = evt.clientY - pointer.startY;
    if (pointer.type === 'drag') {
      const stepX = metrics.colStep || GRID_CELL_HEIGHT;
      const stepY = metrics.rowStep || GRID_CELL_HEIGHT;
      const moveX = Math.round(deltaX / stepX);
      const moveY = Math.round(deltaY / stepY);
      let nextX = pointer.originX + moveX;
      let nextY = pointer.originY + moveY;
      if (nextX < 0) nextX = 0;
      if (nextY < 0) nextY = 0;
      if (nextX + spec.w > GRID_COLUMNS) {
        nextX = GRID_COLUMNS - spec.w;
      }
      const proposed = { x: nextX, y: nextY, w: spec.w, h: spec.h };
      if (!collides(pointer.id, proposed)) {
        if (spec.x !== proposed.x || spec.y !== proposed.y) {
          spec.x = proposed.x;
          spec.y = proposed.y;
          applySpecToElement(pointer.id);
        }
      }
    } else if (pointer.type === 'resize') {
      const stepX = metrics.colStep || GRID_CELL_HEIGHT;
      const stepY = metrics.rowStep || GRID_CELL_HEIGHT;
      const resizeX = Math.round(deltaX / stepX);
      const resizeY = Math.round(deltaY / stepY);
      let nextW = pointer.originW + resizeX;
      let nextH = pointer.originH + resizeY;
      if (nextW < 1) nextW = 1;
      if (nextH < 1) nextH = 1;
      if (pointer.originX + nextW > GRID_COLUMNS) {
        nextW = GRID_COLUMNS - pointer.originX;
      }
      const proposed = { x: spec.x, y: spec.y, w: nextW, h: nextH };
      if (!collides(pointer.id, proposed)) {
        if (spec.w !== proposed.w || spec.h !== proposed.h) {
          spec.w = proposed.w;
          spec.h = proposed.h;
          applySpecToElement(pointer.id);
        }
      }
    }
    evt.preventDefault();
  } catch (err) {
    logLabsError('pointer-move', err);
    cancelPointerInteraction();
  }
}

function onPointerEnd(evt) {
  const pointer = state.pointer;
  if (!pointer || evt.pointerId !== pointer.pointerId) return;
  try {
    cancelPointerInteraction();
    persistLayout();
  } catch (err) {
    logLabsError('pointer-end', err);
    cancelPointerInteraction();
  }
}

function startDrag(id, evt) {
  if (state.pointer) return;
  try {
    const spec = state.layout.get(id);
    const item = state.items.get(id);
    if (!spec || !item) return;
    const metrics = computeGridMetrics();
    state.pointer = {
      id,
      pointerId: evt.pointerId,
      type: 'drag',
      startX: evt.clientX,
      startY: evt.clientY,
      originX: spec.x,
      originY: spec.y,
      originW: spec.w,
      originH: spec.h,
      metrics
    };
    item.wrapper.classList.add('labs-grid-item--dragging');
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    evt.preventDefault();
  } catch (err) {
    logLabsError('start-drag', err);
    cancelPointerInteraction();
  }
}

function startResize(id, evt) {
  if (state.pointer) return;
  try {
    const spec = state.layout.get(id);
    const item = state.items.get(id);
    if (!spec || !item) return;
    const metrics = computeGridMetrics();
    state.pointer = {
      id,
      pointerId: evt.pointerId,
      type: 'resize',
      startX: evt.clientX,
      startY: evt.clientY,
      originX: spec.x,
      originY: spec.y,
      originW: spec.w,
      originH: spec.h,
      metrics
    };
    item.wrapper.classList.add('labs-grid-item--resizing');
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    evt.preventDefault();
  } catch (err) {
    logLabsError('start-resize', err);
    cancelPointerInteraction();
  }
}

function wirePointerControls(id, handle, resize) {
  if (handle) {
    handle.addEventListener('pointerdown', wrapHandler('labs-pointerdown-drag', evt => {
      if (evt.button !== 0 && evt.pointerType !== 'touch') return;
      startDrag(id, evt);
    }));
  }
  if (resize) {
    resize.addEventListener('pointerdown', wrapHandler('labs-pointerdown-resize', evt => {
      if (evt.button !== 0 && evt.pointerType !== 'touch') return;
      startResize(id, evt);
    }));
  }
}

function createGridItems(gridHost, entries, layout) {
  gridHost.innerHTML = '';
  state.items.clear();
  state.layout = layout;
  state.gridHost = gridHost;
  entries.forEach(({ id, spec, node }) => {
    if (!node) return;
    const placeholder = captureNode(node);
    if (!placeholder) {
      layout.delete(id);
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'labs-grid-item';
    wrapper.dataset.widgetId = id;

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'labs-drag-handle';
    handle.setAttribute('aria-label', 'Drag widget');
    handle.innerHTML = '<span aria-hidden="true">⠿</span>';

    const content = document.createElement('div');
    content.className = 'labs-grid-item-content';
    content.appendChild(node);

    const resize = document.createElement('button');
    resize.type = 'button';
    resize.className = 'labs-resize-handle';
    resize.setAttribute('aria-label', 'Resize widget');
    resize.innerHTML = '↘';

    wrapper.appendChild(handle);
    wrapper.appendChild(content);
    wrapper.appendChild(resize);
    gridHost.appendChild(wrapper);
    state.items.set(id, { wrapper, node, handle, resize });
    applySpecToElement(id);
    wirePointerControls(id, handle, resize);
  });
}

function resetLabsLayout() {
  cancelPointerInteraction();
  const defaults = new Map();
  DEFAULT_LAYOUT.forEach(spec => {
    if (!spec || !spec.id) return;
    defaults.set(spec.id, normalizeSpec(spec));
  });
  state.layout.forEach((_, id) => {
    const base = defaults.get(id);
    if (!base) return;
    const current = state.layout.get(id);
    if (!current) return;
    current.x = base.x;
    current.y = base.y;
    current.w = base.w;
    current.h = base.h;
    applySpecToElement(id);
  });
  clearStoredLayout();
}

function attachLabsEvents(shell) {
  const exitBtn = shell.querySelector('[data-labs-exit]');
  if (exitBtn) {
    exitBtn.addEventListener('click', wrapHandler('labs-exit', evt => {
      evt.preventDefault();
      deactivateLabs();
    }));
  }
  const resetBtn = shell.querySelector('[data-labs-reset]');
  if (resetBtn) {
    resetBtn.addEventListener('click', wrapHandler('labs-reset', evt => {
      evt.preventDefault();
      resetLabsLayout();
    }));
  }
}

function setupScopeControls(shell) {
  const host = shell.querySelector('[data-labs-scope]');
  if (!host) return;
  host.innerHTML = '';
  teardownScopeObserver();
  const baseToday = document.querySelector('[data-dashboard-mode="today"]');
  const baseAll = document.querySelector('[data-dashboard-mode="all"]');

  const createBtn = (label, target, mode) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'labs-scope-btn';
    btn.dataset.mode = mode;
    btn.textContent = label;
    btn.addEventListener('click', evt => {
      evt.preventDefault();
      if (target && typeof target.click === 'function') {
        target.click();
      }
    });
    host.appendChild(btn);
    return btn;
  };

  const todayBtn = createBtn('Today', baseToday, 'today');
  const allBtn = createBtn('All', baseAll, 'all');

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

function restoreWidgets() {
  cancelPointerInteraction();
  state.items.forEach(({ node }) => {
    restoreNode(node);
  });
  state.items.clear();
  state.layout.clear();
  state.placeholders.clear();
  state.gridHost = null;
}

function activateLabs() {
  if (state.active) return;
  try {
    const main = document.querySelector('main[data-ui="dashboard-root"]');
    if (!main) return;
    const shell = ensureShell();
    if (!shell) return;
    const gridHost = shell.querySelector('[data-labs-grid]');
    if (!gridHost) return;
    const { entries, layout } = buildLayout();
    if (!entries.length) return;
    createGridItems(gridHost, entries, layout);
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
  } catch (err) {
    logLabsError('activate-labs', err);
    teardownScopeObserver();
    try {
      restoreWidgets();
    } catch (restoreErr) {
      logLabsError('restore-after-activate-failure', restoreErr);
    }
    if (state.shell) {
      state.shell.remove();
      state.shell = null;
    }
    document.body.classList.remove('labs-mode');
    const labsLink = document.querySelector('[data-dashboard-labs]');
    if (labsLink) {
      labsLink.classList.remove('active');
      labsLink.removeAttribute('aria-pressed');
    }
  }
}

function teardownScopeObserver() {
  if (state.scopeObserver) {
    try { state.scopeObserver.disconnect(); }
    catch (_) {}
    state.scopeObserver = null;
  }
}

function deactivateLabs() {
  if (!state.active) return;
  try {
    teardownScopeObserver();
    restoreWidgets();
    if (state.shell) {
      state.shell.remove();
      state.shell = null;
    }
    document.body.classList.remove('labs-mode');
    const labsLink = document.querySelector('[data-dashboard-labs]');
    if (labsLink) {
      labsLink.classList.remove('active');
      labsLink.removeAttribute('aria-pressed');
    }
    state.active = false;
    updateLocationForLabs(false);
  } catch (err) {
    logLabsError('deactivate-labs', err);
  }
}

function syncLabsState() {
  try {
    const requested = isLabsRequested();
    if (requested && !state.active) {
      activateLabs();
    } else if (!requested && state.active) {
      deactivateLabs();
    }
  } catch (err) {
    logLabsError('sync-labs-state', err);
  }
}

function handleLabsLink(evt) {
  try {
    evt.preventDefault();
    if (state.active) return;
    try {
      const url = new URL(window.location.href);
      url.hash = 'labs';
      history.pushState(null, '', url.toString());
    } catch (_) {
      window.location.hash = 'labs';
    }
    syncLabsState();
  } catch (err) {
    logLabsError('labs-link', err);
  }
}

document.addEventListener('DOMContentLoaded', wrapHandler('labs-dom-ready', () => {
  const labsLink = document.querySelector('[data-dashboard-labs]');
  if (labsLink) {
    labsLink.addEventListener('click', wrapHandler('labs-link-click', handleLabsLink));
  }
  window.addEventListener('hashchange', wrapHandler('labs-hashchange', syncLabsState));
  window.addEventListener('popstate', wrapHandler('labs-popstate', syncLabsState));
  if (isLabsRequested()) {
    syncLabsState();
  }
}));

export { activateLabs, deactivateLabs };
