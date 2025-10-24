const STORAGE_KEY = 'workbench:queries:v1';
let bootstrapped = false;
let memoryStore = [];

function clone(entry){
  if(!entry || typeof entry !== 'object') return null;
  return {
    id: entry.id,
    name: entry.name,
    definition: entry.definition,
    entity: entry.entity,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    lastRunAt: entry.lastRunAt || null
  };
}

function generateId(){
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `wb-${ts}-${rand}`;
}

function normalizeEntity(value){
  return value === 'partners' ? 'partners' : 'contacts';
}

function sanitizeName(value){
  return String(value == null ? '' : value).trim();
}

function toIso(value){
  if(!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function normalizeEntry(raw){
  if(!raw || typeof raw !== 'object') return null;
  const id = raw.id ? String(raw.id) : generateId();
  const name = sanitizeName(raw.name || raw.title || raw.label);
  if(!name) return null;
  const definition = String(raw.definition ?? raw.query ?? '').trim();
  const entity = normalizeEntity(raw.entity || raw.scope || raw.type);
  const createdAt = toIso(raw.createdAt);
  const updatedAt = toIso(raw.updatedAt || raw.modifiedAt || createdAt);
  const lastRunAt = raw.lastRunAt ? toIso(raw.lastRunAt) : null;
  return { id, name, definition, entity, createdAt, updatedAt, lastRunAt };
}

function loadFromStorage(){
  if(typeof window === 'undefined' || !window?.localStorage) return memoryStore.slice();
  try{
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray(parsed.queries) ? parsed.queries : []);
    const normalized = list
      .map(item => {
        try{ return normalizeEntry(item); }
        catch(_err){ return null; }
      })
      .filter(Boolean);
    return normalized;
  }catch(_err){
    return [];
  }
}

function persist(){
  memoryStore = memoryStore
    .map(entry => clone(entry))
    .filter(Boolean);
  if(typeof window === 'undefined' || !window?.localStorage) return;
  try{
    const payload = JSON.stringify(memoryStore);
    window.localStorage.setItem(STORAGE_KEY, payload);
  }catch(_err){}
}

function ensureCache(){
  if(bootstrapped) return;
  bootstrapped = true;
  const stored = loadFromStorage();
  if(stored.length){
    memoryStore = stored;
  }
}

function notify(type, entry){
  if(typeof document === 'undefined' || typeof document.dispatchEvent !== 'function') return;
  try{
    const detail = { type };
    if(entry) detail.query = clone(entry);
    document.dispatchEvent(new CustomEvent('workbench:queries:changed', { detail }));
  }catch(_err){}
}

function sortQueries(list){
  return list.slice().sort((a, b) => {
    const aTime = a && a.updatedAt ? Date.parse(a.updatedAt) || 0 : 0;
    const bTime = b && b.updatedAt ? Date.parse(b.updatedAt) || 0 : 0;
    if(bTime !== aTime) return bTime - aTime;
    const aName = a && a.name ? a.name.toLowerCase() : '';
    const bName = b && b.name ? b.name.toLowerCase() : '';
    if(aName < bName) return -1;
    if(aName > bName) return 1;
    return 0;
  });
}

export function listQueries(){
  ensureCache();
  return sortQueries(memoryStore).map(entry => clone(entry)).filter(Boolean);
}

export function getQuery(id){
  ensureCache();
  if(!id) return null;
  const key = String(id);
  const found = memoryStore.find(entry => entry.id === key);
  return clone(found);
}

export function saveQuery(input){
  ensureCache();
  const name = sanitizeName(input && input.name);
  if(!name) throw new Error('Query name is required');
  const definition = String(input && input.definition != null ? input.definition : '').trim();
  const entity = normalizeEntity(input && input.entity);
  const nowIso = new Date().toISOString();
  const key = input && input.id ? String(input.id) : null;
  let existingIndex = -1;
  if(key){
    existingIndex = memoryStore.findIndex(entry => entry.id === key);
  }
  if(existingIndex === -1){
    const normalizedName = name.toLowerCase();
    existingIndex = memoryStore.findIndex(entry => entry.name.toLowerCase() === normalizedName);
  }
  const existing = existingIndex >= 0 ? memoryStore[existingIndex] : null;
  const createdAt = existing ? existing.createdAt : nowIso;
  const lastRunAt = existing ? existing.lastRunAt : null;
  const entry = {
    id: existing ? existing.id : generateId(),
    name,
    definition,
    entity,
    createdAt,
    updatedAt: nowIso,
    lastRunAt
  };
  if(existingIndex >= 0){
    memoryStore.splice(existingIndex, 1, entry);
  }else{
    memoryStore.push(entry);
  }
  persist();
  notify('save', entry);
  return clone(entry);
}

export function deleteQuery(id){
  ensureCache();
  if(!id) return false;
  const key = String(id);
  const index = memoryStore.findIndex(entry => entry.id === key);
  if(index === -1) return false;
  const [removed] = memoryStore.splice(index, 1);
  persist();
  notify('delete', removed);
  return true;
}

export function touchQueryRun(id){
  ensureCache();
  if(!id) return null;
  const key = String(id);
  const entry = memoryStore.find(item => item.id === key);
  if(!entry) return null;
  entry.lastRunAt = new Date().toISOString();
  persist();
  notify('run', entry);
  return clone(entry);
}

export function clearAllQueries(){
  ensureCache();
  memoryStore = [];
  persist();
  notify('reset');
}

export { STORAGE_KEY as QUERIES_STORAGE_KEY };
