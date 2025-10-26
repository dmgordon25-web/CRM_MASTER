import { __WHEN_SERVICES_READY as whenServicesReady } from './boot/contracts/services.js';
import { openDB as openDatabase } from './db.js';

const globalScope = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
const documentRef = typeof document !== 'undefined' ? document : null;
const requestFrame = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame.bind(globalScope)
  : ((fn) => setTimeout(fn, 16));

if (!globalScope.__CALENDAR_STATE__){
  const now = new Date();
  globalScope.__CALENDAR_STATE__ = { anchor: now, view: 'month' };
}

const STATE = globalScope.__CALENDAR_STATE__;

const runtime = {
  bus: null,
  services: null,
  servicesReady: false,
  servicesWaiter: null,
  openDB: null
};

const STORAGE_KEYS = Object.freeze({
  lastTask: 'calendar:lastTaskId'
});

let initLogged = false;
let initCalendarPromise = null;
let taskReplayScheduled = false;

let domReady = documentRef ? documentRef.readyState !== 'loading' : true;
let implReady = false;
let implReadyPromise = null;
let pendingUntilDomReady = false;
let queued = false;
let bound = false;
let wired = false;
let viewChangeUnsub = null;

const pendingInitCalls = [];
let pendingRenderRequest = false;

const API = {
  init(arg){
    pendingInitCalls.push(arg);
    return Promise.resolve(false);
  },
  render(){
    pendingRenderRequest = true;
    return Promise.resolve();
  },
  setView(view){
    STATE.view = normalizeView(view);
    pendingRenderRequest = true;
    return API.render();
  },
  setAnchor(anchor){
    STATE.anchor = new Date(anchor || Date.now());
    pendingRenderRequest = true;
    return API.render();
  },
  calPrev(){
    shiftState(-1);
    pendingRenderRequest = true;
    return API.render();
  },
  calNext(){
    shiftState(1);
    pendingRenderRequest = true;
    return API.render();
  },
  calToday(){
    STATE.anchor = new Date();
    pendingRenderRequest = true;
    return API.render();
  }
};

function exportPublicAPI(){
  globalScope.renderCalendar = function(){ return API.render(); };
  globalScope.initCalendar = function(arg){ return API.init(arg); };
  globalScope.setCalendarView = function(view){ return API.setView(view); };
  globalScope.setCalendarAnchor = function(anchor){ return API.setAnchor(anchor); };
  globalScope.calPrev = function(){ return API.calPrev(); };
  globalScope.calNext = function(){ return API.calNext(); };
  globalScope.calToday = function(){ return API.calToday(); };
}

function calendarRoot(){
  if(!documentRef) return null;
  return documentRef.getElementById('calendar-root');
}

function showCalErrorBanner(root){
  const mount = root || calendarRoot();
  if(!mount) return;
  const doc = mount.ownerDocument || documentRef;
  if(!doc) return;
  const box = doc.createElement('div');
  box.className = 'muted';
  box.style.padding = '16px';
  box.style.textAlign = 'center';
  box.style.fontSize = '13px';
  box.textContent = 'Calendar unavailable. Please refresh to try again.';
  mount.innerHTML = '';
  mount.appendChild(box);
}

function showPlaceholder(){
  const root = calendarRoot();
  if(!root || !documentRef) return;
  if(root.querySelector('[data-cal-loading]')) return;
  root.innerHTML = '<div data-cal-loading class="muted" style="padding:16px;text-align:center;font-size:13px">Loading calendar...</div>';
}

function clearPlaceholder(){
  const root = calendarRoot();
  if(!root) return;
  const placeholder = root.querySelector('[data-cal-loading]');
  if(!placeholder) return;
  if(placeholder.parentNode === root && root.childNodes.length === 1){
    root.innerHTML = '';
  }else{
    placeholder.remove();
  }
}

function safeStorageGet(storage, key){
  try{
    if(!storage || typeof storage.getItem !== 'function') return '';
    return storage.getItem(key) || '';
  }catch (_err){
    return '';
  }
}

