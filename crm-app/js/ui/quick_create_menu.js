import { toastInfo, toastWarn } from './toast_helpers.js';
import { openContactEditor as openContactEntry, openNewContactEditor } from '../editors/contact_entry.js';
import { openPartnerEditor as openPartnerEntry, openNewPartnerEditor } from '../editors/partner_entry.js';
import { validateTask } from '../tasks.js';
import { bindQuickAddValidation } from './quick_add_validation.js';

const MENU_DEFAULT_QA = 'fab-menu';
const QC_DEBUG_KEY = '__QC_DEBUG__';

const WRAPPER_ID = 'global-new-menu';
const MENU_ID = 'header-new-menu';
const BUTTON_PREFIX = 'header-new-';
const ACTION_BAR_ID = 'global-new';
const ACTION_BAR_SOURCE = 'actionbar';
const HEADER_SOURCE = 'header';
const HEADER_TOGGLE_SELECTOR = '#btn-header-new';

const BIND_GUARD_KEY = typeof Symbol === 'function'
  ? Symbol('quick-create-menu:binding')
  : '__quickCreateMenuBinding__';

const defaultOpeners = {
  contact: () => openContactEditor(),
  partner: () => openPartnerEditor(),
  task: () => openTaskEditor()
};

const state = {
  open: false,
  source: null,
  origin: null,
  anchor: null,
  restoreFocus: null,
  wrapper: null,
  menu: null,
  outsideHandler: null,
  keyHandler: null,
  openers: defaultOpeners,
  owner: null,
  reposition: {
    active: false,
    inFlight: false,
    frame: null,
    resizeListener: null,
    scrollListener: null
  }
};

let bootBeaconEmitted = false;
const headerQuickCreateState = { button: null, bound: false, cleanup: null, controller: null };
const taskModalState = { overlay: null, form: null, typeSelect: null, entitySelect: null, taskTypeSelect: null, noteInput: null, dueInput: null, status: null, saveBtn: null, loadingToken: 0, busy: false, validation: null };
const TASK_MODAL_HTML = '<div data-role="panel" style="background:#fff;width:100%;max-width:420px;border-radius:12px;box-shadow:0 20px 50px rgba(15,23,42,0.25);overflow:hidden;font-family:inherit;"><div data-role="header" style="display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #ececec;"><span style="font-size:18px;font-weight:600;">New Task</span><button type="button" data-role="close" aria-label="Close" style="border:none;background:transparent;font-size:20px;line-height:1;cursor:pointer;color:#475467;">×</button></div><form data-role="form" style="display:flex;flex-direction:column;gap:12px;padding:16px;"><label style="display:flex;flex-direction:column;gap:4px;font-size:14px;color:#344054;">Task Type<select name="taskType" style="padding:8px;border:1px solid #d0d5dd;border-radius:8px;"><option value="Call">Call</option><option value="Email">Email</option><option value="SMS">SMS</option><option value="Meeting">Meeting</option><option value="Postal">Postal</option><option value="Follow-up">Follow-up</option></select></label><label style="display:flex;flex-direction:column;gap:4px;font-size:14px;color:#344054;">Link to<select name="linkedType" style="padding:8px;border:1px solid #d0d5dd;border-radius:8px;"><option value="contact">Contact</option><option value="partner">Partner</option></select></label><label style="display:flex;flex-direction:column;gap:4px;font-size:14px;color:#344054;">Who<select name="linkedId" style="padding:8px;border:1px solid #d0d5dd;border-radius:8px;"><option value="">Loading…</option></select></label><label style="display:flex;flex-direction:column;gap:4px;font-size:14px;color:#344054;">Due date<input name="due" type="date" style="padding:8px;border:1px solid #d0d5dd;border-radius:8px;" /></label><label style="display:flex;flex-direction:column;gap:4px;font-size:14px;color:#344054;">Notes<textarea name="note" rows="3" style="padding:8px;border:1px solid #d0d5dd;border-radius:8px;resize:vertical;"></textarea></label><div data-role="status" aria-live="polite" style="min-height:18px;font-size:13px;color:#475467;"></div><div style="display:flex;gap:8px;justify-content:flex-end;"><button type="button" data-role="cancel" style="padding:8px 12px;border-radius:8px;border:1px solid #d0d5dd;background:#fff;color:#344054;cursor:pointer;">Cancel</button><button type="submit" data-role="save" style="padding:8px 14px;border-radius:8px;border:1px solid #1570ef;background:#1570ef;color:#fff;cursor:pointer;">Save Task</button></div></form></div>';

const PASSIVE_LISTENER_OPTIONS = { passive: true };

const TASK_VALIDATION_CONFIG = {
  title: {
    fields: ['note'],
    message: () => 'Add a note for this task'
  },
  date: {
    fields: ['due'],
    message: () => 'Due date is required'
  },
  linked: {
    fields: ['linkedId'],
    message: () => 'Select a contact or partner'
  }
};

const QUICK_ADD_INVALID_TOAST = 'Please fix highlighted fields';

function focusElement(node) {
  if(!node || typeof node.focus !== 'function') return;
  try {
    node.focus({ preventScroll: true });
  } catch (_err) {
    try { node.focus(); }
    catch (_focusErr) {}
  }
}

