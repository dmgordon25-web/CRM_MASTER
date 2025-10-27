
import { rangeForView, addDays, ymd, loadEventsBetween, parseDateInput, toLocalMidnight, isWithinRange } from './calendar/index.js';
import { createTaskFromEvent } from './tasks/api.js';
import { openContactModal } from './contacts.js';
import { openPartnerEditModal } from './ui/modals/partner_edit/index.js';
import { attachStatusBanner } from './ui/status_banners.js';

const GLOBAL = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
const DOC = typeof document !== 'undefined' ? document : null;

const STORAGE_KEYS = Object.freeze({
  lastTask: 'calendar:lastTaskId',
});

const COLOR_PRESETS = [
  { key: 'contact', label: 'Contacts', color: '#2563eb' },
  { key: 'task', label: 'Tasks', color: '#16a34a' },
  { key: 'milestone', label: 'Milestones', color: '#f97316' },
  { key: 'other', label: 'Other', color: '#6b7280' },
];

const LOAN_PALETTE = Object.freeze([
  { key: 'fha', label: 'FHA', css: 'loan-purchase' },
  { key: 'va', label: 'VA', css: 'loan-refi' },
  { key: 'conv', label: 'Conventional', css: 'loan-heloc' },
  { key: 'jumbo', label: 'Jumbo', css: 'loan-construction' },
  { key: 'other', label: 'Other', css: 'loan-other' },
]);

const TIME_FORMAT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

function normalizeLoanType(value){
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if(!raw) return 'other';
  if(raw.includes('fha')) return 'fha';
  if(raw.includes('va') && !raw.includes('nav')) return 'va';
  if(raw.includes('jumbo')) return 'jumbo';
  if(raw.includes('conv')) return 'conv';
  if(raw.includes('refi')) return 'conv';
  return 'other';
}

function cloneLoanPalette(){
  return LOAN_PALETTE.map((item) => ({ ...item }));
}

function formatContactName(record){
  if(!record || typeof record !== 'object') return '';
  const first = record.firstName || record.first || '';
  const last = record.lastName || record.last || '';
  const combined = `${first} ${last}`.trim();
  if(combined) return combined;
  if(record.name) return String(record.name);
  if(record.company) return String(record.company);
  return '';
}

function toDateValue(value){
  if(value instanceof Date){
    const clone = new Date(value.getTime());
    clone.setHours(0, 0, 0, 0);
    return clone;
  }
  const parsed = parseDateInput(value);
  if(parsed) return parsed;
  if(typeof value === 'number' && Number.isFinite(value)){
    const fromNumber = new Date(value);
    if(!Number.isNaN(fromNumber.getTime())){
      fromNumber.setHours(0, 0, 0, 0);
      return fromNumber;
    }
  }
  if(typeof value === 'string' && value.trim()){
    const fromString = new Date(value);
    if(!Number.isNaN(fromString.getTime())){
      fromString.setHours(0, 0, 0, 0);
      return fromString;
    }
  }
  return null;
}

function makeSource(entity, id, field){
  const result = {};
  if(entity) result.entity = String(entity);
  if(id != null && id !== '') result.id = String(id);
  if(field) result.field = String(field);
  return Object.keys(result).length ? result : null;
}

function buildAnnualEvents(contact, field, label, type, range){
  const raw = contact && contact[field];
  const base = toDateValue(raw);
  if(!base) return [];
  const month = base.getMonth();
  const day = base.getDate();
  const contactName = formatContactName(contact);
  const contactId = contact && contact.id ? String(contact.id) : '';
  const startYear = range.start instanceof Date ? range.start.getFullYear() : (range.anchor instanceof Date ? range.anchor.getFullYear() : new Date().getFullYear());
  const endYear = range.end instanceof Date ? range.end.getFullYear() : startYear;
  const events = [];
  for(let year = startYear - 1; year <= endYear + 1; year += 1){
    const date = toLocalMidnight(new Date(year, month, day));
    if(!date || !isWithinRange(date, range.start, range.end)) continue;
    events.push({
      id: `${type}:${field}:${contactId || `${month}-${day}`}:${year}`,
      type,
      title: `${label}: ${contactName || 'Contact'}`,
      subtitle: '',
      status: contact && contact.stage ? String(contact.stage) : '',
      contactId,
      partnerId: contact && contact.partnerId ? String(contact.partnerId) : '',
      contactName,
      date,
      source: makeSource('contact', contactId, field),
    });
  }
  return events;
}

