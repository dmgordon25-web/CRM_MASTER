import { listQueries, getQuery, saveQuery, deleteQuery, touchQueryRun } from './queries_store.js';

const CONTACT_COLUMNS = [
  { key: 'name', label: 'Name', value: contactName },
  { key: 'email', label: 'Email', value: row => safeString(row.email) },
  { key: 'phone', label: 'Phone', value: row => safeString(row.phone) },
  { key: 'stage', label: 'Stage', value: row => safeString(row.stage || row.status) },
  { key: 'updated', label: 'Updated', value: row => formatDate(row.updatedAt || row.modifiedAt || row.lastContact) }
];

const PARTNER_COLUMNS = [
  { key: 'name', label: 'Name', value: partnerName },
  { key: 'company', label: 'Company', value: row => safeString(row.company) },
  { key: 'email', label: 'Email', value: row => safeString(row.email) },
  { key: 'phone', label: 'Phone', value: row => safeString(row.phone) },
  { key: 'tier', label: 'Tier', value: row => safeString(row.tier || row.partnerTier) },
  { key: 'updated', label: 'Updated', value: row => formatDate(row.updatedAt || row.modifiedAt) }
];

const queryHelpers = Object.freeze({
  text(value) {
    return safeString(value);
  },
  lower(value) {
    return safeString(value).toLowerCase();
  },
  includes(value, needle) {
    const source = safeString(value).toLowerCase();
    const match = safeString(needle).toLowerCase();
    if (!match) return false;
    return source.includes(match);
  },
  eq(a, b) {
    return safeString(a).toLowerCase() === safeString(b).toLowerCase();
  },
  oneOf(value, list) {
    if (!Array.isArray(list)) return false;
    const target = safeString(value).toLowerCase();
    return list.some((item) => safeString(item).toLowerCase() === target);
  },
  number(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  },
  date(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  },
  daysAgo(value) {
    const date = queryHelpers.date(value);
    if (!date) return null;
    return (Date.now() - date.getTime()) / 86400000;
  },
  matches(value, pattern) {
    try {
      const source = safeString(value);
      if (pattern instanceof RegExp) return pattern.test(source);
      if (pattern == null) return false;
      const rx = new RegExp(String(pattern), 'i');
      return rx.test(source);
    } catch (_err) {
      return false;
    }
  }
});

const state = {
  queries: [],
  queryMap: new Map(),
  activeQueryId: null,
  results: [],
  resultsEntity: 'contacts',
  lastRunMs: 0,
  lastRunAt: null,
  entity: 'contacts',
  options: {},
  data: { contacts: [], partners: [] }
};

const view = {
  mount: null,
  refs: null,
  selectionOff: null,
  selectionListener: null,
  dataListener: null,
  readyBeaconSent: false
};

function safeString(value) {
  return value == null ? '' : String(value).trim();
}

function contactName(row) {
  const first = safeString(row.first || row.firstName);
  const last = safeString(row.last || row.lastName);
  const joined = `${first} ${last}`.trim();
  if (joined) return joined;
  return safeString(row.name || row.company || row.email || row.id);
}

function partnerName(row) {
  return safeString(row.name || row.company || row.email || row.id);
}

function formatDate(value) {
  if (!value) return '';
  const ts = typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(ts)) return '';
  try {
    const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return fmt.format(new Date(ts));
  } catch (_err) {
    return '';
  }
}

function postLog(event, data) {
  if (!event) return;
  const payload = JSON.stringify({ event, ...(data && typeof data === 'object' ? data : {}) });
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/__log', blob);
      return;
    }
  } catch (_err) {}
  if (typeof fetch === 'function') {
    try {
      fetch('/__log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
    } catch (_err) {}
  }
}

function announceReady() {
  if (view.readyBeaconSent) return;
  view.readyBeaconSent = true;
  try {
    console.info('[VIS] workbench mvp ready');
  } catch (_err) {}
  postLog('workbench-ready');
}

function ensureMount(target) {
  if (target && target.nodeType === 1) {
    view.mount = target;
  }
  if (!view.mount || !(view.mount instanceof HTMLElement) || !document.contains(view.mount)) {
    let mount = document.getElementById('view-workbench');
    if (!mount) {
      mount = document.createElement('main');
      mount.id = 'view-workbench';
      mount.setAttribute('data-view', 'workbench');
      const container = document.querySelector('.container');
      if (container) container.appendChild(mount);
      else document.body.appendChild(mount);
    }
    view.mount = mount;
  }
  if (!view.mount.getAttribute('data-view')) {
    view.mount.setAttribute('data-view', 'workbench');
  }
  return view.mount;
}

