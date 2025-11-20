const __FALLBACK_FAVORITES__ = (() => {
  function normalizeFavoriteId(value){
    if(value == null) return '';
    return String(value).trim();
  }
  function normalizeFavoriteList(input){
    const list = Array.isArray(input) ? input : [];
    const seen = new Set();
    const next = [];
    for(let i = 0; i < list.length; i += 1){
      const id = normalizeFavoriteId(list[i]);
      if(!id || seen.has(id)) continue;
      seen.add(id);
      next.push(id);
    }
    return next;
  }
  function normalizeFavoriteSnapshot(snapshot){
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
      contacts: normalizeFavoriteList(source.contacts),
      partners: normalizeFavoriteList(source.partners)
    };
  }
  function applyFavoriteSnapshot(snapshot){
    return normalizeFavoriteSnapshot(snapshot);
  }
  return { normalizeFavoriteSnapshot, applyFavoriteSnapshot };
})();

const __FAVORITES_API__ = (typeof window !== 'undefined' && window.__CRM_FAVORITES__)
  ? window.__CRM_FAVORITES__
  : __FALLBACK_FAVORITES__;

const { normalizeFavoriteSnapshot, applyFavoriteSnapshot } = __FAVORITES_API__;

const EMAIL_FROM_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const TZ_FALLBACK_PATTERN = /^[A-Za-z0-9_.+-]+(?:\/[A-Za-z0-9_.+-]+)*$/;

const DASHBOARD_WIDGET_DOM_IDS = {
  focus: 'dashboard-focus',
  filters: 'dashboard-filters',
  kpis: 'dashboard-kpis',
  pipeline: 'dashboard-pipeline-overview',
  today: 'dashboard-today',
  leaderboard: 'referral-leaderboard',
  stale: 'dashboard-stale',
  favorites: 'favorites-card',
  goalProgress: 'goal-progress-card',
  numbersPortfolio: 'numbers-portfolio-card',
  numbersReferrals: 'numbers-referrals-card',
  numbersMomentum: 'numbers-momentum-card',
  pipelineCalendar: 'pipeline-calendar-card',
  priorityActions: 'priority-actions-card',
  milestones: 'milestones-card',
  docPulse: 'doc-pulse-card',
  relationshipOpportunities: 'rel-opps-card',
  clientCareRadar: 'nurture-card',
  closingWatch: 'closing-watch-card',
  upcomingCelebrations: 'dashboard-celebrations',
  docCenter: 'doc-center-card',
  statusStack: 'dashboard-status-stack'
};

const DASHBOARD_WIDGET_ORDER = Object.keys(DASHBOARD_WIDGET_DOM_IDS);
const DASHBOARD_WIDGET_KEY_SET = (() => {
  const set = new Set();
  DASHBOARD_WIDGET_ORDER.forEach(key => {
    const str = String(key);
    set.add(str);
    set.add(str.toLowerCase());
  });
  return set;
})();
const DASHBOARD_WIDGET_ID_MAP = (() => {
  const map = new Map();
  Object.entries(DASHBOARD_WIDGET_DOM_IDS).forEach(([key, id]) => {
    if(typeof id === 'string'){
      map.set(id.toLowerCase(), key);
      map.set((id || '').trim(), key);
    }
  });
  return map;
})();
const DASHBOARD_LAYOUT_MIN_COLUMNS = 3;
const DASHBOARD_LAYOUT_MAX_COLUMNS = 4;

const DASHBOARD_GRAPH_KEYS = ['goalProgress', 'numbersPortfolio', 'numbersMomentum', 'pipelineCalendar'];
const DASHBOARD_WIDGET_CARD_KEYS = [
  'priorityActions',
  'milestones',
  'docPulse',
  'relationshipOpportunities',
  'clientCareRadar',
  'closingWatch'
];
const DASHBOARD_KPI_KEYS = [
  'kpiNewLeads7d',
  'kpiActivePipeline',
  'kpiFundedYTD',
  'kpiFundedVolumeYTD',
  'kpiAvgCycleLeadToFunded',
  'kpiTasksToday',
  'kpiTasksOverdue',
  'kpiReferralsYTD'
];

function cloneGeneralDefaults(){
  return {
    timezone: '',
    workHours: { start: null, end: null },
    email: { from: '' },
    notifications: { enabled: null }
  };
}

