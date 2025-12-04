// Labs CRM Dashboard - Canonical mirror with modern UI shell

import { ensureDatabase, buildLabsModel, formatNumber } from './data.js';
import { CRM_WIDGET_RENDERERS } from './crm_widgets.js';
import { makeDraggableGrid } from '../ui/drag_core.js';
import { loadSectionLayoutState, saveSectionLayoutState } from './layout_state.js';

let dashboardRoot = null;
let labsModel = null;
let activeSection = 'overview';
let navClickHandler = null;
let dataChangedHandler = null;
let customizeChangeHandler = null;
let labsLayoutEditMode = false;
const labsDragControllers = new Map();
const labsResizeControllers = new Map();
const labsWidthState = new Map();
const openCustomizerSections = new Set();

const WIDTH_TOKENS = ['w1', 'w2', 'w3'];
const SIZE_TO_WIDTH = {
  small: 'w1',
  medium: 'w2',
  large: 'w3'
};

const WIDGET_LABELS = {
  labsKpiSummary: 'Snapshot KPIs',
  labsPipelineSnapshot: 'Pipeline Snapshot',
  labsTasks: 'Tasks Due',
  today: 'Today\'s Work',
  todo: 'To-do List',
  favorites: 'Favorites',
  priorityActions: 'Priority Actions',
  milestones: 'Milestones',
  upcomingCelebrations: 'Upcoming Celebrations',
  partnerPortfolio: 'Partner Portfolio',
  referralLeaderboard: 'Referral Leaderboard',
  pipelineMomentum: 'Pipeline Momentum',
  relationshipOpportunities: 'Relationship Opportunities',
  closingWatch: 'Closing Watch'
};


const SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Pipeline health and today\'s work',
    widgets: [
      { id: 'labsKpiSummary', size: 'large' },
      { id: 'labsPipelineSnapshot', size: 'large' },
      { id: 'today', size: 'medium' },
      { id: 'todo', size: 'medium' },
      { id: 'favorites', size: 'small' },
      { id: 'labsTasks', size: 'medium' }
    ]
  },
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'Today\'s work and follow-ups',
    widgets: [
      { id: 'labsTasks', size: 'large' },
      { id: 'priorityActions', size: 'medium' },
      { id: 'today', size: 'medium' },
      { id: 'todo', size: 'medium' },
      { id: 'milestones', size: 'medium' },
      { id: 'upcomingCelebrations', size: 'medium' }
    ]
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    description: 'Clients, partners, and referrals',
    widgets: [
      { id: 'partnerPortfolio', size: 'large' },
      { id: 'referralLeaderboard', size: 'medium' },
      { id: 'pipelineMomentum', size: 'medium' },
      { id: 'relationshipOpportunities', size: 'medium' },
      { id: 'closingWatch', size: 'medium' },
      { id: 'upcomingCelebrations', size: 'medium' }
    ]
  }
];

const LABS_LAYOUT_PREFIX = 'labs:layout:';
const LABS_WIDTH_PREFIX = 'labs:widths:';

function layoutStorageKey(sectionId) {
  const safeId = sectionId ? String(sectionId).trim() : '';
  return `${LABS_LAYOUT_PREFIX}${safeId || 'default'}`;
}

function readStoredLayout(sectionId) {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(layoutStorageKey(sectionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch (_err) {
    return [];
  }
}

function widthStorageKey(sectionId) {
  const safeId = sectionId ? String(sectionId).trim() : '';
  return `${LABS_WIDTH_PREFIX}${safeId || 'default'}`;
}

function normalizeWidthToken(token) {
  const value = typeof token === 'string' ? token.trim() : '';
  if (WIDTH_TOKENS.includes(value)) return value;
  return '';
}

function defaultWidthToken(size) {
  const key = typeof size === 'string' ? size.toLowerCase() : '';
  return SIZE_TO_WIDTH[key] || 'w2';
}

function readStoredWidths(sectionId) {
  const cacheKey = sectionId || 'default';
  if (labsWidthState.has(cacheKey)) return labsWidthState.get(cacheKey);
  const map = new Map();
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(widthStorageKey(sectionId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([widgetId, token]) => {
            const normalized = normalizeWidthToken(token);
            if (widgetId && normalized) {
              map.set(String(widgetId), normalized);
            }
          });
        }
      }
    } catch (_err) {}
  }
  labsWidthState.set(cacheKey, map);
  return map;
}

