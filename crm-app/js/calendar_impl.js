import { rangeForView, addDays, ymd, loadEventsBetween, parseDateInput, toLocalMidnight } from './calendar/index.js';
import { createTaskFromEvent } from './tasks/api.js';
import { openPartnerEditModal } from './ui/modals/partner_edit/index.js';

const GLOBAL = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
const DOC = typeof document !== 'undefined' ? document : null;
const STORAGE_KEYS = Object.freeze({
  lastTask: 'calendar:lastTaskId',
});

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

let visibilityWarned = false;

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
  if(GLOBAL){
    GLOBAL.__CAL_TASK_ID__ = value;
    GLOBAL.__LAST_TASK_ID__ = value;
  }
  if(typeof window !== 'undefined'){
    safeStorageSet(window.localStorage, STORAGE_KEYS.lastTask, value);
    safeStorageSet(window.sessionStorage, STORAGE_KEYS.lastTask, value);
  }
}

function loadRememberedTaskId(){
  if(GLOBAL && typeof GLOBAL.__CAL_TASK_ID__ === 'string' && GLOBAL.__CAL_TASK_ID__){
    return GLOBAL.__CAL_TASK_ID__;
  }
  const fromLocal = typeof window !== 'undefined'
    ? (safeStorageGet(window.localStorage, STORAGE_KEYS.lastTask) || safeStorageGet(window.sessionStorage, STORAGE_KEYS.lastTask))
    : '';
  if(fromLocal) return fromLocal;
  return '';
}

function cloneEvent(event){
  if(!event || typeof event !== 'object') return null;
  const copy = { ...event };
  if(event.date instanceof Date){
    copy.date = new Date(event.date.getTime());
  }else if(typeof event.date === 'string' || typeof event.date === 'number'){
    const parsed = parseDateInput(event.date);
    copy.date = parsed || (copy.date instanceof Date ? new Date(copy.date.getTime()) : null);
  }else{
    copy.date = null;
  }
  if(event.source && typeof event.source === 'object'){
    copy.source = {
      entity: event.source.entity ? String(event.source.entity) : '',
      id: event.source.id ? String(event.source.id) : '',
      field: event.source.field ? String(event.source.field) : '',
    };
  }
  return copy;
}

function ensureDebug(){
  if(GLOBAL.__CAL_DEBUG__ && typeof GLOBAL.__CAL_DEBUG__ === 'object') return GLOBAL.__CAL_DEBUG__;
  const lastTaskId = loadRememberedTaskId();
  const initial = {
    enteredCount: 0,
    renderCount: 0,
    cellCount: 0,
    visible: false,
    empty: false,
    taskId: lastTaskId || '',
  };
  GLOBAL.__CAL_DEBUG__ = initial;
  return GLOBAL.__CAL_DEBUG__;
}

function updateDebug(partial){
  const debug = ensureDebug();
  Object.assign(debug, partial);
  return debug;
}

function printDebug(){
  const debug = ensureDebug();
  if(typeof console !== 'undefined' && console && typeof console.log === 'function'){
    console.log('CAL_DEBUG', debug);
  }
}

function emitVisibilityFix(){
  if(visibilityWarned) return;
  visibilityWarned = true;
  if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
    console.warn('CAL_VISIBILITY_FIXED');
  }
}

function labelForRange(range, view){
  if(!range || !(range.anchor instanceof Date)) return '';
  if(view === 'day'){
    return DAY_FORMAT.format(range.anchor);
  }
  if(view === 'week'){
    const startLabel = MONTH_FORMAT.format(range.start || range.anchor);
    const endDate = addDays(range.start, 6);
    const endLabel = MONTH_FORMAT.format(endDate);
    if(startLabel === endLabel) return `${startLabel} (Week)`;
    return `${startLabel} – ${endLabel}`;
  }
  return MONTH_FORMAT.format(range.anchor);
}

function markActiveView(view){
  if(!DOC) return;
  const buttons = DOC.querySelectorAll('#view-calendar [data-calview]');
  buttons.forEach((button) => {
    const targetView = String(button.dataset.calview || '').toLowerCase();
    const isActive = targetView === view;
    try{ button.classList.toggle('active', isActive); }
    catch (_err){}
    try{ button.setAttribute('aria-pressed', isActive ? 'true' : 'false'); }
    catch (_err){}
  });
}