function createButton(label, className) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  return btn;
}

function buildLayout(mount) {
  mount.innerHTML = '';
  mount.classList.remove('hidden');
  const shell = document.createElement('div');
  shell.id = 'workbench-shell';
  shell.className = 'wb-mvp-shell';
  shell.style.display = 'flex';
  shell.style.flexDirection = 'column';
  shell.style.gap = '20px';
  shell.style.padding = '16px';
  shell.style.maxWidth = '1200px';
  shell.style.margin = '0 auto';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.gap = '12px';

  const title = document.createElement('h2');
  title.textContent = 'Workbench';
  title.style.margin = '0';
  title.style.fontWeight = '700';
  title.style.fontSize = '24px';

  const headerActions = document.createElement('div');
  headerActions.style.display = 'flex';
  headerActions.style.gap = '8px';
  headerActions.style.alignItems = 'center';

  const diagnosticsBtn = createButton('Run diagnostics', 'btn');
  diagnosticsBtn.dataset.role = 'workbench-selftest';
  diagnosticsBtn.hidden = true;
  diagnosticsBtn.setAttribute('aria-hidden', 'true');

  headerActions.appendChild(diagnosticsBtn);
  header.appendChild(title);
  header.appendChild(headerActions);

  const queryCard = document.createElement('section');
  queryCard.className = 'wb-card';
  queryCard.style.background = '#ffffff';
  queryCard.style.borderRadius = '12px';
  queryCard.style.padding = '20px';
  queryCard.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.08)';
  queryCard.style.display = 'flex';
  queryCard.style.flexDirection = 'column';
  queryCard.style.gap = '12px';

  const savedRow = document.createElement('div');
  savedRow.style.display = 'flex';
  savedRow.style.gap = '12px';
  savedRow.style.flexWrap = 'wrap';
  savedRow.style.alignItems = 'flex-end';

  const savedField = document.createElement('div');
  savedField.style.flex = '1 1 260px';
  savedField.style.minWidth = '200px';

  const savedLabel = document.createElement('label');
  savedLabel.textContent = 'Saved queries';
  savedLabel.setAttribute('for', 'workbench-view-select');
  savedLabel.style.display = 'block';
  savedLabel.style.fontSize = '13px';
  savedLabel.style.fontWeight = '600';
  savedLabel.style.color = '#334155';
  savedLabel.style.marginBottom = '4px';

  const savedSelect = document.createElement('select');
  savedSelect.id = 'workbench-view-select';
  savedSelect.style.width = '100%';
  savedSelect.style.padding = '8px 12px';
  savedSelect.style.border = '1px solid #cbd5f5';
  savedSelect.style.borderRadius = '6px';
  savedSelect.style.fontSize = '14px';

  savedField.appendChild(savedLabel);
  savedField.appendChild(savedSelect);

  const savedButtons = document.createElement('div');
  savedButtons.style.display = 'flex';
  savedButtons.style.gap = '8px';

  const newButton = createButton('New', 'btn');
  newButton.id = 'btn-workbench-new';
  const deleteButton = createButton('Delete', 'btn muted');
  deleteButton.id = 'btn-workbench-delete';
  deleteButton.disabled = true;

  savedButtons.appendChild(newButton);
  savedButtons.appendChild(deleteButton);

  savedRow.appendChild(savedField);
  savedRow.appendChild(savedButtons);

  const nameField = document.createElement('div');
  nameField.style.display = 'flex';
  nameField.style.flexDirection = 'column';
  nameField.style.gap = '4px';

  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name';
  nameLabel.setAttribute('for', 'workbench-query-name');
  nameLabel.style.fontSize = '13px';
  nameLabel.style.fontWeight = '600';
  nameLabel.style.color = '#334155';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'workbench-query-name';
  nameInput.placeholder = 'Describe this query';
  nameInput.style.padding = '8px 12px';
  nameInput.style.border = '1px solid #cbd5f5';
  nameInput.style.borderRadius = '6px';
  nameInput.style.fontSize = '14px';

  nameField.appendChild(nameLabel);
  nameField.appendChild(nameInput);

  const entityField = document.createElement('div');
  entityField.style.display = 'flex';
  entityField.style.flexDirection = 'column';
  entityField.style.gap = '4px';
  entityField.style.width = '200px';

  const entityLabel = document.createElement('label');
  entityLabel.textContent = 'Entity';
  entityLabel.setAttribute('for', 'workbench-entity-select');
  entityLabel.style.fontSize = '13px';
  entityLabel.style.fontWeight = '600';
  entityLabel.style.color = '#334155';

  const entitySelect = document.createElement('select');
  entitySelect.id = 'workbench-entity-select';
  entitySelect.style.padding = '8px 12px';
  entitySelect.style.border = '1px solid #cbd5f5';
  entitySelect.style.borderRadius = '6px';
  entitySelect.style.fontSize = '14px';
  const contactOption = document.createElement('option');
  contactOption.value = 'contacts';
  contactOption.textContent = 'Contacts';
  const partnerOption = document.createElement('option');
  partnerOption.value = 'partners';
  partnerOption.textContent = 'Partners';
  entitySelect.appendChild(contactOption);
  entitySelect.appendChild(partnerOption);

  entityField.appendChild(entityLabel);
  entityField.appendChild(entitySelect);

  const queryField = document.createElement('div');
  queryField.style.display = 'flex';
  queryField.style.flexDirection = 'column';
  queryField.style.gap = '6px';

  const queryLabel = document.createElement('label');
  queryLabel.textContent = 'Filter expression';
  queryLabel.setAttribute('for', 'workbench-query-definition');
  queryLabel.style.fontSize = '13px';
  queryLabel.style.fontWeight = '600';
  queryLabel.style.color = '#334155';

  const queryInput = document.createElement('textarea');
  queryInput.id = 'workbench-query-definition';
  queryInput.rows = 6;
  queryInput.style.padding = '10px 12px';
  queryInput.style.border = '1px solid #cbd5f5';
  queryInput.style.borderRadius = '8px';
  queryInput.style.fontFamily = 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace';
  queryInput.style.fontSize = '13px';
  queryInput.style.lineHeight = '1.4';
  queryInput.placeholder = "Example: helpers.includes(helpers.lower(row.stage), 'lead')";

  const helperText = document.createElement('p');
  helperText.textContent = 'Write a JavaScript expression that returns true for matching rows. helpers.* utilities are available.';
  helperText.style.margin = '0';
  helperText.style.fontSize = '12px';
  helperText.style.color = '#64748b';

  const actionRow = document.createElement('div');
  actionRow.style.display = 'flex';
  actionRow.style.flexWrap = 'wrap';
  actionRow.style.gap = '8px';
  actionRow.style.marginTop = '4px';

  const saveButton = createButton('Save', 'btn brand');
  saveButton.id = 'btn-workbench-save';
  saveButton.disabled = true;

  const runButton = createButton('Run', 'btn brand');
  runButton.id = 'btn-workbench-run';

  const exportButton = createButton('Export CSV', 'btn');
  exportButton.id = 'btn-workbench-export';
  exportButton.disabled = true;

  actionRow.appendChild(saveButton);
  actionRow.appendChild(runButton);
  actionRow.appendChild(exportButton);

  const errorBox = document.createElement('div');
  errorBox.id = 'workbench-query-error';
  errorBox.style.padding = '8px 12px';
  errorBox.style.borderRadius = '6px';
  errorBox.style.background = 'rgba(248, 113, 113, 0.12)';
  errorBox.style.color = '#b91c1c';
  errorBox.style.fontSize = '13px';
  errorBox.style.display = 'none';

  queryCard.appendChild(savedRow);
  queryCard.appendChild(nameField);
  queryCard.appendChild(entityField);
  queryCard.appendChild(queryField);
  queryField.appendChild(queryLabel);
  queryField.appendChild(queryInput);
  queryField.appendChild(helperText);
  queryCard.appendChild(actionRow);
  queryCard.appendChild(errorBox);

  const resultsCard = document.createElement('section');
  resultsCard.className = 'wb-card';
  resultsCard.style.background = '#ffffff';
  resultsCard.style.borderRadius = '12px';
  resultsCard.style.padding = '20px';
  resultsCard.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.08)';
  resultsCard.style.display = 'flex';
  resultsCard.style.flexDirection = 'column';
  resultsCard.style.gap = '12px';

  const resultsHeader = document.createElement('div');
  resultsHeader.style.display = 'flex';
  resultsHeader.style.alignItems = 'baseline';
  resultsHeader.style.justifyContent = 'space-between';
  resultsHeader.style.gap = '8px';

  const resultsTitle = document.createElement('h3');
  resultsTitle.textContent = 'Results';
  resultsTitle.style.margin = '0';
  resultsTitle.style.fontWeight = '600';
  resultsTitle.style.fontSize = '18px';

  const resultsMeta = document.createElement('div');
  resultsMeta.style.display = 'flex';
  resultsMeta.style.flexDirection = 'column';
  resultsMeta.style.alignItems = 'flex-end';
  resultsMeta.style.gap = '2px';

  const resultCount = document.createElement('span');
  resultCount.id = 'workbench-result-count';
  resultCount.textContent = 'No results yet';
  resultCount.style.fontSize = '14px';
  resultCount.style.fontWeight = '600';
  resultCount.style.color = '#1f2937';

  const resultMeta = document.createElement('span');
  resultMeta.id = 'workbench-result-meta';
  resultMeta.textContent = '';
  resultMeta.style.fontSize = '12px';
  resultMeta.style.color = '#64748b';

  resultsMeta.appendChild(resultCount);
  resultsMeta.appendChild(resultMeta);
  resultsHeader.appendChild(resultsTitle);
  resultsHeader.appendChild(resultsMeta);

  const tableWrap = document.createElement('div');
  tableWrap.style.overflowX = 'auto';
  tableWrap.style.border = '1px solid #e2e8f0';
  tableWrap.style.borderRadius = '10px';

  const table = document.createElement('table');
  table.id = 'workbench-table';
  table.className = 'wb-results-table';
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.fontSize = '13px';

  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  table.appendChild(thead);
  table.appendChild(tbody);
  tableWrap.appendChild(table);

  const emptyState = document.createElement('div');
  emptyState.textContent = 'Run a query to see matching records.';
  emptyState.style.textAlign = 'center';
  emptyState.style.padding = '24px';
  emptyState.style.color = '#64748b';
  emptyState.style.fontSize = '14px';

  resultsCard.appendChild(resultsHeader);
  resultsCard.appendChild(tableWrap);
  resultsCard.appendChild(emptyState);

  shell.appendChild(header);
  shell.appendChild(queryCard);
  shell.appendChild(resultsCard);
  mount.appendChild(shell);

  return {
    shell,
    diagnosticsBtn,
    savedSelect,
    newButton,
    deleteButton,
    nameInput,
    entitySelect,
    queryInput,
    helperText,
    saveButton,
    runButton,
    exportButton,
    errorBox,
    resultCount,
    resultMeta,
    table,
    tableHead: thead,
    tableBody: tbody,
    emptyState
  };
}