function collectTaskEvents(tasks, contactMap, range){
  const list = [];
  (Array.isArray(tasks) ? tasks : []).forEach((task, index) => {
    if(!task) return;
    const dueDate = toDateValue(task.due || task.date || task.dueDate);
    if(!dueDate || !isWithinRange(dueDate, range.start, range.end)) return;
    const contactId = task.contactId ? String(task.contactId) : (task.partnerId ? String(task.partnerId) : '');
    const contact = contactId ? contactMap.get(contactId) : null;
    const contactName = formatContactName(contact);
    list.push({
      id: task.id ? `task:${task.id}` : `task:${dueDate.getTime()}:${index}`,
      type: 'task',
      title: task.title ? String(task.title) : 'Task',
      subtitle: contactName || '',
      status: task.status ? String(task.status) : '',
      contactId: contact && contact.id ? String(contact.id) : '',
      partnerId: task.partnerId ? String(task.partnerId) : '',
      contactName,
      date: dueDate,
      source: makeSource('task', task.id, 'due'),
    });
  });
  return list;
}

function collectDealEvents(deals, contactMap, range){
  const list = [];
  (Array.isArray(deals) ? deals : []).forEach((deal, index) => {
    if(!deal) return;
    const date = toDateValue(deal.closingDate || deal.date);
    if(!date || !isWithinRange(date, range.start, range.end)) return;
    const contactId = deal.contactId ? String(deal.contactId) : '';
    const contact = contactId ? contactMap.get(contactId) : null;
    const contactName = formatContactName(contact);
    list.push({
      id: deal.id ? `deal:${deal.id}` : `deal:${date.getTime()}:${index}`,
      type: 'milestone',
      title: contactName ? `Closing: ${contactName}` : 'Closing Milestone',
      subtitle: deal.status ? String(deal.status) : '',
      status: deal.status ? String(deal.status) : '',
      contactId,
      partnerId: contact && contact.partnerId ? String(contact.partnerId) : '',
      contactName,
      date,
      source: makeSource('deal', deal.id, 'closingDate'),
    });
  });
  return list;
}

function collectContactEvents(contacts, range){
  const list = [];
  (Array.isArray(contacts) ? contacts : []).forEach((contact) => {
    if(!contact) return;
    list.push(
      ...buildAnnualEvents(contact, 'birthday', 'Birthday', 'contact', range),
      ...buildAnnualEvents(contact, 'anniversary', 'Anniversary', 'milestone', range),
    );
  });
  return list;
}

function collectEvents(contacts, tasks, deals, anchor, start, end){
  const startDate = start instanceof Date ? new Date(start.getTime()) : toLocalMidnight(anchor || new Date());
  const endDate = end instanceof Date ? new Date(end.getTime()) : addDays(startDate, 42);
  const contactMap = new Map();
  (Array.isArray(contacts) ? contacts : []).forEach((contact) => {
    if(contact && contact.id != null){
      contactMap.set(String(contact.id), contact);
    }
  });
  const range = { start: startDate, end: endDate, anchor: anchor instanceof Date ? new Date(anchor.getTime()) : startDate };
  const events = [
    ...collectTaskEvents(tasks, contactMap, range),
    ...collectDealEvents(deals, contactMap, range),
    ...collectContactEvents(contacts, range),
  ];
  return events;
}

function normalizeProvidedEvents(events, anchor, start, end){
  const startDate = start instanceof Date ? new Date(start.getTime()) : toLocalMidnight(anchor || new Date());
  const endDate = end instanceof Date ? new Date(end.getTime()) : addDays(startDate, 42);
  return (Array.isArray(events) ? events : [])
    .map((event, index) => {
      if(!event) return null;
      const date = toDateValue(event.date);
      if(!date || !isWithinRange(date, startDate, endDate)) return null;
      return {
        ...event,
        date,
        source: makeSource(event?.source?.entity, event?.source?.id, event?.source?.field),
        id: event.id ? String(event.id) : `event:${date.getTime()}:${index}`,
      };
    })
    .filter(Boolean);
}

function ensureCalendarHelpers(){
  const helpers = {
    collectEvents,
    normalizeProvidedEvents,
    invalidateCache(){},
    __test__: {
      loanPalette: cloneLoanPalette(),
      normalizeLoanType,
    },
  };
  if(GLOBAL.__CALENDAR_IMPL__ && typeof GLOBAL.__CALENDAR_IMPL__ === 'object'){
    Object.assign(GLOBAL.__CALENDAR_IMPL__, helpers);
    if(GLOBAL.__CALENDAR_IMPL__.__test__){
      GLOBAL.__CALENDAR_IMPL__.__test__.loanPalette = cloneLoanPalette();
      GLOBAL.__CALENDAR_IMPL__.__test__.normalizeLoanType = normalizeLoanType;
    }
  }else{
    GLOBAL.__CALENDAR_IMPL__ = helpers;
  }
}