function cloneSimpleModeDefaults(){
  return {
    showLoanDetails: false,
    showRelationshipDetails: false,
    showAddress: false,
    showProfileExtras: false,
    showEngagement: false
  };
}

function coerceHourValue(value){
  if(typeof value === 'number' && Number.isFinite(value)){
    return Math.trunc(value);
  }
  if(typeof value === 'string'){
    const trimmed = value.trim();
    if(trimmed === '') return null;
    const numeric = Number(trimmed);
    if(Number.isFinite(numeric)){
      return Math.trunc(numeric);
    }
    return trimmed;
  }
  return value == null ? null : value;
}

function coerceBooleanLike(value){
  if(typeof value === 'boolean') return value;
  if(typeof value === 'string'){
    const normalized = value.trim().toLowerCase();
    if(normalized === 'true') return true;
    if(normalized === 'false') return false;
  }
  if(typeof value === 'number'){
    if(value === 1) return true;
    if(value === 0) return false;
  }
  return value;
}

function toTrimmedString(value){
  if(typeof value === 'string') return value.trim();
  if(value == null) return '';
  return String(value).trim();
}

function extractGeneralSettings(source){
  const defaults = cloneGeneralDefaults();
  if(!source || typeof source !== 'object'){
    return defaults;
  }
  if(Object.prototype.hasOwnProperty.call(source, 'timezone')){
    defaults.timezone = toTrimmedString(source.timezone);
  }
  const workHours = source.workHours && typeof source.workHours === 'object' ? source.workHours : {};
  if(Object.prototype.hasOwnProperty.call(workHours, 'start')){
    defaults.workHours.start = coerceHourValue(workHours.start);
  }
  if(Object.prototype.hasOwnProperty.call(workHours, 'end')){
    defaults.workHours.end = coerceHourValue(workHours.end);
  }
  const email = source.email && typeof source.email === 'object' ? source.email : {};
  if(Object.prototype.hasOwnProperty.call(email, 'from')){
    defaults.email.from = toTrimmedString(email.from);
  }
  const notifications = source.notifications && typeof source.notifications === 'object' ? source.notifications : {};
  if(Object.prototype.hasOwnProperty.call(notifications, 'enabled')){
    defaults.notifications.enabled = coerceBooleanLike(notifications.enabled);
  }
  return defaults;
}

function extractSimpleModeSettings(source){
  const defaults = cloneSimpleModeDefaults();
  if(!source || typeof source !== 'object') return defaults;
  const simple = source.simpleMode && typeof source.simpleMode === 'object' ? source.simpleMode : {};
  if(Object.prototype.hasOwnProperty.call(simple, 'showProfileExtras')){
    defaults.showProfileExtras = coerceBooleanLike(simple.showProfileExtras) === true;
  }
  if(Object.prototype.hasOwnProperty.call(simple, 'showLoanDetails')){
    defaults.showLoanDetails = coerceBooleanLike(simple.showLoanDetails) === true;
  }
  if(Object.prototype.hasOwnProperty.call(simple, 'showRelationshipDetails')){
    defaults.showRelationshipDetails = coerceBooleanLike(simple.showRelationshipDetails) === true;
  }
  if(Object.prototype.hasOwnProperty.call(simple, 'showAddress')){
    defaults.showAddress = coerceBooleanLike(simple.showAddress) === true;
  }
  if(Object.prototype.hasOwnProperty.call(simple, 'showEngagement')){
    defaults.showEngagement = coerceBooleanLike(simple.showEngagement) === true;
  }
  return defaults;
}

function normalizeUiMode(value){
  return value === 'simple' ? 'simple' : 'advanced';
}

function isValidTimeZone(value){
  if(typeof value !== 'string' || !value){
    return false;
  }
  try{
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  }catch (_err){
    return TZ_FALLBACK_PATTERN.test(value);
  }
}

