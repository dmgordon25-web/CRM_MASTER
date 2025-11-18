import { openDB, dbPut } from '../db.js';
import { normalizeStatus } from '../pipeline/constants.js';
import { getTasks, recordTask } from './store.js';

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

function resolveLinkedContext(payload){
  if(!payload || typeof payload !== 'object') return { type:'', id:'' };
  const type = safeString(payload.linkedType).toLowerCase();
  const id = safeString(payload.linkedId);
  return { type, id };
}

function normalizeDueDate(input){
  if(!input) return toISODate(new Date());
  if(input instanceof Date || typeof input === 'number'){ return toISODate(input); }
  if(typeof input === 'string'){
    const trimmed = input.trim();
    if(!trimmed) return toISODate(new Date());
    if(/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if(!Number.isNaN(parsed.getTime())){
      return toISODate(parsed);
    }
    return trimmed;
  }
  return toISODate(new Date());
}

function dispatchTaskCreated(record, contactId, source){
  let dispatched = false;
  const origin = source || 'followup';
  try{
    if(typeof window !== 'undefined' && typeof window.dispatchAppDataChanged === 'function'){
      window.dispatchAppDataChanged({ source: origin, action:'task:create', taskId: record.id, contactId });
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

function dispatchTaskUpdated(record){
  if(!record || !record.id) return;
  const detail = { scope:'tasks', ids:[record.id] };
  try{
    if(typeof window !== 'undefined' && typeof window.dispatchAppDataChanged === 'function'){
      window.dispatchAppDataChanged(detail);
      return;
    }
  }catch (err){
    console && console.warn && console.warn('dispatchAppDataChanged failed', err);
  }
  if(typeof document !== 'undefined' && typeof document.dispatchEvent === 'function'){
    try{ document.dispatchEvent(new CustomEvent('app:data:changed', { detail })); }
    catch (_err){}
  }
}

function normalizeTaskStatus(task){
  const raw = task && (task.status || task.raw?.status || task.state);
  return raw ? normalizeStatus(raw) : '';
}

function isDone(task){
  const status = normalizeTaskStatus(task);
  return task && (task.done === true || status === 'done' || status === 'completed');
}

function buildTaskRecord(payload){
  const now = Date.now();
  const record = {
    id: uuid(),
    kind: 'todo',
    status: 'open',
    done: false,
    createdAt: now,
    updatedAt: now,
    due: normalizeDueDate(payload?.due)
  };
  const note = safeString(payload?.note || payload?.notes || payload?.title || '');
  record.title = note || 'Follow up';
  const linkedType = safeString(payload?.linkedType || payload?.type);
  const linkedId = safeString(payload?.linkedId || payload?.id);
  if(linkedType && linkedId){
    record.linkedType = linkedType;
    record.linkedId = linkedId;
    if(linkedType === 'contact') record.contactId = linkedId;
    if(linkedType === 'partner') record.partnerId = linkedId;
  }
  const contactId = safeString(payload?.contactId || '');
  if(contactId) {
    record.contactId = contactId;
    record.linkedType = record.linkedType || 'contact';
    record.linkedId = record.linkedId || contactId;
  }
  const partnerId = safeString(payload?.partnerId || '');
  if(partnerId){
    record.partnerId = partnerId;
    record.linkedType = record.linkedType || 'partner';
    record.linkedId = record.linkedId || partnerId;
  }
  return record;
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

export async function createMinimalTask(payload){
  ensureReadyLog();
  const { type: linkedType, id: linkedId } = resolveLinkedContext(payload);
  if(!linkedType || !linkedId){
    return { status:'error', reason:'missing-link' };
  }
  const due = normalizeDueDate(payload?.due);
  const note = safeString(payload?.note || payload?.notes);
  const now = Date.now();
  const record = {
    id: uuid(),
    kind: 'todo',
    status: 'open',
    done: false,
    createdAt: now,
    updatedAt: now,
    due,
    linkedType,
    linkedId
  };
  if(linkedType === 'contact'){
    record.contactId = linkedId;
  }else if(linkedType === 'partner'){
    record.partnerId = linkedId;
  }
  if(note){
    record.notes = note;
    record.note = note;
    record.title = note;
  }else{
    record.title = 'Follow up';
  }
  try{
    await persistTask(record);
  }catch (err){
    console && console.warn && console.warn('createMinimalTask dbPut failed', err);
    toastSafe('Unable to save task');
    return { status:'error', error: err };
  }
  const contactId = record.contactId || (linkedType === 'contact' ? linkedId : '');
  dispatchTaskCreated(record, contactId, 'followup');
  toastSafe('Task added');
  return { status:'ok', task: record };
}

export async function createDashboardTask(payload){
  ensureReadyLog();
  const title = safeString(payload?.title || payload?.note || '');
  if(!title){
    toastSafe('Enter a task name to continue');
    return { status:'error', reason:'missing-title' };
  }
  const record = buildTaskRecord(Object.assign({}, payload, { note: title, notes: title }));
  try{
    await persistTask(record);
  }catch (err){
    console && console.warn && console.warn('createDashboardTask failed', err);
    toastSafe('Unable to save task');
    return { status:'error', error: err };
  }
  const contactId = record.contactId || '';
  dispatchTaskCreated(record, contactId, 'dashboard');
  return { status:'ok', task: record };
}

export async function updateTaskStatus(payload){
  const id = safeString(payload && payload.id);
  if(!id){
    return { status:'error', reason:'missing-id' };
  }
  const targetDone = payload && typeof payload.done === 'boolean' ? payload.done : payload && payload.completed === true;
  const targetStatus = payload && payload.status ? payload.status : (targetDone ? 'done' : 'open');
  const fromPayload = payload && payload.task && typeof payload.task === 'object' ? payload.task : null;
  let existing = fromPayload;
  if(!existing){
    const tasks = await getTasks();
    existing = tasks.find(task => task && String(task.id) === id) || null;
  }
  const now = Date.now();
  const updated = Object.assign({}, existing || { id, kind: 'todo', createdAt: now }, {
    id,
    status: targetStatus,
    done: targetDone,
    updatedAt: now
  });
  if(targetDone){
    updated.completedAt = payload && payload.completedAt ? payload.completedAt : now;
  }else if(updated.completedAt){
    delete updated.completedAt;
  }
  try{
    await persistTask(updated);
  }catch (err){
    console && console.warn && console.warn('updateTaskStatus failed', err);
    toastSafe('Unable to update task');
    return { status:'error', error: err };
  }
  dispatchTaskUpdated(updated);
  return { status:'ok', task: updated };
}

export async function listTasksForDashboard(options = {}){
  const filter = options.filter || 'today';
  const limit = Number.isFinite(options.limit) ? Math.max(1, options.limit) : 50;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayTs = today.getTime();
  const tasks = await getTasks();
  const filtered = tasks.filter(task => {
    if(!task || task.deleted) return false;
    if(isDone(task)) return filter === 'all' ? true : false;
    const status = normalizeTaskStatus(task);
    if(status === 'archived' || status === 'cancelled' || status === 'canceled') return false;
    const kind = (task.kind || task.type || '').toString().toLowerCase();
    if(kind && kind.includes('note')) return false;
    if(filter === 'all') return true;
    const rawDue = task.due || task.dueDate || task.date;
    if(!rawDue) return filter === 'today';
    const dueDate = new Date(rawDue);
    if(Number.isNaN(dueDate.getTime())) return filter === 'today';
    const dueTs = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
    if(filter === 'overdue') return dueTs < todayTs;
    return dueTs <= todayTs;
  });
  const sorted = filtered.sort((a, b) => {
    const aDue = new Date(a.due || a.dueDate || a.date);
    const bDue = new Date(b.due || b.dueDate || b.date);
    const aTs = Number.isNaN(aDue.getTime()) ? Number.MAX_SAFE_INTEGER : aDue.getTime();
    const bTs = Number.isNaN(bDue.getTime()) ? Number.MAX_SAFE_INTEGER : bDue.getTime();
    if(aTs !== bTs) return aTs - bTs;
    return String(a.title || '').localeCompare(String(b.title || ''), undefined, { numeric: true, sensitivity: 'base' });
  });
  return sorted.slice(0, limit);
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
    await openDB();
    await dbPut('tasks', record);
    try{
      recordTask(record);
    }catch (err){
      console && console.warn && console.warn('tasks store update failed', err);
    }
  }catch (err){
    console && console.warn && console.warn('createTaskFromEvent dbPut failed', err);
    toastSafe('Unable to save task');
    return { status:'error', error: err };
  }
  dispatchTaskCreated(record, contactId, 'calendar');
  toastSafe('Task added');
  return { status:'ok', task: record };
}

ensureReadyLog();

export default createTaskFromEvent;
