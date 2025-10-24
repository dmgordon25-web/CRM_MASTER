const STORAGE_KEY = 'crm.workbench.savedQueries.v1';
let memoryStore = [];

function deepClone(value){
  if(value == null) return value;
  try{
    return JSON.parse(JSON.stringify(value));
  }catch (_err){
    if(Array.isArray(value)) return value.map(deepClone);
    if(typeof value === 'object'){
      const clone = {};
      Object.keys(value).forEach((key) => { clone[key] = deepClone(value[key]); });
      return clone;
    }
    return value;
  }
}

function readStorage(){
  if(typeof window === 'undefined'){ return deepClone(memoryStore); }
  let raw = null;
  try{
    raw = window.localStorage ? window.localStorage.getItem(STORAGE_KEY) : null;
  }catch (_err){ raw = null; }
  if(typeof raw === 'string' && raw){
    try{
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)){
        memoryStore = deepClone(parsed);
        return deepClone(parsed);
      }
    }catch (_err){ }
  }
  return deepClone(memoryStore);
}

function persist(list){
  const snapshot = Array.isArray(list) ? deepClone(list) : [];
  memoryStore = snapshot;
  if(typeof window === 'undefined') return;
  try{
    if(window.localStorage){
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
  }catch (_err){}
}

function generateId(){
  if(typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function'){
    try{ return crypto.randomUUID(); }
    catch (_err){}
  }
  const rand = Math.random().toString(16).slice(2, 10);
  return `wb_${Date.now().toString(36)}_${rand}`;
}

function normalizeEntry(entry, existing){
  const now = Date.now();
  const base = entry && typeof entry === 'object' ? deepClone(entry) : {};
  const idSource = base.id != null ? base.id : existing && existing.id != null ? existing.id : generateId();
  const id = String(idSource);
  const createdAt = base.createdAt != null ? base.createdAt : (existing && existing.createdAt != null ? existing.createdAt : now);
  const normalized = {
    ...deepClone(existing || {}),
    ...base,
    id,
    createdAt,
    updatedAt: now
  };
  if(normalized.filters && typeof normalized.filters === 'object'){
    normalized.filters = deepClone(normalized.filters);
  }
  if(normalized.sort && typeof normalized.sort === 'object'){
    normalized.sort = deepClone(normalized.sort);
  }
  if(typeof normalized.raw === 'string'){
    normalized.raw = normalized.raw;
  }
  return normalized;
}

export async function listQueries(entity){
  const list = readStorage();
  const filtered = Array.isArray(list)
    ? list.filter((item) => {
        if(!entity) return true;
        const key = item && item.entity ? String(item.entity).toLowerCase() : '';
        return key === String(entity).toLowerCase();
      })
    : [];
  filtered.sort((a, b) => {
    const left = (a && typeof a.updatedAt === 'number') ? a.updatedAt : 0;
    const right = (b && typeof b.updatedAt === 'number') ? b.updatedAt : 0;
    return right - left;
  });
  return filtered.map((item) => deepClone(item));
}

export async function getQuery(id){
  if(!id) return null;
  const list = readStorage();
  const target = list.find((item) => item && String(item.id) === String(id));
  return target ? deepClone(target) : null;
}

export async function saveQuery(entry){
  const list = readStorage();
  const idSource = entry && entry.id != null ? entry.id : null;
  const idx = idSource == null ? -1 : list.findIndex((item) => item && String(item.id) === String(idSource));
  const existing = idx >= 0 ? list[idx] : null;
  const normalized = normalizeEntry(entry, existing);
  const next = idx >= 0 ? list.slice(0, idx).concat(list.slice(idx + 1)) : list.slice();
  next.push(normalized);
  persist(next);
  return deepClone(normalized);
}

export async function updateQuery(id, patch){
  if(id == null) return null;
  const list = readStorage();
  const idx = list.findIndex((item) => item && String(item.id) === String(id));
  if(idx === -1) return null;
  const existing = list[idx];
  const merged = normalizeEntry({ ...deepClone(existing), ...deepClone(patch), id: existing.id, createdAt: existing.createdAt }, existing);
  const next = list.slice(0, idx).concat(list.slice(idx + 1));
  next.push(merged);
  persist(next);
  return deepClone(merged);
}

export async function removeQuery(id){
  if(id == null) return false;
  const list = readStorage();
  const next = list.filter((item) => item && String(item.id) !== String(id));
  if(next.length === list.length) return false;
  persist(next);
  return true;
}

export async function clearAll(){
  persist([]);
  return true;
}
