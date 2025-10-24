const STORAGE_KEY = 'crm.workbench.queries';
const memoryStore = {};

function clone(value){
  if(!value || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

export function loadAll(){
  let snapshot = {};
  try{
    const store = typeof window !== 'undefined' ? window.localStorage : null;
    if(store && typeof store.getItem === 'function'){
      const raw = store.getItem(STORAGE_KEY);
      if(raw){
        try{
          const parsed = JSON.parse(raw);
          if(parsed && typeof parsed === 'object'){
            Object.assign(memoryStore, parsed);
            snapshot = parsed;
          }
        }catch (err){
          console.warn('[soft] [workbench] query parse failed', err);
          snapshot = { ...memoryStore };
        }
      }else{
        snapshot = { ...memoryStore };
      }
    }else{
      snapshot = { ...memoryStore };
    }
  }catch (err){
    console.warn('[soft] [workbench] query load failed', err);
    snapshot = { ...memoryStore };
  }
  return clone(snapshot || {});
}

export function save(name, definition){
  if(!name) return;
  const payload = loadAll();
  payload[name] = definition;
  memoryStore[name] = clone(definition);
  try{
    const store = typeof window !== 'undefined' ? window.localStorage : null;
    if(store && typeof store.setItem === 'function'){
      store.setItem(STORAGE_KEY, JSON.stringify(payload));
      console.info('[VIS] workbench query saved', name);
    }
  }catch (err){
    console.warn('[soft] [workbench] query save failed', err);
  }
}
