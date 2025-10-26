import { __WHEN_SERVICES_READY as whenServicesReady } from './boot/contracts/services.js';
import { openDB as openDatabase } from './db.js';
import { initCalendar as createCalendar } from './calendar_impl.js';

const GLOBAL = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
const DOC = typeof document !== 'undefined' ? document : null;

const ROUTE_EVENTS = ['hashchange', 'app:navigate', 'app:view:changed', 'route:changed', 'shell:navigate'];

let controller = null;
let controllerPromise = null;
let servicesReady = false;
let routeEventsBound = false;
let enterCount = 0;
let lastRouteActive = false;
let lastHash = '';
let lastView = '';

if(typeof GLOBAL.renderCalendar !== 'function'){
  GLOBAL.renderCalendar = function renderCalendar(){
    return ensureController().then((ctrl) => (ctrl ? ctrl.render() : null));
  };
}
if(typeof GLOBAL.initCalendar !== 'function'){
  GLOBAL.initCalendar = function initCalendar(){
    return ensureController();
  };
}
if(typeof GLOBAL.setCalendarView !== 'function'){
  GLOBAL.setCalendarView = function setCalendarView(view){
    return ensureController().then((ctrl) => (ctrl ? ctrl.setView(view) : null));
  };
}
if(typeof GLOBAL.setCalendarAnchor !== 'function'){
  GLOBAL.setCalendarAnchor = function setCalendarAnchor(anchor){
    return ensureController().then((ctrl) => (ctrl ? ctrl.setAnchor(anchor) : null));
  };
}
if(typeof GLOBAL.calPrev !== 'function'){
  GLOBAL.calPrev = function calPrev(){
    return ensureController().then((ctrl) => (ctrl ? ctrl.prev() : null));
  };
}
if(typeof GLOBAL.calNext !== 'function'){
  GLOBAL.calNext = function calNext(){
    return ensureController().then((ctrl) => (ctrl ? ctrl.next() : null));
  };
}
if(typeof GLOBAL.calToday !== 'function'){
  GLOBAL.calToday = function calToday(){
    return ensureController().then((ctrl) => (ctrl ? ctrl.today() : null));
  };
}

const calendarApiBootstrap = GLOBAL.CalendarAPI = GLOBAL.CalendarAPI || {};
if(typeof calendarApiBootstrap.visibleEvents !== 'function'){
  calendarApiBootstrap.visibleEvents = () => [];
}
if(typeof calendarApiBootstrap.loadRange !== 'function'){
  calendarApiBootstrap.loadRange = (start, end) => ensureController().then((ctrl) => (ctrl ? ctrl.loadRange(start, end) : []));
}

const domReady = new Promise((resolve) => {
  if(!DOC){
    resolve();
    return;
  }
  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  }else{
    resolve();
  }
});

function currentHash(){
  if(!GLOBAL || !GLOBAL.location || typeof GLOBAL.location.hash !== 'string') return '';
  return GLOBAL.location.hash;
}

function isCalendarRoute(hash){
  const value = typeof hash === 'string' ? hash.trim() : '';
  if(!value) return false;
  if(value === '#/calendar' || value === '#calendar') return true;
  if(value.startsWith('#/calendar?')) return true;
  return false;
}

function getMount(){
  if(!DOC) return null;
  const view = DOC.getElementById('view-calendar');
  if(!view) return null;
  const mount = view.querySelector('#calendar-root');
  return mount || null;
}

function gatherDependencies(){
  const crm = GLOBAL && GLOBAL.CRM ? GLOBAL.CRM : {};
  const ctx = crm && typeof crm === 'object' && crm.ctx ? crm.ctx : {};
  const bus = ctx.events || ctx.emitter || crm.events || DOC;
  const services = ctx.services || crm.services || null;
  return { bus, services };
}

function exposeGlobals(){
  const ensure = () => ensureController();
  const call = (fn) => ensureController().then((ctrl) => {
    if(!ctrl) return null;
    return fn(ctrl);
  });

  GLOBAL.renderCalendar = function renderCalendar(){
    return call((ctrl) => ctrl.render());
  };

  GLOBAL.initCalendar = function initCalendar(){
    return ensure();
  };

  GLOBAL.setCalendarView = function setCalendarView(view){
    return call((ctrl) => ctrl.setView(view));
  };

  GLOBAL.setCalendarAnchor = function setCalendarAnchor(anchor){
    return call((ctrl) => ctrl.setAnchor(anchor));
  };

  GLOBAL.calPrev = function calPrev(){
    return call((ctrl) => ctrl.prev());
  };

  GLOBAL.calNext = function calNext(){
    return call((ctrl) => ctrl.next());
  };

  GLOBAL.calToday = function calToday(){
    return call((ctrl) => ctrl.today());
  };

  const calendarApi = GLOBAL.CalendarAPI = GLOBAL.CalendarAPI || {};
  calendarApi.visibleEvents = function visibleEvents(){
    if(controller){
      return controller.visibleEvents();
    }
    return [];
  };
  calendarApi.loadRange = function loadRange(start, end){
    return call((ctrl) => ctrl.loadRange(start, end));
  };
}

function ensureController(){
  if(controller) return Promise.resolve(controller);
  if(controllerPromise) return controllerPromise;
  controllerPromise = domReady.then(() => {
    const mount = getMount();
    if(!mount) return null;
    const { bus, services } = gatherDependencies();
    try{
      controller = createCalendar({ openDB: openDatabase, bus, services, mount });
      exposeGlobals();
      return controller;
    }catch (err){
      if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
        console.warn('calendar init failed', err);
      }
      controller = null;
      return null;
    }
  }).finally(() => {
    controllerPromise = null;
  });
  return controllerPromise;
}

async function handleRouteChange(event){
  if(!servicesReady) return;
  await domReady;
  const hash = currentHash();
  const eventView = event && event.detail && typeof event.detail.view === 'string'
    ? event.detail.view.trim().toLowerCase()
    : '';
  const activeByHash = isCalendarRoute(hash);
  const activeByEvent = eventView === 'calendar';
  const active = activeByEvent || activeByHash;
  if(!active){
    lastRouteActive = false;
    lastHash = hash;
    if(eventView) lastView = eventView;
    else if(!activeByHash && !activeByEvent) lastView = '';
    return;
  }
  const ctrl = await ensureController();
  if(!ctrl) return;
  const entering = !lastRouteActive
    || (activeByHash && hash !== lastHash)
    || (activeByEvent && lastView !== 'calendar');
  lastRouteActive = true;
  lastHash = hash;
  lastView = 'calendar';
  if(entering){
    enterCount += 1;
    await ctrl.enter(enterCount);
    return;
  }
  ctrl.render();
}

function bindRouteEvents(){
  if(routeEventsBound || !GLOBAL || typeof GLOBAL.addEventListener !== 'function') return;
  routeEventsBound = true;
  ROUTE_EVENTS.forEach((eventName) => {
    try{ GLOBAL.addEventListener(eventName, handleRouteChange); }
    catch (_err){}
  });
}

whenServicesReady().then((ok) => {
  if(ok === false){
    if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
      console.warn('calendar services not fully ready; continuing');
    }
  }
  servicesReady = true;
  bindRouteEvents();
  handleRouteChange();
}).catch(() => {
  servicesReady = true;
  bindRouteEvents();
  handleRouteChange();
});

export function ensureCalendar(){
  return ensureController();
}

export default { init: ensureCalendar };