ensureCalendarHelpers();

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
  if(!id) return;
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
  if(typeof window === 'undefined') return '';
  const fromLocal = safeStorageGet(window.localStorage, STORAGE_KEYS.lastTask);
  const fromSession = safeStorageGet(window.sessionStorage, STORAGE_KEYS.lastTask);
  return fromLocal || fromSession || '';
}

function ensureDebug(){
  if(GLOBAL.__CAL_DEBUG__ && typeof GLOBAL.__CAL_DEBUG__ === 'object') return GLOBAL.__CAL_DEBUG__;
  const lastTaskId = loadRememberedTaskId();
  GLOBAL.__CAL_DEBUG__ = {
    enteredCount: 0,
    renderCount: 0,
    month: { cells: 0, events: 0 },
    week: { days: 0, events: 0 },
    day: { slots: 0, events: 0 },
    legendItems: 0,
    visible: false,
    taskId: lastTaskId || '',
  };
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
  const root = DOC.getElementById('view-calendar');
  if(!root) return;
  const buttons = root.querySelectorAll('[data-calview]');
  buttons.forEach((button) => {
    const target = String(button.dataset.calview || '').toLowerCase();
    const isActive = target === view;
    try{ button.classList.toggle('active', isActive); }
    catch (_err){}
    try{ button.setAttribute('aria-pressed', isActive ? 'true' : 'false'); }
    catch (_err){}
  });
}

function updateCalendarLabel(range, view){
  if(!DOC) return;
  const node = DOC.getElementById('calendar-label');
  if(!node) return;
  node.textContent = labelForRange(range, view) || '';
}

function dispatchThroughBus(bus, eventName, detail){
  if(!bus) return;
  try{
    if(typeof bus.emit === 'function'){
      bus.emit(eventName, detail);
      return;
    }
    if(typeof bus.dispatchEvent === 'function'){
      const evt = new CustomEvent(eventName, { detail });
      bus.dispatchEvent(evt);
    }
  }catch (_err){}
}

function isVisible(node){
  if(!node || !DOC) return false;
  const owner = DOC.defaultView || (typeof window !== 'undefined' ? window : null);
  if(!owner) return false;
  try{
    const rect = node.getBoundingClientRect();
    const style = owner.getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }catch (_err){
    return false;
  }
}

function ensureVisible(node){
  if(!node || !DOC) return false;
  try{ node.removeAttribute('hidden'); }
  catch (_err){}
  try{ node.classList.remove('hidden'); }
  catch (_err){}
  try{ node.setAttribute('aria-hidden', 'false'); }
  catch (_err){}
  const host = node.closest('#view-calendar');
  if(host){
    try{ host.removeAttribute('hidden'); }
    catch (_err){}
    try{ host.classList.remove('hidden'); }
    catch (_err){}
    try{ host.setAttribute('aria-hidden', 'false'); }
    catch (_err){}
  }
  return isVisible(node);
}

function eventTypeKey(event){
  const type = event && event.type ? String(event.type).toLowerCase() : '';
  if(type) return type;
  const source = event && event.source && typeof event.source === 'object' ? event.source : null;
  const entity = source && source.entity ? String(source.entity).toLowerCase() : '';
  if(entity) return entity;
  return 'other';
}

function colorForEvent(event){
  const key = eventTypeKey(event);
  const preset = COLOR_PRESETS.find((item) => key.includes(item.key));
  return preset ? preset.color : COLOR_PRESETS[COLOR_PRESETS.length - 1].color;
}

function labelForEvent(event){
  const key = eventTypeKey(event);
  const preset = COLOR_PRESETS.find((item) => key.includes(item.key));
  return preset ? preset.label : 'Other';
}

function parseHourFromString(value){
  if(!value) return null;
  const text = String(value).trim();
  if(!text) return null;
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if(!match) return null;
  let hour = parseInt(match[1], 10);
  let minute = match[2] ? parseInt(match[2], 10) : 0;
  if(Number.isNaN(hour)) return null;
  if(Number.isNaN(minute)) minute = 0;
  const meridiem = match[3] ? match[3].toLowerCase() : '';
  if(meridiem){
    if(hour === 12) hour = 0;
    if(meridiem === 'pm') hour += 12;
  }
  if(hour < 0) hour = 0;
  if(hour > 23) hour = hour % 24;
  if(minute < 0) minute = 0;
  if(minute > 59) minute = 59;
  return { hour, minute };
}

