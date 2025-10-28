
import { rangeForView, addDays, ymd, loadEventsBetween, parseDateInput, toLocalMidnight, isWithinRange } from './calendar/index.js';
import { openContactModal } from './contacts.js';
import { openPartnerEditModal } from './ui/modals/partner_edit/index.js';
import { attachStatusBanner } from './ui/status_banners.js';
import { attachLoadingBlock, detachLoadingBlock } from './ui/loading_block.js';

const GLOBAL = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
const DOC = typeof document !== 'undefined' ? document : null;

const MAX_VISIBLE_EVENTS_MONTH = 3;

function isSafeModeActive(){
  if(GLOBAL && (GLOBAL.__SAFE_MODE__ === true || GLOBAL.__SAFE_MODE__ === 1 || GLOBAL.__SAFE_MODE__ === '1')) return true;
  if(typeof window !== 'undefined' && window.location && typeof window.location.search === 'string'){
    return /(?:^|[?&])safe=1(?:&|$)/.test(window.location.search);
  }
  return false;
}

const EVENT_CATEGORIES = Object.freeze([
  { key: 'meeting', label: 'Meeting', icon: '👥', type: 'contact', accent: '--accent-contact', tokens: ['contact', 'meeting', 'appointment', 'birthday', 'anniversary', 'review'] },
  { key: 'call', label: 'Call', icon: '📞', type: 'task', accent: '--accent-task', tokens: ['task', 'call', 'follow', 'touch', 'reminder', 'phone'] },
  { key: 'deadline', label: 'Deadline', icon: '⭐', type: 'milestone', accent: '--accent-milestone', tokens: ['milestone', 'deal', 'closing', 'deadline', 'funded', 'closing-watch'] },
  { key: 'other', label: 'Other', icon: '📌', type: 'other', accent: '--accent-other', tokens: [] },
]);

const DEFAULT_EVENT_CATEGORY = EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];

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

