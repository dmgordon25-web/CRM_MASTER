import { acquireRouteLifecycleToken, currentRouteKey } from '../ui/route_lifecycle.js';
import { normalizeRouteId, getRouteRoot } from './view_teardown.js';

const enterHandlers = new Map();
const leaveHandlers = new Map();
const routeBuckets = new Map();

const globalScope = typeof window !== 'undefined' ? window : null;

function ensureCounter(prop){
  if(!globalScope) return;
  const value = Number.isFinite(globalScope[prop]) ? globalScope[prop] : 0;
  globalScope[prop] = value;
}

export function incrementBindCounter(){
  if(!globalScope) return 0;
  ensureCounter('__DIAG_BINDS__');
  globalScope.__DIAG_BINDS__ += 1;
  return globalScope.__DIAG_BINDS__;
}

export function incrementUnbindCounter(){
  if(!globalScope) return 0;
  ensureCounter('__DIAG_UNBINDS__');
  globalScope.__DIAG_UNBINDS__ += 1;
  return globalScope.__DIAG_UNBINDS__;
}

function callSafely(fn, context){
  if(typeof fn !== 'function') return;
  try {
    fn(context);
  } catch (err) {
    if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
      console.warn('[router:lifecycle] handler failed', err);
    }
  }
}

let activeRoute = '';
let previousRoute = '';
let started = false;

function updateInitialRoute(){
  try {
    const current = currentRouteKey();
    if(current){
      activeRoute = current;
      previousRoute = current;
    }
  } catch (_err) {}
}

function ensureStarted(){
  if(started) return;
  started = true;
  ensureCounter('__DIAG_BINDS__');
  ensureCounter('__DIAG_UNBINDS__');
  updateInitialRoute();
}

function getBucket(routeId){
  const key = normalizeRouteId(routeId);
  if(!key) return null;
  if(routeBuckets.has(key)){
    return routeBuckets.get(key);
  }
  const bucket = {
    key,
    active: false,
    root: null,
    context: null,
    release: () => {}
  };
  bucket.release = acquireRouteLifecycleToken(key, {
    mount(){
      const root = getRouteRoot(key);
      const previous = activeRoute && activeRoute !== key ? activeRoute : previousRoute !== key ? previousRoute : '';
      const context = {
        route: key,
        root,
        previousRoute: previous,
        nextRoute: '',
        markBound: incrementBindCounter,
        markUnbound: incrementUnbindCounter
      };
      bucket.active = true;
      bucket.root = root;
      bucket.context = context;
      previousRoute = activeRoute && activeRoute !== key ? activeRoute : previousRoute;
      activeRoute = key;
      const handlers = enterHandlers.get(key);
      if(handlers){
        handlers.forEach((handler) => callSafely(handler, context));
      }
    },
    unmount(){
      const root = bucket.root || getRouteRoot(key);
      const next = currentRouteKey();
      const context = {
        route: key,
        root,
        previousRoute: bucket.context ? bucket.context.previousRoute : previousRoute,
        nextRoute: next && next !== key ? next : '',
        markBound: incrementBindCounter,
        markUnbound: incrementUnbindCounter
      };
      const handlers = leaveHandlers.get(key);
      if(handlers){
        handlers.forEach((handler) => callSafely(handler, context));
      }
      bucket.active = false;
      bucket.root = null;
      bucket.context = null;
      if(activeRoute === key){
        previousRoute = key;
        activeRoute = '';
      }
    }
  });
  routeBuckets.set(key, bucket);
  return bucket;
}

function cleanupBucketIfIdle(key){
  const bucket = routeBuckets.get(key);
  if(!bucket) return;
  const hasEnter = enterHandlers.get(key)?.size;
  const hasLeave = leaveHandlers.get(key)?.size;
  if((!hasEnter && !hasLeave) && !bucket.active){
    try {
      bucket.release();
    } catch (_err) {}
    routeBuckets.delete(key);
  }
}

export function onEnter(routeId, handler){
  ensureStarted();
  const key = normalizeRouteId(routeId);
  if(!key || typeof handler !== 'function') return () => {};
  const bucket = getBucket(key);
  if(!enterHandlers.has(key)) enterHandlers.set(key, new Set());
  const set = enterHandlers.get(key);
  set.add(handler);
  if(bucket && bucket.active){
    const context = bucket.context || {
      route: key,
      root: bucket.root || getRouteRoot(key),
      previousRoute,
      nextRoute: '',
      markBound: incrementBindCounter,
      markUnbound: incrementUnbindCounter
    };
    callSafely(handler, context);
  }
  return () => {
    const handlers = enterHandlers.get(key);
    if(!handlers) return;
    handlers.delete(handler);
    if(handlers.size === 0){
      enterHandlers.delete(key);
      cleanupBucketIfIdle(key);
    }
  };
}

export function onLeave(routeId, handler){
  ensureStarted();
  const key = normalizeRouteId(routeId);
  if(!key || typeof handler !== 'function') return () => {};
  getBucket(key);
  if(!leaveHandlers.has(key)) leaveHandlers.set(key, new Set());
  const set = leaveHandlers.get(key);
  set.add(handler);
  return () => {
    const handlers = leaveHandlers.get(key);
    if(!handlers) return;
    handlers.delete(handler);
    if(handlers.size === 0){
      leaveHandlers.delete(key);
      cleanupBucketIfIdle(key);
    }
  };
}

export function startRouteHistory(){
  ensureStarted();
}

startRouteHistory();