function deriveTimeInfo(event){
  if(!event) return { slot: 'all-day', hour: null, minute: 0, label: 'All Day' };
  if(event.allDay) return { slot: 'all-day', hour: null, minute: 0, label: 'All Day' };
  const date = event.date instanceof Date ? event.date : parseDateInput(event.date);
  if(date instanceof Date && !Number.isNaN(date.getTime())){
    const hour = date.getHours();
    const minute = date.getMinutes();
    if(hour || minute){
      return {
        slot: hour,
        hour,
        minute,
        label: TIME_FORMAT.format(date),
      };
    }
  }
  const candidate = event.timeLabel || event.time || event.startTime || event.dueTime || '';
  const parsed = parseHourFromString(candidate);
  if(parsed){
    const { hour, minute } = parsed;
    const temp = new Date();
    temp.setHours(hour, minute, 0, 0);
    return {
      slot: hour,
      hour,
      minute,
      label: TIME_FORMAT.format(temp),
    };
  }
  return { slot: 'all-day', hour: null, minute: 0, label: 'All Day' };
}

function normalizeSource(source){
  if(!source || typeof source !== 'object') return null;
  return {
    entity: source.entity ? String(source.entity) : '',
    id: source.id ? String(source.id) : '',
    field: source.field ? String(source.field) : '',
  };
}

function normalizeEvent(raw, index){
  if(!raw) return null;
  const date = raw.date instanceof Date ? new Date(raw.date.getTime()) : parseDateInput(raw.date || raw.anchor || raw.startDate || raw.dueDate);
  if(!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const id = raw.id || raw.uid || (raw.source && raw.source.id) || `${raw.type || 'event'}:${date.getTime()}:${index}`;
  const type = raw.type ? String(raw.type) : '';
  const color = colorForEvent(raw);
  const timeInfo = deriveTimeInfo({ ...raw, date });
  const label = raw.title ? String(raw.title) : 'Calendar Event';
  const subtitle = raw.subtitle ? String(raw.subtitle) : '';
  const status = raw.status ? String(raw.status) : '';
  const contactId = raw.contactId || raw.partnerId || (raw.source && raw.source.entity === 'partner' ? raw.source.id : null);
  const partnerId = raw.partnerId || raw.contactId || null;
  const hasLoan = !!raw.hasLoan;
  const contactName = raw.contactName ? String(raw.contactName) : '';
  const loanKey = raw.loanKey ? String(raw.loanKey) : '';
  const loanLabel = raw.loanLabel ? String(raw.loanLabel) : '';
  return {
    id: String(id),
    type,
    title: label,
    subtitle,
    status,
    contactId: contactId ? String(contactId) : '',
    partnerId: partnerId ? String(partnerId) : '',
    contactName,
    hasLoan,
    loanKey,
    loanLabel,
    date,
    allDay: timeInfo.slot === 'all-day',
    timeLabel: timeInfo.label,
    hourSlot: timeInfo.slot,
    hour: timeInfo.hour,
    minute: timeInfo.minute,
    color,
    label: labelForEvent(raw),
    source: normalizeSource(raw.source),
  };
}

function normalizeEvents(list){
  return (Array.isArray(list) ? list : [])
    .map((item, index) => normalizeEvent(item, index))
    .filter(Boolean)
    .sort((a, b) => {
      const timeDiff = a.date.getTime() - b.date.getTime();
      if(timeDiff !== 0) return timeDiff;
      if(a.hourSlot === 'all-day' && b.hourSlot !== 'all-day') return -1;
      if(a.hourSlot !== 'all-day' && b.hourSlot === 'all-day') return 1;
      if(typeof a.hour === 'number' && typeof b.hour === 'number' && a.hour !== b.hour) return a.hour - b.hour;
      return a.title.localeCompare(b.title);
    });
}

function cloneForApi(event){
  if(!event) return null;
  return {
    id: event.id,
    uid: event.id,
    type: event.type,
    title: event.title,
    subtitle: event.subtitle,
    status: event.status,
    contactId: event.contactId,
    partnerId: event.partnerId,
    contactName: event.contactName,
    hasLoan: event.hasLoan,
    loanKey: event.loanKey,
    loanLabel: event.loanLabel,
    date: new Date(event.date.getTime()),
    source: event.source ? { ...event.source } : null,
    timeLabel: event.timeLabel,
    allDay: event.allDay,
    color: event.color,
  };
}

function createEventNode(event, handlers){
  const node = DOC.createElement('div');
  node.className = 'calendar-event';
  node.dataset.id = event.id;
  node.dataset.type = event.type || '';
  node.dataset.label = event.label || '';
  node.tabIndex = 0;
  node.style.borderLeft = `4px solid ${event.color}`;
  node.style.borderRadius = '6px';
  node.style.background = '#fff';
  node.style.boxShadow = '0 1px 2px rgba(15,23,42,0.08)';
  node.style.padding = '6px 8px';
  node.style.display = 'grid';
  node.style.gap = '4px';
  if(event.contactId || event.partnerId){
    node.style.cursor = 'pointer';
  }

  const header = DOC.createElement('div');
  header.className = 'calendar-event-header';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  const title = DOC.createElement('span');
  title.className = 'calendar-event-title';
  title.textContent = event.title || 'Calendar Event';
  header.appendChild(title);
  const time = DOC.createElement('span');
  time.className = 'calendar-event-time muted';
  time.textContent = event.timeLabel || '';
  header.appendChild(time);
  node.appendChild(header);

  const detail = DOC.createElement('div');
  detail.className = 'calendar-event-detail muted';
  const detailParts = [];
  if(event.subtitle) detailParts.push(event.subtitle);
  if(event.contactName) detailParts.push(event.contactName);
  if(event.status) detailParts.push(event.status);
  detail.textContent = detailParts.join(' • ');
  node.appendChild(detail);

  if(event.contactId && String(event.type || '').toLowerCase() !== 'task'){
    const actions = DOC.createElement('div');
    actions.className = 'calendar-event-actions';
    actions.style.display = 'flex';
    actions.style.gap = '6px';
    const button = DOC.createElement('button');
    button.type = 'button';
    button.className = 'calendar-event-action';
    button.textContent = 'Add as Task';
    button.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      handlers.onAddTask(event);
    });
    actions.appendChild(button);
    node.appendChild(actions);
  }

  const open = () => handlers.onOpen(event);
  node.addEventListener('click', (evt) => {
    if(evt.defaultPrevented) return;
    open();
  });
  node.addEventListener('keydown', (evt) => {
    if(evt.defaultPrevented) return;
    if(evt.key === 'Enter' || evt.key === ' '){
      evt.preventDefault();
      open();
    }
  });

  return node;
}

