import { openDB, dbPut } from '../db.js';

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

export async function createTaskFromEvent(event){
  ensureReadyLog();
  const contactId = event && event.contactId ? String(event.contactId).trim() : '';
  if(!contactId){
    toastSafe('Link a contact before adding a task');
    return { status:'error', reason:'missing-contact' };
  }
  const dueDate = toISODate(event && event.date ? event.date : new Date());
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
  try{
    await openDB();
    await dbPut('tasks', record);
  }catch (err){
    console && console.warn && console.warn('createTaskFromEvent dbPut failed', err);
    toastSafe('Unable to save task');
    return { status:'error', error: err };
  }
  let dispatched = false;
  try{
    if(typeof window !== 'undefined' && typeof window.dispatchAppDataChanged === 'function'){
      window.dispatchAppDataChanged({ source:'calendar', action:'task:create', taskId: record.id, contactId });
      dispatched = true;
    }
  }catch (err){
    console && console.warn && console.warn('dispatchAppDataChanged failed', err);
  }
  if(!dispatched && typeof document !== 'undefined' && typeof document.dispatchEvent === 'function'){
    try{
      document.dispatchEvent(new CustomEvent('app:data:changed', { detail:{ scope:'tasks', ids:[record.id] } }));
    }catch (_err){}
  }
  toastSafe('Task added');
  return { status:'ok', task: record };
}

ensureReadyLog();

export default createTaskFromEvent;
