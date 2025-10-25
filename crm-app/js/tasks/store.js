import { parseDateInput } from '../calendar/index.js';

const GLOBAL_SCOPE = typeof globalThis !== 'undefined'
  ? globalThis
  : (typeof window !== 'undefined' ? window : {});

const listeners = new Set();
let hydrated = false;
let hydratePromise = null;
let cache = [];

function cloneTask(task){
  if(!task || typeof task !== 'object') return null;
  return { ...(task || {}) };
}

function seedFallback(){
  const dataset = GLOBAL_SCOPE && GLOBAL_SCOPE.__SEED_DATA__;
  if(!dataset || typeof dataset !== 'object') return [];
  const list = dataset.tasks;
  return Array.isArray(list) ? list.map(item => cloneTask(item)).filter(Boolean) : [];
}

function dueStamp(task){
  const raw = task && (task.due ?? task.dueDate ?? task.date);
  const parsed = parseDateInput(raw);
  return parsed instanceof Date ? parsed.getTime() : Number.MAX_SAFE_INTEGER;
}

function sortCache(){
  cache.sort((a, b) => {
    const aStamp = dueStamp(a);
    const bStamp = dueStamp(b);
    if(aStamp !== bStamp) return aStamp - bStamp;
    return String(a?.title || '').localeCompare(String(b?.title || ''));
  });
}

function notify(){
  if(listeners.size === 0) return;
  const snapshot = cache.map(task => cloneTask(task)).filter(Boolean);
  listeners.forEach(listener => {
    if(typeof listener !== 'function') return;
    try{
      listener(snapshot);
    }catch (err){
      if(console && typeof console.warn === 'function'){
        console.warn('tasks store listener failed', err);
      }
    }
  });
}

async function loadFromStore(){
  const getter = GLOBAL_SCOPE && typeof GLOBAL_SCOPE.dbGetAll === 'function'
    ? GLOBAL_SCOPE.dbGetAll
    : null;
  if(!getter){
    return seedFallback();
  }
  try{
    const records = await getter.call(GLOBAL_SCOPE, 'tasks');
    if(Array.isArray(records)){
      if(records.length) return records;
      const fallback = seedFallback();
      return fallback.length ? fallback : records;
    }
  }catch (err){
    if(console && typeof console.warn === 'function'){
      console.warn('tasks store load failed', err);
    }
  }
  return seedFallback();
}

async function ensureHydrated(){
  if(hydrated) return cache;
  if(hydratePromise){
    await hydratePromise;
    return cache;
  }
  hydratePromise = (async () => {
    const records = await loadFromStore();
    cache = Array.isArray(records) ? records.map(task => cloneTask(task)).filter(Boolean) : [];
    sortCache();
    hydrated = true;
    notify();
  })().catch(err => {
    hydrated = true;
    cache = seedFallback();
    sortCache();
    if(console && typeof console.warn === 'function'){
      console.warn('tasks store hydrate failed', err);
    }
    notify();
  }).finally(() => {
    hydratePromise = null;
  });
  await hydratePromise;
  return cache;
}

export async function getTasks(){
  await ensureHydrated();
  return cache.map(task => cloneTask(task)).filter(Boolean);
}

export function subscribe(listener){
  if(typeof listener !== 'function') return () => {};
  listeners.add(listener);
  if(hydrated){
    try{ listener(cache.map(task => cloneTask(task)).filter(Boolean)); }
    catch (err){
      if(console && typeof console.warn === 'function'){
        console.warn('tasks store listener failed', err);
      }
    }
  }
  return () => {
    listeners.delete(listener);
  };
}

export function recordTask(task){
  if(!task || typeof task !== 'object') return;
  const entry = cloneTask(task);
  if(!entry) return;
  if(!entry.id){
    entry.id = String(Date.now());
  }
  const id = String(entry.id);
  const index = cache.findIndex(existing => String(existing && existing.id) === id);
  if(index === -1){
    cache.push(entry);
  }else{
    cache[index] = entry;
  }
  hydrated = true;
  sortCache();
  notify();
}

export async function refreshTasks(){
  hydrated = false;
  cache = [];
  await ensureHydrated();
}

export default {
  getTasks,
  subscribe,
  recordTask,
  refreshTasks
};