function updateCalendarLabel(range, view){
  if(!DOC) return;
  const label = DOC.getElementById('calendar-label');
  if(!label) return;
  const text = labelForRange(range, view);
  label.textContent = text || '';
}

function dispatchThroughBus(bus, eventName, detail){
  if(!bus) return;
  try{
    if(typeof bus.emit === 'function'){
      bus.emit(eventName, detail);
    }else if(typeof bus.dispatchEvent === 'function'){
      const evt = new CustomEvent(eventName, { detail });
      bus.dispatchEvent(evt);
    }
  }catch (_err){}
}

function applyVisibilityLock(mount){
  if(!mount || !DOC || typeof DOC.defaultView?.getComputedStyle !== 'function'){
    return false;
  }
  const grid = mount.querySelector('[data-qa="calendar-month-grid"]');
  if(!grid) return false;
  const style = DOC.defaultView.getComputedStyle(grid);
  const rect = grid.getBoundingClientRect();
  let visible = rect.height > 0
    && style.display !== 'none'
    && style.visibility !== 'hidden'
    && grid.getAttribute('aria-hidden') !== 'true';
  if(visible) return true;
  try{ mount.classList.remove('hidden'); }
  catch (_err){}
  try{ mount.removeAttribute('hidden'); }
  catch (_err){}
  try{ mount.setAttribute('aria-hidden', 'false'); }
  catch (_err){}
  try{ mount.style.removeProperty('display'); }
  catch (_err){}
  if(mount.style && mount.style.display === 'none'){
    try{ mount.style.display = ''; }
    catch (_err){}
  }
  const routeContainer = mount.closest('#view-calendar');
  if(routeContainer){
    try{ routeContainer.classList.remove('hidden'); }
    catch (_err){}
    try{ routeContainer.removeAttribute('hidden'); }
    catch (_err){}
    try{ routeContainer.setAttribute('aria-hidden', 'false'); }
    catch (_err){}
    try{ routeContainer.style.removeProperty('display'); }
    catch (_err){}
    if(routeContainer.style && routeContainer.style.display === 'none'){
      try{ routeContainer.style.display = ''; }
      catch (_err){}
    }
  }
  try{ grid.setAttribute('aria-hidden', 'false'); }
  catch (_err){}
  try{ grid.removeAttribute('hidden'); }
  catch (_err){}
  try{ grid.style.minHeight = '300px'; }
  catch (_err){}
  emitVisibilityFix();
  visible = true;
  return visible;
}

function createEventNode(event, handlers){
  const node = DOC.createElement('div');
  node.className = 'calendar-event';
  node.tabIndex = 0;
  node.dataset.type = event.type ? String(event.type) : '';
  const title = DOC.createElement('div');
  title.className = 'calendar-event-title';
  title.textContent = event.title || 'Calendar Event';
  node.appendChild(title);
  if(event.subtitle){
    const subtitle = DOC.createElement('div');
    subtitle.className = 'calendar-event-subtitle muted';
    subtitle.textContent = event.subtitle;
    node.appendChild(subtitle);
  }
  const footer = DOC.createElement('div');
  footer.className = 'calendar-event-footer';
  footer.style.display = 'flex';
  footer.style.gap = '6px';
  footer.style.flexWrap = 'wrap';
  const hintParts = [];
  if(event.contactName) hintParts.push(event.contactName);
  if(event.status) hintParts.push(event.status);
  if(event.source && event.source.entity){
    hintParts.push(event.source.entity);
  }
  if(hintParts.length){
    const meta = DOC.createElement('span');
    meta.className = 'calendar-event-meta muted';
    meta.textContent = hintParts.join(' • ');
    footer.appendChild(meta);
  }
  const isTask = String(event.type || '').toLowerCase() === 'task';
  if(event.contactId && !isTask){
    const action = DOC.createElement('button');
    action.type = 'button';
    action.className = 'calendar-event-action';
    action.textContent = 'Add as Task';
    action.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      handlers.onAddTask(event);
    });
    footer.appendChild(action);
  }
  if(footer.childNodes.length){
    node.appendChild(footer);
  }
  const activate = () => handlers.onOpen(event);
  node.addEventListener('click', (evt) => {
    if(evt.defaultPrevented) return;
    activate();
  });
  node.addEventListener('keydown', (evt) => {
    if(evt.defaultPrevented) return;
    if(evt.key === 'Enter' || evt.key === ' '){
      evt.preventDefault();
      activate();
    }
  });
  return node;
}

