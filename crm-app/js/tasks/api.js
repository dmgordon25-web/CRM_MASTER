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

function normalizeDueInput(raw){
  if(raw instanceof Date){
    const clone = new Date(raw);
    if(!Number.isNaN(clone.getTime())){
      clone.setHours(0,0,0,0);
      return clone.toISOString().slice(0,10);
    }
  }
  if(typeof raw === 'number' && Number.isFinite(raw)){
    const fromNum = new Date(raw);
    if(!Number.isNaN(fromNum.getTime())){
      fromNum.setHours(0,0,0,0);
      return fromNum.toISOString().slice(0,10);
    }
  }
  if(typeof raw === 'string' && raw.trim()){
    const parsed = new Date(raw);
    if(!Number.isNaN(parsed.getTime())){
      parsed.setHours(0,0,0,0);
      return parsed.toISOString().slice(0,10);
    }
  }
  return toISODate(new Date());
}

async function persistTaskRecord(record){
  await openDB();
  await dbPut('tasks', record);
  try{
    recordTask(record);
  }catch (err){
    console && console.warn && console.warn('tasks store update failed', err);
  }
}

function dispatchTaskCreated(record, detail){
  const changeDetail = Object.assign({}, detail, { taskId: record.id });
  let dispatched = false;
  try{
    if(typeof window !== 'undefined' && typeof window.dispatchAppDataChanged === 'function'){
      window.dispatchAppDataChanged(changeDetail);
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
      document.dispatchEvent(new CustomEvent('app:data:changed', { detail:{ scope:'tasks', ids:[record.id] } }));
    }catch (_err){}
  }
}

function buildManualOrigin(options){
  const context = options && typeof options === 'object' ? options : {};
  const type = safeString(context.type);
  const name = safeString(context.name);
  const stage = safeString(context.stage);
  const status = safeString(context.status);
  const due = safeString(context.due);
  const entityId = safeString(context.entityId);
  if(!type && !name && !stage && !status && !due && !entityId){
    return null;
  }
  const origin = {
    type: type || 'follow-up',
    title: safeString(context.title),
    subtitle: '',
    contactName: type === 'contact' ? name : '',
    partnerName: type === 'partner' ? name : '',
    stage,
    status,
    date: due || toISODate(new Date()),
    source: entityId ? { entity: type, id: entityId, field: 'follow-up' } : null
  };
  if(!origin.title && name){
    origin.title = name;
  }
  if(!origin.source){
    delete origin.source;
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
    await persistTaskRecord(record);
  }catch (err){
    console && console.warn && console.warn('createTaskFromEvent dbPut failed', err);
    toastSafe('Unable to save task');
    return { status:'error', error: err };
  }
  dispatchTaskCreated(record, { source:'calendar', action:'task:create', contactId });
  toastSafe('Task added');
  return { status:'ok', task: record };
}

export async function scheduleFollowUpTask(options){
  ensureReadyLog();
  const settings = options && typeof options === 'object' ? options : {};
  const entity = String(settings.entity || '').toLowerCase() === 'partner' ? 'partner' : 'contact';
  const entityId = settings.entityId == null ? '' : String(settings.entityId).trim();
  if(!entityId){
    toastSafe('Save this record before scheduling follow-up');
    return { status:'error', reason:'missing-id' };
  }
  const due = normalizeDueInput(settings.due);
  const titleRaw = safeString(settings.title);
  const title = titleRaw || (safeString(settings.name) ? `Follow up: ${safeString(settings.name)}` : 'Follow up');
  const note = safeString(settings.note);
  const record = {
    id: uuid(),
    title,
    due,
    status: 'open',
    done: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: entity === 'partner' ? 'partner-modal' : 'contact-modal'
  };
  if(entity === 'contact'){
    record.contactId = entityId;
    if(settings.stage) record.stage = safeString(settings.stage);
    if(settings.name) record.contactName = safeString(settings.name);
    if(settings.status) record.statusLabel = safeString(settings.status);
  }else{
    record.partnerId = entityId;
    if(settings.name) record.partnerName = safeString(settings.name);
  }
  if(note){
    record.notes = note;
  }
  const origin = buildManualOrigin({
    type: entity,
    name: settings.name,
    stage: settings.stage,
    status: settings.status,
    due,
    title,
    entityId
  });
  if(origin){
    record.origin = origin;
  }
  try{
    await persistTaskRecord(record);
  }catch (err){
    console && console.warn && console.warn('scheduleFollowUpTask dbPut failed', err);
    toastSafe('Unable to save task');
    return { status:'error', error: err };
  }
  const detail = entity === 'partner'
    ? { source:'partner', action:'task:create', partnerId: entityId }
    : { source:'contact', action:'task:create', contactId: entityId };
  dispatchTaskCreated(record, detail);
  toastSafe('Follow-up scheduled');
  return { status:'ok', task: record };
}

ensureReadyLog();

export default createTaskFromEvent;