function safeStorageSet(storage, key, value){
  try{
    if(!storage || typeof storage.setItem !== 'function') return;
    storage.setItem(key, value);
  }catch (_err){}
}

function rememberTaskId(id){
  if(id == null) return;
  const value = String(id);
  if(globalScope) globalScope.__LAST_TASK_ID__ = value;
  if(globalScope) globalScope.__CAL_TASK_ID__ = value;
  if(globalScope){
    safeStorageSet(globalScope.localStorage, STORAGE_KEYS.lastTask, value);
    safeStorageSet(globalScope.sessionStorage, STORAGE_KEYS.lastTask, value);
  }
}

function trackTaskCreated(id){
  if(id == null) return;
  rememberTaskId(id);
  const value = String(id);
  try{
    console.log('CAL_TASK_CREATED', value);
  }catch (_err){}
  try{ console.log(`TASK_CREATED:${value}`); }
  catch (_err){}
}

async function replayLastTaskMarker(){
  if(!globalScope) return;
  const stored = safeStorageGet(globalScope.localStorage, STORAGE_KEYS.lastTask);
  if(!stored) return;
  const seen = safeStorageGet(globalScope.sessionStorage, STORAGE_KEYS.lastTask);
  if(seen === stored) return;
  if(typeof runtime.openDB === 'function'){
    try{ await runtime.openDB(); }
    catch (_err){}
  }
  const dbGet = typeof globalScope.dbGet === 'function' ? globalScope.dbGet : null;
  if(!dbGet) return;
  try{
    const record = await dbGet('tasks', stored);
    if(!record) return;
    trackTaskCreated(stored);
  }catch (_err){}
}

function scheduleTaskReplay(){
  if(taskReplayScheduled) return;
  taskReplayScheduled = true;
  Promise.resolve().then(() => {
    const wait = runtime.servicesWaiter || Promise.resolve(true);
    wait.then(() => replayLastTaskMarker()).catch(()=>{});
  });
}

function markInitLogged(){
  if(initLogged) return;
  initLogged = true;
  try{ console.info('CAL_OK:init-once'); }
  catch (_err){}
}

function logCalendarCounts(){
  let cells = 0;
  let events = 0;
  let empty = false;
  if(documentRef){
    const root = calendarRoot();
    if(root){
      cells = root.querySelectorAll('.calendar-cell').length;
      events = root.querySelectorAll('.calendar-event').length;
      empty = !!root.querySelector('[data-qa="calendar-empty"]');
    }
  }
  try{ console.log('CAL_COUNTS', { cells, events, empty }); }
  catch (_err){}
}

function ensureDomReadyHook(){
  if(domReady) return;
  if(!documentRef || typeof documentRef.addEventListener !== 'function') return;
  documentRef.addEventListener('DOMContentLoaded', () => {
    domReady = true;
    if(pendingUntilDomReady){
      pendingUntilDomReady = false;
      queueRender();
    }
    handleEnvironmentReady();
  }, { once: true });
}

function ensureServicesPromise(ctx = {}){
  if(runtime.servicesWaiter) return runtime.servicesWaiter;
  runtime.servicesWaiter = waitForServices(ctx).catch((err) => {
    if(console && typeof console.warn === 'function'){
      console.warn('[CAL] services readiness wait failed', err);
    }
    return true;
  }).then(() => {
    runtime.servicesReady = true;
    handleEnvironmentReady();
    return true;
  });
  return runtime.servicesWaiter;
}

async function waitForServices(ctx = {}){
  const fallback = ctx?.services || ctx || runtime.services || globalScope;
  const candidates = [
    ctx?.whenServicesReady,
    ctx?.servicesReady,
    ctx?.services?.whenReady,
    ctx?.services?.ready,
    globalScope?.CRM?.ctx?.whenServicesReady,
    globalScope?.CRM?.ctx?.servicesReady,
    globalScope?.CRM?.services?.whenReady,
    globalScope?.CRM?.services?.ready,
    whenServicesReady
  ];
  for(const candidate of candidates){
    const result = await callCandidate(candidate, fallback);
    if(result === true) return true;
  }
  return true;
}

