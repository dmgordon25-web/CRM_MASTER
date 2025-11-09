const ROOT = typeof window === 'object' && window ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
const STORAGE_KEYS = { range: 'dash:range', mode: 'dashboard:mode' };
const DEFAULTS = { range: 'all', mode: 'today' };
const REFRESH_PRESETS = {
  range: {
    forceReload: true,
    includeReports: true,
    sections: ['filters','kpis','pipeline','today','leaderboard','stale','focus'],
    reason: 'range-change'
  },
  mode: {
    forceReload: false,
    includeReports: false,
    sections: ['filters','kpis','pipeline','today','leaderboard','stale','focus'],
    reason: 'mode-change'
  }
};

function readLocalStorage(key){
  try{
    if(!ROOT || !ROOT.localStorage) return null;
    return ROOT.localStorage.getItem(key);
  }catch(_err){
    return null;
  }
}

function writeLocalStorage(key, value){
  try{
    if(!ROOT || !ROOT.localStorage) return;
    if(value == null) ROOT.localStorage.removeItem(key);
    else ROOT.localStorage.setItem(key, value);
  }catch(_err){}
}

function validateRange(value){
  return value === 'tm' ? 'tm' : DEFAULTS.range;
}

function validateMode(value){
  return value === 'all' ? 'all' : DEFAULTS.mode;
}

const initialRange = (() => {
  const stored = readLocalStorage(STORAGE_KEYS.range);
  if(stored === 'tm') return 'tm';
  if(stored === 'all') return 'all';
  return DEFAULTS.range;
})();

const initialMode = (() => {
  const stored = readLocalStorage(STORAGE_KEYS.mode);
  if(stored === 'all') return 'all';
  if(stored === 'today') return 'today';
  return DEFAULTS.mode;
})();

const state = {
  range: initialRange,
  mode: initialMode
};

if(ROOT) ROOT.DASH_RANGE = state.range;

const subscribers = new Set();
let persistTimer = null;
const pendingPersistKeys = new Set();
let refreshHandler = null;
let refreshInFlightPromise = null;
let pendingRefresh = null;
let pendingRefreshScheduled = false;

function snapshot(){
  return { range: state.range, mode: state.mode };
}

function notifySubscribers(changed){
  if(!changed || changed.size === 0) return;
  const payload = snapshot();
  subscribers.forEach(fn => {
    try{ fn(payload, new Set(changed)); }
    catch(err){ if(ROOT && ROOT.console && typeof ROOT.console.warn === 'function') ROOT.console.warn('[dashboard_state] listener failed', err); }
  });
}

function schedulePersist(changed){
  changed.forEach(key => pendingPersistKeys.add(key));
  if(persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if(pendingPersistKeys.has('range')){
      writeLocalStorage(STORAGE_KEYS.range, state.range);
    }
    if(pendingPersistKeys.has('mode')){
      writeLocalStorage(STORAGE_KEYS.mode, state.mode);
    }
    pendingPersistKeys.clear();
  }, 150);
}

function mergeRefreshOptions(base, override){
  const merged = Object.assign({}, base);
  if(!override || typeof override !== 'object') return merged;
  if(Array.isArray(override.sections)){
    merged.sections = Array.from(new Set([].concat(base.sections || [], override.sections)));
  }
  if(typeof override.forceReload === 'boolean') merged.forceReload = override.forceReload;
  if(typeof override.includeReports === 'boolean') merged.includeReports = override.includeReports;
  if(typeof override.reason === 'string' && override.reason) merged.reason = override.reason;
  return merged;
}

function normalizeRefreshOptions(options){
  if(!options || typeof options !== 'object') return { forceReload:false, includeReports:false, sections:new Set(), reason: '' };
  const sections = new Set();
  if(Array.isArray(options.sections)) options.sections.forEach(section => { if(section) sections.add(section); });
  else if(options.sections instanceof Set) options.sections.forEach(section => { if(section) sections.add(section); });
  const normalized = {
    forceReload: !!options.forceReload,
    includeReports: !!options.includeReports,
    sections,
    reason: typeof options.reason === 'string' ? options.reason : ''
  };
  return normalized;
}

function mergePendingRefresh(target, normalized){
  target.forceReload = target.forceReload || normalized.forceReload;
  target.includeReports = target.includeReports || normalized.includeReports;
  normalized.sections.forEach(section => target.sections.add(section));
  if(normalized.reason) target.reasons.add(normalized.reason);
}

function schedulePendingRefreshProcessing(){
  if(pendingRefreshScheduled) return;
  pendingRefreshScheduled = true;
  Promise.resolve().then(runPendingRefreshes).catch(err => {
    pendingRefreshScheduled = false;
    if(ROOT && ROOT.console && typeof ROOT.console.error === 'function'){
      ROOT.console.error('[dashboard_state] refresh queue processing failed', err);
    }
  });
}

