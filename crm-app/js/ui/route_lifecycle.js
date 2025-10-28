const ROUTE_BUCKETS = new Map();
let currentRoute = '';
let listenersWired = false;

function toLowerString(value){
  return typeof value === 'string' ? value : '';
}

function normalizeRoute(value){
  const raw = toLowerString(value).trim();
  if(!raw) return '';
  let normalized = raw;
  normalized = normalized.replace(/^view-/, '');
  normalized = normalized.replace(/^#/, '');
  normalized = normalized.replace(/^\/+/, '');
  if(!normalized) return '';
  const segment = normalized.split(/[?&#/]/)[0];
  return segment || '';
}

function safeDocument(){
  return typeof document !== 'undefined' ? document : null;
}

function safeWindow(){
  return typeof window !== 'undefined' ? window : null;
}

function deriveFromExplicit(candidate){
  const normalized = normalizeRoute(candidate);
  if(normalized) return normalized;
  return '';
}

function deriveFromWindow(){
  const win = safeWindow();
  if(!win) return '';
  if(typeof win.__ROUTE__ === 'string'){ 
    const normalized = normalizeRoute(win.__ROUTE__);
    if(normalized) return normalized;
  }
  try{
    const hash = typeof win.location?.hash === 'string' ? win.location.hash : '';
    const normalized = normalizeRoute(hash);
    if(normalized) return normalized;
  }catch(_err){}
  try{
    const pathname = typeof win.location?.pathname === 'string' ? win.location.pathname : '';
    const normalized = normalizeRoute(pathname);
    if(normalized) return normalized;
  }catch(_err){}
  return '';
}

function deriveFromDocument(){
  const doc = safeDocument();
  if(!doc) return '';
  try{
    const activeMain = doc.querySelector('main[id^="view-"]:not(.hidden)');
    if(activeMain && typeof activeMain.id === 'string'){
      const normalized = normalizeRoute(activeMain.id);
      if(normalized) return normalized;
    }
  }catch(_err){}
  try{
    const activeNav = doc.querySelector('#main-nav button[data-nav].active');
    if(activeNav){
      const navTarget = activeNav.getAttribute('data-nav');
      const normalized = normalizeRoute(navTarget);
      if(normalized) return normalized;
    }
  }catch(_err){}
  try{
    const datasetRoute = doc.body?.dataset?.view || doc.body?.dataset?.route;
    const normalized = normalizeRoute(datasetRoute);
    if(normalized) return normalized;
  }catch(_err){}
  return '';
}

function computeRoute(candidate){
  let route = deriveFromExplicit(candidate);
  if(route) return route;
  route = deriveFromWindow();
  if(route) return route;
  route = deriveFromDocument();
  if(route) return route;
  return '';
}

function getBucket(key){
  if(!ROUTE_BUCKETS.has(key)){
    ROUTE_BUCKETS.set(key, { tokens: new Set(), active: currentRoute === key });
  }
  return ROUTE_BUCKETS.get(key);
}

function invokeMount(token, route){
  if(token.mounted) return;
  try{
    if(typeof token.mount === 'function') token.mount();
    token.mounted = true;
  }catch(err){
    token.mounted = false;
    if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
      console.warn('[route-lifecycle] mount failed', { route, error: err });
    }
  }
}

function invokeUnmount(token, route){
  if(!token.mounted) return;
  try{
    if(typeof token.unmount === 'function') token.unmount();
  }catch(err){
    if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
      console.warn('[route-lifecycle] unmount failed', { route, error: err });
    }
  }finally{
    token.mounted = false;
  }
}

function updateActiveRoute(next){
  const normalized = normalizeRoute(next);
  if(normalized === currentRoute) return;
  const previous = currentRoute;
  currentRoute = normalized;
  if(previous){
    const bucket = ROUTE_BUCKETS.get(previous);
    if(bucket){
      bucket.active = false;
      const tokens = Array.from(bucket.tokens);
      tokens.forEach((token) => invokeUnmount(token, previous));
    }
  }
  if(currentRoute){
    const bucket = ROUTE_BUCKETS.get(currentRoute);
    if(bucket){
      bucket.active = true;
      const tokens = Array.from(bucket.tokens);
      tokens.forEach((token) => invokeMount(token, currentRoute));
    }
  }
}

function handleRouteEvent(event){
  const detail = event && typeof event === 'object' ? event.detail : null;
  let candidate = '';
  if(detail && typeof detail === 'object'){
    candidate = detail.view || detail.route || detail.tab || detail.name || detail.hash || '';
  }
  const next = computeRoute(candidate);
  updateActiveRoute(next);
}

function ensureListeners(){
  if(listenersWired) return;
  listenersWired = true;
  const doc = safeDocument();
  const win = safeWindow();
  if(doc){
    const docEvents = ['app:view:changed', 'app:navigate', 'route:changed', 'shell:navigate'];
    docEvents.forEach((eventName) => {
      try{ doc.addEventListener(eventName, handleRouteEvent); }
      catch(_err){}
    });
    if(doc.readyState === 'loading'){
      const onReady = () => handleRouteEvent(null);
      try{ doc.addEventListener('DOMContentLoaded', onReady, { once: true }); }
      catch(_err){}
    }
  }
  if(win){
    const winEvents = ['hashchange', 'popstate'];
    winEvents.forEach((eventName) => {
      try{ win.addEventListener(eventName, handleRouteEvent); }
      catch(_err){}
    });
  }
  handleRouteEvent(null);
}

export function acquireRouteLifecycleToken(route, handlers){
  const key = normalizeRoute(route);
  if(!key) return () => {};
  ensureListeners();
  const bucket = getBucket(key);
  const token = {
    mount: handlers && typeof handlers.mount === 'function' ? handlers.mount
      : handlers && typeof handlers.attach === 'function' ? handlers.attach
      : () => {},
    unmount: handlers && typeof handlers.unmount === 'function' ? handlers.unmount
      : handlers && typeof handlers.detach === 'function' ? handlers.detach
      : () => {},
    mounted: false
  };
  bucket.tokens.add(token);
  if(bucket.active){
    invokeMount(token, key);
  }
  return () => {
    if(!bucket.tokens.has(token)) return;
    try{
      invokeUnmount(token, key);
    }catch(_err){}
    bucket.tokens.delete(token);
  };
}

export function currentRouteKey(){
  return currentRoute;
}