function persistWidths(sectionId, widthMap) {
  if (typeof localStorage === 'undefined') return;
  const payload = {};
  if (widthMap && widthMap.forEach) {
    widthMap.forEach((token, widgetId) => {
      const normalized = normalizeWidthToken(token);
      if (widgetId && normalized) {
        payload[widgetId] = normalized;
      }
    });
  }
  try {
    if (Object.keys(payload).length) {
      localStorage.setItem(widthStorageKey(sectionId), JSON.stringify(payload));
    } else {
      localStorage.removeItem(widthStorageKey(sectionId));
    }
  } catch (_err) {}
}

function getWidgetWidthToken(sectionId, widget) {
  const widgetId = widget && widget.id ? String(widget.id) : '';
  if (!widgetId) return 'w2';
  const stored = readStoredWidths(sectionId).get(widgetId);
  if (stored) return stored;
  return defaultWidthToken(widget?.size);
}

function setWidgetWidthToken(sectionId, widgetId, token) {
  const normalized = normalizeWidthToken(token);
  if (!normalized) return;
  const map = readStoredWidths(sectionId);
  map.set(widgetId, normalized);
  persistWidths(sectionId, map);
}

function applyWidthClass(element, token) {
  if (!element) return;
  WIDTH_TOKENS.forEach((t) => element.classList.remove(`labs-${t}`));
  element.classList.add(`labs-${token}`);
}

function persistLayout(sectionId, order) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (Array.isArray(order) && order.length) {
      localStorage.setItem(layoutStorageKey(sectionId), JSON.stringify(order));
    } else {
      localStorage.removeItem(layoutStorageKey(sectionId));
    }
  } catch (_err) {}
}

function sortWidgetsForSection(section) {
  if (!section || !Array.isArray(section.widgets)) return [];
  const stored = readStoredLayout(section.id);
  if (!stored.length) return section.widgets.slice();
  const widgetMap = new Map();
  section.widgets.forEach((widget) => {
    if (widget && widget.id) {
      widgetMap.set(String(widget.id), widget);
    }
  });
  const ordered = [];
  stored.forEach((id) => {
    const widget = widgetMap.get(id);
    if (widget) {
      ordered.push(widget);
      widgetMap.delete(id);
    }
  });
  section.widgets.forEach((widget) => {
    if (widget && widget.id && widgetMap.has(widget.id)) {
      ordered.push(widget);
      widgetMap.delete(widget.id);
    }
  });
  return ordered;
}

function getWidgetLabel(widgetId) {
  if (!widgetId) return '';
  return WIDGET_LABELS[widgetId] || widgetId;
}

function normalizeVisibilityState(section, state) {
  const normalized = { visible: {} };
  const visible = state?.visible || {};
  (section?.widgets || []).forEach((widget) => {
    if (!widget?.id) return;
    const stored = visible[widget.id];
    normalized.visible[widget.id] = stored === false ? false : true;
  });
  return normalized;
}

function buildSectionRenderData(section) {
  const visibilityState = normalizeVisibilityState(section, loadSectionLayoutState(section.id));
  const widgetsInOrder = sortWidgetsForSection(section).filter(
    (widget) => visibilityState.visible[widget.id] !== false
  );
  return { visibilityState, widgetsInOrder };
}

function updateVisibility(sectionId, widgetId, isVisible) {
  const section = SECTIONS.find((s) => s.id === sectionId);
  if (!section || !widgetId) return;
  const state = normalizeVisibilityState(section, loadSectionLayoutState(sectionId));
  state.visible[widgetId] = !!isVisible;
  saveSectionLayoutState(sectionId, state);
}