export function validateSettings(settings){
  const general = extractGeneralSettings(settings);
  const errors = [];

  const timezone = general.timezone;
  if(!timezone){
    errors.push({ path: 'timezone', reason: 'Timezone is required' });
  }else if(!isValidTimeZone(timezone)){
    errors.push({ path: 'timezone', reason: 'Timezone must be a valid IANA identifier' });
  }

  const startHour = general.workHours.start;
  if(!Number.isInteger(startHour) || startHour < 0 || startHour > 23){
    errors.push({ path: 'workHours.start', reason: 'Start hour must be an integer between 0 and 23' });
  }

  const endHour = general.workHours.end;
  if(!Number.isInteger(endHour) || endHour < 0 || endHour > 23){
    errors.push({ path: 'workHours.end', reason: 'End hour must be an integer between 0 and 23' });
  }else if(Number.isInteger(startHour) && startHour >= endHour){
    errors.push({ path: 'workHours.end', reason: 'End hour must be greater than start hour' });
  }

  const emailFrom = general.email.from;
  if(!emailFrom){
    errors.push({ path: 'email.from', reason: 'From address is required' });
  }else if(!EMAIL_FROM_PATTERN.test(emailFrom)){
    errors.push({ path: 'email.from', reason: 'From address must be a valid email' });
  }

  const notificationsEnabled = general.notifications.enabled;
  if(typeof notificationsEnabled !== 'boolean'){
    errors.push({ path: 'notifications.enabled', reason: 'Enabled must be true or false' });
  }

  const simpleMode = extractSimpleModeSettings(settings);
  if(typeof simpleMode.showLoanDetails !== 'boolean'){
    errors.push({ path: 'simpleMode.showLoanDetails', reason: 'Value must be true or false' });
  }
  if(typeof simpleMode.showRelationshipDetails !== 'boolean'){
    errors.push({ path: 'simpleMode.showRelationshipDetails', reason: 'Value must be true or false' });
  }
  if(typeof simpleMode.showAddress !== 'boolean'){
    errors.push({ path: 'simpleMode.showAddress', reason: 'Value must be true or false' });
  }
  if(typeof simpleMode.showProfileExtras !== 'boolean'){
    errors.push({ path: 'simpleMode.showProfileExtras', reason: 'Value must be true or false' });
  }
  if(typeof simpleMode.showEngagement !== 'boolean'){
    errors.push({ path: 'simpleMode.showEngagement', reason: 'Value must be true or false' });
  }

  return { ok: errors.length === 0, errors };
}

function applyGeneralSettingsCoercion(target){
  if(!target || typeof target !== 'object') return target;
  const general = extractGeneralSettings(target);
  target.timezone = general.timezone;
  target.workHours = general.workHours;
  target.email = general.email;
  target.notifications = general.notifications;
  target.simpleMode = extractSimpleModeSettings(target);
  return target;
}

function shouldValidateGeneral(partial){
  if(!partial || typeof partial !== 'object') return false;
  if(Object.prototype.hasOwnProperty.call(partial, 'timezone')) return true;
  if(Object.prototype.hasOwnProperty.call(partial, 'workHours')) return true;
  if(Object.prototype.hasOwnProperty.call(partial, 'email')) return true;
  if(Object.prototype.hasOwnProperty.call(partial, 'notifications')) return true;
  if(Object.prototype.hasOwnProperty.call(partial, 'simpleMode')) return true;
  return false;
}

