const EMAIL_FROM_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const TZ_FALLBACK_PATTERN = /^[A-Za-z0-9_.+-]+(?:\/[A-Za-z0-9_.+-]+)*$/;

const DASHBOARD_WIDGET_DOM_IDS = {
  focus: 'dashboard-focus',
  filters: 'dashboard-filters',
  kpis: 'dashboard-kpis',
  pipeline: 'dashboard-pipeline-overview',
  today: 'dashboard-today',
  celebrations: 'dashboard-celebrations',
  leaderboard: 'referral-leaderboard',
  stale: 'dashboard-stale',
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

  return { ok: errors.length === 0, errors };
}

function applyGeneralSettingsCoercion(target){
  if(!target || typeof target !== 'object') return target;
  const general = extractGeneralSettings(target);
  target.timezone = general.timezone;
  target.workHours = general.workHours;
  target.email = general.email;
  target.notifications = general.notifications;
  return target;
}

function shouldValidateGeneral(partial){
  if(!partial || typeof partial !== 'object') return false;
  if(Object.prototype.hasOwnProperty.call(partial, 'timezone')) return true;
  if(Object.prototype.hasOwnProperty.call(partial, 'workHours')) return true;
  if(Object.prototype.hasOwnProperty.call(partial, 'email')) return true;
  if(Object.prototype.hasOwnProperty.call(partial, 'notifications')) return true;
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
      kpis: buildDefaultToggleMap(DASHBOARD_KPI_KEYS)
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
    const mode = source.mode === 'all' ? 'all' : 'today';
    return { mode, widgets, graphs, widgetCards, kpis };
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
      dashboardOrder: normalizeDashboardOrder(base.dashboardOrder),
      updatedAt: base.updatedAt || null
    };
    const general = extractGeneralSettings(base);
    normalized.timezone = general.timezone;
    normalized.workHours = general.workHours;
    normalized.email = general.email;
    normalized.notifications = general.notifications;
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
      next.dashboard = normalizeDashboard(merged);
    }
    if(source.dashboardOrder){
      next.dashboardOrder = normalizeDashboardOrder(source.dashboardOrder);
    }
    for(const key of Object.keys(source)){
      if(key === 'goals' || key === 'signature' || key === 'loProfile') continue;
      if(key === 'dashboard') continue;
      if(key === 'dashboardOrder') continue;
      next[key] = source[key];
    }
    if('profile' in next) delete next.profile;
    return next;
  }

  async function save(partial){
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
    const detail = { scope: 'settings' };
    if(typeof window.dispatchAppDataChanged === 'function'){
      window.dispatchAppDataChanged(detail);
    }else if(window.document && typeof window.document.dispatchEvent === 'function'){
      window.document.dispatchEvent(new CustomEvent('app:data:changed', { detail }));
    }
    if(window.Toast && typeof window.Toast.show === 'function'){
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
    return save({ dashboardOrder: normalized });
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
    if(typeof window.dbClear === 'function' && window.DB_META && Array.isArray(window.DB_META.STORES)){
      for(const store of window.DB_META.STORES){
        try{ await window.dbClear(store); }
        catch (err) { if(console && console.warn) console.warn('[settings] dbClear failed', store, err); }
      }
      return;
    }
    if(typeof window.dbClear === 'function'){
      try{
        await window.dbClear('contacts');
        await window.dbClear('partners');
        await window.dbClear('settings');
        await window.dbClear('tasks');
        await window.dbClear('documents');
      }
      catch (err) { if(console && console.warn) console.warn('[settings] dbClear failed', err); }
    }
  }

  async function handleDeleteAll(){
    let confirmed = true;
    if(typeof window.confirmAction === 'function'){
      confirmed = await window.confirmAction({
        title: 'Delete all data',
        message: 'Delete ALL local data?',
        confirmLabel: 'Delete',
        cancelLabel: 'Keep data',
        destructive: true
      });
    }else if(typeof window.confirm === 'function'){
      confirmed = window.confirm('Delete ALL local data?');
    }
    if(!confirmed) return;
    await clearAllStores();
    try{ localStorage.clear(); sessionStorage.clear(); }
    catch (_err) {}
    if(window.toast){
      try{ window.toast('All data deleted'); }
      catch (_err) { console && console.info && console.info('[settings] toast skipped'); }
    }
    document.dispatchEvent(new CustomEvent('app:data:changed', { detail:{ source:'settings:deleteAll' } }));
    const micro = typeof queueMicrotask === 'function'
      ? queueMicrotask
      : (fn) => Promise.resolve().then(fn);
    micro(() => {
      if(window.renderAll){
        try{ window.renderAll('deleteAll'); }
        catch (err) { if(console && console.warn) console.warn('[settings] renderAll failed', err); }
      }
    });
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
