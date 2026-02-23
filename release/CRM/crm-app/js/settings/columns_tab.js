import { columnSchemas, getColumnSchema } from '../tables/column_schema.js';
import { getColumnsForView, loadColumnConfig, saveColumnConfig } from '../tables/column_config.js';
import { getUiMode, onUiModeChanged } from '../ui/ui_mode.js';

const VIEW_LABELS = {
  contacts: 'Contacts',
  longshots: 'Leads',
  pipeline: 'Pipeline',
  clients: 'Clients',
  partners: 'Partners',
  'leads-main': 'Leads Table',
  'pipeline-main': 'Pipeline Table',
  'partners-main': 'Partners Table'
};

const VIEW_ORDER = ['contacts', 'longshots', 'pipeline', 'clients', 'partners', 'leads-main', 'pipeline-main', 'partners-main'];

let columnsConfig = null;
let wired = false;

function currentMode(){
  try{
    return getUiMode();
  }catch (_err){
    return 'advanced';
  }
}

function ensureConfig(){
  if(!columnsConfig){
    columnsConfig = loadColumnConfig();
  }
  return columnsConfig;
}

function resolveViewLabel(viewKey){
  if(!viewKey) return '';
  if(Object.prototype.hasOwnProperty.call(VIEW_LABELS, viewKey)){
    return VIEW_LABELS[viewKey];
  }
  const normalized = String(viewKey)
    .replace(/-main$/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  return normalized.length ? normalized.join(' ') : viewKey;
}

function enumerateColumnViews(){
  const schemaKeys = columnSchemas ? Object.keys(columnSchemas) : [];
  const pending = new Set(schemaKeys);
  const ordered = [];
  VIEW_ORDER.forEach((key) => {
    if(!pending.has(key)) return;
    ordered.push(key);
    pending.delete(key);
  });
  if(pending.size){
    ordered.push(...Array.from(pending).sort());
  }
  return ordered;
}

function persist(viewKey, order, hidden){
  const config = ensureConfig();
  const schema = getColumnSchema(viewKey);
  const allowedIds = new Set(schema.map((col) => col.id));
  const existing = config[viewKey] || { order: [], hidden: [] };
  const baseOrder = Array.isArray(existing.order) ? existing.order.filter((id) => allowedIds.has(id)) : [];
  const baseHidden = new Set(Array.isArray(existing.hidden) ? existing.hidden.filter((id) => allowedIds.has(id)) : []);
  const requestedHidden = new Set((hidden || []).filter((id) => allowedIds.has(id)));
  const nextOrder = [];
  const seen = new Set();
  const nextHidden = new Set(baseHidden);
  requestedHidden.forEach((id) => nextHidden.add(id));
  (order || []).forEach((id) => {
    if(!allowedIds.has(id) || seen.has(id)) return;
    seen.add(id);
    nextOrder.push(id);
    nextHidden.delete(id);
  });
  baseOrder.forEach((id) => {
    if(!allowedIds.has(id) || seen.has(id) || nextHidden.has(id)) return;
    seen.add(id);
    nextOrder.push(id);
  });
  config[viewKey] = { order: nextOrder, hidden: Array.from(nextHidden) };
  columnsConfig = saveColumnConfig(config);
  const detail = { view: viewKey, mode: currentMode(), config: columnsConfig };
  try{ document.dispatchEvent(new CustomEvent('settings:columns:changed', { detail })); }
  catch (_err){}
}

function moveColumn(viewKey, columnId, delta){
  const mode = currentMode();
  const snapshot = getColumnsForView(viewKey, mode, ensureConfig());
  columnsConfig = snapshot.config;
  const order = snapshot.visibleColumns.map((col) => col.id);
  const index = order.indexOf(columnId);
  if(index < 0) return;
  const target = index + delta;
  if(target < 0 || target >= order.length) return;
  const [entry] = order.splice(index, 1);
  order.splice(target, 0, entry);
  const hidden = snapshot.config[viewKey]?.hidden || [];
  persist(viewKey, order, hidden);
}

function removeColumn(viewKey, columnId){
  const mode = currentMode();
  const snapshot = getColumnsForView(viewKey, mode, ensureConfig());
  columnsConfig = snapshot.config;
  const target = snapshot.visibleColumns.find((col) => col.id === columnId);
  if(!target || target.required) return;
  const order = snapshot.visibleColumns.map((col) => col.id).filter((id) => id !== columnId);
  const hidden = new Set(snapshot.config[viewKey]?.hidden || []);
  hidden.add(columnId);
  persist(viewKey, order, Array.from(hidden));
}

function addColumn(viewKey, columnId){
  const mode = currentMode();
  const snapshot = getColumnsForView(viewKey, mode, ensureConfig());
  columnsConfig = snapshot.config;
  const order = snapshot.visibleColumns.map((col) => col.id);
  if(!order.includes(columnId)){
    order.push(columnId);
  }
  const hidden = new Set(snapshot.config[viewKey]?.hidden || []);
  hidden.delete(columnId);
  persist(viewKey, order, Array.from(hidden));
}

function renderAvailableList(viewKey, container){
  const mode = currentMode();
  const snapshot = getColumnsForView(viewKey, mode, ensureConfig());
  columnsConfig = snapshot.config;
  const hiddenColumns = snapshot.hiddenColumns;
  const advancedOnly = mode === 'simple'
    ? getColumnSchema(viewKey).filter((col) => col.simple === false)
    : [];
  container.innerHTML = '';
  if(!hiddenColumns.length){
    const empty = document.createElement('div');
    empty.className = 'muted fine-print';
    empty.textContent = mode === 'simple'
      ? 'All simple columns are already visible.'
      : 'All optional columns are visible.';
    container.appendChild(empty);
    if(advancedOnly.length){
      const locked = document.createElement('div');
      locked.className = 'muted fine-print';
      locked.textContent = `Additional columns (${advancedOnly.map((c) => c.label).join(', ')}) are available in Advanced Mode.`;
      container.appendChild(locked);
    }
    return;
  }
  hiddenColumns.forEach((col) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    const label = document.createElement('span');
    label.textContent = col.label;
    row.appendChild(label);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', () => {
      addColumn(viewKey, col.id);
      renderColumnsPanel();
    });
    row.appendChild(addBtn);

    container.appendChild(row);
  });
}