async function waitForInFlightRefresh(){
  const previous = refreshInFlightPromise;
  if(!previous) return;
  try{
    await previous;
  }catch(err){
    if(ROOT && ROOT.console && typeof ROOT.console.warn === 'function'){
      ROOT.console.warn('[dashboard_state] previous refresh failed', err);
    }
  }
}

async function runPendingRefreshes(){
  try{
    while(pendingRefresh){
      const payload = pendingRefresh;
      pendingRefresh = null;

      const resolve = typeof payload.resolve === 'function' ? payload.resolve : () => {};
      const reject = typeof payload.reject === 'function' ? payload.reject : () => {};

      const sections = new Set(payload.sections);
      const reasons = new Set(payload.reasons);

      await waitForInFlightRefresh();

      if(!refreshHandler){
        resolve();
        payload.resolve = null;
        payload.reject = null;
        continue;
      }

      const detail = {
        forceReload: payload.forceReload,
        includeReports: payload.includeReports,
        sections: Array.from(sections),
        reasons: Array.from(reasons)
      };

      const current = (async () => {
        try{
          return await refreshHandler(detail);
        }finally{
          if(refreshInFlightPromise === current){
            refreshInFlightPromise = null;
          }
        }
      })();

      refreshInFlightPromise = current;

      try{
        const result = await current;
        resolve(result);
      }catch(err){
        reject(err);
      }finally{
        payload.resolve = null;
        payload.reject = null;
      }
    }
  }finally{
    pendingRefreshScheduled = false;
    if(pendingRefresh){
      schedulePendingRefreshProcessing();
    }
  }
}

function triggerRefresh(options){
  if(!refreshHandler) return Promise.resolve();
  const normalized = normalizeRefreshOptions(options);

  if(pendingRefresh){
    mergePendingRefresh(pendingRefresh, normalized);
    return pendingRefresh.promise;
  }

  const request = {
    forceReload: normalized.forceReload,
    includeReports: normalized.includeReports,
    sections: new Set(normalized.sections),
    reasons: new Set(normalized.reason ? [normalized.reason] : [])
  };

  request.promise = new Promise((resolve, reject) => {
    request.resolve = resolve;
    request.reject = reject;
  });

  pendingRefresh = request;
  schedulePendingRefreshProcessing();

  return request.promise;
}

function applyStateChange(key, value, presetKey, options){
  const opts = options || {};
  const notify = opts.notify !== false;
  const persist = opts.persist !== false;
  const refreshOpts = opts.refresh === false ? false : opts.refresh;
  const changed = new Set([key]);

  if(key === 'range'){
    state.range = validateRange(value);
    if(ROOT) ROOT.DASH_RANGE = state.range;
  }else if(key === 'mode'){
    state.mode = validateMode(value);
  }else{
    state[key] = value;
  }

  if(persist) schedulePersist(changed);
  if(notify) notifySubscribers(changed);
  if(refreshOpts !== false){
    const base = REFRESH_PRESETS[presetKey] || { forceReload:false, includeReports:false, sections:[] };
    const merged = mergeRefreshOptions(base, refreshOpts && typeof refreshOpts === 'object' ? refreshOpts : {});
    if(opts.reason && typeof opts.reason === 'string' && opts.reason){
      merged.reason = opts.reason;
    }
    triggerRefresh(merged);
  }
  return state[key];
}

function setRange(value, options){
  const normalized = validateRange(value);
  if(state.range === normalized) return state.range;
  return applyStateChange('range', normalized, 'range', options);
}

function setMode(value, options){
  const normalized = validateMode(value);
  if(state.mode === normalized) return state.mode;
  return applyStateChange('mode', normalized, 'mode', options);
}

function subscribe(listener){
  if(typeof listener !== 'function') return () => {};
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}

function registerRefreshHandler(handler){
  if(typeof handler !== 'function'){
    refreshHandler = null;
    return () => {};
  }
  refreshHandler = handler;
  return () => {
    if(refreshHandler === handler){
      refreshHandler = null;
    }
  };
}

function refresh(options){
  return triggerRefresh(options || {});
}

const dashboardState = {
  getState: () => snapshot(),
  getRange: () => state.range,
  getMode: () => state.mode,
  setRange,
  setMode,
  subscribe,
  refresh,
  registerRefreshHandler
};

if(ROOT){
  ROOT.dashboardState = dashboardState;
  ROOT.dashboard = ROOT.dashboard || {};
  if(typeof ROOT.dashboard.refresh !== 'function'){
    ROOT.dashboard.refresh = refresh;
  }
  ROOT.dashboard.state = dashboardState;
}

export { dashboardState };
export default dashboardState;