function ensureDebug(){
  if(GLOBAL.__CAL_DEBUG__ && typeof GLOBAL.__CAL_DEBUG__ === 'object') return GLOBAL.__CAL_DEBUG__;
  GLOBAL.__CAL_DEBUG__ = {
    enteredCount: 0,
    renderCount: 0,
    month: { cells: 0, events: 0 },
    week: { days: 0, events: 0 },
    day: { slots: 0, events: 0 },
    legendItems: 0,
    visible: false,
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

function isSameDay(a, b){
  if(!(a instanceof Date) || !(b instanceof Date)) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isWeekendDay(date){
  if(!(date instanceof Date)) return false;
  const day = date.getDay();
  return day === 0 || day === 6;
}

function eventTypeKey(event){
  const type = event && event.type ? String(event.type).toLowerCase() : '';
  if(type) return type;
  const source = event && event.source && typeof event.source === 'object' ? event.source : null;
  const entity = source && source.entity ? String(source.entity).toLowerCase() : '';
  if(entity) return entity;
  return 'other';
}

function metaForEvent(event){
  const parts = [];
  const typeKey = eventTypeKey(event);
  if(typeKey) parts.push(typeKey);
  const source = event && typeof event.source === 'object' ? event.source : null;
  if(source){
    if(source.entity) parts.push(String(source.entity));
    if(source.field) parts.push(String(source.field));
  }
  if(event && typeof event === 'object'){
    if(event.label) parts.push(String(event.label));
    if(event.title) parts.push(String(event.title));
    if(event.status) parts.push(String(event.status));
    if(event.subtitle) parts.push(String(event.subtitle));
  }
  const haystack = parts.map((value) => String(value).toLowerCase()).join(' ');
  for(const meta of EVENT_CATEGORIES){
    if(meta.tokens.length && meta.tokens.some((token) => haystack.includes(token))){
      return meta;
    }
  }
  return EVENT_CATEGORIES.find((meta) => meta.tokens.length === 0) || DEFAULT_EVENT_CATEGORY;
}

function colorForEvent(event){
  const meta = metaForEvent(event);
  return `var(${meta.accent})`;
}

function labelForEvent(event){
  const meta = metaForEvent(event);
  return meta.label;
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
  const meta = metaForEvent(raw);
  const color = `var(${meta.accent})`;
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
    accentToken: meta.accent,
    category: meta.type,
    categoryKey: meta.key,
    categoryLabel: meta.label,
    icon: meta.icon,
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
  const node = DOC.createElement('article');
  node.className = 'event-chip';
  node.dataset.id = event.id;
  node.dataset.qa = 'cal-event';
  const toneType = (event.category || event.type || 'other').toLowerCase();
  node.dataset.type = toneType || 'other';
  if(event.categoryKey) node.dataset.category = event.categoryKey;
  node.dataset.label = event.label || '';
  node.tabIndex = 0;

  const meta = event.categoryLabel ? { label: event.categoryLabel, icon: event.icon } : metaForEvent(event);
  const header = DOC.createElement('div');
  header.className = 'event-chip-head';
  const labelWrap = DOC.createElement('span');
  labelWrap.className = 'event-chip-label';
  const icon = DOC.createElement('span');
  icon.className = 'cal-event-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = (event.icon || meta.icon || '').trim() || '•';
  const title = DOC.createElement('span');
  title.className = 'event-chip-title';
  title.textContent = event.title || 'Calendar Event';
  labelWrap.appendChild(icon);
  labelWrap.appendChild(title);
  header.appendChild(labelWrap);
  const time = DOC.createElement('span');
  time.className = 'event-chip-time';
  time.textContent = event.timeLabel || '';
  header.appendChild(time);
  node.appendChild(header);

  const detailParts = [];
  if(event.subtitle) detailParts.push(event.subtitle);
  if(event.contactName) detailParts.push(event.contactName);
  if(event.status) detailParts.push(event.status);
  if(detailParts.length){
    const detail = DOC.createElement('div');
    detail.className = 'event-chip-meta';
    detail.textContent = detailParts.join(' • ');
    node.appendChild(detail);
  }

  if(event.date instanceof Date){
    const typeLabel = (event.categoryLabel || meta.label || 'Event').trim();
    const dateLabel = DAY_FORMAT.format(event.date);
    const baseTitle = event.title || 'Calendar Event';
    node.setAttribute('aria-label', `${typeLabel}: ${baseTitle} on ${dateLabel}`);
  }else{
    node.setAttribute('aria-label', event.title || 'Calendar Event');
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

function createOverflowControl(events, cell, handlers){
  const button = DOC.createElement('button');
  button.type = 'button';
  button.className = 'calendar-more';
  button.textContent = `+${events.length} more`;
  let popover = null;
  let removeListeners = () => {};

  const closePopover = () => {
    if(popover){
      popover.remove();
      popover = null;
    }
    removeListeners();
    removeListeners = () => {};
  };

  const onDocumentClick = (evt) => {
    if(!popover) return;
    if(evt.target === button) return;
    if(popover.contains(evt.target)) return;
    closePopover();
  };

  const onKeyDown = (evt) => {
    if(evt.key === 'Escape'){ closePopover(); button.blur(); }
  };

  const openPopover = () => {
    if(popover) return;
    popover = DOC.createElement('div');
    popover.className = 'calendar-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'More events for this day');
    events.forEach((event) => {
      const node = createEventNode(event, handlers);
      popover.appendChild(node);
    });
    cell.appendChild(popover);
    const cellRect = cell.getBoundingClientRect();
    const triggerRect = button.getBoundingClientRect();
    const top = Math.max(8, triggerRect.bottom - cellRect.top + 4);
    const preferredLeft = triggerRect.left - cellRect.left - 12;
    const maxLeft = Math.max(0, cellRect.width - 240);
    const left = Math.min(Math.max(0, preferredLeft), maxLeft);
    popover.style.setProperty('--popover-top', `${top}px`);
    popover.style.setProperty('--popover-left', `${left}px`);
    popover.dataset.open = '1';
    removeListeners = () => {
      if(DOC){
        DOC.removeEventListener('click', onDocumentClick, true);
        DOC.removeEventListener('keydown', onKeyDown, true);
      }
    };
    if(DOC){
      DOC.addEventListener('click', onDocumentClick, true);
      DOC.addEventListener('keydown', onKeyDown, true);
    }
  };

  button.addEventListener('click', (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    if(popover){
      closePopover();
    }else{
      openPopover();
    }
  });

  button.addEventListener('keydown', (evt) => {
    if(evt.key === 'Enter' || evt.key === ' '){
      evt.preventDefault();
      openPopover();
    }else if(evt.key === 'Escape'){
      closePopover();
    }
  });

  button.addEventListener('blur', () => {
    if(!DOC) return;
    if(!cell.contains(DOC.activeElement || null)){
      closePopover();
    }
  });

  return button;
}

function renderLegend(){
  const container = DOC.createElement('div');
  container.dataset.qa = 'cal-legend';
  container.setAttribute('data-qa', 'cal-legend');
  EVENT_CATEGORIES.forEach((item) => {
    const entry = DOC.createElement('span');
    entry.dataset.qa = 'cal-legend-item';
    entry.dataset.type = item.type;
    entry.dataset.category = item.key;
    const icon = DOC.createElement('span');
    icon.className = 'cal-legend-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = item.icon;
    const label = DOC.createElement('span');
    label.className = 'cal-legend-label';
    label.textContent = item.label;
    entry.appendChild(icon);
    entry.appendChild(label);
    container.appendChild(entry);
  });
  return { node: container, count: EVENT_CATEGORIES.length };
}

function renderMonthView(range, events, handlers){
  const grid = DOC.createElement('div');
  grid.className = 'calendar-month-grid';
  grid.dataset.qa = 'calendar-month-grid';
  const totalDays = 42;
  const eventsByDay = new Map();
  events.forEach((event) => {
    const key = ymd(event.date);
    if(!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key).push(event);
  });
  const cells = [];
  const visibleEvents = [];
  const today = toLocalMidnight(new Date());
  let cursor = range.start instanceof Date ? new Date(range.start.getTime()) : toLocalMidnight(new Date());
  const anchorDate = range.anchor instanceof Date
    ? new Date(range.anchor.getTime())
    : (range.start instanceof Date ? new Date(range.start.getFullYear(), range.start.getMonth(), 1) : new Date(cursor.getTime()));
  const anchorMonth = anchorDate.getMonth();
  const anchorYear = anchorDate.getFullYear();
  for(let index = 0; index < totalDays; index += 1){
    const key = ymd(cursor);
    const dayEvents = eventsByDay.get(key) || [];
    const cell = DOC.createElement('div');
    cell.className = 'calendar-cell';
    cell.dataset.qa = 'cal-cell';
    cell.dataset.date = key;
    if(isSameDay(cursor, today)) cell.classList.add('is-today');
    if(isWeekendDay(cursor)) cell.classList.add('is-weekend');
    if(!(cursor.getMonth() === anchorMonth && cursor.getFullYear() === anchorYear)){
      cell.classList.add('is-outside');
    }

    const header = DOC.createElement('header');
    header.className = 'calendar-cell-header';
    const title = DOC.createElement('span');
    title.className = 'date';
    title.textContent = `${cursor.getDate()}`;
    header.appendChild(title);
    const weekday = DOC.createElement('span');
    weekday.className = 'weekday';
    weekday.textContent = WEEKDAY_FORMAT.format(cursor);
    header.appendChild(weekday);
    cell.appendChild(header);

    const list = DOC.createElement('div');
    list.className = 'calendar-cell-events';
    const overflow = [];
    dayEvents.forEach((event, eventIndex) => {
      visibleEvents.push(event);
      if(eventIndex < MAX_VISIBLE_EVENTS_MONTH){
        const node = createEventNode(event, handlers);
        list.appendChild(node);
      }else{
        overflow.push(event);
      }
    });
    if(overflow.length){
      const overflowButton = createOverflowControl(overflow, cell, handlers);
      list.appendChild(overflowButton);
    }
    if(!dayEvents.length){
      const empty = DOC.createElement('span');
      empty.className = 'calendar-empty';
      empty.textContent = 'No events';
      list.appendChild(empty);
    }
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

  const header = DOC.createElement('div');
  header.className = 'calendar-week-header';
  header.appendChild(DOC.createElement('div'));
  const today = toLocalMidnight(new Date());
  for(let offset = 0; offset < 7; offset += 1){
    const day = addDays(range.start, offset);
    const label = DOC.createElement('div');
    label.textContent = `${WEEKDAY_FORMAT.format(day)} ${day.getDate()}`;
    if(isSameDay(day, today)) label.classList.add('is-today');
    header.appendChild(label);
  }
  container.appendChild(header);

  const visibleEvents = [];
  const body = DOC.createElement('div');
  body.className = 'calendar-week-body';

  const allDayRow = DOC.createElement('div');
  allDayRow.className = 'calendar-week-allday';
  const allDayLabel = DOC.createElement('div');
  allDayLabel.className = 'calendar-time-label';
  allDayLabel.textContent = 'All Day';
  allDayRow.appendChild(allDayLabel);
  for(let offset = 0; offset < 7; offset += 1){
    const day = addDays(range.start, offset);
    const dayKey = ymd(day);
    const slot = DOC.createElement('div');
    slot.className = 'calendar-week-slot';
    slot.dataset.date = dayKey;
    if(isWeekendDay(day)) slot.classList.add('is-weekend');
    if(isSameDay(day, today)) slot.classList.add('is-today');
    events.filter((event) => ymd(event.date) === dayKey && event.hourSlot === 'all-day')
      .forEach((event) => {
        visibleEvents.push(event);
        slot.appendChild(createEventNode(event, handlers));
      });
    allDayRow.appendChild(slot);
  }
  body.appendChild(allDayRow);

  const hoursWrapper = DOC.createElement('div');
  hoursWrapper.className = 'calendar-week-hours';
  const hours = buildHourLabels();
  hours.forEach((hour) => {
    const row = DOC.createElement('div');
    row.className = 'calendar-week-hour';
    const label = DOC.createElement('div');
    label.className = 'calendar-time-label';
    const base = new Date();
    base.setHours(hour, 0, 0, 0);
    label.textContent = TIME_FORMAT.format(base);
    row.appendChild(label);
    for(let offset = 0; offset < 7; offset += 1){
      const day = addDays(range.start, offset);
      const dayKey = ymd(day);
      const slot = DOC.createElement('div');
      slot.className = 'calendar-week-slot';
      slot.dataset.date = dayKey;
      slot.dataset.hour = String(hour);
      if(isWeekendDay(day)) slot.classList.add('is-weekend');
      if(isSameDay(day, today)) slot.classList.add('is-today');
      events.filter((event) => ymd(event.date) === dayKey && event.hourSlot === hour)
        .forEach((event) => {
          visibleEvents.push(event);
          slot.appendChild(createEventNode(event, handlers));
        });
      row.appendChild(slot);
    }
    hoursWrapper.appendChild(row);
  });

  const weekStart = toLocalMidnight(range.start);
  const weekEnd = addDays(weekStart, 6);
  if(isWithinRange(today, weekStart, weekEnd)){
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const offset = (minutes / (24 * 60)) * 100;
    const line = DOC.createElement('div');
    line.className = 'calendar-now-line';
    line.dataset.qa = 'now-line';
    line.style.setProperty('--now-line-offset', offset.toFixed(4));
    hoursWrapper.appendChild(line);
  }

  body.appendChild(hoursWrapper);
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
  const dayKey = ymd(range.start);
  const dayEvents = events.filter((event) => ymd(event.date) === dayKey);
  const visibleEvents = [];
  const hours = buildHourLabels();
  const today = toLocalMidnight(new Date());
  const isToday = isSameDay(range.start, today);
  const isWeekend = isWeekendDay(range.start);

  const allDayRow = DOC.createElement('div');
  allDayRow.className = 'calendar-day-all';
  const allDayLabel = DOC.createElement('div');
  allDayLabel.className = 'calendar-time-label';
  allDayLabel.textContent = 'All Day';
  allDayRow.appendChild(allDayLabel);
  const allDaySlot = DOC.createElement('div');
  allDaySlot.className = 'calendar-day-slot';
  if(isWeekend) allDaySlot.classList.add('is-weekend');
  if(isToday) allDaySlot.classList.add('is-today');
  dayEvents.filter((event) => event.hourSlot === 'all-day').forEach((event) => {
    visibleEvents.push(event);
    allDaySlot.appendChild(createEventNode(event, handlers));
  });
  if(!allDaySlot.children.length){
    const empty = DOC.createElement('span');
    empty.className = 'calendar-empty';
    empty.textContent = 'No events';
    allDaySlot.appendChild(empty);
  }
  allDayRow.appendChild(allDaySlot);
  container.appendChild(allDayRow);

  const body = DOC.createElement('div');
  body.className = 'calendar-day-body';
  const hoursWrapper = DOC.createElement('div');
  hoursWrapper.className = 'calendar-day-hours';
  hours.forEach((hour) => {
    const row = DOC.createElement('div');
    row.className = 'calendar-day-hour';
    const label = DOC.createElement('div');
    label.className = 'calendar-time-label';
    const base = new Date();
    base.setHours(hour, 0, 0, 0);
    label.textContent = TIME_FORMAT.format(base);
    row.appendChild(label);
    const slot = DOC.createElement('div');
    slot.className = 'calendar-day-slot';
    slot.dataset.hour = String(hour);
    if(isWeekend) slot.classList.add('is-weekend');
    if(isToday) slot.classList.add('is-today');
    dayEvents.filter((event) => event.hourSlot === hour).forEach((event) => {
      visibleEvents.push(event);
      slot.appendChild(createEventNode(event, handlers));
    });
    row.appendChild(slot);
    hoursWrapper.appendChild(row);
  });

  if(isToday){
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const offset = (minutes / (24 * 60)) * 100;
    const line = DOC.createElement('div');
    line.className = 'calendar-now-line';
    line.dataset.qa = 'now-line';
    line.style.setProperty('--now-line-offset', offset.toFixed(4));
    hoursWrapper.appendChild(line);
  }

  body.appendChild(hoursWrapper);
  container.appendChild(body);

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

function publishStyleDiagnostics(){
  if(typeof window === 'undefined' || !DOC) return;
  const legendItems = DOC.querySelectorAll('[data-qa="cal-legend"] [data-type]').length;
  const todayCell = !!DOC.querySelector('.calendar-cell.is-today');
  const weekendCells = !!DOC.querySelector('.calendar-cell.is-weekend');
  const nowLine = !!DOC.querySelector('[data-qa="now-line"]');
  let tokensOk = false;
  try{
    const value = getComputedStyle(DOC.documentElement).getPropertyValue('--accent-contact');
    tokensOk = !!(value && value.trim().length > 0);
  }catch (_err){
    tokensOk = false;
  }
  window.__CAL_STYLE__ = {
    legendItems,
    today: todayCell,
    weekends: weekendCells,
    dayNowLine: nowLine,
    tokensOk,
  };
  if(typeof console !== 'undefined' && console && typeof console.log === 'function'){
    console.log('CAL_STYLE', window.__CAL_STYLE__);
  }
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
  const cardHost = mount?.closest?.('.calendar-card') || null;
  if(cardHost){
    if(state.loading){
      attachLoadingBlock(cardHost, { lines: 6 });
    }else{
      detachLoadingBlock(cardHost);
    }
  }
  const emptyCopy = state.view === 'month' ? 'No events this month.' : 'No events scheduled for this period.';
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
    statusBanner.showEmpty(emptyCopy);
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

  publishStyleDiagnostics();

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
    retryRender: null,
    safeMode: isSafeModeActive(),
    primed: false,
  };

  const debug = ensureDebug();

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
    if(state.safeMode){
      events = [];
    }else{
      try{
        const loaded = await loadEventsBetween(range.start, range.end, { anchor: state.anchor, view: state.view });
        events = normalizeEvents(loaded);
      }catch (err){
        if(typeof console !== 'undefined' && console && typeof console.error === 'function'){
          console.error('calendar load failed', err);
        }
        errorMessage = 'We were unable to load calendar events. Please try again.';
      }
    }
    if(events){
      state.events = events;
    }else if(!state.events.length){
      state.events = [];
    }
    state.errorMessage = state.safeMode ? '' : errorMessage;
    state.loading = false;
    state.renderCount += 1;
    range = renderSurface(mount, state, handlers);
    return range;
  }

  function scheduleRender(){
    const range = rangeForView(state.anchor, state.view);
    state.loading = !state.safeMode;
    state.primed = true;
    state.renderCount += 1;
    renderSurface(mount, state, handlers);
    rendering = rendering.then(() => performRender()).catch((err) => {
      if(typeof console !== 'undefined' && console && typeof console.error === 'function'){
        console.error('calendar render failed', err);
      }
    });
    return rendering;
  }

  function prime(){
    if(state.primed) return;
    state.loading = true;
    state.renderCount += 1;
    state.primed = true;
    renderSurface(mount, state, handlers);
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
    prime,
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