function renderLegend(){
  const container = DOC.createElement('div');
  container.dataset.qa = 'calendar-legend';
  container.className = 'calendar-legend';
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.gap = '12px';
  COLOR_PRESETS.forEach((item) => {
    const entry = DOC.createElement('div');
    entry.className = 'calendar-legend-item';
    entry.style.display = 'flex';
    entry.style.alignItems = 'center';
    entry.style.gap = '6px';
    const swatch = DOC.createElement('span');
    swatch.className = 'calendar-legend-swatch';
    swatch.style.width = '12px';
    swatch.style.height = '12px';
    swatch.style.borderRadius = '999px';
    swatch.style.background = item.color;
    swatch.dataset.color = item.color;
    entry.appendChild(swatch);
    const label = DOC.createElement('span');
    label.className = 'calendar-legend-label';
    label.textContent = item.label;
    entry.appendChild(label);
    container.appendChild(entry);
  });
  return { node: container, count: COLOR_PRESETS.length };
}

function renderMonthView(range, events, handlers){
  const grid = DOC.createElement('div');
  grid.className = 'calendar-month-grid';
  grid.dataset.qa = 'calendar-month-grid';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
  grid.style.gap = '8px';
  const totalDays = Math.max(28, range.days || 42);
  const eventsByDay = new Map();
  events.forEach((event) => {
    const key = ymd(event.date);
    if(!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key).push(event);
  });
  const cells = [];
  const visibleEvents = [];
  let cursor = range.start instanceof Date ? new Date(range.start.getTime()) : toLocalMidnight(new Date());
  for(let index = 0; index < totalDays; index += 1){
    const key = ymd(cursor);
    const dayEvents = eventsByDay.get(key) || [];
    const cell = DOC.createElement('div');
    cell.className = 'calendar-cell';
    cell.dataset.date = key;
    cell.style.background = '#fff';
    cell.style.border = '1px solid rgba(15,23,42,0.08)';
    cell.style.borderRadius = '8px';
    cell.style.padding = '8px';
    cell.style.display = 'grid';
    cell.style.gridTemplateRows = 'auto 1fr';
    cell.style.gap = '6px';
    const header = DOC.createElement('header');
    header.className = 'calendar-cell-header';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'baseline';
    const title = DOC.createElement('span');
    title.textContent = `${cursor.getDate()}`;
    header.appendChild(title);
    const weekday = DOC.createElement('span');
    weekday.className = 'muted';
    weekday.textContent = WEEKDAY_FORMAT.format(cursor);
    header.appendChild(weekday);
    cell.appendChild(header);
    const list = DOC.createElement('div');
    list.className = 'calendar-cell-events';
    list.style.display = 'grid';
    list.style.gap = '6px';
    dayEvents.forEach((event) => {
      const node = createEventNode(event, handlers);
      list.appendChild(node);
      visibleEvents.push(event);
    });
    cell.appendChild(list);
    grid.appendChild(cell);
    cells.push(cell);
    cursor = addDays(cursor, 1);
  }
  return {
    node: grid,
    visibleEvents,
    metrics: {
      month: { cells: cells.length, events: visibleEvents.length },
      week: { days: 0, events: 0 },
      day: { slots: 0, events: 0 },
    },
  };
}

