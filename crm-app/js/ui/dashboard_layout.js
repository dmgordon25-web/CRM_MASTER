import makeDraggableList, { attachOnce } from './drag_core.js';

const STORAGE_KEY = 'dash:layout:1';
const ITEM_SELECTOR = ':scope > section.card[id], :scope > section.grid[id], :scope > div.card[id]';
const HANDLE_SELECTOR = '[data-ui="card-title"], .insight-head, .row > strong:first-child, header, h2, h3, h4';

const state = {
  wired: false,
  active: false,
  container: null
};

function getListenerCount(){
  if(typeof makeDraggableList.listenerCount === 'function'){
    try { return makeDraggableList.listenerCount(); }
    catch (_err) { return 0; }
  }
  return 0;
}

function logListenerCount(){
  try {
    console.info('[VIS] dashboard drag listeners:', getListenerCount());
  } catch (_err) {}
}

function isDashboardRoute(hash){
  if(typeof hash !== 'string') return false;
  const trimmed = hash.trim();
  if(!trimmed) return false;
  if(trimmed === '#/dashboard') return true;
  if(trimmed.startsWith('#/dashboard?')) return true;
  return false;
}

function findDashboardContainer(){
  if(typeof document === 'undefined') return null;
  const main = document.querySelector('main[data-ui="dashboard-root"]');
  if(main) return main;
  const fallback = document.getElementById('view-dashboard');
  return fallback || null;
}

function ensureDraggable(){
  const container = findDashboardContainer();
  if(!container) return null;
  state.container = container;
  return makeDraggableList({
    container,
    itemSel: ITEM_SELECTOR,
    handleSel: HANDLE_SELECTOR,
    storageKey: STORAGE_KEY
  });
}

function handleRouteChange(forceLog = false){
  if(typeof window === 'undefined') return;
  const hash = typeof window.location?.hash === 'string' ? window.location.hash : '';
  const isDash = isDashboardRoute(hash);
  if(!isDash){
    state.active = false;
    return;
  }
  ensureDraggable();
  if(forceLog || !state.active){
    state.active = true;
    logListenerCount();
  }
}

export function initDashboardLayout(){
  if(state.wired) return;
  state.wired = true;
  ensureDraggable();
  if(typeof window !== 'undefined'){
    const onHashChange = () => handleRouteChange(false);
    attachOnce(window, 'hashchange', onHashChange, 'dashboard-layout:hashchange');
  }
  logListenerCount();
  handleRouteChange(true);
}

export default initDashboardLayout;
