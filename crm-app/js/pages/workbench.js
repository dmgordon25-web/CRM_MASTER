import { normalizeStatus } from '../pipeline/constants.js';
import { openContactModal } from '../contacts.js';
import { openPartnerEditModal } from '../ui/modals/partner_edit/index.js';
import { createLegendPopover, STAGE_LEGEND_ENTRIES } from '../ui/legend_popover.js';
import { attachStatusBanner } from '../ui/status_banners.js';

const CONTACT_PIPELINE_STAGES = ['application', 'processing', 'underwriting', 'negotiating'];
const CONTACT_CLIENT_STAGES = ['approved', 'cleared-to-close', 'funded', 'post-close', 'post close', 'won'];
const LONGSHOT_STATUSES = new Set(['prospect', 'longshot', 'nurture', 'paused']);

const STORAGE_KEYS = {
  layout: 'workbench:layout',
  queries: 'workbench:queries',
  drafts: 'workbench:lens-drafts'
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

function renderContactNameLink(record, id, lensKey){
  const link = document.createElement('a');
  link.href = '#';
  link.className = 'status-name-link contact-name';
  link.setAttribute('data-role', 'contact-name');
  if(id) link.setAttribute('data-id', id);
  link.setAttribute('data-entity', 'contact');
  const label = contactName(record) || '—';
  link.title = label;
  const nameText = document.createElement('span');
  nameText.className = 'name-text';
  nameText.textContent = label || '—';
  link.appendChild(nameText);
  link.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if(!id || typeof openContactModal !== 'function') return;
    try{
      openContactModal(id, { sourceHint: `workbench:${lensKey}`, trigger: link });
    }catch (err){
      try{ console && console.warn && console.warn('[workbench] contact modal failed', err); }
      catch (_err){}
    }
  });
  return link;
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
    label: 'Leads',
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

const ROW_BATCH_SIZE = 250;
const MIN_NAME_COLUMN_WIDTH = 160;

const yieldMicrotask = typeof queueMicrotask === 'function'
  ? () => new Promise((resolve) => queueMicrotask(resolve))
  : () => Promise.resolve().then(() => {});

const yieldFrame = typeof requestAnimationFrame === 'function'
  ? () => new Promise((resolve) => requestAnimationFrame(() => resolve()))
  : yieldMicrotask;

function isoDateString(date){
  if(!(date instanceof Date)) return '';
  const copy = new Date(date.getTime()); copy.setHours(0,0,0,0);
  try{ return copy.toISOString().slice(0,10); }
  catch (_err){ return ''; }
}

function isoDaysFromNow(offset){
  const now = new Date(); now.setDate(now.getDate() + offset);
  return isoDateString(now);
}

function isoMonthRange(){
  const now = new Date();
  return {
    start: isoDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: isoDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  };
}

const PRESET_FILTERS = {
  pipeline: [
    { key: 'closing-this-month', label: 'Closing This Month', build(){ const { start, end } = isoMonthRange(); return { filters: [ { field:'stage', operator:'contains', value:'close' }, { field:'nextAction', operator:'>=', value:start }, { field:'nextAction', operator:'<=', value:end } ], sort: { field:'nextAction', direction:'asc' } }; } },
    { key: 'needs-followup', label: 'Needs Follow-Up', build(){ return { filters: [{ field:'nextAction', operator:'<=', value: isoDaysFromNow(0) }], sort: { field:'nextAction', direction:'asc' } }; } },
    { key: 'new-this-week', label: 'New This Week', build(){ return { filters: [{ field:'createdAt', operator:'>=', value: isoDaysFromNow(-7) }], sort: { field:'createdAt', direction:'desc' } }; } }
  ],
  clients: [
    { key: 'funded-30', label: 'Funded Last 30 Days', build(){ return { filters: [{ field:'fundedDate', operator:'>=', value: isoDaysFromNow(-30) }], sort: { field:'fundedDate', direction:'desc' } }; } }
  ],
  partners: [
    { key: 'top-tier', label: 'Top Tier', build(){ return { filters: [{ field:'tier', operator:'equals', value:'top' }], sort: { field:'lastTouch', direction:'desc' } }; } },
    { key: 'stale-touch', label: 'Stale Touch', build(){ return { filters: [{ field:'nextTouch', operator:'<=', value: isoDaysFromNow(-14) }], sort: { field:'nextTouch', direction:'asc' } }; } }
  ]
};

