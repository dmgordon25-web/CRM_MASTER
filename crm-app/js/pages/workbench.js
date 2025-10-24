import { normalizeStatus } from '../pipeline/constants.js';
import { openPartnerEditModal } from '../ui/modals/partner_edit/index.js';

const CONTACT_PIPELINE_STAGES = ['application', 'processing', 'underwriting', 'negotiating'];
const CONTACT_CLIENT_STAGES = ['approved', 'cleared-to-close', 'funded', 'post-close', 'post close', 'won'];
const LONGSHOT_STATUSES = new Set(['prospect', 'longshot', 'nurture', 'paused']);

const STORAGE_KEYS = {
  layout: 'workbench:layout',
  queries: 'workbench:queries'
};

const DEFAULT_LAYOUT = {
  open: {
    longshots: true,
    pipeline: false,
    clients: false,
    partners: false
  },
  lastActive: 'longshots'
};

const FILTER_OPERATORS = {
  string: [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'starts', label: 'Starts with' },
    { value: 'ends', label: 'Ends with' }
  ],
  number: [
    { value: '=', label: '=' },
    { value: '>', label: '>' },
    { value: '>=', label: '≥' },
    { value: '<', label: '<' },
    { value: '<=', label: '≤' }
  ],
  date: [
    { value: '=', label: '=' },
    { value: '>', label: '>' },
    { value: '>=', label: '≥' },
    { value: '<', label: '<' },
    { value: '<=', label: '≤' }
  ]
};

const DATE_FORMAT = typeof Intl !== 'undefined'
  ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  : null;

