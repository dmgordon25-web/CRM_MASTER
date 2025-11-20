const __FALLBACK_FAVORITES__ = (() => {
  function normalizeFavoriteId(value){ return String(value || '').trim(); }
  function normalizeFavoriteList(input){ return (Array.isArray(input) ? input : []).map(normalizeFavoriteId).filter(Boolean); }
  function normalizeFavoriteSnapshot(s){ return { contacts: normalizeFavoriteList(s?.contacts), partners: normalizeFavoriteList(s?.partners) }; }
  return { normalizeFavoriteSnapshot, applyFavoriteSnapshot: normalizeFavoriteSnapshot };
})();

const __FAVORITES_API__ = (typeof window !== 'undefined' && window.__CRM_FAVORITES__) ? window.__CRM_FAVORITES__ : __FALLBACK_FAVORITES__;
const { normalizeFavoriteSnapshot, applyFavoriteSnapshot } = __FAVORITES_API__;

function validateSettings(settings){ return { ok: true, errors: [] }; }

(function(){
  if(window.Settings && typeof window.Settings.get === 'function') return;

  const STORE = 'settings';
  const RECORD_ID = 'app:settings';
  let cache = null;

  async function ensureDb(){ if(typeof window.openDB === 'function') await window.openDB(); }
  async function load(){
    await ensureDb();
    const raw = await window.dbGet(STORE, RECORD_ID);
    cache = raw || {};
    return cache;
  }
  async function save(partial, options){
    const current = await load();
    const next = { ...current, ...partial, updatedAt: Date.now() };
    await window.dbPut(STORE, { id: RECORD_ID, ...next });
    cache = next;
    if(!options?.silent && window.Toast) window.Toast.show('Saved');
    return next;
  }

  async function handleDeleteAll(){
    if(!confirm('PERMANENTLY DELETE ALL DATA?')) return;
    const btn = document.getElementById('btn-delete-all');
    if(btn) btn.disabled = true;

    try {
      await ensureDb();
      const STORES = ['contacts','partners','settings','tasks','documents','deals','commissions','meta','templates','notifications','docs','closings','relationships','savedViews'];
      if(typeof window.dbClear === 'function'){
        for(const s of STORES) { try{ await window.dbClear(s); } catch(e){} }
      }
      try { if (window.dbDelete) await window.dbDelete('meta', 'seed:inline:bootstrap'); } catch(e){}
      localStorage.clear();
      sessionStorage.clear();
      try{ localStorage.setItem('crm:suppress-seed', '1'); } catch(e){}

      if(window.toast) window.toast('Wiped. Reloading...');
      // FORCE HARD RELOAD to clear memory state
      setTimeout(() => window.location.reload(), 500);

    } catch(e) {
      console.warn(e);
      if(window.toast) window.toast('Wipe failed: ' + e.message);
      if(btn) btn.disabled = false;
    }
  }

  window.CRM = window.CRM || {};
  window.CRM.validateSettings = validateSettings;
  window.Settings = { get: load, save, refresh: load, deleteAll: handleDeleteAll };

  if(typeof document !== 'undefined'){
     document.addEventListener('DOMContentLoaded', () => {
       const btn = document.getElementById('btn-delete-all');
       if(btn) btn.addEventListener('click', (e) => { e.preventDefault(); handleDeleteAll(); });
     });
  }
})();