function renderActiveList(viewKey, container){
  const mode = currentMode();
  const snapshot = getColumnsForView(viewKey, mode, ensureConfig());
  columnsConfig = snapshot.config;
  const visibleColumns = snapshot.visibleColumns;
  container.innerHTML = '';
  if(!visibleColumns.length){
    const empty = document.createElement('div');
    empty.className = 'muted fine-print';
    empty.textContent = 'No columns available for this view.';
    container.appendChild(empty);
    return;
  }
  visibleColumns.forEach((col, index) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    const labelWrap = document.createElement('div');
    labelWrap.className = 'row';
    labelWrap.style.gap = '6px';
    labelWrap.style.alignItems = 'center';

    const label = document.createElement('span');
    label.textContent = col.label;
    labelWrap.appendChild(label);

    if(col.required){
      const badge = document.createElement('span');
      badge.className = 'badge-pill';
      badge.textContent = 'Required';
      labelWrap.appendChild(badge);
    }
    row.appendChild(labelWrap);

    if(!col.required){
      const controls = document.createElement('div');
      controls.className = 'row';
      controls.style.gap = '6px';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'btn';
      upBtn.textContent = '↑';
      upBtn.title = 'Move up';
      upBtn.disabled = index === 0;
      upBtn.addEventListener('click', () => { moveColumn(viewKey, col.id, -1); renderColumnsPanel(); });
      controls.appendChild(upBtn);

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'btn';
      downBtn.textContent = '↓';
      downBtn.title = 'Move down';
      downBtn.disabled = index === visibleColumns.length - 1;
      downBtn.addEventListener('click', () => { moveColumn(viewKey, col.id, 1); renderColumnsPanel(); });
      controls.appendChild(downBtn);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn';
      removeBtn.textContent = 'Hide';
      removeBtn.addEventListener('click', () => { removeColumn(viewKey, col.id); renderColumnsPanel(); });
      controls.appendChild(removeBtn);

      row.appendChild(controls);
    }

    container.appendChild(row);
  });
}

function renderViewCard(viewKey){
  const label = resolveViewLabel(viewKey);
  const card = document.createElement('div');
  card.className = 'card';

  const heading = document.createElement('h3');
  heading.textContent = `${label} Columns`;
  card.appendChild(heading);

  const summary = document.createElement('p');
  summary.className = 'widget-summary muted';
  summary.textContent = 'Choose which fields appear and order them for this table.';
  card.appendChild(summary);

  const layout = document.createElement('div');
  layout.className = 'grid cols-2';
  layout.style.gap = '12px';

  const availableCol = document.createElement('div');
  const availableHeading = document.createElement('h4');
  availableHeading.textContent = 'Available';
  availableCol.appendChild(availableHeading);
  const availableList = document.createElement('div');
  availableList.className = 'column-list available-columns';
  availableList.style.display = 'grid';
  availableList.style.gap = '6px';
  availableCol.appendChild(availableList);

  const activeCol = document.createElement('div');
  const activeHeading = document.createElement('h4');
  activeHeading.textContent = 'Visible';
  activeCol.appendChild(activeHeading);
  const activeList = document.createElement('div');
  activeList.className = 'column-list active-columns';
  activeList.style.display = 'grid';
  activeList.style.gap = '6px';
  activeCol.appendChild(activeList);

  layout.appendChild(availableCol);
  layout.appendChild(activeCol);
  card.appendChild(layout);

  const note = document.createElement('p');
  note.className = 'fine-print muted';
  note.textContent = 'Required columns stay visible. Simple mode hides advanced fields.';
  card.appendChild(note);

  renderAvailableList(viewKey, availableList);
  renderActiveList(viewKey, activeList);

  return card;
}

function renderColumnsPanel(){
  const host = document.getElementById('settings-columns-grid');
  if(!host) return;
  ensureConfig();
  host.innerHTML = '';
  enumerateColumnViews().forEach((viewKey) => {
    if(!getColumnSchema(viewKey).length) return;
    const card = renderViewCard(viewKey);
    host.appendChild(card);
  });
}

export function initColumnsSettingsPanel(){
  if(wired) return;
  wired = true;
  const run = () => renderColumnsPanel();
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }else{
    run();
  }
  onUiModeChanged(run);
  window.RenderGuard?.registerHook?.(run);
}

export default { initColumnsSettingsPanel };