function buildHourLabels(){
  const labels = [];
  for(let hour = 0; hour < 24; hour += 1){
    labels.push(hour);
  }
  return labels;
}

function renderWeekView(range, events, handlers){
  const container = DOC.createElement('div');
  container.className = 'calendar-week-grid';
  container.dataset.qa = 'calendar-week-grid';
  container.style.display = 'grid';
  container.style.gridTemplateRows = 'auto 1fr';
  container.style.gap = '8px';

  const header = DOC.createElement('div');
  header.className = 'calendar-week-header';
  header.style.display = 'grid';
  header.style.gridTemplateColumns = '80px repeat(7, minmax(0, 1fr))';
  header.style.gap = '4px';
  header.appendChild(DOC.createElement('div'));
  for(let offset = 0; offset < 7; offset += 1){
    const day = addDays(range.start, offset);
    const cell = DOC.createElement('div');
    cell.className = 'calendar-week-header-cell';
    cell.textContent = `${WEEKDAY_FORMAT.format(day)} ${day.getDate()}`;
    header.appendChild(cell);
  }
  container.appendChild(header);

  const visibleEvents = [];
  const allDayRow = DOC.createElement('div');
  allDayRow.className = 'calendar-week-allday';
  allDayRow.style.display = 'grid';
  allDayRow.style.gridTemplateColumns = '80px repeat(7, minmax(0, 1fr))';
  allDayRow.style.gap = '4px';
  const allDayLabel = DOC.createElement('div');
  allDayLabel.className = 'calendar-time-label muted';
  allDayLabel.textContent = 'All Day';
  allDayRow.appendChild(allDayLabel);
  for(let offset = 0; offset < 7; offset += 1){
    const day = addDays(range.start, offset);
    const dayKey = ymd(day);
    const cell = DOC.createElement('div');
    cell.className = 'calendar-week-cell';
    cell.dataset.date = dayKey;
    cell.style.minHeight = '60px';
    cell.style.border = '1px solid rgba(15,23,42,0.08)';
    cell.style.borderRadius = '6px';
    cell.style.padding = '4px';
    cell.style.display = 'grid';
    cell.style.gap = '4px';
    events.filter((event) => ymd(event.date) === dayKey && event.hourSlot === 'all-day')
      .forEach((event) => {
        const node = createEventNode(event, handlers);
        cell.appendChild(node);
        visibleEvents.push(event);
      });
    allDayRow.appendChild(cell);
  }

  const body = DOC.createElement('div');
  body.className = 'calendar-week-body';
  body.style.display = 'grid';
  body.style.gap = '4px';
  const hours = buildHourLabels();
  hours.forEach((hour) => {
    const row = DOC.createElement('div');
    row.className = 'calendar-week-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '80px repeat(7, minmax(0, 1fr))';
    row.style.alignItems = 'stretch';
    row.style.gap = '4px';
    const label = DOC.createElement('div');
    label.className = 'calendar-time-label muted';
    const base = new Date();
    base.setHours(hour, 0, 0, 0);
    label.textContent = TIME_FORMAT.format(base);
    row.appendChild(label);
    for(let offset = 0; offset < 7; offset += 1){
      const day = addDays(range.start, offset);
      const dayKey = ymd(day);
      const cell = DOC.createElement('div');
      cell.className = 'calendar-week-cell';
      cell.dataset.date = dayKey;
      cell.style.minHeight = '60px';
      cell.style.border = '1px solid rgba(15,23,42,0.08)';
      cell.style.borderRadius = '6px';
      cell.style.padding = '4px';
      cell.style.display = 'grid';
      cell.style.gap = '4px';
      events.filter((event) => ymd(event.date) === dayKey && event.hourSlot === hour)
        .forEach((event) => {
          const node = createEventNode(event, handlers);
          cell.appendChild(node);
          visibleEvents.push(event);
        });
      row.appendChild(cell);
    }
    body.appendChild(row);
  });

  container.appendChild(allDayRow);
  container.appendChild(body);

  return {
    node: container,
    visibleEvents,
    metrics: {
      month: { cells: 0, events: 0 },
      week: { days: 7, events: visibleEvents.length },
      day: { slots: 0, events: 0 },
    },
  };
}