function readTaskModalModel(){
  const noteInput = taskModalState.noteInput;
  const dueInput = taskModalState.dueInput;
  const entitySelect = taskModalState.entitySelect;
  const typeSelect = taskModalState.typeSelect;
  const taskTypeSelect = taskModalState.taskTypeSelect;
  const note = noteInput ? String(noteInput.value || '').trim() : '';
  const due = dueInput ? String(dueInput.value || '').trim() : '';
  const linkedId = entitySelect ? String(entitySelect.value || '').trim() : '';
  const linkedType = typeSelect && typeSelect.value === 'partner' ? 'partner' : 'contact';
  const taskType = taskTypeSelect ? String(taskTypeSelect.value || '').trim() : 'Follow-up';
  return {
    note,
    due,
    linkedId,
    linkedType,
    type: taskType,
    title: note
  };
}

function validateTaskModalModel(model){
  const base = validateTask(model);
  const errors = base && base.errors && typeof base.errors === 'object' ? { ...base.errors } : {};
  let ok = base && base.ok === false ? false : true;
  if(!model.linkedId){
    errors.linked = 'required';
    ok = false;
  }
  if(ok && Object.keys(errors).some((key) => errors[key])){
    ok = false;
  }
  return { ok, errors };
}

function getHostWindow() {
  return typeof window !== 'undefined' ? window : null;
}

function getDebugState() {
  if (typeof window === 'undefined') return null;
  const host = window;
  const existing = host[QC_DEBUG_KEY];
  if (!existing || typeof existing !== 'object') {
    const next = { bindCount: 0, openCount: 0, createdCount: 0, beaconCount: 0, rafFramesWhileOpen: 0 };
    host[QC_DEBUG_KEY] = next;
    return next;
  }
  if (typeof existing.bindCount !== 'number' || Number.isNaN(existing.bindCount)) existing.bindCount = 0;
  if (typeof existing.openCount !== 'number' || Number.isNaN(existing.openCount)) existing.openCount = 0;
  if (typeof existing.createdCount !== 'number' || Number.isNaN(existing.createdCount)) existing.createdCount = 0;
  if (typeof existing.beaconCount !== 'number' || Number.isNaN(existing.beaconCount)) existing.beaconCount = 0;
  if (typeof existing.rafFramesWhileOpen !== 'number' || Number.isNaN(existing.rafFramesWhileOpen)) {
    existing.rafFramesWhileOpen = 0;
  }
  return existing;
}

function incrementDebugCounter(key) {
  const debug = getDebugState();
  if (!debug || !(key in debug)) return;
  const value = Number.isFinite(debug[key]) ? debug[key] : 0;
  debug[key] = value + 1;
}

function resetRafDebugCounter() {
  const debug = getDebugState();
  if (!debug) return;
  debug.rafFramesWhileOpen = 0;
}

function incrementRafDebugCounter() {
  const debug = getDebugState();
  if (!debug) return;
  const value = Number.isFinite(debug.rafFramesWhileOpen) ? debug.rafFramesWhileOpen : 0;
  debug.rafFramesWhileOpen = value + 1;
}

function emitState() {
  if (typeof document === 'undefined') return;
  const detail = { open: state.open, source: state.source, origin: state.origin };
  try {
    const event = new CustomEvent('quick-create-menu:state', { detail });
    document.dispatchEvent(event);
  } catch (_) {}
}

function postLog(eventName) {
  if (!eventName) return;
  const payload = JSON.stringify({ event: eventName });
  let sent = false;
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      sent = !!navigator.sendBeacon('/__log', payload) || sent;
    } catch (_) {}
  }
  if (sent) {
    return;
  }
  if (typeof fetch !== 'function') {
    return;
  }
  try {
    fetch('/__log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(() => {});
  } catch (_) {}
}

function ensureBootBeacon() {
  if (bootBeaconEmitted) {
    return;
  }
  bootBeaconEmitted = true;
  try {
    console && typeof console.info === 'function' && console.info('[VIS] quick-create unified');
  } catch (_) {}
  postLog('quick-create-unified');
}

function callSafely(fn, ...args) {
  if (typeof fn !== 'function') return null;
  try {
    return fn(...args);
  } catch (err) {
    if (console && typeof console.warn === 'function') {
      console.warn('[quick-create] action failed', err);
    }
    toastWarn('Something went wrong');
    return null;
  }
}

function ensureButton(label, kind) {
  const { menu } = state;
  if (!menu) return null;
  const role = `${BUTTON_PREFIX}${kind}`;
  let btn = menu.querySelector(`button[data-role="${role}"]`);
  if (btn) return btn;
  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn ghost';
  btn.textContent = label;
  btn.dataset.role = role;
  btn.setAttribute('role', 'menuitem');
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    handleSelection(kind);
  });
  menu.appendChild(btn);
  return btn;
}