const state = {
  mount: null,
  root: null,
  layout: null,
  savedQueries: [],
  savedQueriesLoaded: false,
  lensStates: new Map(),
  lensDrafts: new Map(),
  selectionUnsubscribe: null,
  dataListener: null,
  dataCache: {
    contacts: null,
    partners: null,
    contactsError: null,
    partnersError: null
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
  mount.style.maxWidth = '100%';
  mount.style.overflowX = 'hidden';
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
  root.style.maxWidth = '100%';
  root.style.width = '100%';
  root.style.overflow = 'visible';
  root.style.overflowX = 'visible';
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
  if(typeof window.dbSettingsGet !== 'function'){
    state.savedQueries = [];
    state.savedQueriesLoaded = true;
    return state.savedQueries;
  }
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
  state.savedQueriesLoaded = true;
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

function ensureSavedQueriesLoaded(){
  if(state.savedQueriesLoaded){
    return Promise.resolve(state.savedQueries);
  }
  return loadSavedQueries();
}

function cloneSavedQuery(entry){
  if(!entry) return null;
  const filters = Array.isArray(entry.filters)
    ? entry.filters.map((filter) => ({
      field: filter?.field || '',
      operator: filter?.operator || '',
      value: filter?.value
    })).filter((filter) => filter.field)
    : [];
  const sort = entry.sort && entry.sort.field
    ? { field: entry.sort.field, direction: entry.sort.direction === 'desc' ? 'desc' : 'asc' }
    : { field: '', direction: 'asc' };
  const limit = entry.limit != null ? Number(entry.limit) || null : null;
  return {
    id: entry.id,
    name: entry.name,
    lens: entry.lens,
    filters,
    sort,
    limit,
    createdAt: entry.createdAt || Date.now(),
    updatedAt: entry.updatedAt || entry.createdAt || Date.now()
  };
}

function toServiceResult(entry){
  const clone = cloneSavedQuery(entry);
  if(!clone) return null;
  const config = CONFIG_BY_KEY.get(clone.lens) || null;
  return {
    ...clone,
    entity: config ? config.entity : ''
  };
}

function resolveLensConfigFromOptions(options = {}){
  const lensKey = typeof options.lens === 'string' ? options.lens.trim() : '';
  if(lensKey && CONFIG_BY_KEY.has(lensKey)){
    return CONFIG_BY_KEY.get(lensKey);
  }
  const rawEntity = typeof options.entity === 'string' ? options.entity.trim().toLowerCase() : '';
  if(rawEntity){
    const entity = rawEntity.endsWith('s') ? rawEntity.slice(0, -1) : rawEntity;
    const match = LENS_CONFIGS.find((config) => config.entity === entity || config.key === rawEntity);
    if(match) return match;
  }
  const layout = ensureLayout();
  if(layout.lastActive && CONFIG_BY_KEY.has(layout.lastActive)){
    return CONFIG_BY_KEY.get(layout.lastActive);
  }
  return LENS_CONFIGS[0] || null;
}

function getLensStateForConfig(config){
  if(!config) return null;
  ensureLensStates();
  return state.lensStates.get(config.key) || null;
}

function normalizeServiceFilters(source, config){
  if(!config) return [];
  const filters = [];
  if(Array.isArray(source)){
    source.forEach((filter) => {
      const fieldKey = typeof filter?.field === 'string' ? filter.field : '';
      if(!fieldKey || !config.fieldsMap.has(fieldKey)) return;
      const rawValue = filter?.value;
      if(rawValue == null || rawValue === '') return;
      const operator = typeof filter?.operator === 'string'
        ? filter.operator
        : defaultOperatorFor(config.fieldsMap.get(fieldKey));
      filters.push({ field: fieldKey, operator, value: rawValue });
    });
    return filters;
  }
  if(source && typeof source === 'object'){
    Object.entries(source).forEach(([fieldKey, rawValue]) => {
      if(!config.fieldsMap.has(fieldKey)) return;
      if(rawValue == null || rawValue === '') return;
      const operator = defaultOperatorFor(config.fieldsMap.get(fieldKey));
      filters.push({ field: fieldKey, operator, value: rawValue });
    });
    return filters;
  }
  return [];
}

function normalizeQuerySpec(spec, config){
  const payload = {
    filters: [],
    sort: config?.defaultSort ? { ...config.defaultSort } : { field: '', direction: 'asc' },
    limit: null
  };
  if(!config || !spec || typeof spec !== 'object'){
    return payload;
  }
  let filterSource = null;
  if(Array.isArray(spec.filters) || (spec.filters && typeof spec.filters === 'object')){
    filterSource = spec.filters;
  }else{
    const candidate = {};
    Object.entries(spec).forEach(([key, value]) => {
      if(config.fieldsMap.has(key)) candidate[key] = value;
    });
    if(Object.keys(candidate).length){
      filterSource = candidate;
    }
  }
  if(filterSource){
    payload.filters = normalizeServiceFilters(filterSource, config);
  }
  const sortSource = spec.sort || spec.order || spec.sortBy;
  if(sortSource && typeof sortSource === 'object'){
    const sortField = typeof sortSource.field === 'string'
      ? sortSource.field
      : typeof sortSource.key === 'string'
        ? sortSource.key
        : '';
    if(sortField && config.fieldsMap.has(sortField)){
      const dirRaw = sortSource.direction || sortSource.dir || sortSource.order;
      payload.sort = {
        field: sortField,
        direction: dirRaw === 'desc' ? 'desc' : 'asc'
      };
    }
  }
  const limitSource = spec.limit ?? spec.pageSize ?? spec.take;
  if(limitSource != null){
    const numeric = Number(limitSource);
    payload.limit = Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }
  return payload;
}

async function ensureLensData(lensState, { refresh = false } = {}){
  if(!lensState) return null;
  if(refresh){
    lensState.dataLoaded = false;
  }
  if(!lensState.dataLoaded){
    await runLensQuery(lensState, { refreshBase: refresh });
  }
  return lensState;
}

function escapeCsvValue(value){
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsvLines(lensState, rows){
  if(!lensState || !lensState.config) return [];
  const headers = ['ID'].concat(lensState.config.columns.map((col) => col.label));
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    const rawId = row.id || toId(row.record?.id) || '';
    const values = [escapeCsvValue(rawId)];
    lensState.config.columns.forEach((column) => {
      const value = getDisplayValue(row, column, lensState.config) || '';
      values.push(escapeCsvValue(value));
    });
    lines.push(values.join(','));
  });
  return lines;
}

function csvFromLines(lines){
  if(!Array.isArray(lines) || !lines.length) return '\ufeff';
  return `\ufeff${lines.join('\n')}`;
}

async function writeReportFile(path, content){
  if(!path || !content) return false;
  if(typeof window === 'undefined') return false;
  const normalizedPath = path.replace(/^\/+/, '');
  const writers = [
    window.__WORKBENCH_REPORT_WRITER__,
    window.__CRM_REPORT_WRITER__,
    window.__APP_WRITE_REPORT__,
    window.__writeReport,
    window.__appendReport
  ].filter((fn, index, array) => typeof fn === 'function' && array.indexOf(fn) === index);
  for(let index = 0; index < writers.length; index += 1){
    const writer = writers[index];
    try{
      const result = writer(normalizedPath, content);
      if(result && typeof result.then === 'function'){
        await result;
      }
      return true;
    }catch (err){
      try{ console && console.warn && console.warn('[workbench] report writer failed', err); }
      catch (_err){}
    }
  }
  if(typeof fetch === 'function'){
    try{
      const origin = window.location && window.location.origin ? window.location.origin : '';
      const url = origin ? `${origin}/__report` : '/__report';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: normalizedPath, content })
      });
      if(response && response.ok) return true;
    }catch (_err){}
  }
  return false;
}

async function recordCsvPreview(lines){
  if(!Array.isArray(lines) || !lines.length) return;
  const preview = lines.slice(0, 5).join('\n');
  if(!preview) return;
  try{
    await writeReportFile('reports/A18/workbench_export.log', `${preview}\n`);
  }catch (err){
    try{ console && console.warn && console.warn('[workbench] failed to record CSV preview', err); }
    catch (_err){}
  }
}

function createWorkbenchViewService(){
  return {
    async list(scope){
      await ensureSavedQueriesLoaded();
      if(!scope){
        return state.savedQueries.map((entry) => toServiceResult(entry)).filter(Boolean);
      }
      const config = resolveLensConfigFromOptions(typeof scope === 'string' ? { lens: scope, entity: scope } : scope);
      if(!config){
        return [];
      }
      return state.savedQueries
        .filter((entry) => entry.lens === config.key)
        .map((entry) => toServiceResult(entry))
        .filter(Boolean);
    },
    async save(name, querySpec = {}, options = {}){
      await ensureSavedQueriesLoaded();
      const config = resolveLensConfigFromOptions(options);
      if(!config){
        throw new Error('Workbench lens unavailable');
      }
      const normalized = normalizeQuerySpec(querySpec, config);
      const now = Date.now();
      const trimmed = typeof name === 'string' ? name.trim() : '';
      const entry = {
        id: generateId(),
        name: trimmed || `${config.label} Query`,
        lens: config.key,
        filters: normalized.filters,
        sort: normalized.sort,
        limit: normalized.limit,
        createdAt: now,
        updatedAt: now
      };
      state.savedQueries.push(entry);
      await persistSavedQueries();
      renderSavedQueryLists();
      return toServiceResult(entry);
    },
    async update(id, updates = {}){
      await ensureSavedQueriesLoaded();
      if(!id) return null;
      const entry = state.savedQueries.find((item) => item.id === id);
      if(!entry) return null;
      const config = resolveLensConfigFromOptions({ lens: entry.lens });
      if(typeof updates.name === 'string'){
        const trimmed = updates.name.trim();
        if(trimmed) entry.name = trimmed;
      }
      if(Object.prototype.hasOwnProperty.call(updates, 'filters')){
        const normalized = normalizeQuerySpec({ filters: updates.filters }, config);
        entry.filters = normalized.filters;
      }
      if(Object.prototype.hasOwnProperty.call(updates, 'sort')){
        const normalized = normalizeQuerySpec({ sort: updates.sort }, config);
        entry.sort = normalized.sort;
      }
      if(Object.prototype.hasOwnProperty.call(updates, 'limit')){
        const normalized = normalizeQuerySpec({ limit: updates.limit }, config);
        entry.limit = normalized.limit;
      }
      entry.updatedAt = Date.now();
      await persistSavedQueries();
      renderSavedQueryLists();
      return toServiceResult(entry);
    },
    async remove(id){
      await ensureSavedQueriesLoaded();
      const index = state.savedQueries.findIndex((item) => item.id === id);
      if(index === -1) return false;
      state.savedQueries.splice(index, 1);
      state.lensStates.forEach((lensState) => {
        if(lensState.savedQueryId === id){
          lensState.savedQueryId = null;
        }
      });
      await persistSavedQueries();
      renderSavedQueryLists();
      return true;
    },
    async load(id){
      await ensureSavedQueriesLoaded();
      const entry = state.savedQueries.find((item) => item.id === id);
      return entry ? toServiceResult(entry) : null;
    }
  };
}