function renderDayView(range, events, handlers){
  const container = DOC.createElement('div');
  container.className = 'calendar-day-grid';
  container.dataset.qa = 'calendar-day-grid';
  container.style.display = 'grid';
  container.style.gap = '6px';
  const dayKey = ymd(range.start);
  const dayEvents = events.filter((event) => ymd(event.date) === dayKey);
  const visibleEvents = [];
  const hours = buildHourLabels();

  const allDayRow = DOC.createElement('div');
  allDayRow.className = 'calendar-day-row';
  allDayRow.style.display = 'grid';
  allDayRow.style.gridTemplateColumns = '100px 1fr';
  allDayRow.style.gap = '6px';
  const allDayLabel = DOC.createElement('div');
  allDayLabel.className = 'calendar-time-label muted';
  allDayLabel.textContent = 'All Day';
  allDayRow.appendChild(allDayLabel);
  const allDayCell = DOC.createElement('div');
  allDayCell.className = 'calendar-day-cell';
  allDayCell.style.border = '1px solid rgba(15,23,42,0.08)';
  allDayCell.style.borderRadius = '6px';
  allDayCell.style.padding = '6px';
  allDayCell.style.display = 'grid';
  allDayCell.style.gap = '6px';
  dayEvents.filter((event) => event.hourSlot === 'all-day').forEach((event) => {
    const node = createEventNode(event, handlers);
    allDayCell.appendChild(node);
    visibleEvents.push(event);
  });
  allDayRow.appendChild(allDayCell);
  container.appendChild(allDayRow);

  hours.forEach((hour) => {
    const row = DOC.createElement('div');
    row.className = 'calendar-day-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '100px 1fr';
    row.style.gap = '6px';
    const label = DOC.createElement('div');
    label.className = 'calendar-time-label muted';
    const base = new Date();
    base.setHours(hour, 0, 0, 0);
    label.textContent = TIME_FORMAT.format(base);
    row.appendChild(label);
    const cell = DOC.createElement('div');
    cell.className = 'calendar-day-cell';
    cell.style.border = '1px solid rgba(15,23,42,0.08)';
    cell.style.borderRadius = '6px';
    cell.style.padding = '6px';
    cell.style.display = 'grid';
    cell.style.gap = '6px';
    dayEvents.filter((event) => event.hourSlot === hour).forEach((event) => {
      const node = createEventNode(event, handlers);
      cell.appendChild(node);
      visibleEvents.push(event);
    });
    row.appendChild(cell);
    container.appendChild(row);
  });

  return {
    node: container,
    visibleEvents,
    metrics: {
      month: { cells: 0, events: 0 },
      week: { days: 0, events: 0 },
      day: { slots: hours.length + 1, events: visibleEvents.length },
    },
  };
}

function renderView(range, events, view, handlers){
  if(view === 'week') return renderWeekView(range, events, handlers);
  if(view === 'day') return renderDayView(range, events, handlers);
  return renderMonthView(range, events, handlers);
}