function ensureView(target) {
  const mount = ensureMount(target);
  if (!view.refs || !mount.contains(view.refs.shell)) {
    view.refs = buildLayout(mount);
    attachHandlers();
  } else {
    mount.classList.remove('hidden');
  }
  return view;
}

function attachHandlers() {
  const refs = view.refs;
  if (!refs) return;
  refs.savedSelect.addEventListener('change', handleSavedQueryChange);
  refs.newButton.addEventListener('click', handleNewQuery);
  refs.deleteButton.addEventListener('click', handleDeleteQuery);
  refs.nameInput.addEventListener('input', handleNameInput);
  refs.entitySelect.addEventListener('change', handleEntityChange);
  refs.queryInput.addEventListener('input', handleQueryChange);
  refs.saveButton.addEventListener('click', handleSaveQuery);
  refs.runButton.addEventListener('click', handleRunQuery);
  refs.exportButton.addEventListener('click', handleExportCsv);
  refs.diagnosticsBtn.addEventListener('click', handleDiagnosticsRun);
  wireTable(refs.table);
}

function handleDiagnosticsRun() {
  const fn = state.options && typeof state.options.onRunSelfTest === 'function'
    ? state.options.onRunSelfTest
    : null;
  if (!fn) return;
  const btn = view.refs?.diagnosticsBtn;
  if (!btn) return;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  Promise.resolve()
    .then(() => fn())
    .catch((err) => {
      console.warn('[soft] [workbench] diagnostics failed', err);
      showToast('warn', 'Diagnostics failed');
    })
    .finally(() => {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    });
}