function ensureMenuElements() {
  if (typeof document === 'undefined') return null;

  let wrapper = document.getElementById(WRAPPER_ID);
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = WRAPPER_ID;
    wrapper.hidden = true;
    wrapper.style.position = 'fixed';
    wrapper.style.zIndex = '10050';
    wrapper.style.display = 'block';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    document.body.appendChild(wrapper);
  }

  let menu = document.getElementById(MENU_ID);
  if (!menu) {
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'card hidden';
    menu.hidden = true;
    menu.style.minWidth = '180px';
    menu.style.padding = '8px';
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    menu.style.gap = '4px';
    menu.style.pointerEvents = 'auto';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('data-qa', MENU_DEFAULT_QA);
    menu.setAttribute('aria-hidden', 'true');
  } else {
    if (!menu.hasAttribute('data-qa')) {
      menu.setAttribute('data-qa', MENU_DEFAULT_QA);
    }
    if (!menu.hasAttribute('aria-hidden')) {
      menu.setAttribute('aria-hidden', 'true');
    }
  }

  if (menu.parentElement !== wrapper) {
    wrapper.appendChild(menu);
  }
  if (!wrapper.parentElement) {
    document.body.appendChild(wrapper);
  }

  state.wrapper = wrapper;
  state.menu = menu;

  const contactBtn = ensureButton('Contact', 'contact');
  const partnerBtn = ensureButton('Partner', 'partner');
  const taskBtn = ensureButton('Task', 'task');
  const ordered = [contactBtn, partnerBtn, taskBtn];
  ordered.forEach((btn) => {
    if (btn && btn.parentElement === menu) {
      menu.appendChild(btn);
    }
  });

  return { wrapper, menu };
}

function normalizeSource(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === ACTION_BAR_SOURCE) {
    return ACTION_BAR_SOURCE;
  }
  return HEADER_SOURCE;
}

function focusFirstMenuItem() {
  const { menu } = state;
  if (!menu) return;
  const first = menu.querySelector('button[role="menuitem"]');
  if (!first) return;
  if (typeof first.focus === 'function') {
    try {
      first.focus({ preventScroll: true });
      return;
    } catch (_) {}
    try { first.focus(); }
    catch (_) {}
  }
}

function getOpener(kind) {
  const openers = state.openers && typeof state.openers === 'object' ? state.openers : defaultOpeners;
  const fn = openers && typeof openers[kind] === 'function' ? openers[kind] : defaultOpeners[kind];
  return typeof fn === 'function' ? fn : () => null;
}

function handleSelection(kind) {
  const item = kind === 'partner' ? 'partner' : kind === 'task' ? 'task' : 'contact';
  closeQuickCreateMenu();
  incrementDebugCounter('createdCount');
  incrementDebugCounter('beaconCount');
  try {
    console && typeof console.info === 'function' && console.info('[quick-create] select', { item });
  } catch (_) {}
  const opener = getOpener(item);
  callSafely(opener);
}

