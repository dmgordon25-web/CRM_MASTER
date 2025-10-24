import initDashboardLayout, {
  setDashboardLayoutMode,
  applyDashboardHidden,
  readStoredLayoutMode,
  readStoredHiddenIds,
  getDashboardWidgets,
  requestDashboardLayoutPass
} from '../ui/dashboard_layout.js';

const DASHBOARD_WIDGET_SELECTOR = ':scope > section.card, :scope > div.card, :scope > section.grid > .card, :scope > section.grid > section.card';
const defaultWidgets = getDashboardWidgets();
const defaultOrderIndex = new Map(defaultWidgets.map((widget, index) => [widget.id, index]));

const prefsState = {
  wired: false,
  logged: false,
  layoutMode: false,
  hidden: new Set(),
  widgets: defaultWidgets.slice()
};

const widgetLabelMap = new Map(prefsState.widgets.map(widget => [widget.id, widget.label]));

function postLog(event, data){
  const payload = JSON.stringify(Object.assign({ event }, data || {}));
  if(typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'){
    try{
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/__log', blob);
      return;
    }catch (_err){}
  }
  if(typeof fetch === 'function'){
    try{ fetch('/__log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }); }
    catch (_err){}
  }
}

function logReady(){
  if(prefsState.logged) return;
  prefsState.logged = true;
  try{ console.info('[VIS] dash-prefs ready'); }
  catch (_err){}
  postLog('dash-prefs-ready');
}

function refreshState(){
  prefsState.layoutMode = !!readStoredLayoutMode();
  prefsState.hidden = new Set(readStoredHiddenIds().map(String));
}

function dispatchLayoutMode(enabled){
  try{
    document?.dispatchEvent?.(new CustomEvent('dashboard:layout-mode', { detail: { enabled: !!enabled } }));
  }catch (_err){}
}

function dispatchHiddenChange(hiddenSet){
  try{
    const detail = { hidden: Array.from(hiddenSet).map(String) };
    document?.dispatchEvent?.(new CustomEvent('dashboard:hidden-change', { detail }));
  }catch (_err){}
}

function ensureCard(panel){
  const grid = panel.querySelector('.settings-panel-grid');
  if(!grid) return null;
  let card = grid.querySelector('[data-dash-prefs-card]');
  if(!card){
    card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-dash-prefs-card', 'true');
    grid.appendChild(card);
  }
  return card;
}

function hideLegacyWidgetCard(panel){
  const legacyList = panel.querySelector('#dashboard-widget-list');
  if(!legacyList) return;
  const legacyCard = legacyList.closest('.card');
  if(legacyCard) legacyCard.style.display = 'none';
}

function findDashboardContainer(){
  if(typeof document === 'undefined') return null;
  return document.querySelector('main[data-ui="dashboard-root"]')
    || document.getElementById('view-dashboard')
    || null;
}

function resolveWidgetLabel(node){
  if(!node) return '';
  const dataLabel = node.getAttribute('data-widget-label');
  if(dataLabel) return dataLabel.trim();
  const labelNode = node.querySelector('[data-ui="card-title"], .insight-head, .row > strong:first-child, header, h2, h3, h4');
  if(labelNode && typeof labelNode.textContent === 'string'){
    return labelNode.textContent.trim();
  }
  return '';
}

function scanWidgets(container){
  if(!container) return;
  let nodes;
  try{
    nodes = Array.from(container.querySelectorAll(DASHBOARD_WIDGET_SELECTOR)).filter(el => el && el.nodeType === 1);
  }catch (_err){
    return;
  }
  if(!nodes.length) return;
  const seen = new Set();
  const next = [];
  nodes.forEach(node => {
    const dataset = node.dataset || {};
    let id = dataset.widgetId || dataset.widget || '';
    id = id ? String(id).trim() : '';
    if(!id){
      id = String(node.id || '').trim();
    }
    if(!id){
      const fallback = resolveWidgetLabel(node);
      if(fallback){
        id = fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      }
    }
    if(!id) return;
    if(seen.has(id)){
      let index = 1;
      let candidate = `${id}-${index}`;
      while(seen.has(candidate)){
        index += 1;
        candidate = `${id}-${index}`;
      }
      id = candidate;
    }
    seen.add(id);
    if(!dataset.widgetId){
      node.dataset.widgetId = id;
    }
    let label = widgetLabelMap.get(id);
    if(!label){
      label = resolveWidgetLabel(node) || id;
      widgetLabelMap.set(id, label);
    }
    next.push({ id, label });
  });
  const fallback = [];
  widgetLabelMap.forEach((label, id) => {
    if(seen.has(id)) return;
    const order = defaultOrderIndex.has(id) ? defaultOrderIndex.get(id) : Number.MAX_SAFE_INTEGER;
    fallback.push({ id, label, order });
  });
  if(fallback.length){
    fallback.sort((a, b) => {
      if(a.order === b.order) return a.id.localeCompare(b.id);
      return a.order - b.order;
    });
    fallback.forEach(entry => next.push({ id: entry.id, label: entry.label }));
  }
  if(next.length){
    prefsState.widgets = next;
  }
}

function renderWidgetList(list){
  list.innerHTML = '';
  prefsState.widgets.forEach(widget => {
    const label = document.createElement('label');
    label.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('data-widget-id', widget.id);
    input.checked = !prefsState.hidden.has(widget.id);
    const span = document.createElement('span');
    span.textContent = widget.label;
    label.appendChild(input);
    label.appendChild(span);
    list.appendChild(label);
  });
}

function render(){
  if(typeof document === 'undefined') return;
  const panel = document.querySelector('.settings-panel[data-panel="dashboard"]');
  if(!panel) return;
  hideLegacyWidgetCard(panel);
  const card = ensureCard(panel);
  if(!card) return;
  const dashContainer = findDashboardContainer();
  scanWidgets(dashContainer);
  refreshState();
  card.innerHTML = '';
  const header = document.createElement('h3');
  header.textContent = 'Dashboard Layout';
  card.appendChild(header);
  const desc = document.createElement('p');
  desc.className = 'muted';
  desc.textContent = 'Manage layout mode and widget visibility for the dashboard.';
  card.appendChild(desc);
  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'switch';
  toggleLabel.innerHTML = '<input type="checkbox" data-role="layout-mode"><span>Layout Mode</span>';
  card.appendChild(toggleLabel);
  const hint = document.createElement('p');
  hint.className = 'muted fine-print';
  hint.textContent = 'Enable to drag widgets by their titles. Changes persist per device.';
  card.appendChild(hint);
  const list = document.createElement('div');
  list.className = 'settings-toggle-list';
  list.setAttribute('data-role', 'widget-list');
  card.appendChild(list);
  renderWidgetList(list);
  const layoutInput = toggleLabel.querySelector('input[data-role="layout-mode"]');
  layoutInput.checked = prefsState.layoutMode;
  if(!layoutInput.__wired){
    layoutInput.__wired = true;
    layoutInput.addEventListener('change', evt => {
      const enabled = !!evt.target.checked;
      prefsState.layoutMode = enabled;
      setDashboardLayoutMode(enabled);
      dispatchLayoutMode(enabled);
      requestDashboardLayoutPass({ reason: 'prefs-layout-mode' });
    });
  }
  if(!list.__wired){
    list.__wired = true;
    list.addEventListener('change', evt => {
      const target = evt.target instanceof HTMLInputElement
        ? evt.target
        : evt.target?.closest?.('input[data-widget-id]');
      if(!(target instanceof HTMLInputElement)) return;
      const id = target.getAttribute('data-widget-id');
      if(!id) return;
      const nextHidden = new Set(prefsState.hidden);
      if(target.checked){
        nextHidden.delete(id);
      }else{
        nextHidden.add(id);
      }
      prefsState.hidden = nextHidden;
      applyDashboardHidden(nextHidden);
      dispatchHiddenChange(nextHidden);
      requestDashboardLayoutPass({ reason: 'prefs-hidden' });
    });
  }
  list.querySelectorAll('input[data-widget-id]').forEach(input => {
    const id = input.getAttribute('data-widget-id');
    input.checked = !prefsState.hidden.has(id);
  });
  layoutInput.checked = prefsState.layoutMode;
  logReady();
}

function boot(){
  if(prefsState.wired) return;
  prefsState.wired = true;
  if(typeof document === 'undefined') return;
  const run = () => {
    initDashboardLayout();
    render();
  };
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }else{
    run();
  }
  window.RenderGuard?.registerHook?.(render);
}

boot();