function createWorkbenchExportApi(){
  return async function workbenchExportCsv(options = {}){
    const config = resolveLensConfigFromOptions(options);
    if(!config){
      throw new Error('Workbench lens unavailable');
    }
    const lensState = getLensStateForConfig(config);
    if(!lensState){
      throw new Error('Workbench lens state missing');
    }
    await ensureLensData(lensState, { refresh: options.refresh === true });
    const mode = options.mode === 'all' ? 'all' : 'visible';
    const rows = mode === 'all'
      ? (Array.isArray(lensState.rows) ? lensState.rows : [])
      : (Array.isArray(lensState.visibleRows) && lensState.visibleRows.length ? lensState.visibleRows : (Array.isArray(lensState.rows) ? lensState.rows : []));
    const lines = buildCsvLines(lensState, rows);
    recordCsvPreview(lines);
    return csvFromLines(lines);
  };
}

function createWorkbenchSimulateLargeFilter(){
  return async function workbenchSimulateLargeFilter(sampleSize = 1000, options = {}){
    const config = resolveLensConfigFromOptions(options);
    if(!config) return 0;
    const lensState = getLensStateForConfig(config);
    if(!lensState) return 0;
    await ensureLensData(lensState, { refresh: options.refresh === true });
    const baseRecords = await ensureBaseRecords(lensState);
    if(!Array.isArray(baseRecords) || !baseRecords.length) return 0;
    const numericSize = Number(sampleSize);
    const targetSize = Number.isFinite(numericSize) && numericSize > 0 ? Math.min(numericSize, 50000) : baseRecords.length;
    const records = [];
    for(let index = 0; index < targetSize; index += 1){
      records.push(baseRecords[index % baseRecords.length]);
    }
    const filtered = await applyFiltersToBaseRecords(lensState, records);
    return filtered.length;
  };
}

async function loadLensDrafts(){
  state.lensDrafts = new Map();
  if(typeof window.openDB === 'function'){
    try{ await window.openDB(); }
    catch (_err){}
  }
  if(typeof window.dbSettingsGet !== 'function') return state.lensDrafts;
  try{
    const record = await window.dbSettingsGet(STORAGE_KEYS.drafts);
    const entries = Array.isArray(record?.entries) ? record.entries : [];
    entries.forEach((entry) => {
      if(!entry || typeof entry !== 'object') return;
      const lensKey = typeof entry.lens === 'string' ? entry.lens : typeof entry.key === 'string' ? entry.key : '';
      if(!lensKey) return;
      const config = CONFIG_BY_KEY.get(lensKey);
      if(!config) return;
      const filters = Array.isArray(entry.filters)
        ? entry.filters.map((filter) => {
          const field = typeof filter?.field === 'string' ? filter.field : '';
          if(!field || !config.fieldsMap.has(field)) return null;
          const rawValue = filter?.value;
          if(rawValue == null || rawValue === '') return null;
          const operator = typeof filter?.operator === 'string' ? filter.operator : defaultOperatorFor(config.fieldsMap.get(field));
          return { field, operator, value: rawValue };
        }).filter(Boolean)
        : [];
      let sort = null;
      if(entry.sort && typeof entry.sort === 'object'){
        const sortField = typeof entry.sort.field === 'string' ? entry.sort.field : '';
        if(sortField && config.fieldsMap.has(sortField)){
          sort = { field: sortField, direction: entry.sort.direction === 'desc' ? 'desc' : 'asc' };
        }
      }
      const limit = entry.limit != null ? (Number(entry.limit) || null) : null;
      if(filters.length || sort || limit != null){
        state.lensDrafts.set(lensKey, { filters, sort, limit });
      }
    });
  }catch (err){
    state.lensDrafts = new Map();
    console && console.warn && console.warn('[workbench] failed to load lens drafts', err);
  }
  return state.lensDrafts;
}

let lensDraftSaveTimer = null;

function scheduleLensDraftSave(){
  if(lensDraftSaveTimer){
    clearTimeout(lensDraftSaveTimer);
    lensDraftSaveTimer = null;
  }
  lensDraftSaveTimer = setTimeout(async () => {
    lensDraftSaveTimer = null;
    if(typeof window.dbSettingsPut !== 'function') return;
    const entries = Array.from(state.lensDrafts.entries()).map(([lens, draft]) => {
      const filters = Array.isArray(draft?.filters)
        ? draft.filters.map((filter) => ({ field: filter.field, operator: filter.operator, value: filter.value }))
        : [];
      const sort = draft?.sort && draft.sort.field
        ? { field: draft.sort.field, direction: draft.sort.direction === 'desc' ? 'desc' : 'asc' }
        : null;
      const limit = draft?.limit != null ? (Number(draft.limit) || null) : null;
      return {
        lens,
        filters,
        sort,
        limit,
        updatedAt: Date.now()
      };
    }).filter((entry) => entry.filters.length || (entry.sort && entry.sort.field) || entry.limit != null);
    try{
      await window.dbSettingsPut({
        id: STORAGE_KEYS.drafts,
        entries,
        updatedAt: Date.now()
      });
    }catch (err){
      console && console.warn && console.warn('[workbench] failed to persist lens drafts', err);
    }
  }, 200);
}

