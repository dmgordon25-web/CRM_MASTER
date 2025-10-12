import { PIPELINE_STAGES, NORMALIZE_STAGE, stageKeyFromLabel } from '/js/pipeline/stages.js';

// Normalize a kanban stage/key to a safe, comparable form.
function normalizeKey(x) {
  return String(x || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')        // strip accents consistently
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w ]/g, '')
    .replace(/\s/g, '_');
}

const kanbanMetrics = (() => {
  const metrics = window.__KANBAN_HANDLERS__ || { attach: 0, detach: 0, active: 0 };
  metrics.attach = metrics.attach || 0;
  metrics.detach = metrics.detach || 0;
  metrics.active = metrics.active || 0;
  return window.__KANBAN_HANDLERS__ = metrics;
})();

const wiring = {
  root: null,
  listeners: [],
  observer: null
};

function updateKanbanMetrics(){
  kanbanMetrics.active = wiring.listeners.length;
  kanbanMetrics.root = wiring.root && wiring.root.isConnected ? 'connected' : (wiring.root ? 'detached' : 'none');
  kanbanMetrics.timestamp = Date.now();
}

function unobserveRoot(){
  if(wiring.observer){
    try{ wiring.observer.disconnect(); }
    catch (_err) {}
    wiring.observer = null;
  }
}

function detachAll(reason){
  if(!wiring.listeners.length) return;
  wiring.listeners.forEach(({ root, event, handler, options }) => {
    try{ root.removeEventListener(event, handler, options); }
    catch (_err) {}
    kanbanMetrics.detach += 1;
  });
  wiring.listeners = [];
  if(reason) kanbanMetrics.lastDetachReason = reason;
  updateKanbanMetrics();
}

function recordListener(root, event, handler, options){
  if(!root || !event || typeof handler !== 'function') return;
  root.addEventListener(event, handler, options);
  wiring.listeners.push({ root, event, handler, options });
  kanbanMetrics.attach += 1;
  updateKanbanMetrics();
}

function monitorRoot(root){
  unobserveRoot();
  if(!root) return;
  const target = root.parentNode || document.body || document.documentElement;
  if(!target) return;
  const observer = new MutationObserver(() => {
    if(wiring.root && !wiring.root.isConnected){
      detachAll('disconnect');
      wiring.root = null;
      unobserveRoot();
      updateKanbanMetrics();
    }
  });
  try{ observer.observe(target, { childList: true, subtree: true }); }
  catch (_err) { return; }
  wiring.observer = observer;
}

function teardownKanban(reason){
  detachAll(reason);
  wiring.root = null;
  unobserveRoot();
  updateKanbanMetrics();
}

const STAGE_LABEL_SET = new Set(PIPELINE_STAGES);
const KEY_TO_LABEL = new Map();
PIPELINE_STAGES.forEach((label) => {
  const stageKey = stageKeyFromLabel(label);
  KEY_TO_LABEL.set(stageKey, label);
  KEY_TO_LABEL.set(normalizeKey(label), label);
  KEY_TO_LABEL.set(label.toLowerCase(), label);
});

function normStage(s){
  if(!s) return null;
  const raw = String(s).trim();
  if(!raw) return null;

  const normalized = NORMALIZE_STAGE(raw);
  if (normalized && STAGE_LABEL_SET.has(normalized)) return normalized;

  const normalizedKey = normalizeKey(raw);
  if(KEY_TO_LABEL.has(normalizedKey)) return KEY_TO_LABEL.get(normalizedKey);

  const stageKey = stageKeyFromLabel(raw);
  if(stageKey && KEY_TO_LABEL.has(stageKey)) return KEY_TO_LABEL.get(stageKey);

  const lowered = raw.toLowerCase();
  if(KEY_TO_LABEL.has(lowered)) return KEY_TO_LABEL.get(lowered);

  const slug = lowered.replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'');
  if(KEY_TO_LABEL.has(slug)) return KEY_TO_LABEL.get(slug);

  return null;
}

function boardEl(){ return document.querySelector('[data-kanban], #kanban, .kanban-board'); }

function lanes(){
  const root = boardEl();
  if(!root) return [];
  const items = Array.from(root.querySelectorAll('[data-stage],[data-lane],[data-column]'));
  // If markup lacks attributes, infer from header text and stamp data-stage (JS-only, no HTML edits)
  items.forEach(el => {
    if(!el.dataset.stage){
      const h = el.getAttribute('aria-label') || el.querySelector('h3,h4,header')?.textContent || '';
      const st = normStage(h);
      if(st) el.dataset.stage = stageKeyFromLabel(st);
    }
  });
  return items.filter(el => normStage(el.dataset.stage));
}

function cards(){
  const root = boardEl();
  if(!root) return [];
  const list = Array.from(root.querySelectorAll('[data-id].kanban-card, [data-id][data-type="contact"], .kanban-card [data-id]'))
    .map(el => el.closest('[data-id]'));
  // make draggable
  list.forEach(el => { try{ el.setAttribute('draggable','true'); }catch (_) { } });
  return list.filter(Boolean);
}

function cardId(el){
  if(!el) return null;
  const id = el.getAttribute('data-id') || el.dataset.id || el.getAttribute('data-contact-id') || el.dataset.contactId;
  return id ? String(id) : null;
}

