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
    const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
    return fmt.format(new Date(ts));
  }catch (_err){
    return '';
  }
}

function contactName(row){
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
