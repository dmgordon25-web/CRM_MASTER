import { openDB } from '../db.js';

const GLOBAL_SCOPE = typeof globalThis !== 'undefined'
  ? globalThis
  : (typeof window !== 'undefined' ? window : {});

const DB_WARNED = new Set();
let provider = null;

function cloneList(list){
  return (Array.isArray(list) ? list : []).map(item => ({ ...(item || {}) }));
}

function toSafeDate(value){
  if(value instanceof Date) return new Date(value.getTime());
  if(typeof value === 'number' && Number.isFinite(value)){
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if(typeof value === 'string' && value.trim()){
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function toLocalMidnight(date){
  const parsed = date instanceof Date ? date : toSafeDate(date);
  if(!(parsed instanceof Date)) return null;
  const copy = new Date(parsed.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function parseDateInput(value){
  if(value instanceof Date) return toLocalMidnight(value);
  if(typeof value === 'number' && Number.isFinite(value)){
    return toLocalMidnight(new Date(value));
  }
  const text = value == null ? '' : String(value).trim();
  if(!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso){
    const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return toLocalMidnight(parsed);
  }
  return toLocalMidnight(new Date(text));
}

export function startOfWeek(date){
  const d = toLocalMidnight(date) || new Date();
  const day = (d.getDay() + 6) % 7; // Monday start
  d.setDate(d.getDate() - day);
  return d;
}

export function addDays(date, amount){
  const base = toLocalMidnight(date) || new Date();
  base.setDate(base.getDate() + Number(amount || 0));
  return base;
}

export function ymd(date){
  const d = toLocalMidnight(date);
  if(!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isWithinRange(date, start, end){
  if(!(date instanceof Date)) return false;
  const stamp = date.getTime();
  if(start instanceof Date && stamp < start.getTime()) return false;
  if(end instanceof Date && stamp >= end.getTime()) return false;
  return true;
}

export function rangeForView(anchorInput, viewInput){
  const normalizedView = viewInput === 'week' || viewInput === 'day' ? viewInput : 'month';
  const anchor = toLocalMidnight(anchorInput) || toLocalMidnight(new Date());
  let start;
  let end;
  if(normalizedView === 'week'){
    start = startOfWeek(anchor);
    end = addDays(start, 7);
  }else if(normalizedView === 'day'){
    start = toLocalMidnight(anchor);
    end = addDays(start, 1);
  }else{
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    start = startOfWeek(first);
    end = addDays(start, 42);
  }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  return { view: normalizedView, anchor, start, end, days };
}

function seedFallback(store){
  const dataset = GLOBAL_SCOPE && GLOBAL_SCOPE.__SEED_DATA__;
  if(!dataset || typeof dataset !== 'object') return [];
  const list = dataset[store];
  return cloneList(Array.isArray(list) ? list : []);
}

async function getAll(store){
  const scope = GLOBAL_SCOPE;
  const getter = scope && typeof scope.dbGetAll === 'function' ? scope.dbGetAll : null;
  if(getter){
    try{
      const records = await getter.call(scope, store);
      if(Array.isArray(records)){
        if(records.length) return records;
        const seeds = seedFallback(store);
        return seeds.length ? seeds : records;
      }
    }catch (err){
      if(!DB_WARNED.has(store) && typeof console !== 'undefined' && console && typeof console.warn === 'function'){
        console.warn('calendar store load failed', store, err);
        DB_WARNED.add(store);
      }
    }
  }
  return seedFallback(store);
}

export function registerCalendarProvider(fn){
  provider = typeof fn === 'function' ? fn : null;
}

function cloneEventList(list){
  return (Array.isArray(list) ? list : []).map(item => ({ ...(item || {}) }));
}

export async function loadCalendarData(request = {}){
  const { start, end, anchor, view } = request;
  let result = null;
  if(provider){
    try{
      result = await provider({
        start: start instanceof Date ? new Date(start.getTime()) : null,
        end: end instanceof Date ? new Date(end.getTime()) : null,
        anchor: anchor instanceof Date ? new Date(anchor.getTime()) : null,
        view: view === 'week' || view === 'day' ? view : 'month'
      });
    }catch (err){
      if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
        console.warn('calendar provider failed', err);
      }
      result = null;
    }
  }

  if(result && typeof result === 'object'){
    const contacts = Array.isArray(result.contacts) ? cloneList(result.contacts) : [];
    const tasks = Array.isArray(result.tasks) ? cloneList(result.tasks) : [];
    const deals = Array.isArray(result.deals) ? cloneList(result.deals) : [];
    const events = cloneEventList(result.events);
    return {
      contacts,
      tasks,
      deals,
      events,
      start: start instanceof Date ? new Date(start.getTime()) : null,
      end: end instanceof Date ? new Date(end.getTime()) : null
    };
  }

  const [contacts, tasks, deals] = await Promise.all([
    getAll('contacts'),
    getAll('tasks'),
    getAll('deals')
  ]);

  return {
    contacts: cloneList(contacts),
    tasks: cloneList(tasks),
    deals: cloneList(deals),
    events: [],
    start: start instanceof Date ? new Date(start.getTime()) : null,
    end: end instanceof Date ? new Date(end.getTime()) : null
  };
}

export async function loadEventsForRange(range){
  const data = await loadCalendarData(range || {});
  if(Array.isArray(data.events) && data.events.length){
    return cloneEventList(data.events);
  }
  if(typeof window !== 'undefined' && window.CalendarAPI && typeof window.CalendarAPI.loadRange === 'function'){
    try{
      const events = await window.CalendarAPI.loadRange(data.start, data.end);
      return cloneEventList(events);
    }catch (_err){}
  }
  return [];
}

if(typeof window !== 'undefined'){
  const api = window.CalendarProvider = window.CalendarProvider || {};
  api.rangeForView = rangeForView;
  api.loadCalendarData = loadCalendarData;
  api.loadEventsForRange = loadEventsForRange;
  api.loadEventsBetween = loadEventsBetween;
  api.registerProvider = registerCalendarProvider;
}

function normalizeEventDate(value, fallback){
  const parsed = parseDateInput(value);
  if(parsed) return parsed;
  if(fallback instanceof Date) return new Date(fallback.getTime());
  const safe = toLocalMidnight(new Date());
  return safe || new Date();
}

function cloneCalendarEvent(event, fallbackDate){
  const base = event || {};
  const date = normalizeEventDate(base.date, fallbackDate);
  const source = base.source && typeof base.source === 'object'
    ? {
        entity: base.source.entity ? String(base.source.entity) : '',
        id: base.source.id ? String(base.source.id) : '',
        field: base.source.field ? String(base.source.field) : ''
      }
    : null;
  return {
    type: base.type || 'event',
    title: base.title || '',
    subtitle: base.subtitle || '',
    status: base.status || '',
    hasLoan: base.hasLoan != null ? !!base.hasLoan : !!base.loanKey,
    loanKey: base.loanKey || '',
    loanLabel: base.loanLabel || '',
    contactId: base.contactId ? String(base.contactId) : '',
    contactStage: base.contactStage ? String(base.contactStage) : '',
    contactName: base.contactName ? String(base.contactName) : '',
    source,
    raw: base.raw || base,
    date
  };
}

export async function loadEventsBetween(startTs, endTs, options = {}){
  const start = startTs instanceof Date ? new Date(startTs.getTime()) : (startTs != null ? parseDateInput(startTs) : null);
  const end = endTs instanceof Date ? new Date(endTs.getTime()) : (endTs != null ? parseDateInput(endTs) : null);
  const anchor = options.anchor instanceof Date
    ? new Date(options.anchor.getTime())
    : (start instanceof Date ? new Date(start.getTime()) : toLocalMidnight(new Date()));
  const view = options.view === 'week' || options.view === 'day' ? options.view : 'month';

  try{
    if(typeof openDB === 'function'){
      await openDB();
    }
  }catch (err){
    if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
      console.warn('[CAL] provider fallback (empty):', err);
    }
  }

  let data;
  try{
    data = await loadCalendarData({ start, end, anchor, view });
  }catch (err){
    if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
      console.warn('[CAL] provider fallback (empty):', err);
    }
    return [];
  }

  let events = [];
  if(Array.isArray(data.events) && data.events.length){
    const helper = typeof window !== 'undefined' ? window.__CALENDAR_IMPL__ : null;
    if(helper && typeof helper.normalizeProvidedEvents === 'function'){
      try{
        events = helper.normalizeProvidedEvents(data.events, anchor, start, end);
      }catch (err){
        if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
          console.warn('[CAL] provider fallback (empty):', err);
        }
        events = [];
      }
    }else{
      events = data.events.map(ev => cloneCalendarEvent(ev, anchor));
    }
  }

  if(!events.length){
    const helper = typeof window !== 'undefined' ? window.__CALENDAR_IMPL__ : null;
    if(helper && typeof helper.collectEvents === 'function'){
      try{
        events = helper.collectEvents(data.contacts, data.tasks, data.deals, anchor, start, end);
      }catch (err){
        if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
          console.warn('[CAL] provider fallback (empty):', err);
        }
        events = [];
      }
    }
  }

  return Array.isArray(events)
    ? events.map(ev => cloneCalendarEvent(ev, anchor))
    : [];
}

export default {
  rangeForView,
  loadCalendarData,
  loadEventsForRange,
  loadEventsBetween,
  registerCalendarProvider,
  parseDateInput,
  toLocalMidnight,
  startOfWeek,
  addDays,
  ymd,
  isWithinRange
};