const setTaskModalStatus = (message, tone) => { const s = taskModalState.status; if (!s) return; s.textContent = message || ''; s.dataset.state = tone || ''; s.style.color = tone === 'error' ? 'var(--danger-text,#b42318)' : tone === 'success' ? 'var(--success-text,#067647)' : tone === 'info' ? 'var(--muted-text,#475467)' : 'inherit'; };
const closeTaskModal = () => { const o = taskModalState.overlay; if (!o) return; o.hidden = true; o.style.visibility = 'hidden'; o.style.pointerEvents = 'none'; o.setAttribute('aria-hidden', 'true'); setTaskModalStatus(''); if (taskModalState.form) taskModalState.form.reset(); };
const todayISODate = () => { try { const now = new Date(); if (Number.isNaN(now.getTime())) return ''; return now.toISOString().slice(0, 10); } catch (_) { return ''; } };
const ensureTaskModalElements = () => { if (typeof document === 'undefined') return null; if (taskModalState.overlay && taskModalState.overlay.isConnected !== false) return taskModalState.overlay; const overlay = document.createElement('div'); overlay.id = 'qc-task-modal'; overlay.dataset.role = 'qc-task-modal'; overlay.style.cssText = 'position:fixed;inset:0;z-index:10060;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,0.45);'; overlay.hidden = true; overlay.style.visibility = 'hidden'; overlay.style.pointerEvents = 'none'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.innerHTML = TASK_MODAL_HTML; const form = overlay.querySelector('form[data-role="form"]'); const typeSelect = overlay.querySelector('select[name="linkedType"]'); const entitySelect = overlay.querySelector('select[name="linkedId"]'); const taskTypeSelect = overlay.querySelector('select[name="taskType"]'); const dueInput = overlay.querySelector('input[name="due"]'); const noteInput = overlay.querySelector('textarea[name="note"]'); const status = overlay.querySelector('[data-role="status"]'); const closeBtn = overlay.querySelector('button[data-role="close"]'); const cancelBtn = overlay.querySelector('button[data-role="cancel"]'); const saveBtn = overlay.querySelector('button[data-role="save"]'); if (!form || !typeSelect || !entitySelect || !dueInput || !noteInput || !status || !closeBtn || !cancelBtn || !saveBtn) return null; closeBtn.addEventListener('click', (event) => { event.preventDefault(); closeTaskModal(); }); cancelBtn.addEventListener('click', (event) => { event.preventDefault(); closeTaskModal(); }); overlay.addEventListener('click', (event) => { if (event.target === overlay) closeTaskModal(); }); typeSelect.addEventListener('change', () => { if (taskModalState.validation) taskModalState.validation.markTouched('linkedId'); refreshTaskEntityOptions(typeSelect.value); }); form.addEventListener('submit', (event) => handleTaskModalSubmit(event)); Object.assign(taskModalState, { overlay, form, typeSelect, entitySelect, taskTypeSelect, dueInput, noteInput, status, saveBtn }); document.body.appendChild(overlay); if (!form.__quickAddValidation) { const validation = bindQuickAddValidation(form, TASK_VALIDATION_CONFIG, { buildModel: readTaskModalModel, validate: validateTaskModalModel, onResult: (result) => { const save = taskModalState.saveBtn; const select = taskModalState.entitySelect; if (save) { const disable = taskModalState.busy || !result.ok || (select && select.disabled); save.disabled = disable; } } }); form.__quickAddValidation = validation; taskModalState.validation = validation; } else { taskModalState.validation = form.__quickAddValidation; taskModalState.validation.run(false); } return overlay; };
const formatTaskOptionLabel = (record, kind) => { if (!record || typeof record !== 'object') return kind === 'partner' ? 'Partner' : 'Contact'; const first = record.firstName || record.first || ''; const last = record.lastName || record.last || ''; const combo = `${first} ${last}`.trim(); if (combo) return combo; if (kind === 'partner') { const company = record.company || record.name || ''; if (company) return String(company); } const email = record.email || record.primaryEmail || ''; if (email) return String(email); const phone = record.phone || record.primaryPhone || ''; if (phone) return String(phone); const id = record.id || record._id || record.key || record.contactId || record.partnerId; return id ? String(id) : kind === 'partner' ? 'Partner' : 'Contact'; };
const fetchTaskEntityOptions = async (kind) => { const host = getHostWindow(); const type = kind === 'partner' ? 'partners' : 'contacts'; const seen = new Set(); const results = []; const append = (rec) => { if (!rec || typeof rec !== 'object') return; const raw = rec.id || rec._id || rec.key || rec.contactId || rec.partnerId; const id = raw ? String(raw).trim() : ''; if (!id || seen.has(id)) return; seen.add(id); results.push({ value: id, label: formatTaskOptionLabel(rec, kind) }); }; const run = async (source) => { if (!source) return; try { const list = await source(type); if (Array.isArray(list)) list.forEach(append); } catch (err) { if (console && typeof console.warn === 'function') console.warn('[quick-create] task options load failed', err); } }; if (host) { const dbGetAll = typeof host.dbGetAll === 'function' ? host.dbGetAll.bind(host) : null; await run(dbGetAll); const appList = host.App && host.App[type] && typeof host.App[type].list === 'function' ? host.App[type].list.bind(host.App[type]) : null; if (!results.length) await run(appList); } if (!results.length && typeof window !== 'undefined' && window.__SEED_DATA__ && Array.isArray(window.__SEED_DATA__[type])) window.__SEED_DATA__[type].forEach(append); return results; };
const refreshTaskEntityOptions = async (kind) => { const select = taskModalState.entitySelect; if (!select) return; const saveBtn = taskModalState.saveBtn; taskModalState.loadingToken += 1; const token = taskModalState.loadingToken; select.innerHTML = '<option value="">Loading…</option>'; select.disabled = true; if (saveBtn) saveBtn.disabled = true; const options = await fetchTaskEntityOptions(kind); if (token !== taskModalState.loadingToken) return; select.innerHTML = ''; if (!options.length) { const option = document.createElement('option'); option.value = ''; option.textContent = kind === 'partner' ? 'No partners available' : 'No contacts available'; select.appendChild(option); setTaskModalStatus('Add a record before creating a task.', 'error'); select.disabled = true; if (taskModalState.validation) taskModalState.validation.run(false); return; } options.forEach((opt) => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.label; select.appendChild(option); }); select.disabled = false; if (saveBtn) saveBtn.disabled = false; select.value = options[0].value; setTaskModalStatus(''); if (taskModalState.validation) taskModalState.validation.run(false); };
const handleTaskModalSubmit = async (event) => { if (event && typeof event.preventDefault === 'function') event.preventDefault(); const { typeSelect, entitySelect, dueInput, saveBtn, validation } = taskModalState; if (!typeSelect || !entitySelect || !dueInput) return; if (taskModalState.busy) return; const validationResult = validation ? validation.run(true) : { ok: true, model: readTaskModalModel() }; const model = validationResult.model || readTaskModalModel(); if (!validationResult.ok) { setTaskModalStatus(QUICK_ADD_INVALID_TOAST, 'error'); if (validationResult.firstInvalid) focusElement(validationResult.firstInvalid); toastWarn(QUICK_ADD_INVALID_TOAST); return; } const kind = model.linkedType === 'partner' ? 'partner' : 'contact'; const linkedId = model.linkedId || ''; const dueValue = model.due || todayISODate() || ''; const note = model.note || ''; taskModalState.busy = true; if (saveBtn) saveBtn.disabled = true; setTaskModalStatus('Saving task…', 'info'); try { const mod = await import('../tasks/api.js'); const fn = mod && typeof mod.createMinimalTask === 'function' ? mod.createMinimalTask : mod && typeof mod.createTask === 'function' ? mod.createTask : mod && typeof mod.default === 'function' ? mod.default : null; if (typeof fn !== 'function') throw new Error('Task API unavailable'); const payload = { linkedType: kind, linkedId, due: dueValue }; if (note) payload.note = note; const result = await fn(payload); if (result && result.status === 'ok' && result.task && result.task.id && typeof window !== 'undefined') window.__QC_TASK_ID__ = result.task.id; toastInfo('Task created'); setTaskModalStatus('Task saved.', 'success'); closeTaskModal(); } catch (err) { if (console && typeof console.warn === 'function') console.warn('[quick-create] task save failed', err); setTaskModalStatus('Unable to save task. Try again.', 'error'); toastWarn('Task could not be saved'); } finally { taskModalState.busy = false; if (saveBtn) saveBtn.disabled = false; if (taskModalState.validation) taskModalState.validation.run(false); } };
const openTaskQuickCreateModal = () => { const overlay = ensureTaskModalElements(); if (!overlay) { toastWarn('Task form unavailable'); return null; } const { typeSelect, dueInput, noteInput, validation } = taskModalState; overlay.hidden = false; overlay.style.visibility = 'visible'; overlay.style.pointerEvents = 'auto'; overlay.setAttribute('aria-hidden', 'false'); taskModalState.busy = false; if (dueInput) { const today = todayISODate(); if (today) dueInput.value = today; } if (noteInput) noteInput.value = ''; setTaskModalStatus(''); if (validation && typeof validation.reset === 'function') { validation.reset(); } refreshTaskEntityOptions(typeSelect ? typeSelect.value : 'contact'); if (noteInput) focusElement(noteInput); return overlay; };

