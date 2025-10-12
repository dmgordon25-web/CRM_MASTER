import { PIPELINE_STAGES, NORMALIZE_STAGE, stageKeyFromLabel } from './stages.js';
import { renderStageChip, canonicalStage } from './constants.js';

const fromHere = (p) => new URL(p, import.meta.url).href;

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

const WIRED_BOARDS = new Set();
const BOARD_HANDLERS = new Map();
let HANDLER_COUNT = 0;
let COLUMN_COUNT = 0;

function exposeCounters(){
  if (typeof window === 'undefined') return;
  try {
    window.__KANBAN_HANDLERS__ = Object.freeze({
      added: Number(HANDLER_COUNT || 0),
      columns: Number(COLUMN_COUNT || 0)
    });
  } catch (_) {}
}

function boardConnected(board){
  if (!board) return false;
  if (typeof board.isConnected === 'boolean') return board.isConnected;
  if (typeof document !== 'undefined' && document.documentElement) {
    try { return document.documentElement.contains(board); }
    catch (_) { return false; }
  }
  return false;
}

function detachBoard(board){
  if (!board) return;
  const handlers = BOARD_HANDLERS.get(board);
  if (handlers) {
    try { board.removeEventListener('dragstart', handlers.dragstart); } catch (_) {}
    try { board.removeEventListener('dragover', handlers.dragover); } catch (_) {}
    try { board.removeEventListener('drop', handlers.drop); } catch (_) {}
  }
  BOARD_HANDLERS.delete(board);
  if (WIRED_BOARDS.delete(board)) {
    HANDLER_COUNT = Math.max(0, HANDLER_COUNT - 1);
  }
  if (WIRED_BOARDS.size === 0) {
    COLUMN_COUNT = 0;
  }
  exposeCounters();
}

function detachAll(){
  Array.from(WIRED_BOARDS).forEach((board) => detachBoard(board));
}

function cleanupDetachedBoards(){
  Array.from(WIRED_BOARDS).forEach((board) => {
    if (!boardConnected(board)) {
      detachBoard(board);
    }
  });
}

exposeCounters();

function viewFromDetail(detail){
  if (!detail) return '';
  if (typeof detail === 'string') return detail.toLowerCase();
  if (typeof detail.view === 'string') return detail.view.toLowerCase();
  if (typeof detail.target === 'string') return detail.target.toLowerCase();
  return '';
}

const STAGE_LABEL_SET = new Set(PIPELINE_STAGES);
const KEY_TO_LABEL = new Map();
PIPELINE_STAGES.forEach((label) => {
  const stageKey = stageKeyFromLabel(label);
  KEY_TO_LABEL.set(stageKey, label);
  KEY_TO_LABEL.set(normalizeKey(label), label);
  KEY_TO_LABEL.set(label.toLowerCase(), label);
});

function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stageLabelFor(value){
  const direct = normStage(value);
  if (direct) return direct;
  if (!value) return '';
  const key = stageKeyFromLabel(value);
  if (key && KEY_TO_LABEL.has(key)) return KEY_TO_LABEL.get(key);
  return String(value).trim();
}

function ensureStageChip(card){
  if(!(card instanceof Element)) return;
  const stageValue = card.dataset?.stage || card.getAttribute('data-stage') || card.dataset?.stageLabel || card.getAttribute('data-stage-label');
  const chipHtml = renderStageChip(stageValue);
  let wrapper = card.querySelector('[data-role="stage-chip-wrapper"]');
  if(!wrapper){
    wrapper = document.createElement('div');
    wrapper.className = 'kanban-card-stage';
    wrapper.setAttribute('data-role', 'stage-chip-wrapper');
    const header = card.querySelector('.kanban-card-header');
    if(header && header.parentNode){
      header.parentNode.insertBefore(wrapper, header.nextSibling);
    } else {
      card.insertBefore(wrapper, card.firstChild || null);
    }
  }
  const canonical = canonicalStage(stageValue);
  if(canonical){
    wrapper.dataset.stageCanonical = canonical;
  } else {
    delete wrapper.dataset.stageCanonical;
  }
  if(stageValue){
    wrapper.dataset.stage = String(stageValue);
  } else {
    delete wrapper.dataset.stage;
  }
  if(chipHtml){
    wrapper.innerHTML = chipHtml;
  } else {
    const fallbackLabel = stageLabelFor(stageValue);
    wrapper.innerHTML = fallbackLabel
      ? `<span class="stage-chip stage-generic" data-role="stage-chip" data-qa="stage-chip-generic">${escapeHtml(fallbackLabel)}</span>`
      : '';
  }
}

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
  const filtered = list.filter(Boolean);
  filtered.forEach(ensureStageChip);
  return filtered;
}