function showLoading() {
  if (!dashboardRoot) return;
  const loading = document.createElement('div');
  loading.className = 'labs-loading';
  loading.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">Loading CRM Data...</div>
  `;
  dashboardRoot.replaceChildren(loading);
}

function showError(message) {
  if (!dashboardRoot) return;
  const error = document.createElement('div');
  error.className = 'labs-error';
  error.innerHTML = `
    <h2>⚠️ Error</h2>
    <p>${message}</p>
    <button class="labs-btn-primary" onclick="location.reload()">Reload</button>
  `;
  dashboardRoot.replaceChildren(error);
}

async function hydrateModel() {
  const model = await buildLabsModel();
  if (!model) {
    throw new Error('Labs data unavailable');
  }
  labsModel = model;
  return labsModel;
}

function renderShell() {
  if (!dashboardRoot) return;
  dashboardRoot.className = 'labs-crm-dashboard';
  dashboardRoot.dataset.qa = 'labs-crm-dashboard';
  dashboardRoot.classList.toggle('labs-layout-edit-mode', labsLayoutEditMode);

  const header = createHeader();
  const nav = createNavigation();
  const sectionHost = document.createElement('div');
  sectionHost.className = 'labs-section-host';
  sectionHost.dataset.qa = 'labs-section-host';

  dashboardRoot.replaceChildren(header, nav, sectionHost);

  renderSection(activeSection);
}

function createHeader() {
  const header = document.createElement('header');
  header.className = 'labs-crm-header';
  header.dataset.qa = 'labs-header';
  const contactCount = formatNumber(labsModel?.contacts?.length || 0);
  const partnerCount = formatNumber(labsModel?.partners?.length || 0);
  const taskCount = formatNumber(labsModel?.tasks?.length || 0);

  header.innerHTML = `
    <div class="labs-header-content">
      <div class="labs-branding">
        <h1 class="labs-title">
          <span class="labs-icon-main">🚀</span>
          CRM Labs
          <span class="labs-badge-beta">BETA</span>
        </h1>
        <p class="labs-subtitle">Canonical data • Alternate shell • Modern visuals</p>
      </div>
      <div class="labs-header-stats">
        <div class="header-stat">
          <div class="stat-value">${contactCount}</div>
          <div class="stat-label">Contacts</div>
        </div>
        <div class="header-stat">
          <div class="stat-value">${partnerCount}</div>
          <div class="stat-label">Partners</div>
        </div>
        <div class="header-stat">
          <div class="stat-value">${taskCount}</div>
          <div class="stat-label">Tasks</div>
        </div>
      </div>
      <div class="labs-header-actions">
        <button class="labs-btn-pill" data-action="refresh">Refresh Data</button>
        <button class="labs-btn-ghost" data-action="settings">Experiments</button>
        <button class="labs-btn-ghost" data-action="layout-toggle" aria-pressed="${labsLayoutEditMode}">${labsLayoutEditMode ? 'Done editing' : 'Edit layout'}</button>
      </div>
    </div>
  `;
  return header;
}

function updateLayoutToggleUi() {
  const toggle = dashboardRoot?.querySelector('[data-action="layout-toggle"]');
  if (!toggle) return;
  toggle.textContent = labsLayoutEditMode ? 'Done editing' : 'Edit layout';
  toggle.setAttribute('aria-pressed', labsLayoutEditMode ? 'true' : 'false');
}

function createNavigation() {
  const nav = document.createElement('div');
  nav.className = 'labs-nav';
  nav.dataset.qa = 'labs-nav';
  nav.setAttribute('role', 'tablist');
  const tabs = SECTIONS.map((section) => `
    <button class="labs-nav-tab ${section.id === activeSection ? 'active' : ''}" data-section="${section.id}" role="tab" aria-selected="${section.id === activeSection}" tabindex="${section.id === activeSection ? '0' : '-1'}">
      <span class="labs-nav-label">${section.label}</span>
      <span class="labs-nav-sub">${section.description}</span>
    </button>
  `).join('');
  nav.innerHTML = tabs;
  return nav;
}

function createSectionControls(section, visibilityState, isCustomizerOpen) {
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-section-controls';
  wrapper.dataset.sectionId = section.id;

  const meta = document.createElement('div');
  meta.className = 'labs-section-meta';
  meta.innerHTML = `
    <div class="labs-section-title">${section.label}</div>
    <div class="labs-section-desc">${section.description}</div>
  `;
  wrapper.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'labs-section-actions';

  const customizeBtn = document.createElement('button');
  customizeBtn.type = 'button';
  customizeBtn.className = 'labs-btn-ghost labs-customize-trigger';
  customizeBtn.dataset.action = 'toggle-customize';
  customizeBtn.dataset.sectionId = section.id;
  customizeBtn.setAttribute('aria-expanded', isCustomizerOpen ? 'true' : 'false');
  customizeBtn.textContent = 'Customize widgets';

  actions.appendChild(customizeBtn);
  wrapper.appendChild(actions);

  const panel = createCustomizePanel(section, visibilityState, isCustomizerOpen);
  if (panel) wrapper.appendChild(panel);

  return wrapper;
}

function createCustomizePanel(section, visibilityState, isOpen) {
  const panel = document.createElement('div');
  panel.className = 'labs-customize-panel';
  panel.dataset.sectionId = section.id;
  panel.hidden = !isOpen;

  const header = document.createElement('div');
  header.className = 'labs-customize-header';
  header.textContent = 'Show or hide widgets in this section';
  panel.appendChild(header);

  const list = document.createElement('div');
  list.className = 'labs-customize-list';

  (section.widgets || []).forEach((widget) => {
    if (!widget?.id) return;
    const row = document.createElement('label');
    row.className = 'labs-customize-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.widgetId = widget.id;
    checkbox.dataset.sectionId = section.id;
    checkbox.checked = visibilityState.visible[widget.id] !== false;

    const label = document.createElement('span');
    label.className = 'labs-customize-label';
    label.textContent = getWidgetLabel(widget.id);

    row.appendChild(checkbox);
    row.appendChild(label);
    list.appendChild(row);
  });

  panel.appendChild(list);
  return panel;
}

function renderSection(sectionId, options = {}) {
  const host = dashboardRoot?.querySelector('.labs-section-host');
  if (!host) return;
  const section = SECTIONS.find((s) => s.id === sectionId) || SECTIONS[0];
  activeSection = section.id;

  destroySectionController(section.id);
  destroyResizeController(section.id);

  host.innerHTML = '';

  const { visibilityState, widgetsInOrder } = buildSectionRenderData(section);
  const isCustomizerOpen = options.forceCustomizerOpen || openCustomizerSections.has(section.id);
  if (isCustomizerOpen) {
    openCustomizerSections.add(section.id);
  }

  const controls = createSectionControls(section, visibilityState, openCustomizerSections.has(section.id));
  host.appendChild(controls);

  const gridShell = document.createElement('div');
  gridShell.className = 'labs-grid-shell';

  const grid = document.createElement('div');
  grid.className = 'labs-crm-grid labs-static-grid';
  grid.dataset.qa = `labs-grid-${section.id}`;
  grid.dataset.sectionId = section.id;
  grid.classList.toggle('labs-grid-editable', labsLayoutEditMode);
  gridShell.appendChild(grid);
  host.appendChild(gridShell);

  renderWidgets(grid, widgetsInOrder);
  registerGridDrag(section, grid);
  registerResizeHandles(section, grid);
  updateNavState();
  updateLayoutToggleUi();
}

function updateNavState() {
  const tabs = dashboardRoot?.querySelectorAll('.labs-nav-tab');
  if (!tabs) return;
  tabs.forEach((tab) => {
    const section = tab.dataset.section;
    tab.classList.toggle('active', section === activeSection);
    tab.setAttribute('aria-selected', section === activeSection ? 'true' : 'false');
    tab.tabIndex = section === activeSection ? 0 : -1;
  });
}

function renderWidgets(grid, widgetList = []) {
  const model = labsModel || {
    contacts: [],
    partners: [],
    tasks: [],
    snapshot: { pipelineCounts: {} },
    celebrations: [],
    laneOrder: [],
    activeLanes: []
  };
  widgetList.forEach((widget, index) => {
    const renderer = CRM_WIDGET_RENDERERS[widget.id];
    if (!renderer) return;
    const widthToken = getWidgetWidthToken(grid.dataset.sectionId, widget);

    const item = document.createElement('div');
    item.className = `labs-grid-item size-${widget.size || 'medium'} labs-${widthToken}`;
    item.dataset.widgetId = widget.id;

    const handle = document.createElement('div');
    handle.className = 'labs-widget-drag-handle';
    handle.innerHTML = '<span class="handle-icon">↕</span><span class="handle-label">Drag</span>';

    const content = document.createElement('div');
    content.className = `labs-widget-container size-${widget.size || 'medium'} labs-${widthToken}`;
    content.role = 'presentation';
    content.dataset.widgetId = widget.id;
    content.dataset.qa = `labs-widget-${widget.id}`;
    content.style.animationDelay = `${index * 0.04}s`;

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'labs-widget-resize-handle';
    resizeHandle.dataset.labsResizeHandle = 'true';
    resizeHandle.setAttribute('aria-label', 'Resize widget');

    try {
      const rendered = renderer(content, model);
      if (typeof rendered === 'string') {
        content.innerHTML = rendered;
      } else if (rendered instanceof HTMLElement) {
        content.appendChild(rendered);
      }
      item.appendChild(handle);
      item.appendChild(content);
      item.appendChild(resizeHandle);
      grid.appendChild(item);
      console.debug(`[LABS] rendered widget ${widget.id}`);
    } catch (err) {
      console.error(`[labs] Error rendering widget ${widget.id}:`, err);
    }
  });
}

function destroySectionController(sectionId) {
  if (!sectionId) return;
  const existing = labsDragControllers.get(sectionId);
  if (existing && typeof existing.destroy === 'function') {
    try {
      existing.destroy();
    } catch (_err) {}
  }
  labsDragControllers.delete(sectionId);
}

function destroyResizeController(sectionId) {
  if (!sectionId) return;
  const teardown = labsResizeControllers.get(sectionId);
  if (typeof teardown === 'function') {
    try { teardown(); } catch (_err) {}
  }
  labsResizeControllers.delete(sectionId);
}

function registerGridDrag(section, grid) {
  if (!section || !grid) return;
  try {
    const controller = makeDraggableGrid({
      container: grid,
      itemSel: '.labs-grid-item',
      handleSel: '.labs-widget-drag-handle',
      storageKey: layoutStorageKey(section.id),
      idGetter: (el) => (el?.dataset?.widgetId ? String(el.dataset.widgetId).trim() : ''),
      onOrderChange: (order) => persistLayout(section.id, order),
      enabled: labsLayoutEditMode
    });
    if (controller) {
      if (typeof controller.setEditMode === 'function') {
        controller.setEditMode(labsLayoutEditMode);
      }
      if (labsLayoutEditMode && typeof controller.enable === 'function') {
        controller.enable();
      } else if (!labsLayoutEditMode && typeof controller.disable === 'function') {
        controller.disable();
      }
      if (typeof controller.refresh === 'function') {
        controller.refresh();
      }
      labsDragControllers.set(section.id, controller);
    }
  } catch (err) {
    try {
      if (console && console.warn) console.warn('[labs] drag init failed', err);
    } catch (_warnErr) {}
  }
}

function registerResizeHandles(section, grid) {
  if (!section || !grid) return;
  destroyResizeController(section.id);

  let active = null;

  const onMouseMove = (evt) => {
    if (!active) return;
    const dx = evt.clientX - active.startX;
    const threshold = 50;
    let delta = 0;
    if (dx > threshold) delta = 1;
    if (dx < -threshold) delta = -1;
    if (!delta) return;
    const currentIndex = WIDTH_TOKENS.indexOf(active.token);
    const nextIndex = Math.min(WIDTH_TOKENS.length - 1, Math.max(0, currentIndex + delta));
    if (nextIndex === currentIndex) return;
    const nextToken = WIDTH_TOKENS[nextIndex];
    active.token = nextToken;
    applyWidthClass(active.item, nextToken);
    if (active.content) applyWidthClass(active.content, nextToken);
    setWidgetWidthToken(active.sectionId, active.widgetId, nextToken);
  };

  const stop = () => {
    if (active) {
      active = null;
    }
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', stop);
  };

  const onMouseDown = (evt) => {
    if (!labsLayoutEditMode) return;
    const handle = evt.target.closest('[data-labs-resize-handle]');
    if (!handle) return;
    const item = handle.closest('.labs-grid-item');
    if (!item) return;
    evt.preventDefault();
    evt.stopPropagation();
    const widgetId = item.dataset.widgetId || '';
    if (!widgetId) return;
    const content = item.querySelector('.labs-widget-container');
    const initialToken = WIDTH_TOKENS.find((token) => item.classList.contains(`labs-${token}`))
      || getWidgetWidthToken(section.id, { id: widgetId });
    active = {
      widgetId,
      sectionId: section.id,
      item,
      content,
      startX: evt.clientX,
      token: initialToken
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stop);
  };

  grid.addEventListener('mousedown', onMouseDown);

  const teardown = () => {
    grid.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', stop);
  };

  labsResizeControllers.set(section.id, teardown);
}

async function refreshDashboard() {
  const grid = dashboardRoot?.querySelector('.labs-crm-grid');
  if (!grid) return;
  grid.setAttribute('aria-busy', 'true');
  grid.style.opacity = '0.5';
  try {
    await hydrateModel();
    renderSection(activeSection);
    showNotification('Dashboard refreshed', 'success');
  } catch (err) {
    console.error('[labs] Refresh failed:', err);
    showNotification('Refresh failed', 'error');
  } finally {
    grid.removeAttribute('aria-busy');
    grid.style.opacity = '1';
  }
}

function attachEventListeners() {
  if (!dashboardRoot) return;

  if (navClickHandler) {
    dashboardRoot.removeEventListener('click', navClickHandler);
  }
  navClickHandler = async (event) => {
    const navButton = event.target.closest('.labs-nav-tab');
    if (navButton && navButton.dataset.section) {
      renderSection(navButton.dataset.section);
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'refresh') {
      await refreshDashboard();
    }
    if (action === 'settings') {
      showNotification('Labs experiments are enabled — this mirrors the main dashboard.', 'info');
    }
    if (action === 'toggle-customize') {
      const sectionId = event.target.closest('[data-section-id]')?.dataset.sectionId || activeSection;
      if (!sectionId) return;
      if (openCustomizerSections.has(sectionId)) {
        openCustomizerSections.delete(sectionId);
      } else {
        openCustomizerSections.add(sectionId);
      }
      renderSection(sectionId, { forceCustomizerOpen: openCustomizerSections.has(sectionId) });
      return;
    }
    if (action === 'layout-toggle') {
      setLayoutMode(!labsLayoutEditMode);
    }
  };
  dashboardRoot.addEventListener('click', navClickHandler);

  if (customizeChangeHandler) {
    dashboardRoot.removeEventListener('change', customizeChangeHandler);
  }
  customizeChangeHandler = (event) => {
    const checkbox = event.target.closest('input[type="checkbox"][data-widget-id][data-section-id]');
    if (!checkbox) return;
    const sectionId = checkbox.dataset.sectionId;
    const widgetId = checkbox.dataset.widgetId;
    updateVisibility(sectionId, widgetId, checkbox.checked);
    renderSection(sectionId, { forceCustomizerOpen: true });
  };
  dashboardRoot.addEventListener('change', customizeChangeHandler);

  if (typeof document !== 'undefined') {
    if (dataChangedHandler) {
      document.removeEventListener('app:data:changed', dataChangedHandler);
    }
    dataChangedHandler = async (evt) => {
      console.info('[labs] CRM data changed, refreshing...', evt.detail);
      await refreshDashboard();
    };
    document.addEventListener('app:data:changed', dataChangedHandler);
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `labs-notification ${type}`;
  notification.textContent = message;
  dashboardRoot?.appendChild(notification);
  requestAnimationFrame(() => notification.classList.add('show'));
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 250);
  }, 2600);
}

function setLayoutMode(enabled) {
  labsLayoutEditMode = !!enabled;
  dashboardRoot?.classList.toggle('labs-layout-edit-mode', labsLayoutEditMode);
  const grid = dashboardRoot?.querySelector('.labs-crm-grid');
  if (grid) {
    grid.classList.toggle('labs-grid-editable', labsLayoutEditMode);
  }
  const controller = labsDragControllers.get(activeSection);
  if (controller) {
    if (typeof controller.setEditMode === 'function') {
      controller.setEditMode(labsLayoutEditMode);
    }
    if (labsLayoutEditMode && typeof controller.enable === 'function') {
      controller.enable();
    } else if (!labsLayoutEditMode && typeof controller.disable === 'function') {
      controller.disable();
    }
    if (typeof controller.refresh === 'function') {
      controller.refresh();
    }
  }
  updateLayoutToggleUi();
  showNotification(labsLayoutEditMode ? 'Layout editing enabled' : 'Layout saved', 'info');
}

async function mountLabsDashboard(root) {
  if (!root) {
    console.error('[labs] No root element provided');
    return;
  }
  console.debug('[LABS] mountLabsDashboard called');
  if (dashboardRoot && dashboardRoot !== root) {
    if (navClickHandler) {
      dashboardRoot.removeEventListener('click', navClickHandler);
    }
  }
  dashboardRoot = root;
  showLoading();

  const dbReady = await ensureDatabase();
  if (!dbReady) {
    showError('Failed to connect to CRM database');
    return;
  }

  try {
    await hydrateModel();
    renderShell();
    attachEventListeners();
    console.info('[labs] CRM Labs dashboard rendered');
  } catch (err) {
    console.error('[labs] Failed to initialize:', err);
    showError(err.message || 'Unable to render Labs dashboard');
  }
}

export { mountLabsDashboard as initLabsCRMDashboard };
export default mountLabsDashboard;