function buildCalendarGrid(range, events, view, handlers){
  const grid = DOC.createElement('div');
  grid.dataset.qa = 'calendar-month-grid';
  grid.className = `calendar-grid view-${view}`;
  grid.style.display = 'grid';
  grid.style.gap = '8px';
  grid.style.gridAutoRows = 'minmax(120px, auto)';
  const columns = view === 'day' ? 1 : 7;
  grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  const eventsByDay = new Map();
  events.forEach((event) => {
    const key = ymd(event.date || range.start);
    if(!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key).push(event);
  });
  const totalDays = view === 'day'
    ? 1
    : (view === 'week' ? 7 : Math.max(28, range.days || 42));
  let cursor = range.start instanceof Date ? new Date(range.start.getTime()) : toLocalMidnight(new Date());
  const cells = [];
  const visibleEvents = [];
  for(let index = 0; index < totalDays; index += 1){
    const dayKey = ymd(cursor);
    const dayEvents = eventsByDay.get(dayKey) || [];
    dayEvents.forEach((ev) => visibleEvents.push(ev));
    const cell = DOC.createElement('div');
    cell.className = 'calendar-cell';
    cell.dataset.date = dayKey;
    cell.style.background = '#fff';
    cell.style.border = '1px solid rgba(0,0,0,0.1)';
    cell.style.borderRadius = '6px';
    cell.style.padding = '8px';
    cell.style.display = 'flex';
    cell.style.flexDirection = 'column';
    cell.style.gap = '6px';
    const header = DOC.createElement('header');
    header.className = 'calendar-cell-header';
    header.textContent = `${cursor.getDate()} ${WEEKDAY_FORMAT.format(cursor)}`;
    cell.appendChild(header);
    const list = DOC.createElement('div');
    list.className = 'calendar-cell-events';
    dayEvents.forEach((event) => {
      const node = createEventNode(event, handlers);
      list.appendChild(node);
    });
    cell.appendChild(list);
    grid.appendChild(cell);
    cells.push(cell);
    cursor = addDays(cursor, 1);
  }
  return { grid, cells, visibleEvents };
}

function renderCalendar(mount, state, handlers){
  if(!DOC || !mount) return;
  const range = rangeForView(state.anchor, state.view);
  updateCalendarLabel(range, state.view);
  markActiveView(state.view);
  mount.innerHTML = '';
  const wrapper = DOC.createElement('div');
  wrapper.className = 'calendar-surface';
  const emptyBanner = DOC.createElement('div');
  emptyBanner.dataset.qa = 'calendar-empty';
  emptyBanner.className = 'calendar-empty muted';
  emptyBanner.textContent = 'No events scheduled for this period.';
  const { grid, cells, visibleEvents } = buildCalendarGrid(range, state.events, state.view, handlers);
  if(visibleEvents.length === 0){
    wrapper.appendChild(emptyBanner);
  }
  wrapper.appendChild(grid);
  mount.appendChild(wrapper);
  try{ mount.dataset.view = state.view; }
  catch (_err){}
  const visible = applyVisibilityLock(mount);
  updateDebug({
    renderCount: state.renderCount,
    cellCount: cells.length,
    empty: visibleEvents.length === 0,
    visible,
    taskId: state.taskId || '',
  });
  printDebug();
  state.visibleEvents = visibleEvents.map(cloneEvent).filter(Boolean);
  return { range, cells, grid, visibleEvents };
}