function cardId(el){
  if(!el) return null;
  const id = el.getAttribute('data-id') || el.dataset.id || el.getAttribute('data-contact-id') || el.dataset.contactId;
  return id ? String(id) : null;
}

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
    dbm = await import(fromHere('../db.js'));
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

function createBoardHandlers(root){
  return {
    dragstart(e){
      const card = e.target && typeof e.target.closest === 'function'
        ? e.target.closest('[data-id]')
        : null;
      if(!card) return;
      const id = cardId(card);
      if(!id) return;
      try {
        e.dataTransfer?.setData('text/plain', JSON.stringify({ type:'contact', id }));
      } catch (_) {}
      try { e.dataTransfer?.setDragImage?.(card, 10, 10); } catch (_) {}
    },
    dragover(e){
      const lane = e.target && typeof e.target.closest === 'function'
        ? e.target.closest('[data-stage],[data-lane],[data-column]')
        : null;
      if(!lane) return;
      const st = normStage(lane.dataset.stage);
      if(!st) return;
      try { e.preventDefault(); }
      catch (_) {}
    },
    async drop(e){
      const lane = e.target && typeof e.target.closest === 'function'
        ? e.target.closest('[data-stage],[data-lane],[data-column]')
        : null;
      if(!lane) return;
      const st = normStage(lane.dataset.stage);
      if(!st) return;
      const laneKey = stageKeyFromLabel(st);
      try {
        const raw = e.dataTransfer?.getData('text/plain');
        if(!raw) return;
        const payload = JSON.parse(raw || '{}');
        if(payload.type !== 'contact') return;
        const ok = await persistStage(payload.id, st);
        if(!ok) return;
        const card = root.querySelector(`[data-id="${payload.id}"]`);
        if(!card) return;
        const list = lane.querySelector('[data-list], .lane-list, .kanban-list, .cards');
        if(list) {
          try { list.appendChild(card); }
          catch (_) {}
        }
        try { card.dataset.stage = laneKey; }
        catch (_) {}
        ensureStageChip(card);
      } catch (_) {}
    }
  };
}

function installDnD(root, laneList){
  if(!root) return;
  const columns = Array.isArray(laneList) ? laneList.filter(Boolean) : [];
  COLUMN_COUNT = columns.length;
  if (WIRED_BOARDS.has(root)) {
    exposeCounters();
    return;
  }
  const handlers = createBoardHandlers(root);
  root.addEventListener('dragstart', handlers.dragstart);
  root.addEventListener('dragover', handlers.dragover);
  root.addEventListener('drop', handlers.drop);
  WIRED_BOARDS.add(root);
  BOARD_HANDLERS.set(root, handlers);
  HANDLER_COUNT += 1;
  exposeCounters();
}

// Public API (for tests)
export function wireKanbanDnD(){
  cleanupDetachedBoards();
  const root = boardEl();
  if(!root){
    if (WIRED_BOARDS.size === 0) {
      COLUMN_COUNT = 0;
    }
    exposeCounters();
    return;
  }
  const laneList = lanes();
  cards();
  installDnD(root, laneList);
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

try {
  document.addEventListener('app:navigate', (evt) => {
    const view = viewFromDetail(evt?.detail);
    if (!view) return;
    if (view !== 'pipeline') {
      detachAll();
    }
  });
} catch (_) {}

