import { listQueries, saveQuery, updateQuery, removeQuery, getQuery } from './queries_store.js';

const DEFAULT_ENTITY = 'contacts';
const COLUMN_CONFIG = {
  contacts: [
    { key: 'name', label: 'Name', value: contactName },
    { key: 'email', label: 'Email', value: (row) => String(row.email || '').trim() },
    { key: 'phone', label: 'Phone', value: (row) => String(row.phone || '').trim() },
    { key: 'stage', label: 'Stage', value: (row) => String(row.stage || row.status || '').trim() },
    { key: 'updated', label: 'Updated', value: (row) => formatDate(row.updatedAt || row.modifiedAt) }
  ],
  partners: [
    { key: 'name', label: 'Name', value: partnerName },
    { key: 'company', label: 'Company', value: (row) => String(row.company || '').trim() },
    { key: 'email', label: 'Email', value: (row) => String(row.email || '').trim() },
    { key: 'phone', label: 'Phone', value: (row) => String(row.phone || '').trim() },
    { key: 'tier', label: 'Tier', value: (row) => String(row.tier || row.partnerTier || '').trim() },
    { key: 'updated', label: 'Updated', value: (row) => formatDate(row.updatedAt || row.modifiedAt) }
  ]
};

const activeSnapshot = {
  entity: DEFAULT_ENTITY,
  filters: {},
  rows: [],
  raw: ''
};