async function callCandidate(candidate, fallback){
  if(candidate == null) return null;
  try{
    const value = typeof candidate === 'function'
      ? candidate.call(fallback)
      : candidate;
    if(value && typeof value.then === 'function'){
      await value;
      return true;
    }
    if(value === false) return false;
    if(value == null) return true;
    return !!value;
  }catch (err){
    if(console && typeof console.warn === 'function'){
      console.warn('[CAL] services readiness probe failed', err);
    }
    return false;
  }
}

function handleEnvironmentReady(){
  if(!runtime.servicesReady || !domReady) return;
  maybeAutoInit();
}

function normalizeView(value){
  return (value === 'week' || value === 'day') ? value : 'month';
}

function shiftState(offset){
  const state = STATE;
  const anchor = new Date(state.anchor);
  if(state.view === 'day'){
    anchor.setDate(anchor.getDate() + offset);
  }else if(state.view === 'week'){
    anchor.setDate(anchor.getDate() + (offset * 7));
  }else{
    anchor.setMonth(anchor.getMonth() + offset);
  }
  state.anchor = anchor;
  return anchor;
}

function waitForDom(){
  if(domReady || !documentRef) return Promise.resolve();
  return new Promise((resolve) => {
    documentRef.addEventListener('DOMContentLoaded', () => {
      domReady = true;
      resolve();
      if(pendingUntilDomReady){
        pendingUntilDomReady = false;
        queueRender();
      }
      handleEnvironmentReady();
    }, { once: true });
  });
}

function ensureImplReady(){
  if(implReady) return Promise.resolve(true);
  if(implReadyPromise) return implReadyPromise;
  const ready = globalScope.__CALENDAR_READY__;
  if(ready && typeof ready.then === 'function'){
    implReadyPromise = Promise.resolve(ready).then(() => {
      implReady = true;
      clearPlaceholder();
      return true;
    }).catch((err) => {
      implReady = true;
      clearPlaceholder();
      if(console && typeof console.warn === 'function'){
        console.warn('calendar ready failed', err);
      }
      return false;
    });
  }else{
    implReady = true;
    implReadyPromise = Promise.resolve(true);
  }
  return implReadyPromise;
}

async function renderNow(){
  await ensureImplReady();
  const impl = globalScope.__CALENDAR_IMPL__;
  if(impl && typeof impl.render === 'function'){
    clearPlaceholder();
    return impl.render(STATE.anchor, STATE.view);
  }
  return undefined;
}