function generateId(){
  try{
    if(globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'){
      return globalThis.crypto.randomUUID();
    }
  }catch (_err){}
  return `wb-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function toId(value){
  if(value == null) return '';
  return String(value);
}

function toLower(value){
  return String(value == null ? '' : value).trim().toLowerCase();
}

function parseNumber(value){
  if(typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseDateValue(value){
  if(!value) return null;
  if(value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if(typeof value === 'number' && Number.isFinite(value)) return value;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

function formatDateValue(value){
  const ts = parseDateValue(value);
  if(ts == null) return '—';
  if(!DATE_FORMAT) return new Date(ts).toISOString();
  try{ return DATE_FORMAT.format(new Date(ts)); }
  catch (_err){ return new Date(ts).toLocaleDateString(); }
}

function formatCurrencyValue(value){
  const num = parseNumber(value);
  if(!Number.isFinite(num)) return '—';
  try{
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  }catch (_err){
    return `$${Math.round(num).toLocaleString()}`;
  }
}

function formatStage(value){
  const norm = normalizeStatus(value);
  if(!norm) return '';
  return norm.replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function contactName(record){
  if(!record) return '';
  const first = String(record.first || record.firstName || '').trim();
  const last = String(record.last || record.lastName || '').trim();
  const combined = `${first} ${last}`.trim();
  if(combined) return combined;
  return String(record.company || record.email || record.id || '').trim();
}

function contactStatus(record){
  return String(record.status || '').trim();
}

function contactStage(record){
  const stage = record && record.stage ? record.stage : record && record.status ? record.status : '';
  return stage || '';
}

function contactOwner(record){
  return String(
    record?.owner
    || record?.relationshipOwner
    || record?.loanOfficer
    || record?.accountOwner
    || ''
  ).trim();
}

function contactLoanAmount(record){
  return parseNumber(record?.loanAmount || record?.amount || record?.projectedAmount || 0) || 0;
}

function contactLoanType(record){
  return String(record?.loanType || record?.loanProgram || '').trim();
}

function contactLastTouch(record){
  return parseDateValue(record?.lastContact || record?.lastTouch || record?.updatedAt);
}

function contactNextAction(record){
  return parseDateValue(record?.nextFollowUp || record?.nextTouch || record?.followUpDate);
}

function contactCreatedAt(record){
  return parseDateValue(record?.createdAt);
}

function contactUpdatedAt(record){
  return parseDateValue(record?.updatedAt || record?.modifiedAt);
}

function contactFundedDate(record){
  return parseDateValue(record?.fundedDate || record?.closeDate);
}

function partnerName(record){
  return String(record?.name || record?.company || record?.email || record?.id || '').trim();
}

function partnerCompany(record){
  return String(record?.company || '').trim();
}

function partnerTier(record){
  return String(record?.tier || record?.partnerTier || '').trim();
}

function partnerOwner(record){
  return String(record?.relationshipOwner || record?.owner || '').trim();
}

function partnerLastTouch(record){
  return parseDateValue(record?.lastTouch || record?.updatedAt);
}

function partnerNextTouch(record){
  return parseDateValue(record?.nextTouch || record?.nextContact);
}

function partnerCreatedAt(record){
  return parseDateValue(record?.createdAt);
}

function partnerUpdatedAt(record){
  return parseDateValue(record?.updatedAt);
}

const CONTACT_FIELDS = {
  id: { key: 'id', label: 'ID', type: 'string', accessor: (record) => toId(record?.id) },
  name: { key: 'name', label: 'Name', type: 'string', accessor: contactName },
  status: { key: 'status', label: 'Status', type: 'string', accessor: contactStatus },
  stage: { key: 'stage', label: 'Stage', type: 'string', accessor: contactStage, formatter: formatStage },
  owner: { key: 'owner', label: 'Owner', type: 'string', accessor: contactOwner },
  loanAmount: { key: 'loanAmount', label: 'Loan Amount', type: 'number', accessor: contactLoanAmount, formatter: formatCurrencyValue },
  loanType: { key: 'loanType', label: 'Loan Type', type: 'string', accessor: contactLoanType },
  lastTouch: { key: 'lastTouch', label: 'Last Touch', type: 'date', accessor: contactLastTouch, formatter: formatDateValue },
  nextAction: { key: 'nextAction', label: 'Next Action', type: 'date', accessor: contactNextAction, formatter: formatDateValue },
  createdAt: { key: 'createdAt', label: 'Created', type: 'date', accessor: contactCreatedAt, formatter: formatDateValue },
  updatedAt: { key: 'updatedAt', label: 'Updated', type: 'date', accessor: contactUpdatedAt, formatter: formatDateValue },
  fundedDate: { key: 'fundedDate', label: 'Funded Date', type: 'date', accessor: contactFundedDate, formatter: formatDateValue }
};

const PARTNER_FIELDS = {
  id: { key: 'id', label: 'ID', type: 'string', accessor: (record) => toId(record?.id) },
  name: { key: 'name', label: 'Name', type: 'string', accessor: partnerName },
  company: { key: 'company', label: 'Company', type: 'string', accessor: partnerCompany },
  tier: { key: 'tier', label: 'Tier', type: 'string', accessor: partnerTier },
  owner: { key: 'owner', label: 'Owner', type: 'string', accessor: partnerOwner },
  lastTouch: { key: 'lastTouch', label: 'Last Touch', type: 'date', accessor: partnerLastTouch, formatter: formatDateValue },
  nextTouch: { key: 'nextTouch', label: 'Next Action', type: 'date', accessor: partnerNextTouch, formatter: formatDateValue },
  createdAt: { key: 'createdAt', label: 'Created', type: 'date', accessor: partnerCreatedAt, formatter: formatDateValue },
  updatedAt: { key: 'updatedAt', label: 'Updated', type: 'date', accessor: partnerUpdatedAt, formatter: formatDateValue }
};

function mapFields(fieldKeys, source){
  return fieldKeys
    .map((key) => source[key])
    .filter(Boolean);
}

function buildColumns(columnKeys, source){
  return columnKeys
    .map((key) => {
      const field = source[key];
      if(!field) return null;
      return {
        field: field.key,
        label: field.label,
        type: field.type,
        formatter: field.formatter,
        isName: key === 'name'
      };
    })
    .filter(Boolean);
}

const RAW_LENS_CONFIGS = {
  longshots: {
    key: 'longshots',
    label: 'Long Shots',
    entity: 'contact',
    selectionScope: 'contacts',
    baseFilter: (record) => {
      const status = toLower(record?.status);
      if(LONGSHOT_STATUSES.has(status)) return true;
      const stage = normalizeStatus(record?.stage || record?.status);
      if(!stage) return false;
      if(stage.includes('long')) return true;
      if(stage.includes('nurture')) return true;
      return false;
    },
    fieldKeys: ['name','status','stage','owner','loanType','loanAmount','lastTouch','nextAction','createdAt','updatedAt','id'],
    filterKeys: ['name','status','stage','owner','loanType','loanAmount','lastTouch','nextAction','createdAt','updatedAt','id'],
    columnKeys: ['name','status','owner','lastTouch','nextAction','loanAmount'],
    sortKeys: ['updatedAt','lastTouch','loanAmount','name','status'],
    defaultSort: { field: 'updatedAt', direction: 'desc' },
    searchKeys: ['name','status','stage','owner','loanType']
  },
  pipeline: {
    key: 'pipeline',
    label: 'Pipeline',
    entity: 'contact',
    selectionScope: 'contacts',
    baseFilter: (record) => {
      const stage = normalizeStatus(record?.stage);
      return CONTACT_PIPELINE_STAGES.includes(stage);
    },
    fieldKeys: ['name','stage','owner','loanType','loanAmount','lastTouch','nextAction','createdAt','updatedAt','id'],
    filterKeys: ['name','stage','owner','loanType','loanAmount','lastTouch','nextAction','createdAt','updatedAt','id'],
    columnKeys: ['name','stage','owner','loanAmount','lastTouch','nextAction'],
    sortKeys: ['updatedAt','lastTouch','nextAction','loanAmount','name'],
    defaultSort: { field: 'lastTouch', direction: 'desc' },
    searchKeys: ['name','stage','owner','loanType']
  },
  clients: {
    key: 'clients',
    label: 'Clients',
    entity: 'contact',
    selectionScope: 'contacts',
    baseFilter: (record) => {
      const stage = normalizeStatus(record?.stage);
      return CONTACT_CLIENT_STAGES.includes(stage);
    },
    fieldKeys: ['name','stage','owner','loanType','loanAmount','fundedDate','lastTouch','updatedAt','createdAt','id'],
    filterKeys: ['name','stage','owner','loanType','loanAmount','fundedDate','lastTouch','updatedAt','createdAt','id'],
    columnKeys: ['name','stage','owner','fundedDate','loanAmount','updatedAt'],
    sortKeys: ['fundedDate','updatedAt','loanAmount','name'],
    defaultSort: { field: 'fundedDate', direction: 'desc' },
    searchKeys: ['name','stage','owner','loanType']
  },
  partners: {
    key: 'partners',
    label: 'Partners',
    entity: 'partner',
    selectionScope: 'partners',
    baseFilter: () => true,
    fieldKeys: ['name','company','tier','owner','lastTouch','nextTouch','createdAt','updatedAt','id'],
    filterKeys: ['name','company','tier','owner','lastTouch','nextTouch','createdAt','updatedAt','id'],
    columnKeys: ['name','company','tier','owner','lastTouch','nextTouch'],
    sortKeys: ['updatedAt','lastTouch','tier','name'],
    defaultSort: { field: 'updatedAt', direction: 'desc' },
    searchKeys: ['name','company','tier','owner']
  }
};

const LENS_CONFIGS = Object.values(RAW_LENS_CONFIGS).map((raw) => {
  const source = raw.entity === 'partner' ? PARTNER_FIELDS : CONTACT_FIELDS;
  const fields = mapFields(raw.fieldKeys, source);
  const filterFields = mapFields(raw.filterKeys || raw.fieldKeys, source);
  const columns = buildColumns(raw.columnKeys, source);
  const sortFields = mapFields(raw.sortKeys || raw.columnKeys, source);
  const fieldsMap = new Map(fields.map((field) => [field.key, field]));
  filterFields.forEach((field) => {
    if(!fieldsMap.has(field.key)) fieldsMap.set(field.key, field);
  });
  sortFields.forEach((field) => {
    if(!fieldsMap.has(field.key)) fieldsMap.set(field.key, field);
  });
  return {
    key: raw.key,
    label: raw.label,
    entity: raw.entity,
    selectionScope: raw.selectionScope,
    baseFilter: raw.baseFilter,
    fields,
    filterFields,
    columns,
    sortFields,
    searchKeys: raw.searchKeys || [],
    defaultSort: raw.defaultSort,
    fieldsMap
  };
});

const CONFIG_BY_KEY = new Map(LENS_CONFIGS.map((config) => [config.key, config]));

const state = {
  mount: null,
  root: null,
  layout: null,
  savedQueries: [],
  lensStates: new Map(),
  selectionUnsubscribe: null,
  dataListener: null,
  dataCache: {
    contacts: null,
    partners: null
  },
  ready: false
};

function ensureLayout(){
  if(state.layout) return state.layout;
  state.layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  return state.layout;
}

function ensureMount(target){
  const mount = target || document.getElementById('view-workbench');
  if(!mount) return null;
  mount.classList.remove('hidden');
  if(!mount.getAttribute('data-view')){
    mount.setAttribute('data-view', 'workbench');
  }
  let root = mount.querySelector('#workbench-root');
  if(!root){
    root = document.createElement('section');
    root.id = 'workbench-root';
    root.className = 'card';
    mount.appendChild(root);
  }
  state.mount = mount;
  state.root = root;
  return root;
}

async function loadLayout(){
  ensureLayout();
  if(typeof window.openDB === 'function'){
    try{ await window.openDB(); }
    catch (_err){}
  }
  if(typeof window.dbSettingsGet !== 'function') return state.layout;
  try{
    const record = await window.dbSettingsGet(STORAGE_KEYS.layout);
    if(record && typeof record === 'object'){
      const open = record.open && typeof record.open === 'object' ? record.open : {};
      const layout = ensureLayout();
      layout.open = Object.assign({}, layout.open, open);
      if(typeof record.lastActive === 'string' && record.lastActive){
        layout.lastActive = record.lastActive;
      }
    }
  }catch (err){
    console && console.warn && console.warn('[workbench] failed to load layout', err);
  }
  return state.layout;
}

let layoutSaveTimer = null;

function scheduleLayoutSave(){
  if(layoutSaveTimer){
    clearTimeout(layoutSaveTimer);
    layoutSaveTimer = null;
  }
  layoutSaveTimer = setTimeout(async () => {
    layoutSaveTimer = null;
    if(typeof window.dbSettingsPut !== 'function') return;
    ensureLayout();
    try{
      await window.dbSettingsPut({
        id: STORAGE_KEYS.layout,
        open: state.layout.open,
        lastActive: state.layout.lastActive,
        updatedAt: Date.now()
      });
    }catch (err){
      console && console.warn && console.warn('[workbench] layout save failed', err);
    }
  }, 200);
}

async function loadSavedQueries(){
  if(typeof window.openDB === 'function'){
    try{ await window.openDB(); }
    catch (_err){}
  }
  if(typeof window.dbSettingsGet !== 'function'){ state.savedQueries = []; return state.savedQueries; }
  try{
    const record = await window.dbSettingsGet(STORAGE_KEYS.queries);
    if(record && Array.isArray(record.queries)){
      state.savedQueries = record.queries.map((entry) => ({ ...entry }));
    }else{
      state.savedQueries = [];
    }
  }catch (err){
    state.savedQueries = [];
    console && console.warn && console.warn('[workbench] failed to load saved queries', err);
  }
  return state.savedQueries;
}

async function persistSavedQueries(){
  if(typeof window.dbSettingsPut !== 'function') return;
  try{
    await window.dbSettingsPut({
      id: STORAGE_KEYS.queries,
      queries: state.savedQueries.map((entry) => ({ ...entry })),
      updatedAt: Date.now()
    });
  }catch (err){
    console && console.warn && console.warn('[workbench] failed to persist saved queries', err);
  }
}

function getSelectionStore(){
  return window.SelectionStore || null;
}

function subscribeSelection(){
  if(state.selectionUnsubscribe) return;
  const store = getSelectionStore();
  if(!store || typeof store.subscribe !== 'function') return;
  state.selectionUnsubscribe = store.subscribe((snapshot) => {
    if(!snapshot || !snapshot.scope) return;
    state.lensStates.forEach((lensState) => {
      if(lensState.config.selectionScope !== snapshot.scope) return;
      syncSelectionForLens(lensState);
    });
  });
}

function attachDataListener(){
  if(state.dataListener) return;
  const handler = () => {
    state.dataCache.contacts = null;
    state.dataCache.partners = null;
    state.lensStates.forEach((lensState) => {
      lensState.baseRecords = null;
      lensState.dataLoaded = false;
      if(lensState.open){
        runLensQuery(lensState, { reuseBase: false });
      }
    });
  };
  state.dataListener = handler;
  if(typeof document !== 'undefined'){
    document.addEventListener('app:data:changed', handler);
  }
}

function destroyDataListener(){
  if(state.dataListener && typeof document !== 'undefined'){
    document.removeEventListener('app:data:changed', state.dataListener);
  }
  state.dataListener = null;
}

async function loadContacts(){
  if(Array.isArray(state.dataCache.contacts)) return state.dataCache.contacts;
  if(typeof window.dbGetAll !== 'function'){
    state.dataCache.contacts = [];
    return state.dataCache.contacts;
  }
  try{
    const rows = await window.dbGetAll('contacts');
    state.dataCache.contacts = Array.isArray(rows) ? rows.slice() : [];
  }catch (err){
    state.dataCache.contacts = [];
    console && console.warn && console.warn('[workbench] contacts fetch failed', err);
  }
  return state.dataCache.contacts;
}

async function loadPartners(){
  if(Array.isArray(state.dataCache.partners)) return state.dataCache.partners;
  if(typeof window.dbGetAll !== 'function'){
    state.dataCache.partners = [];
    return state.dataCache.partners;
  }
  try{
    const rows = await window.dbGetAll('partners');
    state.dataCache.partners = Array.isArray(rows) ? rows.slice() : [];
  }catch (err){
    state.dataCache.partners = [];
    console && console.warn && console.warn('[workbench] partners fetch failed', err);
  }
  return state.dataCache.partners;
}

function createLensState(config){
  const layout = ensureLayout();
  const open = layout.open && Object.prototype.hasOwnProperty.call(layout.open, config.key)
    ? !!layout.open[config.key]
    : !!DEFAULT_LAYOUT.open[config.key];
  return {
    config,
    open,
    filters: [],
    sort: { ...(config.defaultSort || { field: config.columns[0]?.field || config.fields[0]?.key || '', direction: 'asc' }) },
    limit: null,
    searchText: '',
    baseRecords: null,
    rows: [],
    visibleRows: [],
    dataLoaded: false,
    elements: {},
    filterCounter: 0,
    tableListener: null,
    savedQueryId: null,
    shouldAutoRun: layout.lastActive === config.key,
    pendingRender: false
  };
}

function ensureLensStates(){
  if(state.lensStates.size) return state.lensStates;
  LENS_CONFIGS.forEach((config) => {
    const lensState = createLensState(config);
    state.lensStates.set(config.key, lensState);
  });
  return state.lensStates;
}

function defaultOperatorFor(field){
  if(!field) return 'contains';
  const ops = FILTER_OPERATORS[field.type] || FILTER_OPERATORS.string;
  return ops[0]?.value || 'contains';
}

function addFilter(lensState, preset){
  const config = lensState.config;
  const firstField = config.filterFields[0];
  const filter = {
    id: generateId(),
    field: preset?.field || firstField?.key || '',
    operator: preset?.operator || defaultOperatorFor(firstField),
    value: preset?.value || ''
  };
  lensState.filters.push(filter);
  renderFilterRows(lensState);
}

function clearFilters(lensState){
  lensState.filters = [];
  renderFilterRows(lensState);
}

function renderFilterRows(lensState){
  const { config, elements } = lensState;
  const container = elements.filters;
  if(!container) return;
  container.innerHTML = '';
  if(!lensState.filters.length){
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'No filters applied.';
    container.appendChild(empty);
    return;
  }
  lensState.filters.forEach((filter) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.gap = '8px';
    row.style.alignItems = 'center';
    row.dataset.filterId = filter.id;

    const fieldSelect = document.createElement('select');
    fieldSelect.className = 'input';
    config.filterFields.forEach((field) => {
      const option = document.createElement('option');
      option.value = field.key;
      option.textContent = field.label;
      if(field.key === filter.field) option.selected = true;
      fieldSelect.appendChild(option);
    });
    fieldSelect.addEventListener('change', () => {
      filter.field = fieldSelect.value;
      const field = config.fieldsMap.get(filter.field) || null;
      filter.operator = defaultOperatorFor(field);
      filter.value = '';
      renderFilterRows(lensState);
    });
    row.appendChild(fieldSelect);

    const operatorSelect = document.createElement('select');
    operatorSelect.className = 'input';
    const fieldMeta = config.fieldsMap.get(filter.field) || null;
    const operators = FILTER_OPERATORS[fieldMeta?.type] || FILTER_OPERATORS.string;
    operators.forEach((op) => {
      const option = document.createElement('option');
      option.value = op.value;
      option.textContent = op.label;
      if(op.value === filter.operator) option.selected = true;
      operatorSelect.appendChild(option);
    });
    operatorSelect.addEventListener('change', () => {
      filter.operator = operatorSelect.value;
    });
    row.appendChild(operatorSelect);

    let valueInput;
    if(fieldMeta?.type === 'number'){
      valueInput = document.createElement('input');
      valueInput.type = 'number';
      valueInput.step = 'any';
    }else if(fieldMeta?.type === 'date'){
      valueInput = document.createElement('input');
      valueInput.type = 'date';
    }else{
      valueInput = document.createElement('input');
      valueInput.type = 'text';
    }
    valueInput.className = 'input';
    valueInput.value = filter.value || '';
    valueInput.addEventListener('input', () => {
      filter.value = valueInput.value;
    });
    row.appendChild(valueInput);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      lensState.filters = lensState.filters.filter((item) => item.id !== filter.id);
      renderFilterRows(lensState);
    });
    row.appendChild(removeBtn);

    container.appendChild(row);
  });
}

function sanitizeFilters(lensState){
  const config = lensState.config;
  const result = [];
  lensState.filters.forEach((filter) => {
    const field = config.fieldsMap.get(filter.field);
    if(!field) return;
    const rawValue = filter.value;
    if(rawValue == null || rawValue === '') return;
    result.push({ field: field.key, operator: filter.operator, value: rawValue, type: field.type });
  });
  return result;
}

function serializeLensState(lensState){
  return {
    filters: sanitizeFilters(lensState),
    sort: { ...lensState.sort },
    limit: lensState.limit
  };
}

function assignLensStateFromQuery(lensState, query){
  lensState.filters = (query.filters || []).map((filter) => ({
    id: generateId(),
    field: filter.field,
    operator: filter.operator,
    value: filter.value
  }));
  lensState.sort = { ...(query.sort || lensState.config.defaultSort || { field: '', direction: 'asc' }) };
  lensState.limit = query.limit != null ? Number(query.limit) || null : null;
  renderFilterRows(lensState);
  syncSortControls(lensState);
  syncLimitControl(lensState);
}

function getSortOptions(lensState){
  return lensState.config.sortFields.length ? lensState.config.sortFields : lensState.config.columns.map((col) => ({ key: col.field, label: col.label }));
}

function syncSortControls(lensState){
  const { elements, sort, config } = lensState;
  if(!elements.sortField) return;
  const options = getSortOptions(lensState);
  elements.sortField.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'None';
  elements.sortField.appendChild(placeholder);
  options.forEach((field) => {
    const meta = config.fieldsMap.get(field.key) || field;
    const option = document.createElement('option');
    option.value = field.key;
    option.textContent = meta.label || field.label || field.key;
    if(sort.field === field.key) option.selected = true;
    elements.sortField.appendChild(option);
  });
  if(elements.sortDirection){
    elements.sortDirection.value = sort.direction === 'asc' ? 'asc' : 'desc';
  }
}

function syncLimitControl(lensState){
  const { elements, limit } = lensState;
  if(!elements.limit) return;
  elements.limit.value = limit != null ? String(limit) : '';
}

function syncSearchControl(lensState){
  if(!lensState.elements.search) return;
  lensState.elements.search.value = lensState.searchText || '';
}

function renderSavedQueryList(lensState){
  const list = lensState.elements.savedQueries;
  if(!list) return;
  list.innerHTML = '';
  const items = state.savedQueries.filter((entry) => entry.lens === lensState.config.key);
  if(!items.length){
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'No saved queries yet.';
    list.appendChild(empty);
    return;
  }
  items.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.dataset.queryId = entry.id;

    const nameBtn = document.createElement('button');
    nameBtn.type = 'button';
    nameBtn.className = 'btn';
    nameBtn.textContent = entry.name || 'Unnamed Query';
    nameBtn.addEventListener('click', () => {
      lensState.savedQueryId = entry.id;
      assignLensStateFromQuery(lensState, entry);
      runLensQuery(lensState, { reuseBase: false });
      state.layout.lastActive = lensState.config.key;
      scheduleLayoutSave();
      toast('Query loaded');
    });
    row.appendChild(nameBtn);

    const actions = document.createElement('div');
    actions.className = 'row';
    actions.style.gap = '4px';

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'btn';
    renameBtn.textContent = 'Rename';
    renameBtn.addEventListener('click', () => {
      const nextName = window.prompt('Rename query', entry.name || '');
      if(nextName == null) return;
      entry.name = nextName.trim() || entry.name;
      renderSavedQueryList(lensState);
      persistSavedQueries();
    });
    actions.appendChild(renameBtn);

    const duplicateBtn = document.createElement('button');
    duplicateBtn.type = 'button';
    duplicateBtn.className = 'btn';
    duplicateBtn.textContent = 'Duplicate';
    duplicateBtn.addEventListener('click', () => {
      const copy = {
        ...entry,
        id: generateId(),
        name: `${entry.name || 'Query'} Copy`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      state.savedQueries.push(copy);
      renderSavedQueryLists();
      persistSavedQueries();
      toast('Query duplicated');
    });
    actions.appendChild(duplicateBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      if(!window.confirm('Delete this saved query?')) return;
      state.savedQueries = state.savedQueries.filter((item) => item.id !== entry.id);
      renderSavedQueryLists();
      persistSavedQueries();
      toast('Query deleted');
    });
    actions.appendChild(deleteBtn);

    row.appendChild(actions);
    list.appendChild(row);
  });
}

function renderSavedQueryLists(){
  state.lensStates.forEach((lensState) => renderSavedQueryList(lensState));
}

function compareValues(a, b){
  if(a == null && b == null) return 0;
  if(a == null) return -1;
  if(b == null) return 1;
  if(typeof a === 'number' && typeof b === 'number'){
    if(Number.isNaN(a) && Number.isNaN(b)) return 0;
    if(Number.isNaN(a)) return -1;
    if(Number.isNaN(b)) return 1;
    return a - b;
  }
  if(typeof a === 'string' && typeof b === 'string'){
    return a.localeCompare(b);
  }
  if(typeof a === 'number' && typeof b !== 'number') return -1;
  if(typeof a !== 'number' && typeof b === 'number') return 1;
  const strA = String(a);
  const strB = String(b);
  return strA.localeCompare(strB);
}

function getRowValue(row, fieldKey, config){
  if(!row.valueCache) row.valueCache = Object.create(null);
  if(Object.prototype.hasOwnProperty.call(row.valueCache, fieldKey)){
    return row.valueCache[fieldKey];
  }
  const field = config.fieldsMap.get(fieldKey);
  if(!field){
    row.valueCache[fieldKey] = null;
    return null;
  }
  try{
    const value = field.accessor ? field.accessor(row.record) : row.record[field.key];
    row.valueCache[fieldKey] = value;
    return value;
  }catch (err){
    console && console.warn && console.warn('[workbench] field accessor failed', { fieldKey, err });
    row.valueCache[fieldKey] = null;
    return null;
  }
}

function getDisplayValue(row, column, config){
  if(!row.displayCache) row.displayCache = Object.create(null);
  const key = column.field;
  if(Object.prototype.hasOwnProperty.call(row.displayCache, key)){
    return row.displayCache[key];
  }
  const rawValue = getRowValue(row, key, config);
  let display;
  if(column.formatter){
    display = column.formatter(rawValue);
  }else if(config.fieldsMap.get(key)?.type === 'date'){
    display = formatDateValue(rawValue);
  }else if(config.fieldsMap.get(key)?.type === 'number'){
    display = Number.isFinite(rawValue) ? String(rawValue) : '—';
  }else{
    display = rawValue == null ? '' : String(rawValue);
  }
  row.displayCache[key] = display;
  return display;
}

function buildRow(record, config){
  return {
    record,
    id: toId(record?.id),
    valueCache: Object.create(null),
    displayCache: Object.create(null),
    searchText: null
  };
}

function buildSearchText(row, config){
  if(row.searchText != null) return row.searchText;
  const parts = [];
  config.searchKeys.forEach((key) => {
    const columnMeta = { field: key, formatter: config.fieldsMap.get(key)?.formatter };
    parts.push(String(getDisplayValue(row, columnMeta, config) || ''));
  });
  row.searchText = parts.join(' ').toLowerCase();
  return row.searchText;
}

function applyFiltersToBaseRecords(lensState, baseRecords){
  const filters = sanitizeFilters(lensState);
  if(!filters.length) return baseRecords.slice();
  return baseRecords.filter((record) => {
    const row = buildRow(record, lensState.config);
    return filters.every((filter) => {
      const field = lensState.config.fieldsMap.get(filter.field);
      if(!field) return true;
      const value = getRowValue(row, filter.field, lensState.config);
      const type = field.type || 'string';
      const normalized = value == null ? '' : value;
      if(type === 'number'){
        const numericValue = Number(normalized);
        const needle = Number(filter.value);
        if(!Number.isFinite(needle)) return true;
        if(!Number.isFinite(numericValue)) return false;
        switch(filter.operator){
          case '=': return numericValue === needle;
          case '>': return numericValue > needle;
          case '>=': return numericValue >= needle;
          case '<': return numericValue < needle;
          case '<=': return numericValue <= needle;
          default: return numericValue === needle;
        }
      }
      if(type === 'date'){
        const ts = parseDateValue(normalized);
        const needleTs = parseDateValue(filter.value);
        if(needleTs == null) return true;
        if(ts == null) return false;
        switch(filter.operator){
          case '=': return ts === needleTs;
          case '>': return ts > needleTs;
          case '>=': return ts >= needleTs;
          case '<': return ts < needleTs;
          case '<=': return ts <= needleTs;
          default: return ts === needleTs;
        }
      }
      const haystack = toLower(normalized);
      const needle = toLower(filter.value);
      switch(filter.operator){
        case 'equals': return haystack === needle;
        case 'starts': return haystack.startsWith(needle);
        case 'ends': return haystack.endsWith(needle);
        case 'contains':
        default:
          return haystack.includes(needle);
      }
    });
  });
}

function sortRows(rows, lensState){
  const { sort, config } = lensState;
  const field = sort.field;
  if(!field) return rows.slice();
  const direction = sort.direction === 'asc' ? 1 : -1;
  const fieldMeta = config.fieldsMap.get(field);
  const type = fieldMeta?.type || 'string';
  return rows.slice().sort((a, b) => {
    const rowA = buildRow(a, config);
    const rowB = buildRow(b, config);
    let valueA;
    let valueB;
    if(type === 'date'){
      valueA = parseDateValue(getRowValue(rowA, field, config));
      valueB = parseDateValue(getRowValue(rowB, field, config));
    }else if(type === 'number'){
      valueA = parseNumber(getRowValue(rowA, field, config));
      valueB = parseNumber(getRowValue(rowB, field, config));
    }else{
      valueA = String(getRowValue(rowA, field, config) ?? '').toLowerCase();
      valueB = String(getRowValue(rowB, field, config) ?? '').toLowerCase();
    }
    const result = compareValues(valueA, valueB);
    if(result !== 0) return result * direction;
    const nameA = contactName(a) || partnerName(a) || '';
    const nameB = contactName(b) || partnerName(b) || '';
    return nameA.localeCompare(nameB) * direction;
  });
}

function applyLimit(rows, limit){
  if(limit == null || !Number.isFinite(limit) || limit <= 0) return rows;
  return rows.slice(0, limit);
}

function applySearch(lensState){
  const { config, searchText, rows } = lensState;
  if(!searchText){
    lensState.visibleRows = rows.map((record) => buildRow(record, config));
    return;
  }
  const needle = searchText.toLowerCase();
  lensState.visibleRows = rows
    .map((record) => buildRow(record, config))
    .filter((row) => buildSearchText(row, config).includes(needle));
}

function updateCounts(lensState){
  const { elements, visibleRows, rows } = lensState;
  if(!elements.count) return;
  const total = rows.length;
  const visible = visibleRows.length;
  elements.count.textContent = total
    ? (visible === total ? `${total} records` : `${visible} of ${total} records`)
    : '0 records';
}

function updateStatusMessage(lensState){
  const { elements, visibleRows } = lensState;
  if(!elements.status) return;
  if(lensState.loading){
    elements.status.textContent = 'Loading…';
    elements.status.classList.remove('muted');
    return;
  }
  if(!visibleRows.length){
    elements.status.textContent = 'No records match the current query.';
    elements.status.classList.remove('muted');
    return;
  }
  elements.status.textContent = '';
  elements.status.classList.add('muted');
}

function syncSelectionForLens(lensState){
  const { elements, config } = lensState;
  const table = elements.table;
  if(!table) return;
  const scope = config.selectionScope;
  const store = getSelectionStore();
  const selected = store ? store.get(scope) : new Set();
  const ids = selected instanceof Set ? selected : new Set(Array.from(selected || []));
  table.querySelectorAll('tbody tr[data-id]').forEach((row) => {
    const id = row.getAttribute('data-id');
    const active = id && ids.has(id);
    if(active){
      row.setAttribute('data-selected', '1');
    }else{
      row.removeAttribute('data-selected');
    }
    const checkbox = row.querySelector('[data-role="select"][data-ui="row-check"]');
    if(checkbox){
      checkbox.checked = active;
      checkbox.setAttribute('aria-checked', active ? 'true' : 'false');
    }
  });
  const header = table.querySelector('thead input[data-role="select-all"]');
  if(header){
    const rowBoxes = Array.from(table.querySelectorAll('tbody [data-role="select"]'));
    const total = rowBoxes.length;
    const checkedCount = rowBoxes.filter((box) => box.checked).length;
    header.indeterminate = checkedCount > 0 && checkedCount < total;
    header.checked = total > 0 && checkedCount === total;
  }
}

function renderTable(lensState){
  const { elements, config, visibleRows } = lensState;
  const tbody = elements.tbody;
  if(!tbody) return;
  tbody.innerHTML = '';
  if(!visibleRows.length){
    const emptyRow = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = config.columns.length + 1;
    cell.className = 'muted';
    cell.textContent = 'No rows to display.';
    emptyRow.appendChild(cell);
    tbody.appendChild(emptyRow);
    updateStatusMessage(lensState);
    syncSelectionForLens(lensState);
    return;
  }
  const frag = document.createDocumentFragment();
  visibleRows.forEach((row) => {
    const tr = document.createElement('tr');
    const id = row.id || toId(row.record?.id);
    if(id) tr.setAttribute('data-id', id);

    const selectCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('data-role', 'select');
    checkbox.setAttribute('data-ui', 'row-check');
    if(id) checkbox.setAttribute('data-id', id);
    selectCell.appendChild(checkbox);
    tr.appendChild(selectCell);

    config.columns.forEach((column) => {
      const td = document.createElement('td');
      if(column.isName){
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = getDisplayValue(row, column, config) || '—';
        link.setAttribute('data-role', 'open-record');
        link.setAttribute('data-entity', config.entity);
        if(id) link.setAttribute('data-id', id);
        td.appendChild(link);
      }else{
        td.textContent = getDisplayValue(row, column, config) || '—';
      }
      tr.appendChild(td);
    });

    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
  updateStatusMessage(lensState);
  syncSelectionForLens(lensState);
}

function setLoading(lensState, loading){
  lensState.loading = loading;
  if(lensState.elements.section){
    lensState.elements.section.classList.toggle('is-loading', loading);
  }
  if(lensState.elements.run){
    lensState.elements.run.disabled = loading;
  }
  if(loading){
    updateStatusMessage(lensState);
  }
}

async function ensureBaseRecords(lensState){
  if(lensState.baseRecords && lensState.baseRecords.length && lensState.dataLoaded) return lensState.baseRecords;
  const { config } = lensState;
  if(config.entity === 'partner'){
    const partners = await loadPartners();
    lensState.baseRecords = partners.filter((record) => {
      try{ return config.baseFilter(record); }
      catch (err){ console && console.warn && console.warn('[workbench] partner base filter failed', err); return false; }
    });
  }else{
    const contacts = await loadContacts();
    lensState.baseRecords = contacts.filter((record) => {
      try{ return config.baseFilter(record); }
      catch (err){ console && console.warn && console.warn('[workbench] contact base filter failed', err); return false; }
    });
  }
  return lensState.baseRecords;
}

async function runLensQuery(lensState, options = {}){
  const { config } = lensState;
  const reuseBase = options.reuseBase === true;
  setLoading(lensState, true);
  try{
    if(!reuseBase){
      await ensureBaseRecords(lensState);
    }else if(!lensState.baseRecords){
      await ensureBaseRecords(lensState);
    }
    const baseRecords = Array.isArray(lensState.baseRecords) ? lensState.baseRecords : [];
    const filtered = applyFiltersToBaseRecords(lensState, baseRecords);
    const sorted = sortRows(filtered, lensState);
    const limited = applyLimit(sorted, lensState.limit != null ? Number(lensState.limit) : null);
    lensState.rows = limited;
    lensState.dataLoaded = true;
    applySearch(lensState);
    renderTable(lensState);
    updateCounts(lensState);
    updateStatusMessage(lensState);
  }finally{
    setLoading(lensState, false);
  }
}

function toggleWindow(lensState, open){
  lensState.open = open;
  const { section, body, toggle } = lensState.elements;
  if(section){
    section.classList.toggle('collapsed', !open);
  }
  if(body){
    body.hidden = !open;
  }
  if(toggle){
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = open ? 'Hide' : 'Show';
  }
  ensureLayout();
  state.layout.open[lensState.config.key] = open;
  if(open){
    state.layout.lastActive = lensState.config.key;
    scheduleLayoutSave();
    if(!lensState.dataLoaded){
      runLensQuery(lensState, { reuseBase: false });
    }
  }else{
    scheduleLayoutSave();
  }
}

function handleHeaderSort(lensState, field){
  if(!field) return;
  if(lensState.sort.field === field){
    lensState.sort.direction = lensState.sort.direction === 'asc' ? 'desc' : 'asc';
  }else{
    lensState.sort.field = field;
    lensState.sort.direction = lensState.config.defaultSort?.direction || 'asc';
  }
  syncSortControls(lensState);
  if(lensState.dataLoaded){
    runLensQuery(lensState, { reuseBase: true });
  }
}

function handleExport(lensState){
  const rows = lensState.visibleRows;
  if(!rows.length){
    toast('No rows to export');
    return;
  }
  const headers = ['ID'].concat(lensState.config.columns.map((col) => col.label));
  const csvLines = [headers.join(',')];
  rows.forEach((row) => {
    const rawId = row.id || toId(row.record?.id) || '';
    const idEscaped = String(rawId).replace(/"/g, '""');
    const values = [`"${idEscaped}"`];
    lensState.config.columns.forEach((column) => {
      const value = getDisplayValue(row, column, lensState.config) || '';
      const escaped = String(value).replace(/"/g, '""');
      values.push(`"${escaped}"`);
    });
    csvLines.push(values.join(','));
  });
  const filename = `${lensState.config.key}-workbench-${new Date().toISOString().slice(0,10)}.csv`;
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
  toast('CSV export ready');
}

function handleRowClick(event, lensState){
  const target = event.target instanceof Element ? event.target : null;
  if(!target) return;
  const link = target.closest('[data-role="open-record"]');
  if(!link || !lensState.elements.table.contains(link)) return;
  event.preventDefault();
  const id = link.getAttribute('data-id');
  if(!id) return;
  const entity = link.getAttribute('data-entity');
  if(entity === 'partner'){
    try{
      openPartnerEditModal(id, { trigger: link, sourceHint: 'workbench:partner-row' });
    }catch (err){
      console && console.warn && console.warn('[workbench] partner modal failed', err);
    }
    return;
  }
  if(typeof window.renderContactModal === 'function'){
    try{
      window.renderContactModal(id, { sourceHint: `workbench:${lensState.config.key}` });
    }catch (err){
      console && console.warn && console.warn('[workbench] contact modal failed', err);
    }
  }
}

function handleSelectAllChange(event, lensState){
  const checkbox = event.target;
  if(!(checkbox instanceof HTMLInputElement)) return;
  const table = lensState.elements.table;
  if(!table) return;
  const scope = lensState.config.selectionScope;
  const store = getSelectionStore();
  if(!store) return;
  const ids = new Set();
  table.querySelectorAll('tbody tr[data-id]').forEach((row) => {
    const id = row.getAttribute('data-id');
    if(!id) return;
    if(checkbox.checked){
      ids.add(id);
    }
  });
  if(checkbox.checked){
    store.set(Array.from(ids), scope);
  }else{
    store.clear(scope);
  }
  syncSelectionForLens(lensState);
}

function buildWindow(lensState){
  const { config } = lensState;
  const section = document.createElement('section');
  section.className = 'card';
  section.dataset.lens = config.key;

  const header = document.createElement('div');
  header.className = 'row';
  header.style.alignItems = 'center';
  header.style.gap = '12px';

  const title = document.createElement('h3');
  title.textContent = config.label;
  title.style.margin = '0';
  header.appendChild(title);

  const count = document.createElement('span');
  count.className = 'muted';
  header.appendChild(count);

  const spacer = document.createElement('div');
  spacer.className = 'grow';
  header.appendChild(spacer);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'btn';
  toggleBtn.setAttribute('aria-expanded', lensState.open ? 'true' : 'false');
  toggleBtn.textContent = lensState.open ? 'Hide' : 'Show';
  toggleBtn.addEventListener('click', () => {
    toggleWindow(lensState, !lensState.open);
  });
  header.appendChild(toggleBtn);

  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.className = 'btn brand';
  runBtn.textContent = 'Run';
  runBtn.addEventListener('click', () => {
    state.layout.lastActive = lensState.config.key;
    scheduleLayoutSave();
    runLensQuery(lensState, { reuseBase: false });
  });
  header.appendChild(runBtn);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn';
  saveBtn.textContent = 'Save Query';
  saveBtn.addEventListener('click', () => {
    const name = window.prompt('Save query as', lensState.savedQueryId ? (state.savedQueries.find((entry) => entry.id === lensState.savedQueryId)?.name || '') : '');
    if(name == null) return;
    const trimmed = name.trim();
    const payload = serializeLensState(lensState);
    if(lensState.savedQueryId){
      const existing = state.savedQueries.find((entry) => entry.id === lensState.savedQueryId);
      if(existing){
        existing.name = trimmed || existing.name || 'Saved Query';
        existing.filters = payload.filters;
        existing.sort = payload.sort;
        existing.limit = payload.limit;
        existing.updatedAt = Date.now();
      }
    }else{
      const newId = generateId();
      state.savedQueries.push({
        id: newId,
        name: trimmed || `${config.label} Query`,
        lens: config.key,
        filters: payload.filters,
        sort: payload.sort,
        limit: payload.limit,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      lensState.savedQueryId = newId;
    }
    persistSavedQueries();
    renderSavedQueryLists();
    toast('Query saved');
  });
  header.appendChild(saveBtn);

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'btn';
  exportBtn.textContent = 'Export CSV';
  exportBtn.addEventListener('click', () => handleExport(lensState));
  header.appendChild(exportBtn);

  section.appendChild(header);

  const body = document.createElement('div');
  body.className = 'workbench-window-body';
  body.style.marginTop = '12px';
  body.hidden = !lensState.open;

  const controls = document.createElement('div');
  controls.className = 'workbench-controls';
  controls.style.display = 'flex';
  controls.style.flexDirection = 'column';
  controls.style.gap = '12px';

  const filterRow = document.createElement('div');
  filterRow.className = 'row';
  filterRow.style.gap = '8px';
  filterRow.style.alignItems = 'center';

  const addFilterBtn = document.createElement('button');
  addFilterBtn.type = 'button';
  addFilterBtn.className = 'btn';
  addFilterBtn.textContent = 'Add Filter';
  addFilterBtn.addEventListener('click', () => addFilter(lensState));
  filterRow.appendChild(addFilterBtn);

  const sortField = document.createElement('select');
  sortField.className = 'input';
  sortField.addEventListener('change', () => {
    const value = sortField.value;
    lensState.sort.field = value || '';
  });
  filterRow.appendChild(sortField);

  const sortDirection = document.createElement('select');
  sortDirection.className = 'input';
  [['asc','Ascending'],['desc','Descending']].forEach(([value,label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    sortDirection.appendChild(option);
  });
  sortDirection.addEventListener('change', () => {
    lensState.sort.direction = sortDirection.value === 'desc' ? 'desc' : 'asc';
  });
  filterRow.appendChild(sortDirection);

  const limitInput = document.createElement('input');
  limitInput.type = 'number';
  limitInput.min = '1';
  limitInput.placeholder = 'Limit';
  limitInput.className = 'input';
  limitInput.style.maxWidth = '90px';
  limitInput.addEventListener('input', () => {
    const value = Number(limitInput.value);
    lensState.limit = Number.isFinite(value) && value > 0 ? value : null;
  });
  filterRow.appendChild(limitInput);

  controls.appendChild(filterRow);

  const filtersContainer = document.createElement('div');
  filtersContainer.className = 'workbench-filters';
  filtersContainer.style.display = 'flex';
  filtersContainer.style.flexDirection = 'column';
  filtersContainer.style.gap = '8px';
  controls.appendChild(filtersContainer);

  body.appendChild(controls);

  const savedQueriesWrap = document.createElement('div');
  savedQueriesWrap.style.display = 'flex';
  savedQueriesWrap.style.flexDirection = 'column';
  savedQueriesWrap.style.gap = '8px';
  savedQueriesWrap.style.marginTop = '12px';

  const savedHeader = document.createElement('strong');
  savedHeader.textContent = 'My Queries';
  savedQueriesWrap.appendChild(savedHeader);

  const savedList = document.createElement('div');
  savedList.className = 'workbench-saved-queries';
  savedList.style.display = 'flex';
  savedList.style.flexDirection = 'column';
  savedList.style.gap = '6px';
  savedQueriesWrap.appendChild(savedList);
  body.appendChild(savedQueriesWrap);

  const searchRow = document.createElement('div');
  searchRow.className = 'row';
  searchRow.style.alignItems = 'center';
  searchRow.style.gap = '8px';
  searchRow.style.marginTop = '12px';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Filter rows';
  searchInput.className = 'input';
  searchInput.addEventListener('input', () => {
    lensState.searchText = searchInput.value;
    if(lensState.dataLoaded){
      applySearch(lensState);
      renderTable(lensState);
      updateCounts(lensState);
      updateStatusMessage(lensState);
    }
  });
  searchRow.appendChild(searchInput);

  const status = document.createElement('div');
  status.className = 'muted';
  status.style.marginLeft = 'auto';
  searchRow.appendChild(status);

  body.appendChild(searchRow);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';
  tableWrap.style.marginTop = '8px';

  const table = document.createElement('table');
  table.className = 'table';
  table.setAttribute('data-selection-scope', config.selectionScope);

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const selectAllTh = document.createElement('th');
  const selectAll = document.createElement('input');
  selectAll.type = 'checkbox';
  selectAll.setAttribute('data-role', 'select-all');
  selectAll.addEventListener('change', (event) => handleSelectAllChange(event, lensState));
  selectAllTh.appendChild(selectAll);
  headerRow.appendChild(selectAllTh);

  config.columns.forEach((column) => {
    const th = document.createElement('th');
    th.textContent = column.label;
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => handleHeaderSort(lensState, column.field));
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  body.appendChild(tableWrap);

  section.appendChild(body);

  lensState.elements = {
    section,
    header,
    count,
    toggle: toggleBtn,
    run: runBtn,
    save: saveBtn,
    export: exportBtn,
    body,
    filters: filtersContainer,
    sortField,
    sortDirection,
    limit: limitInput,
    savedQueries: savedList,
    search: searchInput,
    status,
    table,
    thead,
    tbody
  };

  table.addEventListener('click', (event) => handleRowClick(event, lensState));

  return section;
}

function buildShell(){
  const root = state.root;
  if(!root) return;
  root.innerHTML = '';
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.gap = '16px';
  ensureLensStates();
  state.lensStates.forEach((lensState) => {
    const section = buildWindow(lensState);
    root.appendChild(section);
  });
}

function syncUI(){
  state.lensStates.forEach((lensState) => {
    renderFilterRows(lensState);
    syncSortControls(lensState);
    syncLimitControl(lensState);
    syncSearchControl(lensState);
    renderSavedQueryList(lensState);
    updateCounts(lensState);
    updateStatusMessage(lensState);
    if(!lensState.open){
      lensState.elements.body.hidden = true;
      lensState.elements.toggle.setAttribute('aria-expanded', 'false');
      lensState.elements.toggle.textContent = 'Show';
    }
  });
}

async function setupWorkbench(target){
  const mount = ensureMount(target);
  if(!mount) return;
  await Promise.all([loadLayout(), loadSavedQueries()]);
  ensureLensStates();
  buildShell();
  syncUI();
  subscribeSelection();
  attachDataListener();
  state.ready = true;
  state.lensStates.forEach((lensState) => {
    if(lensState.shouldAutoRun && lensState.open){
      runLensQuery(lensState, { reuseBase: false });
    }
  });
}

async function renderWorkbench(target){
  if(!state.ready){
    await setupWorkbench(target);
    return;
  }
  ensureMount(target);
  syncUI();
  state.lensStates.forEach((lensState) => {
    if(lensState.open && lensState.dataLoaded){
      runLensQuery(lensState, { reuseBase: true });
    }
  });
}

export async function initWorkbench(target){
  await renderWorkbench(target);
}

if(typeof window !== 'undefined'){
  window.renderWorkbench = async function renderWorkbenchPublic(opts){
    const mount = state.mount || document.getElementById('view-workbench');
    await renderWorkbench(mount, opts);
  };
}

export default {
  initWorkbench,
  renderWorkbench
};