function handleSavedQueryChange() {
  const refs = view.refs;
  if (!refs) return;
  const value = refs.savedSelect.value;
  if (!value) {
    state.activeQueryId = null;
    refs.deleteButton.disabled = true;
    return;
  }
  const query = getQuery(value);
  if (!query) {
    state.activeQueryId = null;
    refs.savedSelect.value = '';
    refs.deleteButton.disabled = true;
    return;
  }
  loadQuery(query);
}

function handleNewQuery() {
  const refs = view.refs;
  if (!refs) return;
  state.activeQueryId = null;
  refs.savedSelect.value = '';
  refs.nameInput.value = '';
  refs.queryInput.value = '';
  setEntity('contacts', { updateSelect: true, resetResults: true });
  refs.deleteButton.disabled = true;
  updateSaveState();
  clearError();
}

function handleDeleteQuery() {
  if (!state.activeQueryId) return;
  const query = state.queryMap.get(state.activeQueryId) || getQuery(state.activeQueryId);
  const name = query ? query.name : 'this query';
  let confirmed = true;
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    confirmed = window.confirm(`Delete ${name}?`);
  }
  if (!confirmed) return;
  deleteQuery(state.activeQueryId);
  state.activeQueryId = null;
  refreshSavedQueries();
  handleNewQuery();
  showToast('info', 'Query deleted');
}