function renderSurface(mount, state, handlers){
  const range = rangeForView(state.anchor, state.view);
  updateCalendarLabel(range, state.view);
  markActiveView(state.view);
  const legend = renderLegend();
  const viewResult = renderView(range, state.events, state.view, handlers);
  const wrapper = DOC.createElement('div');
  wrapper.className = 'calendar-surface';
  wrapper.style.display = 'grid';
  wrapper.style.gap = '12px';

  const statusHost = DOC.createElement('div');
  statusHost.className = 'calendar-status muted';
  statusHost.style.display = 'flex';
  statusHost.style.flexWrap = 'wrap';
  statusHost.style.alignItems = 'center';
  statusHost.style.gap = '12px';
  statusHost.style.minHeight = '24px';
  const statusBanner = attachStatusBanner(statusHost, { tone: 'muted' });
  if(state.loading){
    statusBanner.showLoading('Loading…');
  }else if(state.errorMessage){
    statusBanner.showError(state.errorMessage || 'We were unable to load calendar events. Please try again.', {
      onRetry: () => {
        state.errorMessage = '';
        if(typeof state.retryRender === 'function'){
          state.retryRender();
        }
      }
    });
  }else if(!viewResult.visibleEvents.length){
    statusBanner.showEmpty('No events scheduled for this period.');
  }else{
    statusBanner.clear();
  }
  wrapper.appendChild(statusHost);

  wrapper.appendChild(legend.node);

  wrapper.appendChild(viewResult.node);

  mount.innerHTML = '';
  mount.appendChild(wrapper);
  try{ mount.dataset.view = state.view; }
  catch (_err){}

  const visible = ensureVisible(mount);
  state.visibleEvents = viewResult.visibleEvents.map((event) => cloneForApi(event)).filter(Boolean);

  const debug = ensureDebug();
  debug.renderCount = state.renderCount;
  debug.legendItems = legend.count;
  debug.visible = visible;
  debug.taskId = state.taskId || loadRememberedTaskId() || '';
  debug.month = viewResult.metrics.month;
  debug.week = viewResult.metrics.week;
  debug.day = viewResult.metrics.day;
  printDebug();

  const detail = {
    view: state.view,
    range: {
      start: range.start instanceof Date ? new Date(range.start.getTime()) : null,
      end: range.end instanceof Date ? new Date(range.end.getTime()) : null,
      anchor: range.anchor instanceof Date ? new Date(range.anchor.getTime()) : null,
    },
    metrics: {
      legendItems: legend.count,
      visibleEvents: state.visibleEvents.length,
      month: viewResult.metrics.month,
      week: viewResult.metrics.week,
      day: viewResult.metrics.day,
    },
  };
  if(DOC){
    try{ mount.dispatchEvent(new CustomEvent('calendar:rendered', { detail })); }
    catch (_err){}
    try{ DOC.dispatchEvent(new CustomEvent('calendar:rendered', { detail })); }
    catch (_err){}
  }

  return range;
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
    loading: false,
    errorMessage: '',
    renderCount: 0,
    entered: 0,
    taskId: loadRememberedTaskId(),
    retryRender: null,
  };

  const debug = ensureDebug();
  debug.taskId = state.taskId || '';

  if(state.taskId && typeof console !== 'undefined' && console && typeof console.log === 'function'){
    console.log(`TASK_CREATED:${state.taskId}`);
  }

  if(GLOBAL && typeof GLOBAL.__CALENDAR_TASK_TRACKER__ !== 'function'){
    GLOBAL.__CALENDAR_TASK_TRACKER__ = rememberTaskId;
  }

  let controlsBound = false;
  let rendering = Promise.resolve();

  const handlers = {
    onOpen(event){
      if(!event) return;
      const partnerId = event.partnerId ? String(event.partnerId) : '';
      const contactId = event.contactId ? String(event.contactId) : '';
      if(contactId){
        dispatchThroughBus(bus, 'calendar:event:open', { event, partnerId, contactId });
        try{ openContactModal(contactId, { sourceHint: 'calendar:event' }); }
        catch (_err){}
        return;
      }
      if(partnerId){
        dispatchThroughBus(bus, 'calendar:event:open', { event, partnerId, contactId });
        try{ openPartnerEditModal(partnerId, { sourceHint: 'calendar:event' }); }
        catch (_err){}
      }
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
      if(!outcome || outcome.status !== 'ok') return;
      const record = outcome.task || outcome.record || {};
      const id = record.id || outcome.id || '';
      if(id){
        rememberTaskId(id);
        state.taskId = String(id);
        updateDebug({ taskId: state.taskId });
        if(typeof console !== 'undefined' && console && typeof console.log === 'function'){
          console.log(`TASK_CREATED:${state.taskId}`);
        }
      }
      scheduleRender();
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
    let events = null;
    let errorMessage = '';
    try{
      const loaded = await loadEventsBetween(range.start, range.end, { anchor: state.anchor, view: state.view });
      events = normalizeEvents(loaded);
    }catch (err){
      if(typeof console !== 'undefined' && console && typeof console.error === 'function'){
        console.error('calendar load failed', err);
      }
      errorMessage = 'We were unable to load calendar events. Please try again.';
    }
    if(events){
      state.events = events;
    }else if(!state.events.length){
      state.events = [];
    }
    state.errorMessage = errorMessage;
    state.loading = false;
    state.renderCount += 1;
    range = renderSurface(mount, state, handlers);
    return range;
  }

  function scheduleRender(){
    const range = rangeForView(state.anchor, state.view);
    state.loading = true;
    state.renderCount += 1;
    renderSurface(mount, state, handlers);
    rendering = rendering.then(() => performRender()).catch((err) => {
      if(typeof console !== 'undefined' && console && typeof console.error === 'function'){
        console.error('calendar render failed', err);
      }
    });
    return rendering;
  }

  state.retryRender = () => scheduleRender();

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
    updateDebug({ enteredCount: state.entered });
    return scheduleRender();
  }

  function visibleEvents(){
    return state.visibleEvents.map((event) => cloneForApi(event)).filter(Boolean);
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