function updateControls(){
  if(!documentRef || typeof documentRef.querySelectorAll !== 'function') return;
  const view = STATE.view;
  documentRef.querySelectorAll('[data-calview]').forEach(btn => {
    const current = btn.getAttribute('data-calview');
    const active = current === view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function queueRender(){
  if(!domReady){
    pendingUntilDomReady = true;
    return;
  }
  pendingUntilDomReady = false;
  if(queued) return;
  queued = true;
  if(!implReady){
    ensureImplReady().catch((err) => {
      if(console && typeof console.warn === 'function'){
        console.warn('calendar gate failed', err);
      }
    });
  }
  requestFrame(async () => {
    queued = false;
    try{
      await renderNow();
    }catch (err){
      if(console && typeof console.warn === 'function'){
        console.warn('calendar render failed', err);
      }
    }finally{
      updateControls();
      logCalendarCounts();
    }
  });
  if(!implReady) showPlaceholder();
}

function bindControls(){
  if(!documentRef) return;
  const list = documentRef.querySelectorAll('[data-calview]');
  list.forEach(btn => {
    if(btn.__calViewWired) return;
    btn.__calViewWired = true;
    btn.addEventListener('click', (evt) => {
      evt.preventDefault();
      const view = btn.getAttribute('data-calview');
      API.setView(view);
    });
  });
  const prev = documentRef.getElementById('cal-prev');
  if(prev && !prev.__calNav){
    prev.__calNav = true;
    prev.addEventListener('click', (evt) => {
      evt.preventDefault();
      API.calPrev();
    });
  }
  const next = documentRef.getElementById('cal-next');
  if(next && !next.__calNav){
    next.__calNav = true;
    next.addEventListener('click', (evt) => {
      evt.preventDefault();
      API.calNext();
    });
  }
  const today = documentRef.getElementById('cal-today');
  if(today && !today.__calNav){
    today.__calNav = true;
    today.addEventListener('click', (evt) => {
      evt.preventDefault();
      API.calToday();
    });
  }
  updateControls();
}

function attachBusListener(eventName, handler){
  const bus = runtime.bus;
  if(bus && typeof bus.addEventListener === 'function'){
    bus.addEventListener(eventName, handler);
    return () => {
      try{ bus.removeEventListener(eventName, handler); }
      catch (_err){}
    };
  }
  if(bus && typeof bus.on === 'function'){
    bus.on(eventName, handler);
    return () => {
      try{
        if(typeof bus.off === 'function') bus.off(eventName, handler);
        else if(typeof bus.removeListener === 'function') bus.removeListener(eventName, handler);
      }catch (_err){}
    };
  }
  return null;
}

function attachDocumentListener(eventName, handler, options){
  if(!documentRef || typeof documentRef.addEventListener !== 'function') return null;
  documentRef.addEventListener(eventName, handler, options);
  return () => {
    try{ documentRef.removeEventListener(eventName, handler, options); }
    catch (_err){}
  };
}

function register(){
  if(globalScope.__CALENDAR_LISTENER__) return;
  const subs = [];
  const listener = (evt) => {
    if(globalScope.__RENDERING__) return;
    const type = evt?.type || '';
    if(type && type !== 'app:data:changed' && type !== 'crm:data:changed') return;
    API.render();
  };
  const busSubA = attachBusListener('app:data:changed', listener);
  if(busSubA) subs.push(busSubA);
  const busSubB = attachBusListener('crm:data:changed', listener);
  if(busSubB) subs.push(busSubB);
  if(runtime.bus !== documentRef){
    const docSub = attachDocumentListener('app:data:changed', listener, { passive: true });
    if(docSub) subs.push(docSub);
  }
  globalScope.__CALENDAR_LISTENER__ = {
    off(){
      subs.forEach((fn) => {
        try{ typeof fn === 'function' ? fn() : fn?.off?.(); }
        catch (_err){}
      });
    }
  };
}

function normalizeInitOptions(input){
  if(!input) return { element: null, bus: null, services: null, openDB: null };
  if(input instanceof Event){
    return normalizeInitOptions(input.detail || {});
  }
  if(typeof input === 'string'){
    if(!documentRef) return { element: null, bus: null, services: null, openDB: null };
    return { element: documentRef.querySelector(input), bus: null, services: null, openDB: null };
  }
  if(typeof input === 'object'){
    const element = input.element || input.el || input.root || input.target || null;
    return {
      element: element && typeof element === 'object' && typeof element.nodeType === 'number' ? element : null,
      bus: input.bus || null,
      services: input.services || null,
      openDB: input.openDB || null
    };
  }
  return { element: null, bus: null, services: null, openDB: null };
}

async function bootstrapCalendar(root){
  if(bound) return true;
  try{
    await waitForDom();
    bindControls();
    register();
    bound = true;
    queueRender();
    return true;
  }catch (err){
    if(console && typeof console.warn === 'function'){
      console.warn('[CAL] init failed:', err);
    }
    showCalErrorBanner(root);
    return false;
  }
}

async function actualInit(arg){
  const options = normalizeInitOptions(arg);
  setRuntimeDeps(options);
  await ensureServicesPromise({ services: options.services });
  scheduleTaskReplay();
  const root = options.element || calendarRoot();
  const ready = await bootstrapCalendar(root);
  if(!ready) return false;
  return true;
}

function actualRender(){
  if(!bound){
    API.init({});
    return;
  }
  queueRender();
}

function actualSetView(view){
  STATE.view = normalizeView(view);
  if(!bound){
    API.init({});
    return;
  }
  queueRender();
}

function actualSetAnchor(anchor){
  STATE.anchor = new Date(anchor || Date.now());
  if(!bound){
    API.init({});
    return;
  }
  queueRender();
}

function actualCalPrev(){
  shiftState(-1);
  actualRender();
}

function actualCalNext(){
  shiftState(1);
  actualRender();
}

function actualCalToday(){
  STATE.anchor = new Date();
  actualRender();
}

function setRuntimeDeps(source = {}){
  if(!source) return;
  if(source.bus) runtime.bus = source.bus;
  if(source.services) runtime.services = source.services;
  if(source.openDB && typeof source.openDB === 'function'){
    runtime.openDB = source.openDB;
    if(!globalScope.openDB) globalScope.openDB = source.openDB;
  }else if(!runtime.openDB && typeof openDatabase === 'function'){
    runtime.openDB = openDatabase;
    if(!globalScope.openDB) globalScope.openDB = openDatabase;
  }
}

function attachViewChangeListener(){
  if(viewChangeUnsub) return;
  const handler = (evt) => {
    const detail = evt?.detail || {};
    const view = detail.view || detail.route || detail.name || detail.id || '';
    if(view && view !== 'calendar') return;
    const element = detail.element || detail.el || detail.root || detail.target || null;
    const deps = {
      element: element && typeof element === 'object' && typeof element.nodeType === 'number' ? element : null,
      bus: detail.bus || null,
      services: detail.services || null,
      openDB: detail.openDB || null
    };
    API.init(deps);
  };
  const sub = attachBusListener('app:view:changed', handler);
  if(sub){
    viewChangeUnsub = sub;
    return;
  }
  viewChangeUnsub = attachDocumentListener('app:view:changed', handler);
}

function setApiImplementations(){
  API.init = actualInit;
  API.render = actualRender;
  API.setView = actualSetView;
  API.setAnchor = actualSetAnchor;
  API.calPrev = actualCalPrev;
  API.calNext = actualCalNext;
  API.calToday = actualCalToday;
  if(globalScope) globalScope.__CALENDAR_TASK_TRACKER__ = trackTaskCreated;
  exportPublicAPI();
  while(pendingInitCalls.length){
    const next = pendingInitCalls.shift();
    try{ API.init(next); }
    catch (_err){}
  }
  if(pendingRenderRequest){
    pendingRenderRequest = false;
    API.render();
  }
}

function isCalendarVisible(){
  if(!documentRef) return false;
  const container = documentRef.getElementById('view-calendar');
  if(!container) return false;
  if(container.hasAttribute('hidden')) return false;
  const style = typeof globalScope.getComputedStyle === 'function'
    ? globalScope.getComputedStyle(container)
    : null;
  if(style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  return true;
}

function maybeAutoInit(){
  if(!isCalendarVisible()) return;
  API.init({ element: calendarRoot() });
}

export function initCalendar(ctx = {}){
  setRuntimeDeps(ctx);
  ensureDomReadyHook();
  ensureServicesPromise(ctx);
  if(initCalendarPromise){
    if(domReady && runtime.servicesReady) maybeAutoInit();
    return initCalendarPromise;
  }
  initCalendarPromise = (async () => {
    if(!wired){
      wired = true;
      globalScope.__CALENDAR_WIRED__ = true;
      setApiImplementations();
      attachViewChangeListener();
      if(domReady && runtime.servicesReady){
        maybeAutoInit();
      }else{
        handleEnvironmentReady();
      }
    }else if(domReady && runtime.servicesReady){
      maybeAutoInit();
    }
    markInitLogged();
    return runtime.servicesWaiter;
  })();
  return initCalendarPromise;
}

if(typeof whenServicesReady === 'function'){
  whenServicesReady().then(async (ok) => {
    if(ok === false) return;
    if(typeof openDatabase === 'function'){
      try{ await openDatabase(); }
      catch (_err){}
    }
    const crm = globalScope?.CRM || {};
    const ctx = crm?.ctx || {};
    const bus = runtime.bus || ctx?.events || crm?.events || documentRef;
    const services = runtime.services || ctx?.services || crm?.services || null;
    initCalendar({ element: calendarRoot(), bus, services, openDB: runtime.openDB || openDatabase }).catch(()=>{});
  }).catch(()=>{});
}

export default { init: initCalendar };