function handleNameInput() {
  updateSaveState();
}

function handleEntityChange() {
  const refs = view.refs;
  if (!refs) return;
  const value = refs.entitySelect.value === 'partners' ? 'partners' : 'contacts';
  setEntity(value, { updateSelect: false, resetResults: false });
}

function handleQueryChange() {
  updateSaveState();
}

function updateDiagnosticsButton() {
  const refs = view.refs;
  if (!refs) return;
  const has = state.options && typeof state.options.onRunSelfTest === 'function';
  refs.diagnosticsBtn.hidden = !has;
  if (has) refs.diagnosticsBtn.removeAttribute('aria-hidden');
  else refs.diagnosticsBtn.setAttribute('aria-hidden', 'true');
}

function loadQuery(entry) {
  const refs = view.refs;
  if (!refs || !entry) return;
  state.activeQueryId = entry.id;
  refs.savedSelect.value = entry.id;
  refs.nameInput.value = entry.name;
  refs.queryInput.value = entry.definition || '';
  setEntity(entry.entity || 'contacts', { updateSelect: true, resetResults: false });
  refs.deleteButton.disabled = false;
  updateSaveState();
  clearError();
}

function updateSaveState() {
  const refs = view.refs;
  if (!refs) return;
  const nameFilled = refs.nameInput.value.trim().length > 0;
  refs.saveButton.disabled = !nameFilled;
}

function setEntity(entity, { updateSelect = true, resetResults = false } = {}) {
  const refs = view.refs;
  if (!refs) return;
  const normalized = entity === 'partners' ? 'partners' : 'contacts';
  state.entity = normalized;
  if (updateSelect) refs.entitySelect.value = normalized;
  if (resetResults) {
    state.results = [];
    state.resultsEntity = normalized;
    renderResults();
  } else {
    renderHeader();
  }
}

function refreshSavedQueries() {
  const refs = view.refs;
  if (!refs) return;
  const list = listQueries();
  state.queries = list;
  state.queryMap = new Map(list.map((entry) => [entry.id, entry]));
  const select = refs.savedSelect;
  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = list.length ? 'Select saved query' : 'No saved queries yet';
  select.appendChild(placeholder);
  list.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.name;
    select.appendChild(option);
  });
  if (state.activeQueryId && state.queryMap.has(state.activeQueryId)) {
    select.value = state.activeQueryId;
    refs.deleteButton.disabled = false;
  } else {
    select.value = '';
    refs.deleteButton.disabled = true;
  }
}

function handleSaveQuery() {
  const refs = view.refs;
  if (!refs) return;
  try {
    const entry = saveQuery({
      id: state.activeQueryId,
      name: refs.nameInput.value,
      definition: refs.queryInput.value,
      entity: refs.entitySelect.value
    });
    state.activeQueryId = entry.id;
    refreshSavedQueries();
    showToast('success', 'Query saved');
    clearError();
  } catch (err) {
    const message = err && err.message ? String(err.message) : 'Unable to save query';
    showError(message);
  }
}

function compilePredicate(source) {
  const code = String(source || '').trim();
  if (!code) {
    return () => true;
  }
  const body = code.includes('return') ? code : `return (${code});`;
  try {
    const fn = new Function('row', 'helpers', 'context', `'use strict'; ${body}`);
    return (row, helpers, context) => Boolean(fn(row, helpers, context));
  } catch (err) {
    const message = err && err.message ? err.message : 'Invalid expression';
    const error = new Error(`Unable to compile query: ${message}`);
    error.original = err;
    throw error;
  }
}

function handleRunQuery() {
  runQueryInternal({ silent: false });
}