function handleOutsideClick(event) {
  const { wrapper, anchor } = state;
  if (!wrapper || wrapper.hidden) return;
  const target = event.target;
  if (wrapper.contains(target)) return;
  if (anchor && typeof anchor.contains === 'function' && anchor.contains(target)) return;
  closeQuickCreateMenu();
}

function handleKeyDown(event) {
  if (event.key === 'Escape') {
    closeQuickCreateMenu();
  }
}

function positionMenu(anchor) {
  const { wrapper, menu } = state;
  if (!wrapper || !menu) return;
  const anchorNode = anchor && anchor.isConnected !== false ? anchor : null;
  const anchorRect = anchorNode && typeof anchorNode.getBoundingClientRect === 'function'
    ? anchorNode.getBoundingClientRect()
    : null;

  wrapper.hidden = false;
  menu.hidden = false;
  menu.classList.remove('hidden');
  menu.setAttribute('aria-hidden', 'false');
  menu.setAttribute('data-qa', 'qc-open');
  const previousVisibility = wrapper.style.visibility;
  wrapper.style.visibility = 'hidden';
  wrapper.style.pointerEvents = 'none';

  const menuRect = menu.getBoundingClientRect();
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth || document.documentElement.clientWidth || 0 : 0;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight || document.documentElement.clientHeight || 0 : 0;

  const margin = 8;
  const anchorBottom = anchorRect ? anchorRect.bottom : 48;
  let top = anchorBottom + margin;
  if (!Number.isFinite(top)) {
    top = 64;
  }
  if (viewportHeight && top + menuRect.height + margin > viewportHeight) {
    const candidate = anchorRect ? anchorRect.top - menuRect.height - margin : viewportHeight - menuRect.height - margin;
    if (Number.isFinite(candidate) && candidate >= margin) {
      top = candidate;
    } else {
      top = Math.max(margin, viewportHeight - menuRect.height - margin);
    }
  }

  let left;
  if (anchorRect) {
    left = anchorRect.left + anchorRect.width - menuRect.width;
  } else {
    left = (viewportWidth - menuRect.width) / 2;
  }
  if (!Number.isFinite(left)) {
    left = (viewportWidth - menuRect.width) / 2;
  }
  const minLeft = 8;
  const maxLeft = Math.max(minLeft, viewportWidth - menuRect.width - 8);
  if (left < minLeft) left = minLeft;
  if (left > maxLeft) left = maxLeft;

  wrapper.style.left = `${Math.round(left)}px`;
  wrapper.style.top = `${Math.round(top)}px`;
  wrapper.style.right = 'auto';
  wrapper.style.bottom = 'auto';
  wrapper.style.visibility = previousVisibility || '';
  wrapper.style.pointerEvents = 'auto';
}

function cancelRepositionFrame() {
  const { reposition } = state;
  if (!reposition) return;
  const win = getHostWindow();
  if (reposition.frame != null && win && typeof win.cancelAnimationFrame === 'function') {
    try { win.cancelAnimationFrame(reposition.frame); }
    catch (_) {}
  }
  reposition.frame = null;
  reposition.inFlight = false;
}

function scheduleMenuReposition() {
  const { reposition } = state;
  if (!reposition || !reposition.active) return;
  if (reposition.inFlight) return;
  reposition.inFlight = true;
  const win = getHostWindow();
  const run = () => {
    reposition.frame = null;
    reposition.inFlight = false;
    if (!state.open) return;
    positionMenu(state.anchor);
    incrementRafDebugCounter();
  };
  if (win && typeof win.requestAnimationFrame === 'function') {
    reposition.frame = win.requestAnimationFrame(() => {
      try { run(); }
      catch (_) {}
    });
    return;
  }
  try { run(); }
  catch (_) {}
}

function ensureRepositionListeners() {
  const { reposition } = state;
  if (!reposition || reposition.active) return;
  const win = getHostWindow();
  if (!win) return;
  const resizeListener = () => {
    scheduleMenuReposition();
  };
  const scrollListener = () => {
    scheduleMenuReposition();
  };
  try {
    win.addEventListener('resize', resizeListener, PASSIVE_LISTENER_OPTIONS);
  } catch (_) {
    win.addEventListener('resize', resizeListener, false);
  }
  try {
    win.addEventListener('scroll', scrollListener, PASSIVE_LISTENER_OPTIONS);
  } catch (_) {
    win.addEventListener('scroll', scrollListener, false);
  }
  reposition.resizeListener = resizeListener;
  reposition.scrollListener = scrollListener;
  reposition.active = true;
}