function deepClone(value){
  if(value == null) return value;
  try{
    return JSON.parse(JSON.stringify(value));
  }catch (_err){
    if(Array.isArray(value)) return value.map((item) => deepClone(item));
    if(typeof value === 'object'){
      const copy = {};
      Object.keys(value).forEach((key) => { copy[key] = deepClone(value[key]); });
      return copy;
    }
    return value;
  }
import { doubleRaf } from '../patch_2025-10-02_baseline_ux_cleanup.js';
import { loadAll as loadSavedQueries, save as saveQueryDefinition } from './queries_store.js';

const state = {
  lastMount: null,
  selectionListener: null,
  dataListener: null,
  refreshScheduled: false,
  currentOptions: {},
  tables: { contacts: null, partners: null },
  counts: { contacts: null, partners: null },
  savedQueries: {},
  selfTestRunner: null,
  selfTestLoad: null
};

function ensureMount(root){
  if(typeof document === 'undefined') return null;
  let mount = null;
  if(root){
    if(root.id === 'view-workbench'){
      mount = root;
    }else if(typeof root.querySelector === 'function'){
      mount = root.querySelector('#view-workbench');
    }
  }
  if(!mount){
    mount = document.getElementById('view-workbench');
  }
  if(!mount){
    mount = document.createElement('main');
    mount.id = 'view-workbench';
    mount.classList.add('hidden');
    mount.setAttribute('data-view', 'workbench');
    const container = (root && typeof root.appendChild === 'function')
      ? root
      : document.querySelector('.container');
    if(container && typeof container.appendChild === 'function'){
      container.appendChild(mount);
    }else if(document.body && typeof document.body.appendChild === 'function'){
      document.body.appendChild(mount);
    }
  }else if(root && typeof root.appendChild === 'function' && !root.contains(mount)){
    root.appendChild(mount);
  }
  state.lastMount = mount;
  return mount;
}

function isWorkbenchActive(){
  const mount = state.lastMount;
  if(!mount) return false;
  if(mount.classList && mount.classList.contains('hidden')) return false;
  return !!mount.querySelector?.('[data-wb-section]');
}

function formatDate(value){
  if(!value) return '';
  const ts = typeof value === 'number' ? value : Date.parse(value);
  if(Number.isNaN(ts)) return '';
  try{
    const fmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    return fmt.format(new Date(ts));
  }catch (_err){
    return new Date(ts).toISOString().slice(0, 10);
    const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
    return fmt.format(new Date(ts));
  }catch (_err){
    return '';
  }
}

function contactName(row){
  const first = String(row.first || row.firstName || '').trim();
  const last = String(row.last || row.lastName || '').trim();
  if(first || last) return `${first} ${last}`.trim();
  return String(row.name || row.company || row.email || row.id || '').trim();
}

function partnerName(row){
  return String(row.name || row.company || row.email || row.id || '').trim();
}

function safeStringify(filters){
  if(filters == null) return '';
  try{ return JSON.stringify(filters, null, 2); }
  catch (_err){ return String(filters); }
}

function parseFilters(rawText){
  if(typeof rawText !== 'string') return {};
  const trimmed = rawText.trim();
  if(!trimmed) return {};
  try{
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed : { q: trimmed };
  }catch (_err){
    return { q: trimmed };
  }
}

async function fetchRecords(entity){
  const target = String(entity || DEFAULT_ENTITY).toLowerCase() === 'partners' ? 'partners' : 'contacts';
  const open = typeof window !== 'undefined' ? window.openDB : null;
  const getter = typeof window !== 'undefined' ? window.dbGetAll : null;
  if(typeof open === 'function'){
    try{ await open(); }
    catch (_err){}
  }
  if(typeof getter !== 'function') return [];
  try{
    const rows = await getter(target);
    if(!Array.isArray(rows)) return [];
    const copy = rows.map((row) => ({ ...row }));
    copy.sort((a, b) => {
      const left = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
      const right = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
      return right - left;
    });
    return copy;
  }catch (_err){
    return [];
  }
}

function normalizeArray(value){
  if(Array.isArray(value)) return value.map((item) => String(item || '').toLowerCase()).filter(Boolean);
  if(typeof value === 'string') return [String(value).toLowerCase()].filter(Boolean);
  return [];
}

function matchesFilters(row, filters, entity){
  if(!filters || typeof filters !== 'object') return true;
  const stageFields = ['stage', 'status'];
  const tierFields = ['tier', 'partnerTier'];
  const partnerFields = ['partnerId', 'partner'];
  const emailFields = ['email'];
  const phoneFields = ['phone'];

  const q = typeof filters.q === 'string' ? filters.q.trim().toLowerCase() : '';
  if(q){
    const haystack = Object.values(row || {})
      .map((value) => (value == null ? '' : String(value)))
      .join(' ')
      .toLowerCase();
    if(!haystack.includes(q)) return false;
  }

  const stages = normalizeArray(filters.stages || filters.stage || filters.status || filters.pipelineStages);
  if(stages.length){
    const value = stageFields
      .map((key) => String(row[key] || '').toLowerCase())
      .find((val) => Boolean(val));
    if(!value || !stages.includes(value)) return false;
  }

  const tiers = normalizeArray(filters.tier || filters.tiers);
  if(tiers.length){
    const value = tierFields
      .map((key) => String(row[key] || '').toLowerCase())
      .find((val) => Boolean(val));
    if(!value || !tiers.includes(value)) return false;
  }

  const partnerIds = normalizeArray(filters.partnerIds || filters.partners || filters.partnerId);
  if(partnerIds.length){
    const candidate = partnerFields
      .map((key) => String(row[key] || '').toLowerCase())
      .find((val) => Boolean(val));
    if(!candidate || !partnerIds.includes(candidate)) return false;
  }

  if(filters.hasEmail === true){
    const hasEmail = emailFields.some((key) => row[key] && String(row[key]).trim());
    if(!hasEmail) return false;
  }

  if(filters.hasPhone === true){
    const hasPhone = phoneFields.some((key) => row[key] && String(row[key]).trim());
    if(!hasPhone) return false;
  }

  if(filters.overdueTasks === true){
    const due = row.tasksDueAt || row.nextTaskDueAt || row.nextTaskAt;
    if(!due) return false;
    const dueTs = typeof due === 'number' ? due : Date.parse(due);
    if(Number.isNaN(dueTs)) return false;
    if(dueTs > Date.now()) return false;
  }

  const createdFrom = filters.createdFrom || filters.created_after;
  if(createdFrom){
    const ts = Date.parse(createdFrom);
    if(!Number.isNaN(ts)){
      const created = row.createdAt || row.created || row.insertedAt;
      const createdTs = typeof created === 'number' ? created : Date.parse(created || '');
      if(Number.isNaN(createdTs) || createdTs < ts) return false;
    }
  }

  const createdTo = filters.createdTo || filters.created_before;
  if(createdTo){
    const ts = Date.parse(createdTo);
    if(!Number.isNaN(ts)){
      const created = row.createdAt || row.created || row.insertedAt;
      const createdTs = typeof created === 'number' ? created : Date.parse(created || '');
      if(!Number.isNaN(createdTs) && createdTs > ts) return false;
    }
  }

  const updatedFrom = filters.updatedFrom;
  if(updatedFrom){
    const ts = Date.parse(updatedFrom);
    if(!Number.isNaN(ts)){
      const updated = row.updatedAt || row.modifiedAt || row.updated;
      const updatedTs = typeof updated === 'number' ? updated : Date.parse(updated || '');
      if(Number.isNaN(updatedTs) || updatedTs < ts) return false;
    }
  }

  const updatedTo = filters.updatedTo;
  if(updatedTo){
    const ts = Date.parse(updatedTo);
    if(!Number.isNaN(ts)){
      const updated = row.updatedAt || row.modifiedAt || row.updated;
      const updatedTs = typeof updated === 'number' ? updated : Date.parse(updated || '');
      if(!Number.isNaN(updatedTs) && updatedTs > ts) return false;
    }
  }

  const lastTouchFrom = filters.lastTouchFrom;
  if(lastTouchFrom){
    const ts = Date.parse(lastTouchFrom);
    if(!Number.isNaN(ts)){
      const lastTouch = row.lastTouchAt || row.lastContactedAt || row.lastContacted;
      const lastTs = typeof lastTouch === 'number' ? lastTouch : Date.parse(lastTouch || '');
      if(Number.isNaN(lastTs) || lastTs < ts) return false;
    }
  }

  const lastTouchTo = filters.lastTouchTo;
  if(lastTouchTo){
    const ts = Date.parse(lastTouchTo);
    if(!Number.isNaN(ts)){
      const lastTouch = row.lastTouchAt || row.lastContactedAt || row.lastContacted;
      const lastTs = typeof lastTouch === 'number' ? lastTouch : Date.parse(lastTouch || '');
      if(!Number.isNaN(lastTs) && lastTs > ts) return false;
    }
  }

  const lastTouchOlderThan = filters.lastTouchOlderThan;
  if(typeof lastTouchOlderThan === 'number' && lastTouchOlderThan > 0){
    const lastTouch = row.lastTouchAt || row.lastContactedAt || row.lastContacted;
    const lastTs = typeof lastTouch === 'number' ? lastTouch : Date.parse(lastTouch || '');
    if(!Number.isNaN(lastTs)){
      const delta = Date.now() - lastTs;
      if(delta < lastTouchOlderThan * 86400000) return false;
    }
  }

  const entityFilter = filters.entity;
  if(entityFilter){
    const normalized = String(entityFilter).toLowerCase();
    if(normalized && normalized !== String(entity).toLowerCase()) return false;
  }

  return true;
}

function applySort(rows, sort){
  if(!Array.isArray(rows)) return [];
  if(!sort || typeof sort !== 'object') return rows.slice();
  const field = typeof sort.field === 'string' ? sort.field : null;
  if(!field) return rows.slice();
  const dir = String(sort.dir || sort.direction || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const left = a ? a[field] : undefined;
    const right = b ? b[field] : undefined;
    if(left == null && right == null) return 0;
    if(left == null) return -1 * dir;
    if(right == null) return 1 * dir;
    if(typeof left === 'number' && typeof right === 'number'){
      if(left === right) return 0;
      return left > right ? dir : -dir;
    }
    const l = String(left).toLowerCase();
    const r = String(right).toLowerCase();
    if(l === r) return 0;
    return l > r ? dir : -dir;
  });
}