async function runQueryInternal(options = {}) {
  const refs = view.refs;
  if (!refs) return;
  const entity = refs.entitySelect.value === 'partners' ? 'partners' : 'contacts';
  const expression = refs.queryInput.value;
  state.entity = entity;
  refs.runButton.disabled = true;
  refs.runButton.setAttribute('aria-busy', 'true');
  try {
    await ensureDataLoaded(options.force === true);
    const predicate = compilePredicate(expression);
    const dataset = entity === 'partners' ? state.data.partners : state.data.contacts;
    const context = { entity, dataset: state.data };
    const results = [];
    const start = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    let errorCount = 0;
    for (const row of dataset) {
      try {
        if (predicate(row, queryHelpers, context)) results.push(row);
      } catch (err) {
        errorCount += 1;
        if (errorCount <= 3) console.warn('[soft] [workbench] predicate failure', err);
      }
    }
    const end = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    state.results = results;
    state.resultsEntity = entity;
    state.lastRunMs = Math.max(0, end - start);
    state.lastRunAt = new Date().toISOString();
    renderResults();
    updateSummary();
    if (errorCount) showError('Some records could not be evaluated. Check console for details.');
    else clearError();
    if (state.activeQueryId) {
      touchQueryRun(state.activeQueryId);
      refreshSavedQueries();
    }
    updateExportState();
    clearSelection();
    if (!options.silent) showToast('success', `${results.length} result${results.length === 1 ? '' : 's'} matched`);
  } catch (err) {
    const message = err && err.message ? String(err.message) : 'Query failed';
    showError(message);
    console.warn('[soft] [workbench] run failed', err);
  } finally {
    refs.runButton.disabled = false;
    refs.runButton.removeAttribute('aria-busy');
  }
}

function handleExportCsv() {
  if (!state.results.length) return;
  const columns = state.resultsEntity === 'partners' ? PARTNER_COLUMNS : CONTACT_COLUMNS;
  const csv = toCsv(state.results, columns);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `workbench-${state.resultsEntity}-${timestamp}.csv`;
  downloadCsv(filename, csv);
  showToast('info', `Exported ${state.results.length} rows`);
}

function toCsv(rows, columns) {
  const headers = columns.map((col) => csvEscape(col.label));
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    const values = columns.map((col) => {
      let value = '';
      try {
        value = col.value(row);
      } catch (_err) {
        value = '';
      }
      return csvEscape(value);
    });
    lines.push(values.join(','));
  });
  return lines.join('\r\n');
}

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadCsv(filename, text) {
  try {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 0);
  } catch (err) {
    console.warn('[soft] [workbench] export failed', err);
    showError('Unable to create CSV export.');
  }
}

function renderHeader() {
  const refs = view.refs;
  if (!refs) return;
  const columns = state.entity === 'partners' ? PARTNER_COLUMNS : CONTACT_COLUMNS;
  refs.tableHead.innerHTML = '';
  const headerRow = document.createElement('tr');
  const selectTh = document.createElement('th');
  selectTh.style.width = '36px';
  headerRow.appendChild(selectTh);
  columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col.label;
    th.style.textAlign = 'left';
    th.style.padding = '10px 12px';
    th.style.fontSize = '12px';
    th.style.fontWeight = '600';
    th.style.color = '#475569';
    th.style.borderBottom = '1px solid #e2e8f0';
    headerRow.appendChild(th);
  });
  refs.tableHead.appendChild(headerRow);
  refs.table.dataset.selectionScope = state.entity;
}

function renderResults() {
  const refs = view.refs;
  if (!refs) return;
  renderHeader();
  const columns = state.resultsEntity === 'partners' ? PARTNER_COLUMNS : CONTACT_COLUMNS;
  const rows = Array.isArray(state.results) ? state.results : [];
  refs.tableBody.innerHTML = '';
  if (!rows.length) {
    refs.emptyState.style.display = 'block';
    updateSummary();
    updateExportState();
    applySelectionToTable();
    return;
  }
  refs.emptyState.style.display = 'none';
  const frag = document.createDocumentFragment();
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', row && row.id != null ? String(row.id) : '');
    tr.style.borderBottom = '1px solid #e2e8f0';

    const selectTd = document.createElement('td');
    selectTd.style.padding = '8px 12px';
    selectTd.style.textAlign = 'center';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('data-ui', 'row-check');
    checkbox.setAttribute('data-role', 'select');
    checkbox.setAttribute('aria-label', 'Select row');
    selectTd.appendChild(checkbox);
    tr.appendChild(selectTd);

    columns.forEach((col) => {
      const td = document.createElement('td');
      td.style.padding = '8px 12px';
      td.style.verticalAlign = 'top';
      let value = '';
      try {
        value = col.value(row);
      } catch (_err) {
        value = '';
      }
      td.textContent = value == null ? '' : String(value);
      tr.appendChild(td);
    });
    frag.appendChild(tr);
  });
  refs.tableBody.appendChild(frag);
  updateSummary();
  updateExportState();
  applySelectionToTable();
  syncSelectionCheckboxes();
}