function teardownRepositionListeners() {
  const { reposition } = state;
  if (!reposition) return;
  const win = getHostWindow();
  if (win && reposition.resizeListener) {
    try { win.removeEventListener('resize', reposition.resizeListener, PASSIVE_LISTENER_OPTIONS); }
    catch (_) { win.removeEventListener('resize', reposition.resizeListener, false); }
  }
  if (win && reposition.scrollListener) {
    try { win.removeEventListener('scroll', reposition.scrollListener, PASSIVE_LISTENER_OPTIONS); }
    catch (_) { win.removeEventListener('scroll', reposition.scrollListener, false); }
  }
  reposition.resizeListener = null;
  reposition.scrollListener = null;
  reposition.active = false;
  cancelRepositionFrame();
}

export function closeQuickCreateMenu() {
  teardownRepositionListeners();
  const { wrapper, menu, restoreFocus } = state;
  if (!wrapper || !menu || wrapper.hidden) return;
  wrapper.hidden = true;
  menu.hidden = true;
  if (menu.classList && typeof menu.classList.add === 'function') {
    menu.classList.add('hidden');
  }
  menu.setAttribute('aria-hidden', 'true');
  menu.setAttribute('data-qa', MENU_DEFAULT_QA);
  wrapper.style.left = '';
  wrapper.style.top = '';
  wrapper.style.right = '';
  wrapper.style.bottom = '';
  wrapper.style.pointerEvents = 'none';
  state.open = false;
  state.source = null;
  state.origin = null;
  const anchor = state.anchor;
  if (state.outsideHandler) {
    document.removeEventListener('click', state.outsideHandler, true);
    state.outsideHandler = null;
  }
  if (state.keyHandler) {
    document.removeEventListener('keydown', state.keyHandler, true);
    state.keyHandler = null;
  }
  state.anchor = null;
  state.restoreFocus = null;
  if (restoreFocus && typeof restoreFocus.focus === 'function') {
    try {
      restoreFocus.focus({ preventScroll: true });
    } catch (_) {
      try { restoreFocus.focus(); }
      catch (_) {}
    }
  } else if (anchor && typeof anchor.focus === 'function') {
    try {
      anchor.focus({ preventScroll: true });
    } catch (_) {
      try { anchor.focus(); }
      catch (_) {}
    }
  }
  emitState();
}

export function openQuickCreateMenu(options = {}) {
  const { anchor = null, source = HEADER_SOURCE, origin = source } = options;
  const normalizedSource = normalizeSource(source);
  const elements = ensureMenuElements();
  if (!elements) return;
  const wasOpen = state.open;
  const anchorNode = anchor && anchor.isConnected !== false ? anchor : null;
  state.anchor = anchorNode;
  state.source = normalizedSource;
  state.origin = typeof origin === 'string' && origin ? origin : normalizedSource;
  state.open = true;
  resetRafDebugCounter();
  cancelRepositionFrame();
  state.restoreFocus = anchorNode && typeof anchorNode.focus === 'function' ? anchorNode : null;
  positionMenu(anchorNode);
  ensureRepositionListeners();
  const { menu } = elements;
  if (menu) {
    menu.setAttribute('aria-hidden', 'false');
    menu.setAttribute('data-qa', 'qc-open');
  }
  if (!state.outsideHandler) {
    state.outsideHandler = (event) => handleOutsideClick(event);
    document.addEventListener('click', state.outsideHandler, true);
  }
  if (!state.keyHandler) {
    state.keyHandler = (event) => handleKeyDown(event);
    document.addEventListener('keydown', state.keyHandler, true);
  }
  if (!wasOpen) {
    incrementDebugCounter('openCount');
  }
  focusFirstMenuItem();
  emitState();
}

export function toggleQuickCreateMenu(options = {}) {
  const { anchor = null, source = HEADER_SOURCE } = options;
  const normalizedSource = normalizeSource(source);
  if (state.open) {
    const sameAnchor = anchor && state.anchor === anchor;
    const sameSource = state.source === normalizedSource;
    if ((sameAnchor && sameSource) || (!anchor && sameSource)) {
      closeQuickCreateMenu();
      return state.open;
    }
  }
  openQuickCreateMenu({ anchor, source: normalizedSource, origin: source });
  return state.open;
}

export function isQuickCreateMenuOpen(source) {
  if (!state.open) return false;
  if (!source) return true;
  return state.source === source;
}

function defaultOpenContactEditor(prefill) {
  const meta = { source: 'quick-create:menu', context: 'open', prefill };
  try {
    if(prefill && prefill.id){
      return openContactEntry(prefill.id, meta);
    }
    return openNewContactEditor(meta);
  } catch (err) {
    try {
      if (console && typeof console.warn === 'function') {
        console.warn('[quick-create] contact editor open failed', err);
      }
    } catch (_) {}
    toastWarn('Contact modal unavailable');
    return null;
  }
}

