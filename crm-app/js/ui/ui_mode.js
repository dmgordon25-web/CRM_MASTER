const STORAGE_KEY = 'crm:uiMode';
const MODE_SIMPLE = 'simple';
const MODE_ADVANCED = 'advanced';

let currentMode = MODE_ADVANCED;
let initialized = false;
const subscribers = new Set();

function normalizeMode(value){
  return value === MODE_SIMPLE ? MODE_SIMPLE : MODE_ADVANCED;
}

function readLocalFallback(){
  try{
    const stored = localStorage.getItem(STORAGE_KEY);
    if(stored){
      return normalizeMode(stored.trim());
    }
  }catch (_err){}
  return MODE_ADVANCED;
}

function writeLocalFallback(mode){
  try{ localStorage.setItem(STORAGE_KEY, mode); }
  catch (_err){}
}

function notify(mode){
  const detail = { mode };
  try{ document.dispatchEvent(new CustomEvent('app:ui-mode:changed', { detail })); }
  catch (_err){}
  subscribers.forEach((handler) => {
    try{ handler(mode); }
    catch (err){ console && console.warn && console.warn('[ui-mode] handler failed', err); }
  });
}

function applyMode(nextMode){
  const mode = normalizeMode(nextMode);
  if(mode === currentMode){
    return currentMode;
  }
  currentMode = mode;
  if(typeof document !== 'undefined' && document.body){
    document.body.classList.toggle('ui-simple-mode', mode === MODE_SIMPLE);
    document.body.classList.toggle('ui-advanced-mode', mode === MODE_ADVANCED);
  }
  notify(currentMode);
  return currentMode;
}

async function hydrateFromSettings(){
  if(typeof window === 'undefined') return;
  if(!window.Settings || typeof window.Settings.get !== 'function') return;
  try{
    const data = await window.Settings.get();
    const storedMode = normalizeMode(data && data.uiMode);
    if(storedMode !== currentMode){
      applyMode(storedMode);
      writeLocalFallback(storedMode);
    }
  }catch (err){
    try{ console && console.warn && console.warn('[ui-mode] hydrate failed', err); }
    catch (_warn){}
  }
}

function saveModePreference(mode){
  const normalized = normalizeMode(mode);
  writeLocalFallback(normalized);
  if(typeof window !== 'undefined' && window.Settings && typeof window.Settings.save === 'function'){
    try{ window.Settings.save({ uiMode: normalized }, { silent: true }); }
    catch (_err){}
  }
}

function ensureInitialized(){
  if(initialized) return currentMode;
  initialized = true;
  currentMode = normalizeMode(readLocalFallback());
  hydrateFromSettings();
  wireUiModeControl();
  return currentMode;
}

function getUiMode(){
  ensureInitialized();
  return currentMode;
}

function isSimpleMode(){
  return getUiMode() === MODE_SIMPLE;
}

function onUiModeChanged(handler){
  if(typeof handler !== 'function') return () => {};
  ensureInitialized();
  subscribers.add(handler);
  return () => subscribers.delete(handler);
}

function handleControlChange(event){
  const target = event?.target;
  if(!target || !target.value) return;
  const next = normalizeMode(target.value);
  if(next === currentMode){
    return;
  }
  applyMode(next);
  saveModePreference(next);
}

function syncControls(){
  const mode = getUiMode();
  if(typeof document === 'undefined') return;
  const inputs = document.querySelectorAll('input[name="ui-mode"]');
  inputs.forEach((input) => {
    if(!(input instanceof HTMLInputElement)) return;
    input.checked = input.value === mode;
  });
}

function wireUiModeControl(){
  if(typeof document === 'undefined') return;
  const host = document.querySelector('[data-ui-mode-selector]');
  if(!host || host.__uiModeWired) return;
  host.__uiModeWired = true;
  host.addEventListener('change', handleControlChange);
  syncControls();
  document.addEventListener('app:ui-mode:changed', syncControls);
  if(window.RenderGuard?.registerHook){
    window.RenderGuard.registerHook(syncControls);
  }
}

ensureInitialized();

export { getUiMode, isSimpleMode, onUiModeChanged };
export default { getUiMode, isSimpleMode, onUiModeChanged };