function updateSummary() {
  const refs = view.refs;
  if (!refs) return;
  const count = Array.isArray(state.results) ? state.results.length : 0;
  refs.resultCount.textContent = count ? `${count} result${count === 1 ? '' : 's'}` : 'No results yet';
  const pieces = [];
  if (state.lastRunMs) {
    const ms = Math.round(state.lastRunMs);
    pieces.push(`${ms.toLocaleString()} ms`);
  }
  if (state.lastRunAt) {
    try {
      const dt = new Date(state.lastRunAt);
      pieces.push(`at ${dt.toLocaleString()}`);
    } catch (_err) {}
  }
  refs.resultMeta.textContent = pieces.join(' · ');
}

function updateExportState() {
  const refs = view.refs;
  if (!refs) return;
  refs.exportButton.disabled = !state.results.length;
}

function clearSelection() {
  try {
    if (window.Selection && typeof window.Selection.clear === 'function') {
      window.Selection.clear('workbench');
      return;
    }
  } catch (_err) {}
  try {
    if (window.SelectionService && typeof window.SelectionService.clear === 'function') {
      window.SelectionService.clear('workbench');
      return;
    }
  } catch (_err) {}
  try {
    if (window.SelectionService && typeof window.SelectionService.set === 'function') {
      window.SelectionService.set([], state.entity);
    }
  } catch (_err) {}
}

function applySelectionToTable() {
  const refs = view.refs;
  if (!refs) return;
  const snapshot = readSelectionSnapshot();
  const ids = new Set(snapshot.ids.map(String));
  const type = snapshot.type || 'contacts';
  refs.tableBody.querySelectorAll('tr[data-id]').forEach((row) => {
    const id = row.getAttribute('data-id');
    const active = type === state.resultsEntity && id && ids.has(String(id));
    row.classList.toggle('is-selected', active);
    row.setAttribute('aria-selected', active ? 'true' : 'false');
    const checkbox = row.querySelector('input[type="checkbox"][data-ui="row-check"]');
    if (checkbox) {
      checkbox.checked = active;
      checkbox.setAttribute('aria-checked', active ? 'true' : 'false');
      checkbox.setAttribute('data-selected', active ? 'true' : 'false');
    }
  });
}

function syncSelectionCheckboxes() {
  try {
    if (window.Selection && typeof window.Selection.syncCheckboxes === 'function') {
      window.Selection.syncCheckboxes();
      return;
    }
  } catch (_err) {}
  try {
    if (window.SelectionService && typeof window.SelectionService.syncCheckboxes === 'function') {
      window.SelectionService.syncCheckboxes();
    }
  } catch (_err) {}
}

function readSelectionSnapshot() {
  try {
    if (window.Selection) {
      if (typeof window.Selection.get === 'function') {
        const snap = window.Selection.get();
        if (snap && Array.isArray(snap.ids)) return { type: snap.type || 'contacts', ids: snap.ids };
      }
      if (typeof window.Selection.getSelectedIds === 'function') {
        const ids = window.Selection.getSelectedIds();
        if (Array.isArray(ids)) return { type: state.resultsEntity, ids };
      }
      if (typeof window.Selection.all === 'function') {
        const ids = window.Selection.all();
        if (Array.isArray(ids)) return { type: state.resultsEntity, ids };
      }
    }
  } catch (_err) {}
  try {
    if (window.SelectionService) {
      if (typeof window.SelectionService.get === 'function') {
        const snap = window.SelectionService.get();
        if (snap && Array.isArray(snap.ids)) return { type: snap.type || 'contacts', ids: snap.ids };
      }
      if (typeof window.SelectionService.getIds === 'function') {
        const ids = window.SelectionService.getIds();
        if (ids && typeof ids.forEach === 'function') {
          const collected = [];
          ids.forEach((value) => collected.push(String(value)));
          return { type: window.SelectionService.type || 'contacts', ids: collected };
        }
      }
    }
  } catch (_err) {}
  return { type: 'contacts', ids: [] };
}

function ensureSelectionBinding() {
  if (view.selectionOff) {
    try {
      view.selectionOff();
    } catch (_err) {}
    view.selectionOff = null;
  }
  try {
    if (window.Selection && typeof window.Selection.onChange === 'function') {
      view.selectionOff = window.Selection.onChange(() => applySelectionToTable());
    }
  } catch (_err) {}
  if (!view.selectionListener) {
    view.selectionListener = () => applySelectionToTable();
    document.addEventListener('selection:changed', view.selectionListener);
  }
}