export function initCalendar({ openDB, bus, services, mount }){
  if(!DOC || !mount){
    throw new Error('calendar mount unavailable');
  }
  const state = {
    view: 'month',
    anchor: toLocalMidnight(new Date()),
    events: [],
    visibleEvents: [],
    renderCount: 0,
    taskId: loadRememberedTaskId(),
    entered: 0,
  };
  const debug = ensureDebug();
  debug.taskId = state.taskId || '';
  if(state.taskId){
    if(typeof console !== 'undefined' && console && typeof console.log === 'function'){
      console.log(`TASK_CREATED:${state.taskId}`);
    }
  }
  let controlsBound = false;
  let rendering = Promise.resolve();

  const handlers = {
    onOpen(event){
      if(!event || !event.contactId) return;
      dispatchThroughBus(bus, 'calendar:event:open', { event });
      try{ openPartnerEditModal(event.contactId, { sourceHint: 'calendar:event' }); }
      catch (_err){}
    },
    async onAddTask(event){
      let outcome = null;
      try{
        outcome = await createTaskFromEvent(event);
      }catch (err){
        if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
          console.warn('calendar task create failed', err);
        }
        return;
      }
      if(outcome && outcome.status === 'ok'){
        const record = outcome.task || outcome.record || {};
        const id = record.id || outcome.id || '';
        if(id){
          rememberTaskId(id);
          state.taskId = id;
          updateDebug({ taskId: id });
          printDebug();
          if(typeof console !== 'undefined' && console && typeof console.log === 'function'){
            console.log(`TASK_CREATED:${id}`);
          }
        }
        scheduleRender();
      }
    },
  };

  function ensureControls(){
    if(controlsBound) return;
    controlsBound = true;
    const root = mount.closest('#view-calendar') || DOC.getElementById('view-calendar') || DOC;
    const viewButtons = Array.from(root.querySelectorAll('[data-calview]'));
    viewButtons.forEach((button) => {
      button.addEventListener('click', (evt) => {
        evt.preventDefault();
        const nextView = String(button.dataset.calview || '').toLowerCase();
        setView(nextView);
      });
    });
    const prev = root.querySelector('#cal-prev');
    if(prev){
      prev.addEventListener('click', (evt) => {
        evt.preventDefault();
        shiftAnchor(-1);
      });
    }
    const next = root.querySelector('#cal-next');
    if(next){
      next.addEventListener('click', (evt) => {
        evt.preventDefault();
        shiftAnchor(1);
      });
    }
    const today = root.querySelector('#cal-today');
    if(today){
      today.addEventListener('click', (evt) => {
        evt.preventDefault();
        setAnchor(new Date());
      });
    }
  }

  async function performRender(){
    if(typeof openDB === 'function'){
      try{ await openDB(); }
      catch (_err){}
    }
    let range = rangeForView(state.anchor, state.view);
    let events = [];
    try{
      events = await loadEventsBetween(range.start, range.end, { anchor: state.anchor, view: state.view });
    }catch (err){
      if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
        console.warn('calendar load failed', err);
      }
      events = [];
    }
    state.events = Array.isArray(events)
      ? events.map((event) => cloneEvent(event)).filter(Boolean)
      : [];
    state.renderCount += 1;
    const result = renderCalendar(mount, state, handlers);
    range = rangeForView(state.anchor, state.view);
    updateCalendarLabel(range, state.view);
    return result;
  }

  function scheduleRender(){
    rendering = rendering.then(() => performRender()).catch((err) => {
      if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
        console.warn('calendar render failed', err);
      }
    });
    return rendering;
  }

  function setView(next){
    const normalized = next === 'week' || next === 'day' ? next : 'month';
    if(state.view === normalized){
      return scheduleRender();
    }
    state.view = normalized;
    return scheduleRender();
  }

  function setAnchor(next){
    const parsed = next instanceof Date ? toLocalMidnight(next) : parseDateInput(next);
    if(parsed){
      state.anchor = parsed;
    }
    return scheduleRender();
  }

  function shiftAnchor(offset){
    if(state.view === 'day'){
      return setAnchor(addDays(state.anchor, offset));
    }
    if(state.view === 'week'){
      return setAnchor(addDays(state.anchor, offset * 7));
    }
    const year = state.anchor.getFullYear();
    const month = state.anchor.getMonth();
    const shifted = new Date(year, month + offset, 1);
    return setAnchor(shifted);
  }

  function enter(count){
    ensureControls();
    state.entered = count || (state.entered + 1);
    const debugState = ensureDebug();
    debugState.enteredCount = state.entered;
    return scheduleRender();
  }

  function visibleEvents(){
    return state.visibleEvents.map((event) => cloneEvent(event)).filter(Boolean);
  }

  function loadRange(start, end){
    return loadEventsBetween(start, end, { anchor: state.anchor, view: state.view });
  }

  function next(){
    return shiftAnchor(1);
  }

  function prev(){
    return shiftAnchor(-1);
  }

  function today(){
    return setAnchor(new Date());
  }

  return {
    enter,
    render: scheduleRender,
    setView,
    setAnchor,
    next,
    prev,
    today,
    visibleEvents,
    loadRange,
    getState(){
      return {
        view: state.view,
        anchor: new Date(state.anchor.getTime()),
        events: visibleEvents(),
      };
    },
  };
}

export default { initCalendar };
