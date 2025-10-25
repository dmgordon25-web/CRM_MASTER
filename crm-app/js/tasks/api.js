import { openDB, dbPut } from '../db.js';
import { recordTask } from './store.js';

let logged = false;

function postLog(eventName){
  const payload = JSON.stringify({ event: eventName });
  let delivered = false;
  if(typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'){
    try{
      const blob = new Blob([payload], { type:'application/json' });
      delivered = navigator.sendBeacon('/__log', blob) === true;
    }catch (_err){}
  }
  if(delivered || typeof fetch !== 'function') return;
  try{
    fetch('/__log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(()=>{});
  }catch (_err){}
}

function ensureReadyLog(){
  if(logged) return;
  logged = true;
  try{ console && typeof console.info === 'function' && console.info('[VIS] add-as-task ready'); }
  catch (_err){}
  postLog('calendar-add-as-task-ready');
}

function toastSafe(message){
  if(typeof window !== 'undefined' && typeof window.toast === 'function'){
    try{ window.toast(message); }
    catch (_err){}
    return;
  }
  if(typeof console !== 'undefined' && typeof console.log === 'function'){
    console.log('[toast]', message);
  }
}

function uuid(){
  if(typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'){
    try{ return crypto.randomUUID(); }
    catch (_err){}
  }
  return `task-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
}

function toISODate(date){
  const d = date instanceof Date ? new Date(date) : new Date();
  if(Number.isNaN(d.getTime())){
    const now = new Date();
    now.setHours(0,0,0,0);
    return now.toISOString().slice(0,10);
  }
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}

function normalizeTitle(event){
  if(!event) return 'Follow up';
  const title = event.title || event.subtitle;
  if(title && String(title).trim()) return String(title).trim();
  if(event.type){
    const type = String(event.type);
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
  return 'Follow up';
}

function safeString(value){
  return value == null ? '' : String(value).trim();
}

function cloneSource(source){
  if(!source || typeof source !== 'object') return null;
  const entity = safeString(source.entity);
  const id = safeString(source.id);
  const field = safeString(source.field);
  if(!entity && !id && !field) return null;
  return { entity, id, field };
}

function emitTasksChanged(detail){
  const payload = detail && typeof detail === 'object' ? detail : {};
  let emitted = false;
  try{
    const bus = typeof window !== 'undefined'
      ? (window.__APP_BUS__ || window.appEvents || window.events || null)
      : null;
    if(bus && typeof bus.emit === 'function'){
      bus.emit('tasks:changed', payload);
      emitted = true;
    }
  }catch (_err){}
  if(emitted) return true;
  if(typeof document !== 'undefined' && typeof document.dispatchEvent === 'function'){
    try{
      document.dispatchEvent(new CustomEvent('tasks:changed', { detail: payload }));
      emitted = true;
    }catch (_err){}
  }
  return emitted;
}

async function persistTask(record){
  await openDB();
  await dbPut('tasks', record);
  try{
    recordTask(record);
  }catch (err){
    console && console.warn && console.warn('tasks store update failed', err);
  }
}

function broadcastTaskCreate(record, meta){
  if(!record) return;
  const detail = Object.assign({
    scope: 'tasks',
    action: 'task:create',
    source: 'tasks:api'
  }, meta || {});
  detail.taskId = record.id;
  if(!Array.isArray(detail.ids)) detail.ids = [record.id];
  if(record.contactId && !detail.contactId) detail.contactId = record.contactId;
  if(record.partnerId && !detail.partnerId) detail.partnerId = record.partnerId;
  let dispatched = false;
  try{
    if(typeof window !== 'undefined' && typeof window.dispatchAppDataChanged === 'function'){
      window.dispatchAppDataChanged(detail);
      dispatched = true;
    }
  }catch (err){
    console && console.warn && console.warn('dispatchAppDataChanged failed', err);
  }
  emitTasksChanged({ action: detail.action, task: record });
  if(!dispatched && typeof document !== 'undefined' && typeof document.dispatchEvent === 'function'){
    try{
      document.dispatchEvent(new CustomEvent('app:data:changed', { detail }));
    }catch (_err){}
  }
}

function parseEventDate(raw){
  if(raw instanceof Date) return raw;
  if(typeof raw === 'number' && Number.isFinite(raw)){
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if(typeof raw === 'string' && raw.trim()){
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function buildOrigin(event, fallbackDate){
  if(!event || typeof event !== 'object') return null;
  const origin = {
    type: safeString(event.type),
    title: '',
    subtitle: safeString(event.subtitle),
    stage: safeString(event.contactStage),
    contactName: safeString(event.contactName),
    status: safeString(event.status),
    date: fallbackDate,
    source: cloneSource(event.source)
  };
  const title = safeString(event.title || '');
  if(title) origin.title = title;
  if(!origin.title && origin.subtitle){
    origin.title = origin.subtitle;
  }
  const eventDate = parseEventDate(event.date);
  if(eventDate){
    origin.date = toISODate(eventDate);
  }
  if(!origin.type && !origin.title && !origin.subtitle && !origin.stage && !origin.contactName && !origin.status && !origin.source){
    return null;
  }
  return origin;
}

export async function createTaskFromEvent(event){
  ensureReadyLog();
  const contactId = event && event.contactId ? String(event.contactId).trim() : '';
  if(!contactId){
    toastSafe('Link a contact before adding a task');
    return { status:'error', reason:'missing-contact' };
  }
  const dueDate = toISODate(event && event.date ? event.date : new Date());
  const origin = buildOrigin(event, dueDate);
  const record = {
    id: uuid(),
    contactId,
    title: normalizeTitle(event),
    due: dueDate,
    status: 'open',
    done: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'calendar'
  };
  if(origin){
    record.origin = origin;
    if(origin.stage) record.stage = origin.stage;
    if(origin.contactName) record.contactName = origin.contactName;
    if(origin.status) record.statusLabel = origin.status;
  }
  try{
    await persistTask(record);
  }catch (err){
    console && console.warn && console.warn('createTaskFromEvent dbPut failed', err);
    toastSafe('Unable to save task');
    return { status:'error', error: err };
  }
  broadcastTaskCreate(record, { source:'calendar', contactId });
  if(typeof window !== 'undefined' && window.__CALENDAR_IMPL__ && typeof window.__CALENDAR_IMPL__.invalidateCache === 'function'){
    try{ window.__CALENDAR_IMPL__.invalidateCache(); }
    catch (_err){}
  }
  toastSafe('Task added');
  return { status:'ok', task: record };
}

export async function createFollowUpTask(options){
  ensureReadyLog();
  const opts = options && typeof options === 'object' ? options : {};
  const contactId = safeString(opts.contactId);
  const partnerId = safeString(opts.partnerId);
  if(!contactId && !partnerId){
    return { status:'error', reason:'missing-target' };
  }
  const dueDate = toISODate(opts.due || opts.date || new Date());
  const now = Date.now();
  const name = safeString(opts.name);
  const explicitTitle = safeString(opts.title);
  const title = explicitTitle || (name ? `Follow up with ${name}` : 'Follow up');
  const note = safeString(opts.note);
  const record = {
    id: uuid(),
    title,
    due: dueDate,
    status: 'open',
    done: false,
    createdAt: now,
    updatedAt: now,
    source: safeString(opts.source) || (contactId ? 'contact-modal' : 'partner-modal')
  };
  if(contactId) record.contactId = contactId;
  if(partnerId) record.partnerId = partnerId;
  if(name && contactId) record.contactName = name;
  if(name && partnerId) record.partnerName = name;
  if(note) record.note = note;
  if(opts.stage) record.stage = safeString(opts.stage);
  const originType = safeString(opts.originType) || (contactId ? 'contact:follow-up' : 'partner:follow-up');
  record.origin = {
    type: originType,
    title,
    subtitle: note,
    date: dueDate,
    contactName: contactId ? name : '',
    partnerName: partnerId ? name : '',
    source: { entity: contactId ? 'contact' : 'partner', id: contactId || partnerId, field: 'follow-up' }
  };
  try{
    await persistTask(record);
  }catch (err){
    console && console.warn && console.warn('createFollowUpTask failed', err);
    if(opts.showToast === true){
      toastSafe('Unable to save task');
    }
    return { status:'error', error: err };
  }
  broadcastTaskCreate(record, {
    source: safeString(opts.changeSource) || (contactId ? 'contact-modal' : 'partner-modal'),
    contactId: contactId || undefined,
    partnerId: partnerId || undefined
  });
  if(opts.showToast === true){
    toastSafe('Follow-up scheduled');
  }
  return { status:'ok', task: record };
}

ensureReadyLog();

export default createTaskFromEvent;