function persistLensDraft(lensState){
  if(!lensState || !lensState.config) return;
  const { config } = lensState;
  const payload = serializeLensState(lensState);
  const filters = Array.isArray(payload.filters)
    ? payload.filters.map((filter) => ({ field: filter.field, operator: filter.operator, value: filter.value }))
    : [];
  const sort = payload.sort && payload.sort.field
    ? { field: payload.sort.field, direction: payload.sort.direction === 'desc' ? 'desc' : 'asc' }
    : null;
  const limit = payload.limit != null ? (Number(payload.limit) || null) : null;
  if(!filters.length && !sort && limit == null){
    state.lensDrafts.delete(config.key);
    scheduleLensDraftSave();
    return;
  }
  state.lensDrafts.set(config.key, { filters, sort, limit });
  scheduleLensDraftSave();
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
    state.dataCache.contactsError = null;
    state.dataCache.partnersError = null;
    state.lensStates.forEach((lensState) => {
      lensState.baseRecords = null;
      lensState.dataLoaded = false;
      lensState.rowCache = new WeakMap();
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
  if(Array.isArray(state.dataCache.contacts) && !state.dataCache.contactsError){
    return state.dataCache.contacts;
  }
  if(typeof window.dbGetAll !== 'function'){
    state.dataCache.contacts = [];
    state.dataCache.contactsError = null;
    return state.dataCache.contacts;
  }
  try{
    const rows = await window.dbGetAll('contacts');
    state.dataCache.contacts = Array.isArray(rows) ? rows.slice() : [];
    state.dataCache.contactsError = null;
    return state.dataCache.contacts;
  }catch (err){
    state.dataCache.contacts = null;
    state.dataCache.contactsError = err;
    console && console.warn && console.warn('[workbench] contacts fetch failed', err);
    throw err;
  }
}

async function loadPartners(){
  if(Array.isArray(state.dataCache.partners) && !state.dataCache.partnersError){
    return state.dataCache.partners;
  }
  if(typeof window.dbGetAll !== 'function'){
    state.dataCache.partners = [];
    state.dataCache.partnersError = null;
    return state.dataCache.partners;
  }
  try{
    const rows = await window.dbGetAll('partners');
    state.dataCache.partners = Array.isArray(rows) ? rows.slice() : [];
    state.dataCache.partnersError = null;
    return state.dataCache.partners;
  }catch (err){
    state.dataCache.partners = null;
    state.dataCache.partnersError = err;
    console && console.warn && console.warn('[workbench] partners fetch failed', err);
    throw err;
  }
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
    pendingRender: false,
    lastError: null,
    statusBanner: null,
    activePreset: '',
    restoredDraft: false,
    rowCache: new WeakMap()
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
  clearActivePreset(lensState);
  lensState.filters.push(filter);
  renderFilterRows(lensState);
}

function clearFilters(lensState){
  clearActivePreset(lensState);
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
      clearActivePreset(lensState);
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
      clearActivePreset(lensState);
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
      clearActivePreset(lensState);
    });
    row.appendChild(valueInput);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      lensState.filters = lensState.filters.filter((item) => item.id !== filter.id);
      clearActivePreset(lensState);
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

function evaluatePresetQuery(lensState, preset){
  if(!preset) return { filters: [] };
  const config = lensState.config;
  const query = typeof preset.build === 'function' ? preset.build(lensState) : preset;
  const filters = Array.isArray(query?.filters)
    ? query.filters.map((item) => ({
      field: item?.field || config.filterFields[0]?.key || '',
      operator: item?.operator || defaultOperatorFor(config.filterFields[0]),
      value: item?.value ?? ''
    }))
    : [];
  const sort = query?.sort && query.sort.field
    ? { field: query.sort.field, direction: query.sort.direction === 'desc' ? 'desc' : 'asc' }
    : null;
  const limit = query?.limit != null ? Number(query.limit) || null : null;
  return { filters, sort, limit };
}

function clearActivePreset(lensState){
  if(!lensState || !lensState.activePreset) return;
  lensState.activePreset = '';
  renderPresetChips(lensState);
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
  renderPresetChips(lensState);
}

function getSortOptions(lensState){
  return lensState.config.sortFields.length ? lensState.config.sortFields : lensState.config.columns.map((col) => ({ key: col.field, label: col.label }));
}

function renderPresetChips(lensState){
  const host = lensState?.elements?.presetChips;
  if(!host) return;
  const presets = PRESET_FILTERS[lensState.config.key] || [];
  if(!presets.length){
    host.innerHTML = '';
    host.hidden = true;
    return;
  }
  const doc = host.ownerDocument || document;
  host.hidden = false;
  host.innerHTML = '';
  presets.forEach((preset) => {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'chip preset-chip';
    btn.dataset.qa = 'preset-filter'; btn.dataset.presetKey = preset.key;
    btn.textContent = preset.label;
    btn.setAttribute('aria-pressed', lensState.activePreset === preset.key ? 'true' : 'false');
    if(lensState.activePreset === preset.key && btn.classList) btn.classList.add('is-active');
    btn.addEventListener('click', () => {
      if(lensState.activePreset === preset.key){
        runLensQuery(lensState, { reuseBase: false });
        return;
      }
      applyPresetFilters(lensState, preset);
    });
    host.appendChild(btn);
  });
}

function applyPresetFilters(lensState, preset){
  if(!lensState || !preset) return;
  lensState.activePreset = preset.key || '';
  lensState.savedQueryId = null;
  const query = evaluatePresetQuery(lensState, preset);
  assignLensStateFromQuery(lensState, {
    filters: query.filters,
    sort: query.sort || lensState.config.defaultSort,
    limit: query.limit
  });
  runLensQuery(lensState, { reuseBase: false });
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
    empty.textContent = 'No saved queries yet. Click "Save Query" to reuse this filter set.';
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
      clearActivePreset(lensState);
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

function resetRowModel(row, record){
  if(!row) return null;
  row.record = record;
  row.id = toId(record?.id);
  row.valueCache = Object.create(null);
  row.displayCache = Object.create(null);
  row.searchText = null;
  return row;
}

function getRowModel(record, lensState){
  if(!lensState) return resetRowModel(buildRow(record, {}), record);
  const cache = lensState.rowCache || (lensState.rowCache = new WeakMap());
  if(!record || (typeof record !== 'object' && typeof record !== 'function')){
    return resetRowModel(buildRow(record, lensState.config), record);
  }
  let row = cache.get(record);
  if(!row){
    row = buildRow(record, lensState.config);
    cache.set(record, row);
  }
  return resetRowModel(row, record);
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

function matchesFilters(row, filters, lensState){
  if(!filters.length) return true;
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
}

async function applyFiltersToBaseRecords(lensState, baseRecords){
  const filters = sanitizeFilters(lensState);
  if(!Array.isArray(baseRecords) || !baseRecords.length){
    return [];
  }
  const result = [];
  for(let index = 0; index < baseRecords.length; index += 1){
    const record = baseRecords[index];
    const row = getRowModel(record, lensState);
    if(matchesFilters(row, filters, lensState)){
      result.push(row);
    }
    if(index && index % ROW_BATCH_SIZE === 0){
      await yieldFrame();
    }
  }
  await yieldMicrotask();
  return result;
}

function sortRows(rows, lensState){
  if(!Array.isArray(rows)) return [];
  const { sort, config } = lensState;
  const field = sort.field;
  if(!field) return rows.slice();
  const direction = sort.direction === 'asc' ? 1 : -1;
  const fieldMeta = config.fieldsMap.get(field);
  const type = fieldMeta?.type || 'string';
  return rows.slice().sort((rowA, rowB) => {
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
    const nameA = contactName(rowA.record) || partnerName(rowA.record) || '';
    const nameB = contactName(rowB.record) || partnerName(rowB.record) || '';
    return nameA.localeCompare(nameB) * direction;
  });
}

function applyLimit(rows, limit){
  if(limit == null || !Number.isFinite(limit) || limit <= 0) return rows;
  return rows.slice(0, limit);
}

function applySearch(lensState){
  const { config, searchText, rows } = lensState;
  if(!Array.isArray(rows) || !rows.length){
    lensState.visibleRows = [];
    return;
  }
  if(!searchText){
    lensState.visibleRows = rows.slice();
    return;
  }
  const needle = searchText.toLowerCase();
  lensState.visibleRows = rows.filter((row) => buildSearchText(row, config).includes(needle));
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
  const { visibleRows, statusBanner } = lensState;
  if(!statusBanner) return;
  if(lensState.loading){
    statusBanner.showLoading('Loading…');
    return;
  }
  if(lensState.lastError){
    statusBanner.showError('We couldn’t load this view. Please try again.', {
      onRetry: () => runLensQuery(lensState, { reuseBase: false })
    });
    return;
  }
  if(!visibleRows.length){
    statusBanner.showEmpty('No records match these filters. Adjust filters or add records to see them here.');
    return;
  }
  statusBanner.clear();
}

function isLensRowVisible(row){
  if(!row) return false;
  if(row.hidden) return false;
  if(row.getAttribute && row.getAttribute('aria-hidden') === 'true') return false;
  const classList = row.classList;
  if(classList){
    if(classList.contains('hidden') || classList.contains('is-hidden') || classList.contains('pipeline-filter-hide')){
      return false;
    }
  }
  if(row.style){
    if(row.style.display === 'none' || row.style.visibility === 'hidden') return false;
  }
  if(typeof row.offsetParent !== 'undefined' && row.offsetParent === null){
    if(typeof row.getClientRects === 'function'){
      const rects = row.getClientRects();
      if(!rects.length) return false;
      const rect = rects[0];
      if(rect && rect.width === 0 && rect.height === 0) return false;
    }else{
      return false;
    }
  }
  return true;
}

function gatherLensRowData(table){
  if(!table) return [];
  return Array.from(table.querySelectorAll('tbody tr[data-id]')).map(row => {
    const id = row.getAttribute('data-id');
    const checkbox = row.querySelector('[data-role="select"][data-ui="row-check"]');
    const ariaDisabled = checkbox && checkbox.getAttribute ? checkbox.getAttribute('aria-disabled') : null;
    const disabled = !!(checkbox && (checkbox.disabled || ariaDisabled === 'true'));
    return {
      row,
      id: id ? String(id) : null,
      checkbox,
      disabled,
      visible: isLensRowVisible(row)
    };
  });
}

function syncSelectionForLens(lensState){
  const { elements, config } = lensState;
  const table = elements.table;
  if(!table) return;
  const scope = config.selectionScope;
  const store = getSelectionStore();
  const selected = store ? store.get(scope) : new Set();
  const ids = selected instanceof Set ? selected : new Set(Array.from(selected || []));
  const rowData = gatherLensRowData(table);
  rowData.forEach(({ row, id, checkbox }) => {
    const active = id && ids.has(id);
    if(active){
      row.setAttribute('data-selected', '1');
    }else{
      row.removeAttribute('data-selected');
    }
    if(checkbox){
      checkbox.checked = active;
      checkbox.setAttribute('aria-checked', active ? 'true' : 'false');
    }
  });
  const header = table.querySelector('thead input[data-role="select-all"]');
  if(header){
    const visibleBoxes = rowData.filter(entry => entry.visible && entry.checkbox && !entry.disabled && entry.id);
    const total = visibleBoxes.length;
    let selectedVisible = 0;
    visibleBoxes.forEach((entry) => {
      if(entry.id && ids.has(entry.id)) selectedVisible += 1;
    });
    const shouldIndeterminate = total > 0 && selectedVisible > 0 && selectedVisible < total;
    const shouldChecked = total > 0 && selectedVisible === total;
    header.indeterminate = shouldIndeterminate;
    header.checked = shouldChecked;
    try {
      header.setAttribute('aria-checked', shouldIndeterminate ? 'mixed' : (shouldChecked ? 'true' : 'false'));
    }catch (_err){}
    if(!total){
      header.indeterminate = false;
      header.checked = false;
      try { header.setAttribute('aria-checked', 'false'); }
      catch (_err){}
    }
  }
}

function renderTable(lensState){
  const { elements, config, visibleRows } = lensState;
  const tbody = elements.tbody;
  if(!tbody) return;
  const layoutManager = ensureTableLayoutManager(lensState);
  tbody.innerHTML = '';
  if(lensState.lastError){
    updateStatusMessage(lensState);
    syncSelectionForLens(lensState);
    if(layoutManager) layoutManager.scheduleMeasure();
    return;
  }
  if(!visibleRows.length){
    updateStatusMessage(lensState);
    syncSelectionForLens(lensState);
    if(layoutManager) layoutManager.scheduleMeasure();
    return;
  }
  const frag = document.createDocumentFragment();
  visibleRows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.classList.add('status-row');
    const id = row.id || toId(row.record?.id);
    if(id) tr.setAttribute('data-id', id);

    const selectCell = document.createElement('td');
    selectCell.setAttribute('data-role', 'select');
    selectCell.dataset.compact = '1';
    selectCell.dataset.column = 'select';
    selectCell.style.textAlign = 'center';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('data-role', 'select');
    checkbox.setAttribute('data-ui', 'row-check');
    checkbox.setAttribute('aria-label', 'Select row');
    if(id) checkbox.setAttribute('data-id', id);
    selectCell.appendChild(checkbox);
    tr.appendChild(selectCell);

    config.columns.forEach((column) => {
      const td = document.createElement('td');
      if(td.dataset){
        td.dataset.field = column.field || '';
        td.dataset.wrap = column.isName ? '1' : '0';
        td.dataset.column = column.isName ? 'name' : (column.field || '');
      }
      if(column.type === 'number'){
        td.classList.add('numeric');
      }
      if(column.isName){
        if(config.entity === 'contact'){
          const link = renderContactNameLink(row.record, id, lensState.config.key);
          td.appendChild(link);
        }else{
          const link = document.createElement('a');
          link.href = '#';
          link.textContent = getDisplayValue(row, column, config) || '—';
          link.setAttribute('data-role', 'open-record');
          link.setAttribute('data-entity', config.entity);
          if(id) link.setAttribute('data-id', id);
          link.title = link.textContent;
          td.appendChild(link);
        }
      }else{
        td.textContent = getDisplayValue(row, column, config) || '—';
        td.title = td.textContent;
      }
      tr.appendChild(td);
    });

    const gutterCell = document.createElement('td');
    gutterCell.setAttribute('data-role', 'gutter');
    gutterCell.setAttribute('aria-hidden', 'true');
    gutterCell.tabIndex = -1;
    gutterCell.dataset.compact = '1';
    gutterCell.dataset.column = 'gutter';
    tr.appendChild(gutterCell);

    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
  if(layoutManager) layoutManager.scheduleMeasure();
  updateStatusMessage(lensState);
  syncSelectionForLens(lensState);
}

const tableLayoutRaf = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame
  : (fn) => setTimeout(fn, 16);
const tableLayoutMicrotask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => Promise.resolve().then(fn);

function ensureTableLayoutManager(lensState){
  if(!lensState || !lensState.elements) return null;
  const { table, tbody } = lensState.elements;
  const wrap = lensState.elements.tableWrap || (table ? table.parentElement : null);
  if(!table || !tbody || !wrap) return null;
  if(lensState.tableLayoutManager && lensState.tableLayoutManager.table === table){
    lensState.tableLayoutManager.tbody = tbody;
    lensState.tableLayoutManager.wrap = wrap;
    return lensState.tableLayoutManager;
  }
  if(lensState.tableLayoutManager){
    disposeTableLayout(lensState.tableLayoutManager);
  }
  const manager = createTableLayoutManager(lensState, wrap, table, tbody);
  lensState.tableLayoutManager = manager;
  manager.scheduleMeasure();
  return manager;
}

function createTableLayoutManager(lensState, wrap, table, tbody){
  const manager = {
    lensState,
    wrap,
    table,
    tbody,
    colgroup: null,
    resizeObserver: null,
    rafId: null,
    disposed: false,
    fontsReadyResolved: true,
    fontsReadyPromise: null,
    isUpdating: false,
    needsMeasure: false,
    lastSnapshot: null,
    debugLogged: false
  };
  const doc = table.ownerDocument || document;
  let colgroup = table.querySelector('colgroup[data-role="layout"]');
  if(!colgroup){
    colgroup = doc.createElement('colgroup');
    colgroup.setAttribute('data-role', 'layout');
    table.insertBefore(colgroup, table.firstChild || null);
  }else if(colgroup !== table.firstElementChild){
    table.insertBefore(colgroup, table.firstChild || null);
  }
  manager.colgroup = colgroup;

  const fontsReady = typeof document !== 'undefined'
    && document.fonts
    && typeof document.fonts.ready === 'object'
      ? document.fonts.ready
      : null;
  if(fontsReady && typeof fontsReady.then === 'function'){
    manager.fontsReadyResolved = false;
    manager.fontsReadyPromise = fontsReady.catch(() => {});
    manager.fontsReadyPromise.then(() => {
      manager.fontsReadyResolved = true;
      if(!manager.disposed){
        manager.scheduleMeasure();
      }
    });
  }else{
    manager.fontsReadyResolved = true;
    manager.fontsReadyPromise = Promise.resolve();
  }

  manager.scheduleMeasure = function scheduleMeasure(){
    if(manager.disposed) return;
    if(manager.rafId != null) return;
    manager.rafId = tableLayoutRaf(() => {
      manager.rafId = null;
      tableLayoutMicrotask(() => manager.measure());
    });
  };

  manager.measure = function measure(){
    if(manager.disposed) return;
    if(manager.isUpdating){
      manager.needsMeasure = true;
      return;
    }
    if(!manager.fontsReadyResolved){
      manager.needsMeasure = true;
      return;
    }
    manager.isUpdating = true;
    let pending = manager.needsMeasure;
    manager.needsMeasure = false;
    try{
      const changed = applyTableLayout(manager);
      if(!changed && manager.needsMeasure){
        pending = true;
      }else if(manager.needsMeasure){
        pending = true;
      }
      manager.needsMeasure = false;
    }finally{
      manager.isUpdating = false;
    }
    if((pending || manager.needsMeasure) && !manager.disposed){
      manager.needsMeasure = false;
      manager.scheduleMeasure();
    }
  };

  if(typeof ResizeObserver === 'function'){
    const resizeObserver = new ResizeObserver(() => {
      manager.scheduleMeasure();
    });
    resizeObserver.observe(wrap);
    manager.resizeObserver = resizeObserver;
  }

  return manager;
}

function disposeTableLayout(manager){
  if(!manager) return;
  manager.disposed = true;
  if(manager.resizeObserver){
    try{ manager.resizeObserver.disconnect(); }
    catch (_err){}
    manager.resizeObserver = null;
  }
}

function applyTableLayout(manager){
  const { table, tbody, wrap, colgroup } = manager;
  if(!table || !tbody || !wrap || !colgroup) return false;
  const thead = table.tHead;
  const headerRow = thead && thead.rows && thead.rows[0];
  if(!headerRow){
    table.removeAttribute('data-table-layout-ready');
    table.style.removeProperty('--table-scrollbar-width');
    ensureColgroupLength(colgroup, 0);
    manager.lastSnapshot = null;
    return false;
  }
  const headerCells = Array.from(headerRow.cells || []);
  if(headerCells.length === 0){
    table.removeAttribute('data-table-layout-ready');
    table.style.removeProperty('--table-scrollbar-width');
    ensureColgroupLength(colgroup, 0);
    manager.lastSnapshot = null;
    return false;
  }
  const dataColumnCount = Math.max(0, headerCells.length - 1);
  if(dataColumnCount <= 0){
    table.removeAttribute('data-table-layout-ready');
    table.style.removeProperty('--table-scrollbar-width');
    ensureColgroupLength(colgroup, 0);
    manager.lastSnapshot = null;
    return false;
  }

  const firstRow = findFirstVisibleRow(tbody);
  let widths = [];
  if(firstRow){
    const cells = Array.from(firstRow.cells || []);
    for(let index = 0; index < dataColumnCount; index += 1){
      const cell = cells[index];
      const headerCell = headerCells[index];
      let width = measureCellWidth(cell);
      const headerWidth = measureCellWidth(headerCell);
      if(headerWidth > width) width = headerWidth;
      if(index === 0){
        width = Math.max(width, 44);
      }
      widths.push(Math.max(0, Math.round(width)));
    }
  }else if(manager.lastSnapshot && Array.isArray(manager.lastSnapshot.widths)){
    widths = manager.lastSnapshot.widths.slice(0, dataColumnCount);
  }else{
    widths = headerCells.slice(0, dataColumnCount).map((cell, index) => {
      const width = measureCellWidth(cell);
      return Math.max(0, Math.round(index === 0 ? Math.max(width, 44) : width));
    });
  }
  while(widths.length < dataColumnCount){
    widths.push(44);
  }

  const scrollbarWidth = Math.max(0, wrap.offsetWidth - wrap.clientWidth);
  const horizontalOverflow = wrap.scrollWidth > wrap.clientWidth + 1;
  const gutterWidth = horizontalOverflow ? scrollbarWidth : 0;
  const containerWidth = wrap.clientWidth;

  let nameIndex = -1;
  for(let index = 0; index < dataColumnCount; index += 1){
    const headerCell = headerCells[index];
    if(!headerCell || !headerCell.dataset) continue;
    if(headerCell.dataset.column === 'name'){
      nameIndex = index;
      break;
    }
  }
  if(nameIndex > -1 && containerWidth > 0){
    const otherWidth = widths.reduce((sum, value, idx) => idx === nameIndex ? sum : sum + value, 0);
    const available = containerWidth - otherWidth - gutterWidth;
    if(available > 0){
      const base = Math.max(widths[nameIndex], MIN_NAME_COLUMN_WIDTH);
      let target;
      if(available >= base){
        target = available;
      }else if(available >= MIN_NAME_COLUMN_WIDTH){
        target = Math.max(MIN_NAME_COLUMN_WIDTH, available);
      }else{
        target = Math.max(available, 44);
      }
      widths[nameIndex] = Math.max(44, Math.round(target));
    }else if(widths[nameIndex] < MIN_NAME_COLUMN_WIDTH){
      widths[nameIndex] = Math.max(44, Math.round(widths[nameIndex]));
    }
  }

  const newSnapshot = {
    widths: widths.slice(),
    gutter: Math.max(0, Math.round(gutterWidth)),
    scrollbar: Math.max(0, Math.round(scrollbarWidth)),
    containerWidth: Math.max(0, Math.round(containerWidth)),
    horizontalOverflow: Boolean(horizontalOverflow),
    fontsReady: manager.fontsReadyResolved
  };

  const previous = manager.lastSnapshot;
  const changed = !previous || snapshotChanged(previous, newSnapshot);
  if(!changed){
    return false;
  }

  ensureColgroupLength(colgroup, dataColumnCount + 1);
  for(let index = 0; index < dataColumnCount; index += 1){
    const col = colgroup.children[index];
    const width = Math.max(0, Math.round(widths[index]));
    col.style.width = `${width}px`;
    col.style.minWidth = `${width}px`;
    col.style.maxWidth = `${width}px`;
  }
  const gutterCol = colgroup.children[dataColumnCount];
  const gutterValue = Math.max(0, newSnapshot.gutter);
  gutterCol.style.width = `${gutterValue}px`;
  gutterCol.style.minWidth = `${gutterValue}px`;
  gutterCol.style.maxWidth = `${gutterValue}px`;
  gutterCol.style.display = gutterValue ? '' : 'none';

  table.style.setProperty('--table-scrollbar-width', `${Math.max(newSnapshot.gutter, newSnapshot.scrollbar)}px`);
  table.setAttribute('data-table-layout-ready', '1');

  manager.lastSnapshot = newSnapshot;
  if(!manager.debugLogged){
    emitTableDebug(manager, newSnapshot);
  }
  return true;
}

function ensureColgroupLength(colgroup, desired){
  const doc = colgroup.ownerDocument || document;
  while(colgroup.children.length < desired){
    colgroup.appendChild(doc.createElement('col'));
  }
  while(colgroup.children.length > desired){
    const last = colgroup.lastElementChild;
    if(!last) break;
    colgroup.removeChild(last);
  }
}

function findFirstVisibleRow(tbody){
  if(!tbody) return null;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  for(const row of rows){
    if(!row) continue;
    if(row.hidden || row.getAttribute('hidden') === 'true') continue;
    if(row.style && row.style.display === 'none') continue;
    const rect = typeof row.getBoundingClientRect === 'function' ? row.getBoundingClientRect() : null;
    if(rect && rect.height === 0 && rect.width === 0) continue;
    return row;
  }
  return null;
}

function measureCellWidth(cell){
  if(!cell) return 0;
  try{
    if(typeof cell.getBoundingClientRect === 'function'){
      const rect = cell.getBoundingClientRect();
      if(rect && rect.width) return Math.round(rect.width);
    }
  }catch (_err){}
  if(typeof cell.offsetWidth === 'number' && cell.offsetWidth) return Math.round(cell.offsetWidth);
  if(typeof cell.clientWidth === 'number' && cell.clientWidth) return Math.round(cell.clientWidth);
  return 0;
}

function snapshotChanged(previous, next){
  if(!previous) return true;
  if(!previous.widths || previous.widths.length !== next.widths.length) return true;
  for(let index = 0; index < next.widths.length; index += 1){
    if(previous.widths[index] !== next.widths[index]) return true;
  }
  if(previous.gutter !== next.gutter) return true;
  if(previous.scrollbar !== next.scrollbar) return true;
  if(previous.containerWidth !== next.containerWidth) return true;
  if(previous.horizontalOverflow !== next.horizontalOverflow) return true;
  return false;
}

function emitTableDebug(manager, snapshot){
  if(typeof window === 'undefined'){
    manager.debugLogged = true;
    return;
  }
  const global = window;
  const payload = {
    table: manager.lensState?.config?.key || manager.table?.dataset?.tableLens || '',
    widths: snapshot.widths.slice(),
    containerWidth: snapshot.containerWidth,
    scrollbarWidth: snapshot.scrollbar,
    gutter: snapshot.gutter,
    fontsReady: snapshot.fontsReady,
    horizontalOverflow: snapshot.horizontalOverflow,
    timestamp: Date.now()
  };
  let store = global.__TABLE_DEBUG__;
  let enabled = false;
  if(store && typeof store === 'object' && !Array.isArray(store)){
    enabled = store.enabled === true;
  }else if(store === true){
    enabled = true;
    store = { enabled: true, logs: [] };
  }else if(store === false){
    enabled = false;
    store = { enabled: false, logs: [] };
  }else{
    store = { enabled: false, logs: [] };
  }
  if(!Array.isArray(store.logs)) store.logs = [];
  store.logs.push(payload);
  global.__TABLE_DEBUG__ = store;
  if(global.__DEV__ || enabled){
    try{ console.log('__TABLE_DEBUG__', payload); }
    catch (_err){}
  }
  manager.debugLogged = true;
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
    lensState.rowCache = new WeakMap();
  }else{
    const contacts = await loadContacts();
    lensState.baseRecords = contacts.filter((record) => {
      try{ return config.baseFilter(record); }
      catch (err){ console && console.warn && console.warn('[workbench] contact base filter failed', err); return false; }
    });
    lensState.rowCache = new WeakMap();
  }
  return lensState.baseRecords;
}

async function runLensQuery(lensState, options = {}){
  const refreshBase = options.refreshBase === true;
  setLoading(lensState, true);
  lensState.lastError = null;
  try{
    if(refreshBase){
      lensState.baseRecords = null;
    }
    if(refreshBase || !Array.isArray(lensState.baseRecords)){
      await ensureBaseRecords(lensState);
    }
    await yieldFrame();
    const baseRecords = Array.isArray(lensState.baseRecords) ? lensState.baseRecords : [];
    const filtered = await applyFiltersToBaseRecords(lensState, baseRecords);
    await yieldMicrotask();
    const sorted = sortRows(filtered, lensState);
    await yieldMicrotask();
    const limitValue = lensState.limit != null ? Number(lensState.limit) : null;
    const limited = applyLimit(sorted, Number.isFinite(limitValue) ? limitValue : null);
    lensState.rows = limited;
    lensState.dataLoaded = true;
    applySearch(lensState);
    renderTable(lensState);
    updateCounts(lensState);
    lensState.lastError = null;
    persistLensDraft(lensState);
  }catch (err){
    lensState.lastError = err;
    lensState.rows = [];
    lensState.visibleRows = [];
    lensState.dataLoaded = false;
    renderTable(lensState);
    updateCounts(lensState);
  }finally{
    setLoading(lensState, false);
    updateStatusMessage(lensState);
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
    toggle.title = open ? 'Hide results' : 'Show results';
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
  const rows = Array.isArray(lensState?.visibleRows) ? lensState.visibleRows : [];
  if(!rows.length){
    toast('No rows to export');
    return;
  }
  const lines = buildCsvLines(lensState, rows);
  const previewPromise = recordCsvPreview(lines);
  if(previewPromise && typeof previewPromise.then === 'function'){
    previewPromise.catch(() => {});
  }
  const filename = `${lensState.config.key}-workbench-${new Date().toISOString().slice(0,10)}.csv`;
  const blob = new Blob([csvFromLines(lines)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  const revoke = () => {
    try{ URL.revokeObjectURL(url); }
    catch (_err){}
  };
  if(typeof queueMicrotask === 'function'){
    queueMicrotask(revoke);
  }else{
    Promise.resolve().then(revoke, () => {});
  }
  toast('CSV export ready');
}

function handleRowClick(event, lensState){
  const target = event.target instanceof Element ? event.target : null;
  if(!target) return;
  const link = target.closest('[data-role="open-record"], [data-role="contact-name"]');
  if(!link || !lensState.elements.table.contains(link)) return;
  event.preventDefault();
  if(link.getAttribute('data-role') === 'contact-name') return;
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
  if(typeof openContactModal !== 'function') return;
  try{
    openContactModal(id, { sourceHint: `workbench:${lensState.config.key}`, trigger: link });
  }catch (err){
    try{ console && console.warn && console.warn('[workbench] contact modal failed', err); }
    catch (_err){}
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
  checkbox.indeterminate = false;
  const rowData = gatherLensRowData(table);
  const visibleEntries = rowData.filter(entry => entry.visible && entry.id && entry.checkbox && !entry.disabled);
  const visibleIds = visibleEntries.map(entry => entry.id);
  if(!visibleIds.length){
    checkbox.indeterminate = false;
    checkbox.checked = false;
    try { checkbox.setAttribute('aria-checked', 'false'); }
    catch (_err){}
    syncSelectionForLens(lensState);
    return;
  }
  const current = store.get(scope);
  const next = current instanceof Set
    ? new Set(current)
    : new Set(Array.from(current || [], value => String(value)));
  if(checkbox.checked){
    visibleIds.forEach(id => next.add(id));
    try { checkbox.setAttribute('aria-checked', 'true'); }
    catch (_err){}
  }else{
    visibleIds.forEach(id => next.delete(id));
    try { checkbox.setAttribute('aria-checked', 'false'); }
    catch (_err){}
  }
  store.set(next, scope);
  syncSelectionForLens(lensState);
}

function handleRowCheckboxChange(event, lensState){
  const input = event.target;
  if(!(input instanceof HTMLInputElement)) return;
  if(input.getAttribute('data-role') !== 'select') return;
  if(input.getAttribute('data-ui') !== 'row-check') return;
  const id = input.getAttribute('data-id');
  if(!id) return;
  const store = getSelectionStore();
  if(!store) return;
  const scope = lensState.config.selectionScope;
  const current = store.get(scope);
  const next = current instanceof Set ? new Set(current) : new Set(Array.from(current || []));
  if(input.checked){
    next.add(id);
  }else{
    next.delete(id);
  }
  store.set(next, scope);
  syncSelectionForLens(lensState);
}

function buildWindow(lensState){
  const { config } = lensState;
  const section = document.createElement('section');
  section.className = 'card workbench-window';
  section.dataset.lens = config.key;

  const header = document.createElement('div');
  header.className = 'row workbench-window__header';

  const title = document.createElement('h3');
  title.textContent = config.label;
  title.className = 'workbench-window__title';
  header.appendChild(title);

  const count = document.createElement('span');
  count.className = 'workbench-window__count muted';
  header.appendChild(count);

  const spacer = document.createElement('div');
  spacer.className = 'grow';
  header.appendChild(spacer);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'btn';
  toggleBtn.setAttribute('aria-expanded', lensState.open ? 'true' : 'false');
  toggleBtn.textContent = lensState.open ? 'Hide' : 'Show';
  toggleBtn.setAttribute('aria-label', `Toggle ${config.label} window`);
  toggleBtn.title = lensState.open ? 'Hide results' : 'Show results';
  toggleBtn.addEventListener('click', () => {
    toggleWindow(lensState, !lensState.open);
  });
  header.appendChild(toggleBtn);

  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.className = 'btn brand';
  runBtn.textContent = 'Run';
  runBtn.setAttribute('aria-label', `Run ${config.label} query`);
  runBtn.title = 'Run query now';
  runBtn.addEventListener('click', () => {
    state.layout.lastActive = lensState.config.key;
    scheduleLayoutSave();
    runLensQuery(lensState, { refreshBase: true });
  });
  header.appendChild(runBtn);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn';
  saveBtn.textContent = 'Save Query';
  saveBtn.setAttribute('aria-label', 'Save this query configuration');
  saveBtn.title = 'Save this query';
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
  exportBtn.setAttribute('aria-label', 'Export visible rows to CSV');
  exportBtn.title = 'Export visible rows to CSV';
  exportBtn.addEventListener('click', () => handleExport(lensState));
  header.appendChild(exportBtn);

  section.appendChild(header);

  const body = document.createElement('div');
  body.className = 'workbench-window-body';
  body.hidden = !lensState.open;

  const controls = document.createElement('div');
  controls.className = 'workbench-controls';

  const filterRow = document.createElement('div');
  filterRow.className = 'row workbench-filter-row';

  const addFilterBtn = document.createElement('button');
  addFilterBtn.type = 'button';
  addFilterBtn.className = 'btn';
  addFilterBtn.textContent = 'Add Filter';
  addFilterBtn.setAttribute('aria-label', 'Add filter row');
  addFilterBtn.title = 'Add filter row';
  addFilterBtn.addEventListener('click', () => addFilter(lensState));
  filterRow.appendChild(addFilterBtn);

  const sortField = document.createElement('select');
  sortField.className = 'input';
  sortField.addEventListener('change', () => {
    const value = sortField.value;
    lensState.sort.field = value || '';
    clearActivePreset(lensState);
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
    clearActivePreset(lensState);
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
    clearActivePreset(lensState);
  });
  filterRow.appendChild(limitInput);

  controls.appendChild(filterRow);

  const filtersContainer = document.createElement('div');
  filtersContainer.className = 'workbench-filters';
  controls.appendChild(filtersContainer);

  body.appendChild(controls);

  const savedQueriesWrap = document.createElement('div');
  savedQueriesWrap.className = 'workbench-saved-queries-wrap';

  const savedHeader = document.createElement('strong');
  savedHeader.textContent = 'My Queries';
  savedQueriesWrap.appendChild(savedHeader);

  const savedList = document.createElement('div');
  savedList.className = 'workbench-saved-queries';
  savedQueriesWrap.appendChild(savedList);
  body.appendChild(savedQueriesWrap);

  const searchRow = document.createElement('div');
  searchRow.className = 'row workbench-search-row';

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
  status.className = 'workbench-status muted';
  searchRow.appendChild(status);

  body.appendChild(searchRow);

  const presetRow = document.createElement('div');
  presetRow.className = 'preset-chip-row workbench-preset-row';
  presetRow.hidden = true;
  body.appendChild(presetRow);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';
  if(tableWrap.dataset){
    tableWrap.dataset.tableLens = config.key || '';
  }

  const table = document.createElement('table');
  table.className = 'table list-table';
  table.classList.add('table-managed');
  table.setAttribute('data-selection-scope', config.selectionScope);
  table.setAttribute('data-table-role', config.key ? `workbench-${config.key}` : 'workbench');
  if(table.dataset){
    table.dataset.tableLens = config.key || '';
    table.dataset.tableManaged = '1';
  }

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.classList.add('status-row');

  const selectAllTh = document.createElement('th');
  selectAllTh.setAttribute('data-role', 'select');
  selectAllTh.dataset.compact = '1';
  selectAllTh.dataset.column = 'select';
  const selectAll = document.createElement('input');
  selectAll.type = 'checkbox';
  selectAll.setAttribute('data-role', 'select-all');
  selectAll.setAttribute('data-ui', 'row-check-all');
  selectAll.setAttribute('aria-label', 'Select all');
  selectAll.setAttribute('role', 'checkbox');
  selectAll.setAttribute('aria-checked', 'false');
  selectAll.addEventListener('change', (event) => handleSelectAllChange(event, lensState));
  selectAllTh.appendChild(selectAll);
  headerRow.appendChild(selectAllTh);

  config.columns.forEach((column) => {
    const th = document.createElement('th');
    th.textContent = column.label;
    if(th.dataset){
      th.dataset.field = column.field || '';
      th.dataset.wrap = column.isName ? '1' : '0';
      th.dataset.column = column.isName ? 'name' : (column.field || '');
    }
    if(column.type === 'number'){
      th.classList.add('numeric');
    }
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => handleHeaderSort(lensState, column.field));
    headerRow.appendChild(th);
  });

  const gutterTh = document.createElement('th');
  gutterTh.setAttribute('data-role', 'gutter');
  gutterTh.setAttribute('aria-hidden', 'true');
  gutterTh.tabIndex = -1;
  gutterTh.dataset.compact = '1';
  gutterTh.dataset.column = 'gutter';
  headerRow.appendChild(gutterTh);

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  body.appendChild(tableWrap);

  if(typeof window !== 'undefined' && typeof window.ensureRowCheckHeaders === 'function'){
    try { window.ensureRowCheckHeaders(table); }
    catch (_err) {}
  }

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
    presetChips: presetRow,
    status,
    tableWrap,
    table,
    thead,
    tbody
  };

  lensState.statusBanner = attachStatusBanner(status, { tone: 'muted' });
  renderPresetChips(lensState);

  table.addEventListener('click', (event) => handleRowClick(event, lensState));
  table.addEventListener('change', (event) => handleRowCheckboxChange(event, lensState));

  return section;
}

function buildShell(){
  const root = state.root;
  if(!root) return;
  root.innerHTML = '';
  root.classList.add('workbench-shell');
  const legendDoc = root.ownerDocument || document;
  const legend = createLegendPopover({
    document: legendDoc,
    id: 'workbench-stage-legend',
    summaryLabel: 'Legend',
    summaryAriaLabel: 'Workbench color legend',
    title: 'Stage colors',
    entries: STAGE_LEGEND_ENTRIES,
    note: 'Row highlights reuse the same pipeline stage colors and status pills share these tones.'
  });
  if(legend){
    const wrap = legendDoc.createElement('div');
    wrap.className = 'legend-inline-row';
    wrap.appendChild(legend);
    root.appendChild(wrap);
  }
  ensureLensStates();
  state.lensStates.forEach((lensState) => {
    const section = buildWindow(lensState);
    root.appendChild(section);
  });
}

function restoreLensDrafts(){
  state.lensStates.forEach((lensState) => {
    if(!lensState || lensState.restoredDraft) return;
    const draft = state.lensDrafts.get(lensState.config.key);
    lensState.restoredDraft = true;
    if(!draft) return;
    lensState.savedQueryId = null;
    lensState.activePreset = '';
    assignLensStateFromQuery(lensState, draft);
  });
}

function syncUI(){
  state.lensStates.forEach((lensState) => {
    renderFilterRows(lensState);
    syncSortControls(lensState);
    syncLimitControl(lensState);
    syncSearchControl(lensState);
    renderSavedQueryList(lensState);
    renderPresetChips(lensState);
    updateCounts(lensState);
    updateStatusMessage(lensState);
    if(!lensState.open){
      lensState.elements.body.hidden = true;
      lensState.elements.toggle.setAttribute('aria-expanded', 'false');
      lensState.elements.toggle.textContent = 'Show';
    }
  });
}

function reportListsSummary(){
  if(typeof document === 'undefined' || typeof console === 'undefined') return;
  try{
    const doc = document;
    const chips = doc.querySelectorAll('[data-qa="preset-filter"]').length;
    const bulkActions = ['followup', 'logcall'].every((key) => doc.querySelector(`[data-qa="bulk-${key}"]`));
    console.log('LISTS_SUMMARY', { chips, bulkActions, emptyBanner: !!doc.querySelector('[data-qa="empty-state"]') });
  }catch (_err){}
}

async function setupWorkbench(target){
  const mount = ensureMount(target);
  if(!mount) return;
  await Promise.all([loadLayout(), loadSavedQueries(), loadLensDrafts()]);
  ensureLensStates();
  buildShell();
  restoreLensDrafts();
  syncUI();
  reportListsSummary();
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
  reportListsSummary();
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
  const viewService = createWorkbenchViewService();
  const existingViews = window.WorkbenchViews && typeof window.WorkbenchViews === 'object'
    ? window.WorkbenchViews
    : {};
  window.WorkbenchViews = { ...existingViews, ...viewService };
  window.workbenchExportCsv = createWorkbenchExportApi();
  window.workbenchSimulateLargeFilter = createWorkbenchSimulateLargeFilter();
}

export default {
  initWorkbench,
  renderWorkbench
};