function wireTable(table) {
  if (!table || table.__wbWired) return;
  table.__wbWired = true;
  table.addEventListener('click', (event) => {
    const row = event.target && event.target.closest('tbody tr[data-id]');
    if (!row) return;
    if (event.target && event.target.closest('button, a')) return;
    const checkbox = event.target && event.target.closest('input[type="checkbox"]');
    if (checkbox) return;
    event.preventDefault();
    toggleRowSelection(row);
  });
  table.addEventListener('change', (event) => {
    const checkbox = event.target && event.target.closest('input[type="checkbox"][data-ui="row-check"]');
    if (!checkbox) return;
    const row = checkbox.closest('tr[data-id]');
    if (!row) return;
    event.preventDefault();
    toggleRowSelection(row);
  });
}

function toggleRowSelection(row) {
  if (!row) return;
  const id = row.getAttribute('data-id');
  if (!id) return;
  const type = state.resultsEntity;
  try {
    if (window.Selection && typeof window.Selection.toggle === 'function') {
      window.Selection.toggle(id, type);
      return;
    }
  } catch (_err) {}
  try {
    if (window.SelectionService && typeof window.SelectionService.toggle === 'function') {
      window.SelectionService.toggle(id, type);
      return;
    }
  } catch (_err) {}
  applySelectionToTable();
}

async function ensureDataLoaded(force = false) {
  if (!state.data) state.data = { contacts: [], partners: [] };
  const contactsMissing = !Array.isArray(state.data.contacts) || !state.data.contacts.length;
  const partnersMissing = !Array.isArray(state.data.partners) || !state.data.partners.length;
  if (!force && !contactsMissing && !partnersMissing) return;
  const dataset = await fetchDataset();
  state.data = dataset;
}

async function fetchDataset() {
  const empty = { contacts: [], partners: [] };
  if (typeof window === 'undefined') return empty;
  try {
    if (typeof window.openDB === 'function') await window.openDB();
  } catch (_err) {}
  let contacts = [];
  let partners = [];
  try {
    if (typeof window.dbGetAll === 'function') {
      contacts = await window.dbGetAll('contacts').catch(() => []);
      partners = await window.dbGetAll('partners').catch(() => []);
    }
  } catch (_err) {}
  if (!Array.isArray(contacts) || !contacts.length) {
    try {
      const seed = window.__SEED_DATA__;
      if (seed && Array.isArray(seed.contacts)) contacts = seed.contacts.slice();
    } catch (_err) {}
  }
  if (!Array.isArray(partners) || !partners.length) {
    try {
      const seed = window.__SEED_DATA__;
      if (seed && Array.isArray(seed.partners)) partners = seed.partners.slice();
    } catch (_err) {}
  }
  contacts = Array.isArray(contacts) ? contacts.slice() : [];
  partners = Array.isArray(partners) ? partners.slice() : [];
  contacts.sort((a, b) => (b && b.updatedAt || 0) - (a && a.updatedAt || 0));
  partners.sort((a, b) => (b && b.updatedAt || 0) - (a && a.updatedAt || 0));
  return { contacts, partners };
}

function ensureDataListener() {
  if (view.dataListener) {
    document.removeEventListener('app:data:changed', view.dataListener);
  }
  view.dataListener = () => {
    ensureDataLoaded(true).then(() => runQueryInternal({ silent: true, force: true }));
  };
  document.addEventListener('app:data:changed', view.dataListener);
}

function showToast(kind, message) {
  const toast = typeof window !== 'undefined' ? window.Toast : null;
  if (!toast || typeof toast.show !== 'function') return;
  try {
    if (typeof toast[kind] === 'function') {
      toast[kind](message);
      return;
    }
  } catch (_err) {}
  try {
    toast.show(message, { kind });
  } catch (_err) {}
}

function showError(message) {
  const refs = view.refs;
  if (!refs) return;
  refs.errorBox.textContent = message;
  refs.errorBox.style.display = 'block';
}

function clearError() {
  const refs = view.refs;
  if (!refs) return;
  refs.errorBox.textContent = '';
  refs.errorBox.style.display = 'none';
}

export async function initWorkbench(target, options = {}) {
  ensureView(target);
  state.options = options || {};
  updateDiagnosticsButton();
  refreshSavedQueries();
  ensureSelectionBinding();
  ensureDataListener();
  announceReady();
  await ensureDataLoaded(true);
  renderHeader();
  if (!state.results.length) {
    state.resultsEntity = state.entity;
    renderResults();
  }
  return state.results;
}

export const renderWorkbench = initWorkbench;

if (typeof window !== 'undefined') {
  window.renderWorkbench = (opts) => initWorkbench(view.mount, opts || state.options);
  window.Workbench = window.Workbench || {};
  window.Workbench.render = () => runQueryInternal({ silent: true });
}

export default { initWorkbench, renderWorkbench };