function defaultOpenPartnerEditor() {
  try {
    return openNewPartnerEditor({ source: 'quick-create:menu', context: 'open' });
  } catch (err) {
    try { if (console && typeof console.warn === 'function') console.warn('[quick-create] partner editor open failed', err); }
    catch (_) {}
    toastWarn('Partner modal unavailable');
    return null;
  }
}

function defaultOpenTaskEditor() {
  const modal = openTaskQuickCreateModal();
  if (modal) return modal;
  const handlers = [
    window.openTaskQuickAdd,
    window.CRM && window.CRM.openTaskQuickCreate,
    window.Tasks && window.Tasks.openQuickCreate,
    window.openTaskQuickCreate,
    window.renderTaskModal
  ].filter((fn) => typeof fn === 'function');
  if (handlers.length) {
    try { return handlers[0](); }
    catch (_) { return null; }
  }
  toastInfo('Tasks coming soon');
  return null;
}

export function openContactEditor(prefill) {
  return defaultOpenContactEditor(prefill);
}

export function openPartnerEditor() {
  return defaultOpenPartnerEditor();
}

export function openTaskEditor() {
  return defaultOpenTaskEditor();
}

function buildOpeners(options = {}) {
  const openers = {
    contact: typeof options.openContact === 'function' ? options.openContact : defaultOpenContactEditor,
    partner: typeof options.openPartner === 'function' ? options.openPartner : defaultOpenPartnerEditor,
    task: typeof options.openTask === 'function' ? options.openTask : defaultOpenTaskEditor
  };
  return openers;
}

function createAnchorBinding(anchor, source) {
  if (!anchor || typeof anchor.addEventListener !== 'function') return null;
  const normalizedSource = normalizeSource(source);
  anchor.setAttribute('aria-haspopup', 'true');
  if (anchor.getAttribute('aria-expanded') !== 'true') {
    anchor.setAttribute('aria-expanded', 'false');
  }
  const handleClick = (event) => {
    event.preventDefault();
    toggleQuickCreateMenu({ anchor, source: normalizedSource });
  };
  const handleState = (event) => {
    const detail = event && event.detail ? event.detail : {};
    const expanded = !!(detail.open && detail.source === normalizedSource);
    anchor.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (!anchor.isConnected) {
      document.removeEventListener('quick-create-menu:state', handleState);
    }
  };
  anchor.addEventListener('click', handleClick);
  document.addEventListener('quick-create-menu:state', handleState);
  if (isQuickCreateMenuOpen(normalizedSource)) {
    anchor.setAttribute('aria-expanded', 'true');
  }
  return () => {
    try { anchor.removeEventListener('click', handleClick); }
    catch (_) {}
    try { document.removeEventListener('quick-create-menu:state', handleState); }
    catch (_) {}
    if (anchor.getAttribute('aria-haspopup') === 'true' && !isQuickCreateMenuOpen(normalizedSource)) {
      anchor.setAttribute('aria-expanded', 'false');
    }
  };
}

function applyOpeners(binding, options) {
  const nextOpeners = buildOpeners(options);
  binding.openers = nextOpeners;
  const previousOwner = state.owner;
  const previousOpeners = state.openers;
  state.owner = binding;
  state.openers = nextOpeners;
  binding.previousOpeners = previousOwner === binding ? binding.previousOpeners : previousOpeners;
}

function createBinding(host, options) {
  const toggleSelector = typeof options.toggleSelector === 'string' && options.toggleSelector
    ? options.toggleSelector
    : HEADER_TOGGLE_SELECTOR;
  const enableActionBar = options.enableActionBar === true;
  const actionBarSelector = typeof options.actionBarSelector === 'string' && options.actionBarSelector
    ? options.actionBarSelector
    : `#${ACTION_BAR_ID}`;

  const binding = {
    disposed: false,
    host,
    toggleSelector,
    actionBarSelector,
    enableActionBar,
    localBindings: new Map(),
    actionBarCleanup: null,
    previousOpeners: state.openers,
    openers: state.openers,
    update(nextOptions) {
      if (this.disposed) return;
      applyOpeners(this, nextOptions || options);
    },
    unbind: () => {}
  };

  applyOpeners(binding, options);
  ensureBootBeacon();

  function registerAnchor(anchor, source) {
    if (!anchor || binding.localBindings.has(anchor)) return;
    const unbind = createAnchorBinding(anchor, source);
    if (typeof unbind === 'function') {
      binding.localBindings.set(anchor, unbind);
    }
  }

  const toggles = Array.from(host.querySelectorAll(toggleSelector));
  toggles.forEach((toggle) => {
    registerAnchor(toggle, HEADER_SOURCE);
  });

  if (enableActionBar) {
    const handleActionBarClick = (event) => {
      if (!event || !event.target || typeof event.target.closest !== 'function') {
        return;
      }
      const anchor = event.target.closest(actionBarSelector);
      if (!anchor) {
        return;
      }
      registerAnchor(anchor, ACTION_BAR_SOURCE);
      event.preventDefault();
      toggleQuickCreateMenu({ anchor, source: ACTION_BAR_SOURCE });
    };
    document.addEventListener('click', handleActionBarClick, false);
    const existing = document.querySelector(actionBarSelector);
    if (existing) {
      registerAnchor(existing, ACTION_BAR_SOURCE);
    }
    binding.actionBarCleanup = () => {
      document.removeEventListener('click', handleActionBarClick, false);
    };
  }

  binding.unbind = () => {
    if (binding.disposed) return;
    binding.disposed = true;
    binding.localBindings.forEach((unbind, anchor) => {
      if (typeof unbind === 'function') {
        try { unbind(); }
        catch (_) {}
      }
      binding.localBindings.delete(anchor);
    });
    if (binding.actionBarCleanup) {
      binding.actionBarCleanup();
      binding.actionBarCleanup = null;
    }
    if (state.owner === binding) {
      state.owner = null;
      state.openers = binding.previousOpeners || defaultOpeners;
    }
  };

  return binding;
}