async function runWorkbenchQuery(entity, filters, sort){
  const rows = await fetchRecords(entity);
  const filtered = rows.filter((row) => matchesFilters(row, filters, entity));
  const sorted = applySort(filtered, sort || filters?.sort);
  activeSnapshot.entity = entity;
  activeSnapshot.filters = deepClone(filters || {});
  activeSnapshot.rows = deepClone(sorted);
  activeSnapshot.raw = typeof filters?.raw === 'string' ? filters.raw : safeStringify(filters || {});
  return sorted;
}

function toCsvValue(value){
  if(value == null) return '';
  const str = String(value);
  if(/[",
]/.test(str)){
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export async function workbenchExportCsv(options = {}){
  const entity = options.entity ? String(options.entity) : activeSnapshot.entity || DEFAULT_ENTITY;
  const filters = options.filters ? deepClone(options.filters) : deepClone(activeSnapshot.filters || {});
  let rows = Array.isArray(options.rows) ? options.rows.map((row) => ({ ...row })) : null;
  if(!rows || !rows.length){
    rows = await runWorkbenchQuery(entity, filters, options.sort);
  }
  const columns = COLUMN_CONFIG[entity] || COLUMN_CONFIG.contacts;
  const header = ['Select'].concat(columns.map((col) => col.label));
  const csvRows = [header.join(',')];
  rows.forEach((row) => {
    const cells = [''];
    columns.forEach((col) => {
      let value;
      try{ value = col.value(row); }
      catch (_err){ value = ''; }
      cells.push(toCsvValue(value));
    });
    csvRows.push(cells.join(','));
  });
  return csvRows.join('
');
}

function getSelectionSnapshot(){
  const empty = { scope: '', ids: new Set() };
  const selection = typeof window !== 'undefined' ? window.Selection : null;
  if(selection && typeof selection.get === 'function'){
    try{
      const snap = selection.get();
      if(snap && Array.isArray(snap.ids)){
        return { scope: snap.type || snap.scope || '', ids: new Set(snap.ids.map((id) => String(id))) };
      }
    }catch (_err){}
  }
  const service = typeof window !== 'undefined' ? window.SelectionService : null;
  if(service){
    try{
      const ids = typeof service.getIds === 'function' ? service.getIds() : service.ids;
      const list = Array.isArray(ids) ? ids : (ids && typeof ids.values === 'function' ? Array.from(ids.values()) : []);
      const scope = service.type || service.scope || '';
      if(Array.isArray(list) || list instanceof Set){
        return { scope, ids: new Set(Array.from(list).map((id) => String(id))) };
      }
    }catch (_err){}
  }
  return empty;
}

function setSelection(scope, id, active){
  const normalizedScope = String(scope || '').toLowerCase();
  const targetId = String(id);
  if(!targetId) return;
  const selection = typeof window !== 'undefined' ? window.Selection : null;
  const service = typeof window !== 'undefined' ? window.SelectionService : null;
  if(active){
    if(selection && typeof selection.add === 'function'){ selection.add(targetId, normalizedScope); return; }
    if(service && typeof service.add === 'function'){ service.add(targetId, normalizedScope); return; }
  }else{
    if(selection && typeof selection.remove === 'function'){ selection.remove(targetId, normalizedScope); return; }
    if(service && typeof service.remove === 'function'){ service.remove(targetId); return; }
  }
  if(selection && typeof selection.toggle === 'function'){ selection.toggle(targetId, normalizedScope); return; }
  if(service && typeof service.toggle === 'function'){ service.toggle(targetId, normalizedScope); }
}

function syncSelectionState(table, entity){
  if(!table) return;
  const snapshot = getSelectionSnapshot();
  const expectedScope = String(entity || '').toLowerCase();
  table.querySelectorAll('tbody tr[data-id]').forEach((row) => {
    const id = row.getAttribute('data-id');
    const active = id && snapshot.scope === expectedScope && snapshot.ids.has(String(id));
    row.classList.toggle('is-selected', !!active);
    row.setAttribute('aria-selected', active ? 'true' : 'false');
    const checkbox = row.querySelector('input[type="checkbox"][data-role="select"]');
    if(checkbox && checkbox.checked !== active){
      checkbox.checked = active;
    }
  });
}

function wireTable(table, entity){
  if(!table || table.__wbWired) return;
  table.__wbWired = true;
  const scope = String(entity || DEFAULT_ENTITY).toLowerCase();
  table.addEventListener('click', (event) => {
    const row = event.target && event.target.closest('tr[data-id]');
    if(!row) return;
    if(event.target && event.target.closest('button, a, input, label, textarea, select')) return;
    const id = row.getAttribute('data-id');
    if(!id) return;
    const snapshot = getSelectionSnapshot();
    const isActive = snapshot.scope === scope && snapshot.ids.has(String(id));
    setSelection(scope, id, !isActive);
    syncSelectionState(table, scope);
    event.preventDefault();
    event.stopPropagation();
  });
  table.addEventListener('change', (event) => {
    const checkbox = event.target && event.target.closest('input[type="checkbox"][data-role="select"]');
    if(!checkbox) return;
    const row = checkbox.closest('tr[data-id]');
    if(!row) return;
    const id = row.getAttribute('data-id');
    if(!id) return;
    const desired = checkbox.checked;
    setSelection(scope, id, desired);
    syncSelectionState(table, scope);
    event.preventDefault();
    event.stopPropagation();
  });
}

function buildResultsTable(entity, rows){
  const columns = COLUMN_CONFIG[entity] || COLUMN_CONFIG.contacts;
  const table = document.createElement('table');
  table.id = 'workbench-table';
  table.className = 'table';
  table.setAttribute('data-selection-scope', entity);
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const selectTh = document.createElement('th');
  selectTh.style.width = '32px';
  selectTh.textContent = '';
  headerRow.appendChild(selectTh);
  columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col.label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  const tbody = document.createElement('tbody');
  if(!rows.length){
    const empty = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = columns.length + 1;
    cell.textContent = 'No records found.';
    cell.className = 'muted';
    empty.appendChild(cell);
    tbody.appendChild(empty);
  }else{
    const frag = document.createDocumentFragment();
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      const id = row && row.id != null ? String(row.id) : null;
      if(id) tr.setAttribute('data-id', id);
      const selectCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('data-role', 'select');
      checkbox.setAttribute('aria-label', 'Select row');
      selectCell.appendChild(checkbox);
      tr.appendChild(selectCell);
      columns.forEach((col) => {
        const td = document.createElement('td');
        let value = '';
        try{ value = col.value(row); }
        catch (_err){ value = ''; }
        td.textContent = value == null ? '' : String(value);
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }
  table.appendChild(thead);
  table.appendChild(tbody);
  wireTable(table, entity);
  syncSelectionState(table, entity);
  return table;
}

function createButton(label, className){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  return btn;
}

async function refreshSavedList(state){
  const entity = state.entitySelect.value || DEFAULT_ENTITY;
  let list;
  try{ list = await WorkbenchViews.list(entity); }
  catch (_err){ list = []; }
  state.savedQueries = Array.isArray(list) ? list : [];
  state.savedList.innerHTML = '';
  if(!state.savedQueries.length){
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = 'No saved queries yet.';
    state.savedList.appendChild(empty);
  }else{
    const frag = document.createDocumentFragment();
    state.savedQueries.forEach((item) => {
      const li = document.createElement('li');
      li.dataset.id = item.id;
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'space-between';
      li.style.gap = '8px';
      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'btn link';
      loadBtn.dataset.action = 'load';
      loadBtn.dataset.id = item.id;
      loadBtn.textContent = item.name || 'Untitled';
      const meta = document.createElement('span');
      meta.className = 'muted';
      meta.style.fontSize = '12px';
      meta.textContent = formatDate(item.updatedAt);
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn';
      deleteBtn.dataset.action = 'delete';
      deleteBtn.dataset.id = item.id;
      deleteBtn.textContent = 'Remove';
      deleteBtn.setAttribute('aria-label', `Delete ${item.name}`);
      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.flexDirection = 'column';
      left.style.alignItems = 'flex-start';
      left.appendChild(loadBtn);
      left.appendChild(meta);
      li.appendChild(left);
      li.appendChild(deleteBtn);
      frag.appendChild(li);
    });
    state.savedList.appendChild(frag);
  }
}

async function loadSavedQuery(state, id, { autorun = true } = {}){
  if(!id) return;
  let record = null;
  try{ record = await getQuery(id); }
  catch (_err){ record = null; }
  if(!record) return;
  state.activeId = record.id;
  state.nameInput.value = record.name || '';
  const entity = record.entity || DEFAULT_ENTITY;
  state.entitySelect.value = entity;
  const rawText = typeof record.raw === 'string' && record.raw.trim() ? record.raw : safeStringify(record.filters || {});
  state.filterInput.value = rawText;
  state.status.textContent = `Loaded saved query "${record.name || ''}".`;
  if(autorun){
    await handleRun(state, { entity });
  }
}

async function handleSave(state){
  const nameRaw = state.nameInput.value;
  const entity = state.entitySelect.value || DEFAULT_ENTITY;
  const rawText = state.filterInput.value || '';
  const filters = parseFilters(rawText);
  const payload = {
    name: nameRaw && nameRaw.trim() ? nameRaw.trim() : 'Untitled Query',
    entity,
    filters,
    raw: rawText
  };
  try{
    let record;
    if(state.activeId){
      record = await WorkbenchViews.update(state.activeId, payload);
      if(!record){
        record = await WorkbenchViews.save(payload.name, filters, { entity, raw: rawText });
      }
    }else{
      record = await WorkbenchViews.save(payload.name, filters, { entity, raw: rawText });
    }
    if(record){
      state.activeId = record.id;
      state.status.textContent = 'Query saved.';
    }else{
      state.status.textContent = 'Save failed.';
    }
  }catch (err){
    state.status.textContent = 'Save failed.';
    try{ console.warn('[workbench] save failed', err); }
    catch (_err){}
  }
  await refreshSavedList(state);
}

async function handleDelete(state, id){
  if(!id) return;
  try{ await WorkbenchViews.remove(id); }
  catch (err){
    try{ console.warn('[workbench] remove failed', err); }
    catch (_err){}
  }
  if(state.activeId && String(state.activeId) === String(id)){
    state.activeId = null;
  }
  await refreshSavedList(state);
}

async function handleRun(state, opts = {}){
  const entity = opts.entity || state.entitySelect.value || DEFAULT_ENTITY;
  const rawText = state.filterInput.value || '';
  const filters = parseFilters(rawText);
  filters.raw = rawText;
  let results = [];
  try{ results = await runWorkbenchQuery(entity, filters, filters.sort); }
  catch (err){
    try{ console.warn('[workbench] run failed', err); }
    catch (_err){}
    results = [];
  }
  state.lastResults = results.slice();
  state.lastFilters = deepClone(filters);
  state.entity = entity;
  const table = buildResultsTable(entity, results);
  state.results.innerHTML = '';
  state.results.appendChild(table);
  state.currentTable = table;
  if(!opts.silent){
    const count = results.length;
    state.status.textContent = count ? `${count} record${count === 1 ? '' : 's'} returned.` : 'No records matched.';
  }
}

async function handleExport(state){
  const entity = state.entitySelect.value || DEFAULT_ENTITY;
  const rows = state.lastResults && state.lastResults.length ? state.lastResults : null;
  const filters = state.lastFilters || parseFilters(state.filterInput.value || '');
  let csv = '';
  try{ csv = await workbenchExportCsv({ entity, rows, filters }); }
  catch (err){
    try{ console.warn('[workbench] export failed', err); }
    catch (_err){}
    csv = '';
  }
  if(!csv){
    state.status.textContent = 'No data to export.';
    return;
  }
  try{
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const suffix = new Date().toISOString().slice(0, 10);
    link.download = `workbench_${entity}_${suffix}.csv`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 0);
    state.status.textContent = 'CSV export ready.';
  }catch (err){
    state.status.textContent = 'Export failed.';
    try{ console.warn('[workbench] CSV export failed', err); }
    catch (_err){}
  }
}

function setupSelectionSync(state){
  if(state.selectionHandler) return;
  const handler = () => {
    if(state.currentTable) syncSelectionState(state.currentTable, state.entity);
  };
  state.selectionHandler = handler;
  if(typeof document !== 'undefined'){ document.addEventListener('selection:changed', handler); }
  state.teardown.push(() => {
    if(typeof document !== 'undefined'){ document.removeEventListener('selection:changed', handler); }
  });
}

function createLayout(host){
  host.innerHTML = '';
  host.setAttribute('data-view', 'workbench');
  host.style.display = 'block';
  const shell = document.createElement('div');
  shell.className = 'workbench-shell';
  shell.style.display = 'grid';
  shell.style.gridTemplateColumns = 'minmax(220px, 260px) 1fr';
  shell.style.gap = '16px';

  const savedColumn = document.createElement('aside');
  savedColumn.style.display = 'flex';
  savedColumn.style.flexDirection = 'column';
  savedColumn.style.gap = '12px';
  const savedTitle = document.createElement('h3');
  savedTitle.textContent = 'Saved Queries';
  savedTitle.style.margin = '0';
  const savedList = document.createElement('ul');
  savedList.style.listStyle = 'none';
  savedList.style.margin = '0';
  savedList.style.padding = '0';
  savedList.style.display = 'flex';
  savedList.style.flexDirection = 'column';
  savedList.style.gap = '8px';
  savedColumn.appendChild(savedTitle);
  savedColumn.appendChild(savedList);

  const mainColumn = document.createElement('div');
  mainColumn.style.display = 'flex';
  mainColumn.style.flexDirection = 'column';
  mainColumn.style.gap = '16px';

  const header = document.createElement('header');
  header.style.display = 'flex';
  header.style.flexDirection = 'column';
  header.style.gap = '4px';
  const title = document.createElement('h2');
  title.textContent = 'Workbench';
  title.style.margin = '0';
  const subtitle = document.createElement('p');
  subtitle.className = 'muted';
  subtitle.style.margin = '0';
  subtitle.textContent = 'Build quick queries, review results, and export selections.';
  header.appendChild(title);
  header.appendChild(subtitle);

  const form = document.createElement('section');
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '12px';

  const nameRow = document.createElement('div');
  nameRow.style.display = 'flex';
  nameRow.style.gap = '12px';
  nameRow.style.alignItems = 'center';
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name';
  nameLabel.style.display = 'flex';
  nameLabel.style.flexDirection = 'column';
  nameLabel.style.gap = '4px';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'My Saved Query';
  nameInput.className = 'input';
  nameLabel.appendChild(nameInput);
  const entityLabel = document.createElement('label');
  entityLabel.textContent = 'Entity';
  entityLabel.style.display = 'flex';
  entityLabel.style.flexDirection = 'column';
  entityLabel.style.gap = '4px';
  const entitySelect = document.createElement('select');
  entitySelect.className = 'input';
  ['contacts', 'partners'].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value.charAt(0).toUpperCase() + value.slice(1);
    entitySelect.appendChild(option);
  });
  entityLabel.appendChild(entitySelect);
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(entityLabel);

  const filtersLabel = document.createElement('label');
  filtersLabel.textContent = 'Filters (JSON or simple text search)';
  filtersLabel.style.display = 'flex';
  filtersLabel.style.flexDirection = 'column';
  filtersLabel.style.gap = '4px';
  const filterInput = document.createElement('textarea');
  filterInput.rows = 6;
  filterInput.className = 'input';
  filterInput.placeholder = '{"q":"stage:qualified"}';
  filtersLabel.appendChild(filterInput);

  const buttonRow = document.createElement('div');
  buttonRow.style.display = 'flex';
  buttonRow.style.gap = '8px';
  const saveBtn = createButton('Save', 'btn');
  const runBtn = createButton('Run', 'btn brand');
  const exportBtn = createButton('Export CSV', 'btn');
  buttonRow.appendChild(saveBtn);
  buttonRow.appendChild(runBtn);
  buttonRow.appendChild(exportBtn);

  const status = document.createElement('div');
  status.className = 'muted';
  status.textContent = 'Define a query and press Run to see results.';

  const results = document.createElement('section');
  results.id = 'workbench-results';
  results.style.display = 'block';
  results.style.overflowX = 'auto';
  results.style.padding = '0';
  results.style.margin = '0';

  form.appendChild(nameRow);
  form.appendChild(filtersLabel);
  form.appendChild(buttonRow);

  mainColumn.appendChild(header);
  mainColumn.appendChild(form);
  mainColumn.appendChild(status);
  mainColumn.appendChild(results);

  shell.appendChild(savedColumn);
  shell.appendChild(mainColumn);
  host.appendChild(shell);

  return {
    savedList,
    nameInput,
    entitySelect,
    filterInput,
    saveBtn,
    runBtn,
    exportBtn,
    status,
    results
  };
}

function cleanupState(state){
  if(!state) return;
  if(Array.isArray(state.teardown)){
    while(state.teardown.length){
      const fn = state.teardown.pop();
      try{ if(typeof fn === 'function') fn(); }
      catch (_err){}
    }
  }
}

export async function mountWorkbench(root, _options = {}){
  const host = root && root.nodeType === 1
    ? root
    : (typeof document !== 'undefined' ? (document.querySelector('#route-root') || document.getElementById('view-workbench') || document.body) : null);
  if(!host) return;
  if(host.__workbenchState){
    cleanupState(host.__workbenchState);
  }
  const ui = createLayout(host);
  const state = {
    host,
    savedList: ui.savedList,
    nameInput: ui.nameInput,
    entitySelect: ui.entitySelect,
    filterInput: ui.filterInput,
    saveBtn: ui.saveBtn,
    runBtn: ui.runBtn,
    exportBtn: ui.exportBtn,
    status: ui.status,
    results: ui.results,
    teardown: [],
    savedQueries: [],
    activeId: null,
    lastResults: [],
    lastFilters: {},
    entity: ui.entitySelect.value,
    currentTable: null,
    selectionHandler: null
  };

  host.__workbenchState = state;

  const savedClickHandler = async (event) => {
    const actionNode = event.target && event.target.closest('[data-action]');
    if(!actionNode) return;
    const action = actionNode.dataset.action;
    const id = actionNode.dataset.id;
    event.preventDefault();
    if(action === 'load'){
      await loadSavedQuery(state, id);
    }else if(action === 'delete'){
      await handleDelete(state, id);
    }
  };
  state.savedList.addEventListener('click', savedClickHandler);
  state.teardown.push(() => state.savedList.removeEventListener('click', savedClickHandler));

  const saveHandler = () => { handleSave(state); };
  state.saveBtn.addEventListener('click', saveHandler);
  state.teardown.push(() => state.saveBtn.removeEventListener('click', saveHandler));

  const runHandler = () => { handleRun(state); };
  state.runBtn.addEventListener('click', runHandler);
  state.teardown.push(() => state.runBtn.removeEventListener('click', runHandler));

  const exportHandler = () => { handleExport(state); };
  state.exportBtn.addEventListener('click', exportHandler);
  state.teardown.push(() => state.exportBtn.removeEventListener('click', exportHandler));

  const entityChangeHandler = async () => {
    state.activeId = null;
    await refreshSavedList(state);
    await handleRun(state, { entity: state.entitySelect.value, silent: true });
  };
  state.entitySelect.addEventListener('change', entityChangeHandler);
  state.teardown.push(() => state.entitySelect.removeEventListener('change', entityChangeHandler));

  setupSelectionSync(state);
  await refreshSavedList(state);
  await handleRun(state, { entity: state.entitySelect.value, silent: true });

  try{ console.info('[VIS] workbench mounted'); }
  catch (_err){}
}

function ensureWorkbenchViews(){
  const api = {
    async list(entity){
      const list = await listQueries(entity);
      return Array.isArray(list) ? list.map((item) => deepClone(item)) : [];
    },
    async save(name, filters = {}, options = {}){
      const entity = options.entity || DEFAULT_ENTITY;
      const payload = {
        name: typeof name === 'string' && name.trim() ? name.trim() : 'Untitled Query',
        entity,
        filters: deepClone(filters || {}),
        raw: typeof options.raw === 'string' ? options.raw : safeStringify(filters || {})
      };
      if(options.sort){
        payload.sort = deepClone(options.sort);
      }
      const record = await saveQuery(payload);
      return deepClone(record);
    },
    async update(id, patch = {}){
      if(id == null) return null;
      const payload = {};
      if(patch.name != null) payload.name = patch.name;
      if(patch.filters != null) payload.filters = deepClone(patch.filters);
      if(patch.sort != null) payload.sort = deepClone(patch.sort);
      if(patch.entity != null) payload.entity = patch.entity;
      if(patch.raw != null) payload.raw = patch.raw;
      const record = await updateQuery(id, payload);
      return record ? deepClone(record) : null;
    },
    async remove(id){
      return removeQuery(id);
    }
  };
  if(typeof window !== 'undefined'){
    if(!window.WorkbenchViews) window.WorkbenchViews = api;
    else Object.assign(window.WorkbenchViews, api);
  }
  return api;
}

const WorkbenchViews = ensureWorkbenchViews();

if(typeof window !== 'undefined'){
  window.workbenchExportCsv = workbenchExportCsv;
  window.renderWorkbench = function(options){
    const root = document.querySelector('#route-root') || document.getElementById('view-workbench') || document.body;
    return mountWorkbench(root, options);
  };
  const first = String(row?.first || row?.firstName || '').trim();
  const last = String(row?.last || row?.lastName || '').trim();
  if(first || last) return `${first} ${last}`.trim();
  return String(row?.name || row?.company || row?.email || row?.id || '').trim();
}

function partnerName(row){
  return String(row?.name || row?.company || row?.email || row?.id || '').trim();
}

async function fetchAllRows(){
  if(typeof window === 'undefined') return { contacts: [], partners: [] };
  const open = window.openDB;
  const read = window.dbGetAll;
  if(typeof open !== 'function' || typeof read !== 'function'){
    return { contacts: [], partners: [] };
  }
  try{
    await open();
    const [contactsRaw, partnersRaw] = await Promise.all([
      read('contacts').catch(() => []),
      read('partners').catch(() => [])
    ]);
    const contacts = Array.isArray(contactsRaw) ? contactsRaw.slice() : [];
    const partners = Array.isArray(partnersRaw) ? partnersRaw.slice() : [];
    contacts.sort((a, b) => (b?.updatedAt || 0) - (a?.updatedAt || 0));
    partners.sort((a, b) => (b?.updatedAt || 0) - (a?.updatedAt || 0));
    return { contacts, partners };
  }catch (err){
    console.warn('[soft] [workbench] data fetch failed', err);
    return { contacts: [], partners: [] };
  }
}

const CONTACT_COLUMNS = [
  { key: 'name', label: 'Name', value: contactName },
  { key: 'email', label: 'Email', value: row => String(row?.email || '').trim() },
  { key: 'phone', label: 'Phone', value: row => String(row?.phone || '').trim() },
  { key: 'stage', label: 'Stage', value: row => String(row?.stage || row?.status || '').trim() },
  { key: 'updated', label: 'Updated', value: row => formatDate(row?.updatedAt || row?.modifiedAt) }
];

const PARTNER_COLUMNS = [
  { key: 'name', label: 'Name', value: partnerName },
  { key: 'company', label: 'Company', value: row => String(row?.company || '').trim() },
  { key: 'email', label: 'Email', value: row => String(row?.email || '').trim() },
  { key: 'phone', label: 'Phone', value: row => String(row?.phone || '').trim() },
  { key: 'tier', label: 'Tier', value: row => String(row?.tier || row?.partnerTier || '').trim() },
  { key: 'updated', label: 'Updated', value: row => formatDate(row?.updatedAt) }
];

function buildTable(type, columns){
  const table = document.createElement('table');
  table.className = 'wb-table';
  table.setAttribute('data-selection-scope', type);
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const selectTh = document.createElement('th');
  selectTh.style.width = '32px';
  headerRow.appendChild(selectTh);
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  const tbody = document.createElement('tbody');
  table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}

function toggleRow(row, type){
  if(!row) return;
  const id = row.getAttribute('data-id');
  if(!id) return;
  if(window.Selection && typeof window.Selection.toggle === 'function'){
    window.Selection.toggle(id, type);
    return;
  }
  const svc = window.SelectionService;
  if(!svc) return;
  if(typeof svc.toggle === 'function'){
    svc.toggle(id, type);
    return;
  }
  if(typeof svc.add === 'function'){
    let exists = false;
    if(svc.ids && typeof svc.ids.has === 'function'){
      exists = svc.ids.has(String(id));
    }else if(typeof svc.getIds === 'function'){
      try{
        const ids = svc.getIds();
        if(Array.isArray(ids)) exists = ids.map(String).includes(String(id));
      }catch (_err){ exists = false; }
    }
    if(exists){
      try{ svc.remove?.(id); }
      catch (_err){}
    }else{
      try{ svc.add(id, type); }
      catch (_err){}
    }
  }
}

function wireTable(table, type){
  if(!table || table.__wbWired) return;
  table.__wbWired = true;
  const body = table.tBodies[0];
  if(!body) return;
  body.addEventListener('click', evt => {
    const cell = evt.target?.closest('td,th');
    if(cell && cell.closest('thead')) return;
    const row = evt.target?.closest('tr[data-id]');
    if(!row) return;
    if(evt.target?.closest('button,a')) return;
    evt.preventDefault();
    evt.stopPropagation();
    toggleRow(row, type);
  });
  body.addEventListener('change', evt => {
    const cb = evt.target?.closest('input[type="checkbox"][data-role="select"]');
    if(!cb) return;
    const row = cb.closest('tr[data-id]');
    if(!row) return;
    evt.preventDefault();
    evt.stopPropagation();
    toggleRow(row, type);
  });
}

function paintRows(table, rows, columns, type){
  if(!table) return;
  const body = table.tBodies[0];
  if(!body) return;
  body.innerHTML = '';
  const list = Array.isArray(rows) ? rows : [];
  if(!list.length){
    const empty = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = columns.length + 1;
    cell.textContent = 'No records yet.';
    cell.style.fontStyle = 'italic';
    cell.style.color = '#64748b';
    empty.appendChild(cell);
    body.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach(row => {
    const tr = document.createElement('tr');
    const id = row?.id != null ? String(row.id) : null;
    if(id) tr.setAttribute('data-id', id);
    const selectCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('data-role', 'select');
    checkbox.setAttribute('aria-label', 'Select row');
    selectCell.appendChild(checkbox);
    tr.appendChild(selectCell);
    columns.forEach(col => {
      const td = document.createElement('td');
      let value = '';
      try{ value = col.value(row); }
      catch (_err){ value = ''; }
      td.textContent = value == null ? '' : String(value);
      tr.appendChild(td);
    });
    frag.appendChild(tr);
  });
  body.appendChild(frag);
  syncSelectionState();
}

function syncSelectionState(){
  const selected = { ids: [], type: 'contacts' };
  try{
    if(window.Selection && typeof window.Selection.get === 'function'){
      const snap = window.Selection.get();
      if(snap && Array.isArray(snap.ids)){
        selected.ids = snap.ids.map(String);
        selected.type = snap.type || 'contacts';
      }
    }else if(window.SelectionService && typeof window.SelectionService.getIds === 'function'){
      selected.ids = Array.from(window.SelectionService.getIds() || []).map(String);
      selected.type = window.SelectionService.type || 'contacts';
    }
  }catch (_err){}
  const typeKey = selected.type || 'contacts';
  const idSet = new Set(selected.ids.map(String));
  Object.entries(state.tables).forEach(([scope, table]) => {
    if(!table) return;
    table.querySelectorAll('tbody tr[data-id]').forEach(row => {
      const id = row.getAttribute('data-id');
      const active = scope === typeKey && id && idSet.has(String(id));
      row.classList.toggle('is-selected', active);
      row.setAttribute('aria-selected', active ? 'true' : 'false');
      if(row.style){
        row.style.backgroundColor = active ? 'rgba(148, 163, 184, 0.18)' : '';
      }
      const cb = row.querySelector('input[type="checkbox"][data-role="select"]');
      if(cb && cb.checked !== active){
        cb.checked = active;
      }
    });
  });
}

function ensureSelectionListener(){
  if(typeof document === 'undefined') return;
  if(state.selectionListener){
    document.removeEventListener('selection:changed', state.selectionListener);
  }
  state.selectionListener = () => syncSelectionState();
  document.addEventListener('selection:changed', state.selectionListener);
}

function attachDataListener(){
  if(typeof document === 'undefined') return;
  if(state.dataListener){
    document.removeEventListener('app:data:changed', state.dataListener);
  }
  state.dataListener = () => {
    if(!isWorkbenchActive()) return;
    scheduleRefresh();
  };
  document.addEventListener('app:data:changed', state.dataListener);
}

function createSection(label, type){
  const section = document.createElement('section');
  section.setAttribute('data-wb-section', type);
  section.style.marginTop = '16px';
  const head = document.createElement('div');
  head.style.display = 'flex';
  head.style.alignItems = 'center';
  head.style.justifyContent = 'space-between';
  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.alignItems = 'baseline';
  titleWrap.style.gap = '12px';
  const heading = document.createElement('h3');
  heading.textContent = label;
  heading.style.margin = '0';
  heading.style.fontWeight = '600';
  const count = document.createElement('span');
  count.dataset.role = 'count';
  count.style.fontSize = '13px';
  count.style.color = '#64748b';
  titleWrap.appendChild(heading);
  titleWrap.appendChild(count);
  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'btn';
  refreshBtn.textContent = 'Refresh';
  actions.appendChild(refreshBtn);
  head.appendChild(titleWrap);
  head.appendChild(actions);
  const body = document.createElement('div');
  body.className = 'wb-body';
  body.style.marginTop = '8px';
  section.appendChild(head);
  section.appendChild(body);
  return { section, body, refreshBtn, countEl: count };
}

async function renderData(mount, options){
  const target = mount || state.lastMount;
  if(!target) return { contacts: [], partners: [] };
  let dataset = { contacts: [], partners: [] };
  try{
    dataset = await fetchAllRows();
  }catch (err){
    console.warn('[soft] [workbench] render failed', err);
  }
  await Promise.resolve();
  paintRows(state.tables.contacts, dataset.contacts, CONTACT_COLUMNS, 'contacts');
  paintRows(state.tables.partners, dataset.partners, PARTNER_COLUMNS, 'partners');
  if(state.counts.contacts){
    state.counts.contacts.textContent = `${dataset.contacts.length} records`;
  }
  if(state.counts.partners){
    state.counts.partners.textContent = `${dataset.partners.length} records`;
  }
  syncSelectionState();
  return dataset;
}

function scheduleRefresh(){
  if(state.refreshScheduled) return;
  state.refreshScheduled = true;
  doubleRaf(() => {
    state.refreshScheduled = false;
    if(!isWorkbenchActive()) return;
    if(state.lastMount){
      renderData(state.lastMount, state.currentOptions).catch(err => {
        console.warn('[soft] [workbench] refresh failed', err);
      });
    }
  });
}

function ensureGlobalRenderer(){
  if(typeof window === 'undefined') return;
  window.renderWorkbench = function(opts){
    const target = (state.lastMount && document.contains(state.lastMount))
      ? state.lastMount
      : ensureMount(null);
    if(!target) return null;
    if(opts && typeof opts === 'object'){
      state.currentOptions = Object.assign({}, state.currentOptions, opts);
    }
    return renderData(target, state.currentOptions);
  };
}

async function resolveSelfTestRunner(options){
  if(options && typeof options.onRunSelfTest === 'function'){
    return options.onRunSelfTest;
  }
  if(state.selfTestRunner) return state.selfTestRunner;
  if(state.selfTestLoad) return state.selfTestLoad;
  state.selfTestLoad = import('../selftest.js')
    .then(mod => {
      const fn = mod && typeof mod.runSelfTest === 'function' ? mod.runSelfTest : null;
      state.selfTestRunner = fn;
      return fn;
    })
    .catch(err => {
      console.warn('[soft] [workbench] self-test load failed', err);
      return null;
    })
    .finally(() => {
      state.selfTestLoad = null;
    });
  return state.selfTestLoad;
}

function applySavedQueriesBeacon(){
  try{
    state.savedQueries = loadSavedQueries();
  }catch (_err){
    state.savedQueries = {};
  }
  try{
    saveQueryDefinition('last-visit', { at: new Date().toISOString() });
  }catch (_err){}
}

export async function mountWorkbench(root, opts = {}){
  const mount = ensureMount(root);
  if(!mount) return null;
  state.currentOptions = opts || {};
  applySavedQueriesBeacon();
  mount.classList.remove('hidden');
  mount.innerHTML = '';

  const shell = document.createElement('div');
  shell.className = 'wb-shell';
  shell.style.display = 'flex';
  shell.style.flexDirection = 'column';
  shell.style.gap = '20px';

  const header = document.createElement('section');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.marginTop = '12px';
  const title = document.createElement('h2');
  title.textContent = 'Workbench';
  title.style.margin = '0';
  title.style.fontWeight = '700';
  const headerActions = document.createElement('div');
  headerActions.style.display = 'flex';
  headerActions.style.gap = '8px';
  const refreshAll = document.createElement('button');
  refreshAll.type = 'button';
  refreshAll.className = 'btn';
  refreshAll.textContent = 'Refresh All';
  refreshAll.addEventListener('click', () => {
    if(state.lastMount){
      renderData(state.lastMount, state.currentOptions).catch(err => {
        console.warn('[soft] [workbench] refresh failed', err);
      });
    }
  });
  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.className = 'btn brand';
  runBtn.textContent = 'Run Self-Test';
  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    runBtn.setAttribute('aria-busy', 'true');
    try{
      const runner = await resolveSelfTestRunner(state.currentOptions);
      if(typeof runner === 'function'){
        await runner();
      }else{
        console.info('[VIS] self-test unavailable');
      }
    }catch (err){
      console.warn('[soft] [workbench] self-test failed', err);
    }finally{
      runBtn.removeAttribute('aria-busy');
      runBtn.disabled = false;
    }
  });
  headerActions.appendChild(refreshAll);
  headerActions.appendChild(runBtn);
  header.appendChild(title);
  header.appendChild(headerActions);
  shell.appendChild(header);

  const contactsSection = createSection('Contacts', 'contacts');
  const contactsTable = buildTable('contacts', CONTACT_COLUMNS);
  contactsSection.body.appendChild(contactsTable);
  wireTable(contactsTable, 'contacts');
  contactsSection.refreshBtn.addEventListener('click', () => {
    if(state.lastMount){
      renderData(state.lastMount, state.currentOptions).catch(err => {
        console.warn('[soft] [workbench] refresh failed', err);
      });
    }
  });
  state.tables.contacts = contactsTable;
  state.counts.contacts = contactsSection.countEl;
  shell.appendChild(contactsSection.section);

  const partnersSection = createSection('Partners', 'partners');
  const partnersTable = buildTable('partners', PARTNER_COLUMNS);
  partnersSection.body.appendChild(partnersTable);
  wireTable(partnersTable, 'partners');
  partnersSection.refreshBtn.addEventListener('click', () => {
    if(state.lastMount){
      renderData(state.lastMount, state.currentOptions).catch(err => {
        console.warn('[soft] [workbench] refresh failed', err);
      });
    }
  });
  state.tables.partners = partnersTable;
  state.counts.partners = partnersSection.countEl;
  shell.appendChild(partnersSection.section);

  mount.appendChild(shell);
  ensureSelectionListener();
  attachDataListener();
  ensureGlobalRenderer();

  await Promise.resolve();
  const outcome = await renderData(mount, state.currentOptions);
  console.info('[VIS] workbench mounted');
  return outcome;
}
