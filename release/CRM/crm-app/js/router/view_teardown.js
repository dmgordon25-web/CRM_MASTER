const DEFAULT_GUARD_KEY = '__WIRED_VIEW_LIFECYCLE__';

function guardKey(key){
  const raw = typeof key === 'string' && key.trim() ? key.trim() : '';
  return raw || DEFAULT_GUARD_KEY;
}

function isElement(value){
  return typeof Element !== 'undefined' && value instanceof Element;
}

export function normalizeRouteId(value){
  if(typeof value !== 'string') return '';
  const trimmed = value.trim();
  if(!trimmed) return '';
  let normalized = trimmed.toLowerCase();
  normalized = normalized.replace(/^view-/, '');
  normalized = normalized.replace(/^#/, '');
  normalized = normalized.replace(/^\/+/, '');
  normalized = normalized.replace(/[#?].*$/, '');
  return normalized;
}

export function getRouteRoot(routeId){
  if(typeof document === 'undefined') return null;
  const key = normalizeRouteId(routeId);
  if(!key) return null;
  const selectors = [
    `#view-${key}`,
    `[data-view="${key}"]`,
    `[data-route="${key}"]`,
    `[data-ui="${key}-root"]`,
    `[data-zone="${key}"]`,
    `[data-role="${key}"]`
  ];
  for(const selector of selectors){
    if(!selector) continue;
    try{
      const node = document.querySelector(selector);
      if(node) return node;
    }catch(_err){}
  }
  return null;
}

function createGuardState(root, key){
  const state = {
    key,
    root,
    cleanups: []
  };
  state.addCleanup = function addCleanup(fn){
    if(typeof fn === 'function') this.cleanups.push(fn);
  };
  state.runCleanup = function runCleanup(){
    while(this.cleanups.length){
      const task = this.cleanups.pop();
      try{ task(); }
      catch(_err){}
    }
  };
  state.release = function release(){
    this.runCleanup();
    if(this.root && this.root[this.key] === this){
      try{ delete this.root[this.key]; }
      catch(_err){ this.root[this.key] = null; }
    }
  };
  return state;
}

export function ensureViewGuard(root, key){
  if(!isElement(root)) return null;
  const guard = guardKey(key);
  const existing = root[guard];
  if(existing && typeof existing === 'object' && existing.root === root){
    return null;
  }
  const state = createGuardState(root, guard);
  try{
    Object.defineProperty(root, guard, { value: state, configurable: true });
  }catch(_err){
    root[guard] = state;
  }
  return state;
}

export function getViewGuard(root, key){
  if(!isElement(root)) return null;
  const guard = guardKey(key);
  const value = root[guard];
  if(value && typeof value === 'object' && value.root === root){
    return value;
  }
  return null;
}

export function releaseViewGuard(root, key){
  if(!isElement(root)) return;
  const guard = guardKey(key);
  const state = getViewGuard(root, guard);
  if(state){
    state.release();
    return;
  }
  if(Object.prototype.hasOwnProperty.call(root, guard)){
    try{ delete root[guard]; }
    catch(_err){ root[guard] = null; }
  }
}