export function bindQuickCreateMenu(root, options = {}) {
  if (typeof document === 'undefined') {
    return () => {};
  }
  const host = root && typeof root.querySelectorAll === 'function' ? root : document;
  const existing = host[BIND_GUARD_KEY];
  if (existing && typeof existing.unbind === 'function' && !existing.disposed) {
    if (typeof existing.update === 'function') {
      existing.update(options);
    }
    return existing.unbind;
  }

  const binding = createBinding(host, options);
  host[BIND_GUARD_KEY] = binding;
  incrementDebugCounter('bindCount');

  return () => {
    binding.unbind();
    if (host[BIND_GUARD_KEY] === binding) {
      try { delete host[BIND_GUARD_KEY]; }
      catch (_) { host[BIND_GUARD_KEY] = null; }
    }
  };
}

function resetHeaderQuickCreateBinding() {
  const cleanup = headerQuickCreateState.cleanup;
  const controller = headerQuickCreateState.controller;
  headerQuickCreateState.button = null;
  headerQuickCreateState.bound = false;
  headerQuickCreateState.cleanup = null;
  headerQuickCreateState.controller = null;
  if (typeof cleanup === 'function') {
    try { cleanup(); }
    catch (_) {}
  }
  if (controller && controller.signal && !controller.signal.aborted) {
    try { controller.abort(); }
    catch (_) {}
  }
}

export function bindHeaderQuickCreateOnce(root, bus) {
  if (typeof document === 'undefined') return null;
  const scope = root && typeof root.querySelector === 'function' ? root : document;
  const button = scope ? scope.querySelector(HEADER_TOGGLE_SELECTOR) : null;
  if (!button) {
    resetHeaderQuickCreateBinding();
    return null;
  }
  if (headerQuickCreateState.button === button && headerQuickCreateState.bound && button.isConnected !== false) {
    if (!button.hasAttribute('data-bound')) {
      try { button.setAttribute('data-bound', '1'); }
      catch (_) {}
    }
    return button;
  }

  resetHeaderQuickCreateBinding();

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const signal = controller ? controller.signal : null;
  headerQuickCreateState.controller = controller;

  const cleanupTasks = [];
  const addCleanup = (fn) => {
    if (typeof fn === 'function') {
      cleanupTasks.push(fn);
    }
  };

  if (bus && typeof bus === 'object') {
    const eventNames = ['app:navigate', 'app:view:changed', 'route:changed', 'shell:navigate'];
    eventNames.forEach((eventName) => {
      if (!eventName) return;
      if (typeof bus.addEventListener === 'function') {
        try {
          bus.addEventListener(eventName, closeQuickCreateMenu, signal ? { signal } : undefined);
        } catch (_) {
          try { bus.addEventListener(eventName, closeQuickCreateMenu); }
          catch (_) {}
        }
        addCleanup(() => {
          if (typeof bus.removeEventListener === 'function') {
            try { bus.removeEventListener(eventName, closeQuickCreateMenu); }
            catch (_) {}
          }
        });
        return;
      }
      const handler = () => {
        closeQuickCreateMenu();
      };
      if (typeof bus.on === 'function') {
        try { bus.on(eventName, handler); }
        catch (_) {}
        addCleanup(() => {
          if (typeof bus.off === 'function') {
            try { bus.off(eventName, handler); }
            catch (_) {}
          } else if (typeof bus.removeListener === 'function') {
            try { bus.removeListener(eventName, handler); }
            catch (_) {}
          }
        });
        return;
      }
      if (typeof bus.addListener === 'function') {
        try { bus.addListener(eventName, handler); }
        catch (_) {}
        addCleanup(() => {
          if (typeof bus.removeListener === 'function') {
            try { bus.removeListener(eventName, handler); }
            catch (_) {}
          }
        });
      }
    });
  }

  const runCleanup = () => {
    while (cleanupTasks.length) {
      const task = cleanupTasks.pop();
      try { task(); }
      catch (_) {}
    }
  };

  headerQuickCreateState.cleanup = () => {
    runCleanup();
  };

  if (signal && typeof signal.addEventListener === 'function') {
    try {
      signal.addEventListener('abort', () => {
        runCleanup();
        if (headerQuickCreateState.button === button) {
          headerQuickCreateState.button = null;
          headerQuickCreateState.bound = false;
          headerQuickCreateState.cleanup = null;
          headerQuickCreateState.controller = null;
        }
      }, { once: true });
    } catch (_) {}
  }

  headerQuickCreateState.button = button;
  headerQuickCreateState.bound = true;
  if (typeof button.setAttribute === 'function') {
    try { button.setAttribute('data-bound', '1'); }
    catch (_) {}
  }

  return button;
}