(function(){
  if(window.Settings && typeof window.Settings.get === 'function') return;

  const STORE = 'settings';
  const RECORD_ID = 'app:settings';
  const PROFILE_KEY = 'profile:v1';
  const SIGNATURE_KEY = 'signature:v1';

  let cache = null;
  let inflight = null;

  function clone(data){
    if(data == null) return data;
    const cloned = JSON.parse(JSON.stringify(data));
    if(cloned && cloned.loProfile && !cloned.profile){
      cloned.profile = cloned.loProfile;
    }
    return cloned;
  }

  function idFactory(){
    try{ if(window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID(); }
    catch (_err) {}
    return 'sig-' + Math.random().toString(36).slice(2, 12);
  }

  function normalizeGoals(input){
    const source = input && typeof input === 'object' ? input : {};
    const monthlyFundedGoal = Math.max(0, Number(source.monthlyFundedGoal || source.funded || 0) || 0);
    const monthlyVolumeGoal = Math.max(0, Number(source.monthlyVolumeGoal || source.volume || 0) || 0);
    const updatedAt = source.updatedAt || (monthlyFundedGoal || monthlyVolumeGoal ? new Date().toISOString() : null);
    return { monthlyFundedGoal, monthlyVolumeGoal, updatedAt };
  }

  function normalizeSignature(input){
    if(typeof input === 'string'){
      const body = String(input);
      const rowId = idFactory();
      return {
        items: body ? [{ id: rowId, title: 'Default', body, updatedAt: Date.now() }] : [],
        defaultId: body ? rowId : null,
        text: body
      };
    }
    const itemsRaw = Array.isArray(input && input.items) ? input.items : [];
    const items = itemsRaw.map(row => ({
      id: String(row && row.id ? row.id : idFactory()),
      title: String(row && row.title != null ? row.title : ''),
      body: String(row && row.body != null ? row.body : ''),
      updatedAt: row && row.updatedAt ? row.updatedAt : Date.now()
    })).filter(row => row.title || row.body);
    let defaultId = items.length ? items[0].id : null;
    if(input && input.defaultId && items.some(row => row.id === input.defaultId)){
      defaultId = input.defaultId;
    }
    const text = defaultId ? (items.find(row => row.id === defaultId)?.body || '') : '';
    return { items, defaultId, text };
  }

  function mergeSignatureWithLocal(signature, localRaw){
    const body = typeof localRaw === 'string' ? localRaw : '';
    if(!body) return signature;
    const base = signature && typeof signature === 'object' ? signature : { items: [], defaultId: null, text: '' };
    const items = Array.isArray(base.items) ? base.items.map(row => Object.assign({}, row)) : [];
    if(!items.length){
      return normalizeSignature(body);
    }
    let defaultId = base.defaultId;
    if(!defaultId || !items.some(row => row.id === defaultId)){
      defaultId = items.length ? items[0].id : null;
    }
    if(!defaultId){
      return normalizeSignature(body);
    }
    const index = items.findIndex(row => row.id === defaultId);
    if(index === -1){
      return normalizeSignature(body);
    }
    if(items[index].body !== body){
      items[index] = Object.assign({}, items[index], { body, updatedAt: Date.now() });
    }
    return { items, defaultId, text: body };
  }

  function normalizeProfile(input){
    const source = input && typeof input === 'object' ? input : {};
    return {
      name: String(source.name || ''),
      email: String(source.email || ''),
      phone: String(source.phone || ''),
      signature: String(source.signature || ''),
      photoDataUrl: typeof source.photoDataUrl === 'string' ? source.photoDataUrl : ''
    };
  }

  function buildDefaultToggleMap(keys){
    const map = {};
    keys.forEach(key => {
      map[key] = true;
    });
    return map;
  }

  function normalizeDashboard(input){
    const widgetDefaults = buildDefaultToggleMap(DASHBOARD_WIDGET_ORDER);
    widgetDefaults.pipeline = false;
    widgetDefaults.leaderboard = false;
    widgetDefaults.stale = false;
    const defaults = {
      mode: 'today',
      widgets: widgetDefaults,
      graphs: buildDefaultToggleMap(DASHBOARD_GRAPH_KEYS),
      widgetCards: buildDefaultToggleMap(DASHBOARD_WIDGET_CARD_KEYS),
      kpis: buildDefaultToggleMap(DASHBOARD_KPI_KEYS),
      layout: { columns: DASHBOARD_LAYOUT_MIN_COLUMNS, widths: {} }
    };
    const source = input && typeof input === 'object' ? input : {};
    const widgetsSource = source.widgets && typeof source.widgets === 'object' ? source.widgets : {};
    const graphSource = source.graphs && typeof source.graphs === 'object' ? source.graphs : {};
    const widgetCardSource = source.widgetCards && typeof source.widgetCards === 'object' ? source.widgetCards : {};
    const kpiSource = source.kpis && typeof source.kpis === 'object' ? source.kpis : {};
    const widgets = Object.assign({}, defaults.widgets);
    if(typeof widgetsSource.insights === 'boolean'){
      const value = widgetsSource.insights;
      ['goalProgress','numbersPortfolio','numbersReferrals','numbersMomentum','pipelineCalendar','priorityActions','milestones','docPulse'].forEach(key => {
        if(typeof widgetsSource[key] !== 'boolean') widgets[key] = value;
      });
    }
    if(typeof widgetsSource.opportunities === 'boolean'){
      const value = widgetsSource.opportunities;
      ['relationshipOpportunities','clientCareRadar','closingWatch'].forEach(key => {
        if(typeof widgetsSource[key] !== 'boolean') widgets[key] = value;
      });
    }
    Object.keys(widgets).forEach(key => {
      if(typeof widgetsSource[key] === 'boolean') widgets[key] = widgetsSource[key];
    });
    if(typeof widgetsSource.numbersGlance === 'boolean'){
      const legacyValue = widgetsSource.numbersGlance;
      ['numbersPortfolio','numbersReferrals','numbersMomentum'].forEach(key => {
        if(typeof widgetsSource[key] !== 'boolean') widgets[key] = legacyValue;
      });
    }
    const graphs = Object.assign({}, defaults.graphs);
    Object.keys(graphs).forEach(key => {
      if(typeof graphSource[key] === 'boolean') graphs[key] = graphSource[key];
    });
    if(typeof graphSource.numbersGlance === 'boolean'){
      const legacyValue = graphSource.numbersGlance;
      ['numbersPortfolio','numbersMomentum'].forEach(key => {
        if(typeof graphSource[key] !== 'boolean') graphs[key] = legacyValue;
      });
    }
    const widgetCards = Object.assign({}, defaults.widgetCards);
    Object.keys(widgetCards).forEach(key => {
      if(typeof widgetCardSource[key] === 'boolean') widgetCards[key] = widgetCardSource[key];
    });
    const kpis = Object.assign({}, defaults.kpis);
    Object.keys(kpis).forEach(key => {
      if(typeof kpiSource[key] === 'boolean') kpis[key] = kpiSource[key];
    });
    const layoutSource = source.layout && typeof source.layout === 'object' ? source.layout : {};
    let layoutColumns = defaults.layout.columns;
    if(Object.prototype.hasOwnProperty.call(layoutSource, 'columns')){
      const numeric = Number(layoutSource.columns);
      if(Number.isFinite(numeric)){
        const rounded = Math.round(numeric);
        layoutColumns = Math.min(DASHBOARD_LAYOUT_MAX_COLUMNS, Math.max(DASHBOARD_LAYOUT_MIN_COLUMNS, rounded));
      }
    }
    const widthSource = layoutSource && typeof layoutSource.widths === 'object' ? layoutSource.widths : {};
    const widthMap = {};
    const allowedWidths = ['third','half','twoThird','full'];
    Object.keys(widthSource).forEach(key => {
      const normalizedKey = key == null ? '' : String(key).trim();
      if(!normalizedKey) return;
      const raw = widthSource[key];
      const text = typeof raw === 'string' ? raw.trim() : '';
      if(!text) return;
      const lower = text.toLowerCase();
      const match = allowedWidths.includes(text) ? text : (allowedWidths.includes(lower) ? lower : '');
      if(match) {
        widthMap[normalizedKey] = match;
      }
    });
    const mode = source.mode === 'all' ? 'all' : 'today';
    return { mode, widgets, graphs, widgetCards, kpis, layout: { columns: layoutColumns, widths: widthMap } };
  }

  function normalizeDashboardOrder(input){
    const source = Array.isArray(input) ? input : [];
    const next = [];
    const seen = new Set();
    source.forEach(entry => {
      if(entry == null) return;
      const str = String(entry).trim();
      if(!str) return;
      const lower = str.toLowerCase();
      let key = null;
      if(DASHBOARD_WIDGET_KEY_SET.has(lower)){
        key = lower;
      }else if(DASHBOARD_WIDGET_ID_MAP.has(lower)){
        key = DASHBOARD_WIDGET_ID_MAP.get(lower);
      }else{
        const normalized = lower.replace(/[^a-z0-9]+/g, '');
        if(normalized === 'numbersglance' || normalized === 'numbersglancecard'){
          ['numbersPortfolio','numbersReferrals','numbersMomentum'].forEach(legacyKey => {
            if(seen.has(legacyKey)) return;
            seen.add(legacyKey);
            next.push(legacyKey);
          });
          return;
        }
      }
      if(key && !seen.has(key)){
        seen.add(key);
        next.push(key);
      }
    });
    DASHBOARD_WIDGET_ORDER.forEach(key => {
      if(!seen.has(key)){
        seen.add(key);
        next.push(key);
      }
    });
    return next;
  }

  function normalize(raw){
    const base = raw && typeof raw === 'object' ? raw : {};
    const profileSource = base && base.loProfile !== undefined ? base.loProfile : base.profile;
    const normalized = {
      goals: normalizeGoals(base.goals),
      signature: normalizeSignature(base.signature),
      loProfile: normalizeProfile(profileSource),
      dashboard: normalizeDashboard(base.dashboard),
      favorites: normalizeFavoriteSnapshot(base.favorites),
      dashboardOrder: normalizeDashboardOrder(base.dashboardOrder),
      updatedAt: base.updatedAt || null,
      uiMode: normalizeUiMode(base.uiMode)
    };
    const general = extractGeneralSettings(base);
    normalized.timezone = general.timezone;
    normalized.workHours = general.workHours;
    normalized.email = general.email;
    normalized.notifications = general.notifications;
    normalized.simpleMode = extractSimpleModeSettings(base);
    return normalized;
  }

  function updateSignatureCache(signature){
    const payload = {
      items: signature.items.map(row => ({ id: row.id, title: row.title, body: row.body })),
      defaultId: signature.defaultId || null,
      text: signature.text || ''
    };
    window.__SIGNATURE_CACHE__ = payload;
  }

  function updateProfileCache(profile){
    window.__LO_PROFILE__ = Object.assign({}, profile);
  }

  function readProfileLocal(){
    try{
      const raw = localStorage.getItem(PROFILE_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    }catch (_err) { return null; }
  }

  function writeProfileLocal(profile){
    try{
      if(profile){
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      }else{
        localStorage.removeItem(PROFILE_KEY);
      }
    }catch (_err) { /* noop */ }
  }

  function readSignatureLocal(){
    try{
      const raw = localStorage.getItem(SIGNATURE_KEY);
      return typeof raw === 'string' ? raw : '';
    }catch (_err) { return ''; }
  }

  function writeSignatureLocal(value){
    try{
      if(value){
        localStorage.setItem(SIGNATURE_KEY, String(value));
      }else{
        localStorage.removeItem(SIGNATURE_KEY);
      }
    }catch (_err) { /* noop */ }
  }

  async function ensureDb(){
    if(typeof window.openDB === 'function'){
      await window.openDB();
    }
  }

  async function readRecord(){
    await ensureDb();
    if(typeof window.dbGet !== 'function') return null;
    try{ return await window.dbGet(STORE, RECORD_ID); }
    catch (_err) { return null; }
  }

  async function writeRecord(data){
    await ensureDb();
    if(typeof window.dbPut !== 'function') return;
    const payload = Object.assign({ id: RECORD_ID }, data, { updatedAt: Date.now() });
    await window.dbPut(STORE, payload);
  }

  async function load(){
    if(cache) return clone(cache);
    if(inflight) return clone(await inflight);
    inflight = (async ()=>{
      const raw = await readRecord();
      const normalized = normalize(raw);
      const profileLocal = readProfileLocal();
      if(profileLocal){
        normalized.loProfile = normalizeProfile(Object.assign({}, normalized.loProfile, profileLocal));
      }
      const signatureLocal = readSignatureLocal();
      if(signatureLocal){
        normalized.signature = mergeSignatureWithLocal(normalized.signature, signatureLocal);
      }
      cache = normalized;
      updateSignatureCache(normalized.signature);
      updateProfileCache(normalized.loProfile);
      applyFavoriteSnapshot(normalized.favorites);
      inflight = null;
      return normalized;
    })();
    const result = await inflight;
    return clone(result);
  }

  function mergeSettings(current, partial){
    const next = clone(current);
    const source = partial && typeof partial === 'object' ? partial : {};
    if(source.goals){
      next.goals = normalizeGoals(Object.assign({}, current.goals, source.goals));
    }
    if(source.signature){
      next.signature = normalizeSignature(source.signature);
    }
    if(source.loProfile){
      next.loProfile = normalizeProfile(Object.assign({}, current.loProfile, source.loProfile));
    }
    else if(source.profile){
      next.loProfile = normalizeProfile(Object.assign({}, current.loProfile, source.profile));
    }
    if(source.dashboard){
      const merged = Object.assign({}, current.dashboard, source.dashboard);
      merged.widgets = Object.assign({}, current.dashboard.widgets || {}, source.dashboard.widgets || {});
      merged.graphs = Object.assign({}, current.dashboard.graphs || {}, source.dashboard.graphs || {});
      merged.widgetCards = Object.assign({}, current.dashboard.widgetCards || {}, source.dashboard.widgetCards || {});
      merged.kpis = Object.assign({}, current.dashboard.kpis || {}, source.dashboard.kpis || {});
      merged.layout = Object.assign({}, current.dashboard.layout || {}, source.dashboard.layout || {});
      next.dashboard = normalizeDashboard(merged);
    }
    if(source.dashboardOrder){
      next.dashboardOrder = normalizeDashboardOrder(source.dashboardOrder);
    }
    if(source.favorites){
      const currentFavorites = current.favorites || { contacts: [], partners: [] };
      const mergedFavorites = {
        contacts: Array.isArray(source.favorites.contacts) ? source.favorites.contacts : currentFavorites.contacts,
        partners: Array.isArray(source.favorites.partners) ? source.favorites.partners : currentFavorites.partners
      };
      next.favorites = normalizeFavoriteSnapshot(mergedFavorites);
    }
    if(Object.prototype.hasOwnProperty.call(source, 'simpleMode')){
      const mergedSimple = Object.assign({}, current.simpleMode || {}, source.simpleMode || {});
      next.simpleMode = extractSimpleModeSettings({ simpleMode: mergedSimple });
    }
    if(Object.prototype.hasOwnProperty.call(source, 'uiMode')){
      next.uiMode = normalizeUiMode(source.uiMode);
    }
    for(const key of Object.keys(source)){
      if(key === 'goals' || key === 'signature' || key === 'loProfile') continue;
      if(key === 'dashboard') continue;
      if(key === 'dashboardOrder') continue;
      if(key === 'favorites') continue;
      next[key] = source[key];
    }
    if('profile' in next) delete next.profile;
    return next;
  }

  async function save(partial, options){
    const opts = options && typeof options === 'object' ? options : {};
    const current = await load();
    const next = mergeSettings(current, partial);
    applyGeneralSettingsCoercion(next);
    if(shouldValidateGeneral(partial)){
      const validation = validateSettings(next);
      if(!validation.ok){
        if(window.Toast && typeof window.Toast.show === 'function'){
          try{
            const first = validation.errors && validation.errors[0];
            const path = first && first.path ? first.path : 'invalid field';
            window.Toast.show('Settings validation: ' + path);
          }catch (err){
            if(console && console.warn) console.warn('[settings] validation toast failed', err);
          }
        }
        return false;
      }
    }
    cache = next;
    applyFavoriteSnapshot(next.favorites);
    if(partial && typeof partial.loProfile === 'object'){
      writeProfileLocal(normalizeProfile(partial.loProfile));
    }else if(partial && typeof partial.profile === 'object'){
      writeProfileLocal(normalizeProfile(partial.profile));
    }
    if(partial && partial.signature){
      const normalizedSignature = normalizeSignature(partial.signature);
      const text = normalizedSignature.text || '';
      writeSignatureLocal(text);
    }
    await writeRecord(next);
    updateSignatureCache(next.signature);
    updateProfileCache(next.loProfile);
    const detail = { scope: 'settings', settings: clone(next), uiMode: next.uiMode };
    if(typeof window.dispatchAppDataChanged === 'function'){
      window.dispatchAppDataChanged(detail);
    }else if(window.document && typeof window.document.dispatchEvent === 'function'){
      window.document.dispatchEvent(new CustomEvent('app:data:changed', { detail }));
    }
    try{
      const settingsDetail = { scope: 'uiMode', uiMode: next.uiMode, settings: clone(next) };
      window.document?.dispatchEvent?.(new CustomEvent('app:settings:changed', { detail: settingsDetail }));
    }catch (_err){}
    if(!opts.silent && window.Toast && typeof window.Toast.show === 'function'){
      window.Toast.show('Saved');
    }
    return clone(next);
  }

  async function persistDashboardOrderOnly(orderLike){
    const normalized = normalizeDashboardOrder(orderLike);
    if(cache && Array.isArray(cache.dashboardOrder)){
      const sameLength = normalized.length === cache.dashboardOrder.length;
      const matches = sameLength && normalized.every((value, index) => cache.dashboardOrder[index] === value);
      if(matches){
        return clone(cache);
      }
    }
    return save({ dashboardOrder: normalized }, { silent: true });
  }

  async function refresh(){
    cache = null;
    return load();
  }

  async function clearAllStores(){
    if(typeof window.openDB === 'function'){
      try{ await window.openDB(); }
      catch (_err) {}
    }

    // FIX: Use DB_META if available, but fallback to a hardcoded COMPLETE list
    // This ensures we wipe 'templates', 'notifications', 'relationships', etc.
    const FALLBACK_STORES = ['contacts', 'partners', 'settings', 'tasks', 'documents', 'deals', 'commissions', 'meta', 'templates', 'notifications', 'docs', 'closings', 'relationships', 'savedViews'];

    const targetStores = (window.DB_META && Array.isArray(window.DB_META.STORES))
      ? window.DB_META.STORES
      : FALLBACK_STORES;

    if(typeof window.dbClear === 'function'){
      for(const store of targetStores){
        try{ await window.dbClear(store); }
        catch (err) { if(console && console.warn) console.warn('[settings] dbClear failed', store, err); }
      }
    }

    // FIX: Force seed data to re-run on next boot
    try {
      if (window.dbDelete) await window.dbDelete('meta', 'seed:inline:bootstrap');
    } catch(e){}
  }

  async function handleDeleteAll(){
    if(!confirm('PERMANENTLY DELETE ALL DATA?')) return;

    // 1. Wipe DB
    if(typeof window.openDB === 'function') await window.openDB();
    const STORES = ['contacts','partners','settings','tasks','documents','deals','commissions','meta','templates','notifications','docs','closings','relationships','savedViews'];

    if(typeof window.dbClear === 'function'){
        for(const s of STORES) { try{ await window.dbClear(s); } catch(e){} }
    }

    // 2. Clear Flags & Storage
    try { if (window.dbDelete) await window.dbDelete('meta', 'seed:inline:bootstrap'); } catch(e){}
    localStorage.clear();
    sessionStorage.clear();

    // 3. HARD RELOAD
    if(window.toast) window.toast('Wiped. Reloading...');
    setTimeout(() => window.location.reload(), 500);
  }

  function wireDeleteAll(){
    if(typeof document === 'undefined') return;
    const btn = document.getElementById('btn-delete-all');
    if(!btn || btn.__wired) return;
    btn.__wired = true;
    btn.addEventListener('click', (evt)=>{
      evt.preventDefault();
      handleDeleteAll();
    });
  }

  function hideCardByHeading(text){
    if(typeof document === 'undefined') return;
    const cards = Array.from(document.querySelectorAll('.settings-panel[data-panel="general"] .card'));
    const target = typeof text === 'string' ? text.trim().toLowerCase() : '';
    if(!target) return;
    const card = cards.find(c => c.querySelector('h3')?.textContent?.trim().toLowerCase() === target);
    if(card) card.style.display = 'none';
  }

  function moveDeleteAll(){
    if(typeof document === 'undefined') return;
    const btn = document.getElementById('btn-delete-all');
    const container = document.getElementById('local-utilities-card');
    if(!btn || !container || btn.__moved) return;
    btn.__moved = true;
    const dangerZone = document.createElement('section');
    dangerZone.className = 'utility-block';
    dangerZone.innerHTML = `<h4>Danger Zone</h4><p class="muted fine-print">Delete all local data (irreversible).</p>`;
    dangerZone.appendChild(btn);
    const grid = container.querySelector('.local-utilities-grid');
    if(grid){
      grid.appendChild(dangerZone);
    }else{
      container.appendChild(dangerZone);
    }
  }

  function initSettingsUX(){
    function run(){
      hideCardByHeading('maintenance');
      hideCardByHeading('qa panel');
      const stale = document.getElementById('settings-preferences-stale');
      if(stale) stale.style.display = 'none';
      moveDeleteAll();
      wireDeleteAll();
    }
    if(typeof document === 'undefined') return;
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', run, { once: true });
    }else{
      run();
    }
    window.RenderGuard?.registerHook?.(run);
  }

  if(typeof document !== 'undefined'){
    initSettingsUX();
    wireDeleteAll();
  }

  window.CRM = window.CRM || {};
  window.CRM.validateSettings = validateSettings;

  window.Settings = {
    get: load,
    save,
    refresh,
    deleteAll: handleDeleteAll,
    persistDashboardOrder: persistDashboardOrderOnly
  };
})();