updateKanbanMetrics();

let pending = new Set();
let flushScheduled = false;

function scheduleFlush(){
  if(flushScheduled) return;
  flushScheduled = true;
  const qmt = (typeof queueMicrotask==='function') ? queueMicrotask : (fn)=>Promise.resolve().then(fn);
  qmt(async () => {
    flushScheduled = false;
    if(pending.size === 0) return;
    // Emit exactly one change for the batch
    try{
      if (typeof window.dispatchAppDataChanged === 'function'){
        window.dispatchAppDataChanged({ scope:'pipeline', ids:[...pending] });
      } else {
        document.dispatchEvent(new CustomEvent('app:data:changed',{ detail:{ scope:'pipeline', ids:[...pending] }}));
      }
    } finally {
      pending.clear();
    }
  });
}

async function persistStage(contactId, newStage){
  if(!contactId || !newStage) return false;
  const normalizedLabel = NORMALIZE_STAGE(newStage);
  const stageKey = stageKeyFromLabel(normalizedLabel);

  const scope = (typeof window !== 'undefined' && window) ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  let dbm = null;
  try {
    dbm = await import('/js/db.js');
  } catch (_err) {
    dbm = null;
  }

  const pickFn = (...candidates) => {
    for (const fn of candidates) {
      if (typeof fn === 'function') return fn;
    }
    return null;
  };

  const openDBFn = pickFn(dbm?.openDB, scope?.openDB);
  if(!openDBFn) return false;
  await openDBFn();

  const get = pickFn(
    dbm?.dbGetContact,
    dbm?.getContact,
    dbm?.dbContactById,
    typeof dbm?.dbGet === 'function' ? (id) => dbm.dbGet('contacts', id) : null,
    scope?.dbGetContact,
    scope?.getContact,
    scope?.dbContactById,
    typeof scope?.dbGet === 'function' ? (id) => scope.dbGet('contacts', id) : null
  );

  const put = pickFn(
    dbm?.dbPutContact,
    dbm?.putContact,
    dbm?.saveContact,
    typeof dbm?.dbPut === 'function' ? (row) => dbm.dbPut('contacts', row) : null,
    scope?.dbPutContact,
    scope?.putContact,
    scope?.saveContact,
    typeof scope?.dbPut === 'function' ? (row) => scope.dbPut('contacts', row) : null
  );

  if(!get || !put) return false;

  let row = null;
  try {
    row = await get(contactId);
  } catch (_err) {
    row = null;
  }
  if(!row) return false;
  const currentKey = stageKeyFromLabel(row.stage);
  if(currentKey === stageKey && row.stage === stageKey) return true;

  row.stage = stageKey;
  row.updatedAt = Date.now();
  try {
    await put(row);
  } catch (_err) {
    return false;
  }
  pending.add(contactId);
  scheduleFlush();
  return true;
}

function installDnD(){
  const root = boardEl();
  if(!root){
    if(wiring.root) teardownKanban('missing-root');
    return;
  }
  if(wiring.root && wiring.root !== root){
    teardownKanban('root-changed');
  }
  if(wiring.root === root && wiring.listeners.length){
    return;
  }

  wiring.root = root;

  const onDragStart = (e) => {
    const card = e.target.closest('[data-id]');
    if(!card) return;
    const id = cardId(card); if(!id) return;
    e.dataTransfer?.setData('text/plain', JSON.stringify({ type:'contact', id }));
    e.dataTransfer?.setDragImage?.(card, 10, 10);
  };

  const onDragOver = (e) => {
    const lane = e.target.closest('[data-stage],[data-lane],[data-column]');
    if(!lane) return;
    const st = normStage(lane.dataset.stage); if(!st) return;
    e.preventDefault();
  };

  const onDrop = async (e) => {
    const lane = e.target.closest('[data-stage],[data-lane],[data-column]');
    if(!lane) return;
    const st = normStage(lane.dataset.stage); if(!st) return;
    const laneKey = stageKeyFromLabel(st);
    try{
      const raw = e.dataTransfer?.getData('text/plain'); if(!raw) return;
      const payload = JSON.parse(raw || '{}');
      if(payload.type !== 'contact') return;
      const ok = await persistStage(payload.id, st);
      if(ok){
        const card = root.querySelector(`[data-id="${payload.id}"]`);
        if(card && lane){
          const list = lane.querySelector('[data-list], .lane-list, .kanban-list, .cards');
          if(list) list.appendChild(card);
          try{ card.dataset.stage = laneKey; }catch (_) { }
        }
      }
    }catch (_err) {}
  };

  recordListener(root, 'dragstart', onDragStart);
  recordListener(root, 'dragover', onDragOver);
  recordListener(root, 'drop', onDrop);
  monitorRoot(root);
}

// Public API (for tests)
export function wireKanbanDnD(){
  // stamp stage attributes if missing, then install handlers
  lanes(); cards();
  installDnD();
}

// Auto-wire after render
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => wireKanbanDnD(), { once:true });
} else {
  wireKanbanDnD();
}

try {
  // Re-wire on our render guard
  if (window.RenderGuard && typeof window.RenderGuard.registerHook === 'function') {
    window.RenderGuard.registerHook(() => wireKanbanDnD());
  }
} catch (_) {}

