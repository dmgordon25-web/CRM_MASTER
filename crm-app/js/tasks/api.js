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

function normalizeRecordName(value){
  const str = safeString(value);
  if(!str) return '';
  return str.replace(/\s+/g, ' ').trim();
}

async function persistTask(record, options = {}){
  const detail = options && typeof options === 'object' ? options : {};
  const toastMessage = safeString(detail.toastMessage) || 'Task added';
  const source = safeString(detail.source) || 'tasks';
  const contactId = record && record.contactId ? String(record.contactId).trim() : '';
  const partnerId = record && record.partnerId ? String(record.partnerId).trim() : '';
  try{
    await openDB();
    await dbPut('tasks', record);
    try{
      recordTask(record);
    }catch (err){
      console && console.warn && console.warn('tasks store update failed', err);
    }
  }catch (err){
    console && console.warn && console.warn('persistTask dbPut failed', err);
    toastSafe('Unable to save task');
    return { status:'error', error: err };
  }
  let dispatched = false;
  try{
    if(typeof window !== 'undefined' && typeof window.dispatchAppDataChanged === 'function'){
      const payload = { source, action:'task:create', taskId: record.id };
      if(contactId) payload.contactId = contactId;
      if(partnerId) payload.partnerId = partnerId;
      window.dispatchAppDataChanged(payload);
      dispatched = true;
    }
  }catch (err){
    console && console.warn && console.warn('dispatchAppDataChanged failed', err);
  }
  if(typeof window !== 'undefined' && window.__CALENDAR_IMPL__ && typeof window.__CALENDAR_IMPL__.invalidateCache === 'function'){
    try{ window.__CALENDAR_IMPL__.invalidateCache(); }
    catch (_err){}
  }
  if(!dispatched && typeof document !== 'undefined' && typeof document.dispatchEvent === 'function'){
    try{
      const payload = { scope:'tasks', ids:[record.id] };
      if(contactId) payload.contactId = contactId;
      if(partnerId) payload.partnerId = partnerId;
      document.dispatchEvent(new CustomEvent('app:data:changed', { detail: payload }));
    }catch (_err){}
  }
  toastSafe(toastMessage);
  return { status:'ok', task: record };
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
  return persistTask(record, { toastMessage:'Task added', source:'calendar' });
}

export async function createLinkedTask(options){
  ensureReadyLog();
  const opts = options && typeof options === 'object' ? options : {};
  const entity = opts.entity === 'partner' ? 'partner' : 'contact';
  const recordId = safeString(opts.recordId);
  if(!recordId){
    toastSafe('Save the record before scheduling follow-ups');
    return { status:'error', reason:'missing-record' };
  }
  const dueDate = parseEventDate(opts.due) || new Date();
  const due = toISODate(dueDate);
  const now = Date.now();
  const title = normalizeRecordName(opts.title) || 'Follow up';
  const displayName = normalizeRecordName(opts.displayName || opts.contactName);
  const stage = safeString(opts.stage);
  const statusLabel = safeString(opts.statusLabel);
  const note = safeString(opts.note || opts.notes);
  const record = {
    id: uuid(),
    title,
    due,
    status: 'open',
    done: false,
    createdAt: now,
    updatedAt: now,
    source: entity === 'partner' ? 'partner-followup' : 'contact-followup'
  };
  if(entity === 'partner'){ record.partnerId = recordId; }
  else { record.contactId = recordId; }
  if(stage) record.stage = stage;
  if(statusLabel) record.statusLabel = statusLabel;
  if(entity === 'contact' && displayName){
    record.contactName = displayName;
  }else if(entity === 'partner' && displayName){
    record.partnerName = displayName;
  }
  if(note){
    record.notes = note;
  }
  const originSource = entity === 'partner' ? 'partners' : 'contacts';
  record.origin = {
    type: 'manual-followup',
    title,
    subtitle: note,
    contactName: entity === 'contact' ? displayName : '',
    status: statusLabel,
    stage,
    date: due,
    source: {
      entity: originSource,
      id: recordId,
      field: entity === 'partner' ? 'nextTouch' : 'nextFollowUp'
    }
  };
  return persistTask(record, {
    toastMessage: 'Follow-up scheduled',
    source: entity === 'partner' ? 'partner-followup' : 'contact-followup'
  });
}

ensureReadyLog();

export default createTaskFromEvent;
