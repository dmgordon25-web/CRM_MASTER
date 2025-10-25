// partners.js — partner modal wiring & selection helpers
import { debounce } from './patch_2025-10-02_baseline_ux_cleanup.js';
import { openPartnerEditModal } from './ui/modals/partner_edit/index.js';
import { TOUCH_OPTIONS, createTouchLogEntry, formatTouchDate, touchSuccessMessage } from './util/touch_log.js';
import { toastError, toastSuccess } from './ui/toast_helpers.js';
import { ensureFavoriteState, renderFavoriteToggle } from './util/favorites.js';
import { createLinkedTask } from './tasks/api.js';

const STRAY_DIALOG_ALLOW = '[data-ui="merge-modal"],[data-ui="merge-confirm"],[data-ui="toast"]';

function ensurePartnersBoot(ctx){
  if (!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if (window.__INIT_FLAGS__.partners_plus) return false;
  window.__INIT_FLAGS__.partners_plus = true;

  function $$(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

  function closePartnerRouteDialogs(){
    if (typeof document === 'undefined') return;
    document.querySelectorAll('dialog[open]').forEach(dialog => {
      let allowed = false;
      try {
        allowed = typeof dialog.matches === 'function' && dialog.matches(STRAY_DIALOG_ALLOW);
      } catch (_) {
        allowed = false;
      }
      if (allowed) return;
      try { dialog.close?.(); }
      catch (_) {}
      try { dialog.removeAttribute?.('open'); }
      catch (_) {}
      try { dialog.classList?.add('is-hidden'); }
      catch (_) {}
    });
  }

  [
    '#adv-query',
    '#query-builder',
    '.query-shell[data-query-scope="partners"]',
    '#view-partners .query-save-row'
  ].forEach(selector => {
    const n = document.querySelector(selector);
    if (n){
      n.remove();
    }
  });

  function applyFilter(value){
    if (typeof document === 'undefined') return;
    const query = String(value == null ? '' : value).toLowerCase();
    const table = document.getElementById('tbl-partners');
    if (!table || !table.tBodies || !table.tBodies[0]) return;
    const rows = Array.from(table.tBodies[0].querySelectorAll('tr[data-id]'));
    rows.forEach(row => {
      const text = (row.textContent || '').toLowerCase();
      row.style.display = query && !text.includes(query) ? 'none' : '';
    });
  }

  function wireFilter(){
    if (typeof document === 'undefined') return;
    const input = document.querySelector('#view-partners input[data-table-search="#tbl-partners"], #view-partners input[data-role="partner-search"]');
    if (!input || input.__simpleFilter) return;
    input.__simpleFilter = true;
    const run = () => applyFilter(input.value || '');
    const handler = debounce(run, 150);
    input.addEventListener('input', handler);
    run();
  }

  wireFilter();
  closePartnerRouteDialogs();
  if (typeof document !== 'undefined'){
    document.addEventListener('DOMContentLoaded', wireFilter);
    document.addEventListener('DOMContentLoaded', closePartnerRouteDialogs, { once: true });
    document.addEventListener('app:data:changed', () => {
      const input = document.querySelector('#view-partners input[data-table-search="#tbl-partners"], #view-partners input[data-role="partner-search"]');
      if (input && input.value){
        applyFilter(input.value);
      }
    }, { passive: true });
  }

  function isoToday(){
    const now = new Date();
    now.setHours(0,0,0,0);
    try{ return now.toISOString().slice(0,10); }
    catch (_err){ return ''; }
  }

  function normalizeDateInput(value){
    if(value instanceof Date){
      const copy = new Date(value);
      if(Number.isNaN(copy.getTime())) return isoToday();
      copy.setHours(0,0,0,0);
      return copy.toISOString().slice(0,10);
    }
    if(typeof value === 'number' && Number.isFinite(value)){
      const parsed = new Date(value);
      if(!Number.isNaN(parsed.getTime())){
        parsed.setHours(0,0,0,0);
        return parsed.toISOString().slice(0,10);
      }
    }
    if(typeof value === 'string' && value.trim()){
      const parsed = new Date(value);
      if(!Number.isNaN(parsed.getTime())){
        parsed.setHours(0,0,0,0);
        return parsed.toISOString().slice(0,10);
      }
    }
    return isoToday();
  }

  function requestPartnerModal(partnerId, options){
    const normalized = partnerId == null ? '' : String(partnerId).trim();
    const openOptions = options && typeof options === 'object' ? { ...options } : {};
    if(!openOptions.sourceHint || typeof openOptions.sourceHint !== 'string' || !openOptions.sourceHint.trim()){
      openOptions.sourceHint = normalized ? 'partners:request-edit' : 'partners:request-new';
    }
    if(!normalized){
      openOptions.allowAutoOpen = true;
    }
    try {
      const result = openPartnerEditModal(normalized, openOptions);
      return result && typeof result.then === 'function' ? result : Promise.resolve(result);
    } catch (err) {
      console && console.warn && console.warn('openPartnerEditModal failed', err);
      return Promise.resolve(null);
    }
  }

  window.requestPartnerModal = requestPartnerModal;

  function syncSelectionCheckboxes(scope, ids){
    const scopeKey = scope && scope.trim() ? scope.trim() : 'partners';
    const idSet = ids instanceof Set
      ? ids
      : new Set(Array.isArray(ids) ? ids.map(String) : []);
    $$("[data-selection-scope='" + scopeKey + "']").forEach(table => {
      table.querySelectorAll('tbody tr[data-id]').forEach(row => {
        const id = row.getAttribute('data-id');
        if (!id) return;
        const checkbox = row.querySelector('[data-role="select"]');
        if (!checkbox) return;
        const shouldCheck = idSet.has(String(id));
        if (checkbox.checked !== shouldCheck){
          checkbox.checked = shouldCheck;
        }
      });
    });
  }

  function handleSelectionSnapshot(snapshot){
    if (!snapshot || snapshot.scope !== 'partners') return;
    const ids = snapshot.ids instanceof Set
      ? snapshot.ids
      : new Set(Array.from(snapshot.ids || [], value => String(value)));
    syncSelectionCheckboxes('partners', ids);
  }

  function initSelectionMirror(){
    if (initSelectionMirror.__wired) return;
    const store = window.SelectionStore || null;
    if (!store) return;
    initSelectionMirror.__wired = true;
    store.subscribe(handleSelectionSnapshot);
  }

  initSelectionMirror();
  if (typeof document !== 'undefined'){
    document.addEventListener('DOMContentLoaded', initSelectionMirror);
  }

  function applyPartnerFavorite(detail){
    const dialog = detail && detail.dialog ? detail.dialog : null;
    const record = detail && detail.record ? detail.record : {};
    if(!dialog) return;
    const summaryName = dialog.querySelector('#p-summary-name');
    if(!summaryName) return;
    const partnerId = String(record && record.id ? record.id : '');
    summaryName.dataset.favoriteType = 'partner';
    summaryName.dataset.recordId = partnerId;
    summaryName.setAttribute('data-role', 'favorite-host');
    summaryName.setAttribute('data-favorite-type', 'partner');
    summaryName.setAttribute('data-record-id', partnerId);
    const isFavorite = ensureFavoriteState().partners.has(partnerId);
    summaryName.classList.toggle('is-favorite', isFavorite);
    if(isFavorite){
      summaryName.setAttribute('data-favorite', '1');
    }else{
      summaryName.removeAttribute('data-favorite');
    }
    let actions = summaryName.querySelector('[data-role="favorite-actions"]');
    if(!actions){
      actions = document.createElement('span');
      actions.className = 'summary-actions';
      actions.dataset.role = 'favorite-actions';
      summaryName.appendChild(actions);
    }
    actions.innerHTML = renderFavoriteToggle('partner', partnerId, isFavorite);
  }

  function ensurePartnerFollowUpControls(dialog, start){
    if(!dialog || !start) return null;
    if(dialog.__partnerFollowUpControls){
      dialog.__partnerFollowUpControls.refresh();
      return dialog.__partnerFollowUpControls;
    }
    const wrapper = document.createElement('div');
    wrapper.dataset.role = 'partner-followup';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '8px';
    wrapper.style.marginRight = '12px';
    const anchor = start.firstChild || null;
    start.insertBefore(wrapper, anchor);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'btn ghost';
    trigger.dataset.role = 'partner-followup-trigger';
    trigger.textContent = 'Schedule Follow-up';
    trigger.setAttribute('aria-expanded', 'false');

    const form = document.createElement('div');
    form.dataset.role = 'partner-followup-form';
    form.hidden = true;
    form.style.display = 'none';
    form.style.flexDirection = 'column';
    form.style.gap = '8px';
    form.style.background = 'var(--surface-subdued,#f5f5f5)';
    form.style.padding = '12px';
    form.style.borderRadius = '8px';
    form.style.minWidth = '220px';

    const dueLabel = document.createElement('label');
    dueLabel.style.display = 'flex';
    dueLabel.style.flexDirection = 'column';
    dueLabel.style.gap = '4px';
    dueLabel.textContent = 'Due Date';
    const dueInput = document.createElement('input');
    dueInput.type = 'date';
    dueInput.dataset.role = 'partner-followup-due';
    dueLabel.appendChild(dueInput);

    const noteLabel = document.createElement('label');
    noteLabel.style.display = 'flex';
    noteLabel.style.flexDirection = 'column';
    noteLabel.style.gap = '4px';
    noteLabel.textContent = 'Note (optional)';
    const noteInput = document.createElement('textarea');
    noteInput.rows = 2;
    noteInput.dataset.role = 'partner-followup-note';
    noteInput.style.minHeight = '48px';
    noteInput.style.resize = 'vertical';
    noteLabel.appendChild(noteInput);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '8px';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn';
    cancelBtn.textContent = 'Cancel';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn brand';
    saveBtn.textContent = 'Add Task';
    actions.append(cancelBtn, saveBtn);

    form.append(dueLabel, noteLabel, actions);
    wrapper.append(trigger, form);

    const state = { open:false, saving:false };

    const getPartnerId = ()=> dialog.dataset && dialog.dataset.partnerId ? String(dialog.dataset.partnerId) : '';
    const computeName = ()=>{
      const name = dialog.querySelector('#p-name')?.value?.trim() || '';
      if(name) return name;
      const company = dialog.querySelector('#p-company')?.value?.trim() || '';
      if(company) return company;
      if(dialog.__currentPartnerBase && dialog.__currentPartnerBase.name){
        return String(dialog.__currentPartnerBase.name).trim();
      }
      return 'Partner';
    };
    const computeDefaultDue = ()=>{
      const nextInput = dialog.querySelector('#p-nexttouch');
      if(nextInput && nextInput.value){
        return normalizeDateInput(nextInput.value);
      }
      if(dialog.__currentPartnerBase && dialog.__currentPartnerBase.nextTouch){
        return normalizeDateInput(dialog.__currentPartnerBase.nextTouch);
      }
      return normalizeDateInput();
    };
    const hideForm = ()=>{
      state.open = false;
      form.hidden = true;
      form.style.display = 'none';
      trigger.setAttribute('aria-expanded', 'false');
    };
    const showForm = ()=>{
      if(state.saving) return;
      state.open = true;
      form.hidden = false;
      form.style.display = 'flex';
      trigger.setAttribute('aria-expanded', 'true');
      dueInput.value = computeDefaultDue();
      try{ dueInput.focus({ preventScroll: true }); }
      catch (_err){
        try{ dueInput.focus(); }
        catch(__err){}
      }
    };
    const updateAvailability = ()=>{
      const partnerId = getPartnerId();
      const canUse = Boolean(partnerId);
      trigger.disabled = !canUse;
      trigger.title = canUse ? 'Schedule a follow-up task' : 'Save this partner before scheduling follow-ups';
      if(!canUse){
        hideForm();
      }
    };

    trigger.addEventListener('click', (event)=>{
      event.preventDefault();
      if(state.saving) return;
      if(state.open) hideForm();
      else showForm();
    });
    cancelBtn.addEventListener('click', (event)=>{
      event.preventDefault();
      if(state.saving) return;
      hideForm();
    });
    noteInput.addEventListener('input', ()=>{
      noteInput.style.height = 'auto';
      const nextHeight = Math.min(160, noteInput.scrollHeight || 0);
      if(nextHeight){
        noteInput.style.height = `${nextHeight}px`;
      }
    });
    saveBtn.addEventListener('click', async (event)=>{
      event.preventDefault();
      if(state.saving) return;
      const partnerId = getPartnerId();
      if(!partnerId){
        toastError('Save this partner before scheduling follow-ups.');
        return;
      }
      state.saving = true;
      saveBtn.disabled = true;
      trigger.disabled = true;
      const iso = normalizeDateInput(dueInput.value);
      const noteVal = noteInput.value || '';
      try{
        const name = computeName();
        const result = await createLinkedTask({
          entity: 'partner',
          recordId: partnerId,
          due: iso,
          note: noteVal,
          title: `Follow up with ${name}`,
          displayName: name
        });
        if(result && result.status === 'ok'){
          const nextInput = dialog.querySelector('#p-nexttouch');
          if(nextInput){
            nextInput.value = iso;
            nextInput.dispatchEvent(new Event('input', { bubbles:true }));
            nextInput.dispatchEvent(new Event('change', { bubbles:true }));
          }
          noteInput.value = '';
          hideForm();
        }
      }catch (err){
        try{ console && console.warn && console.warn('partner follow-up task failed', err); }
        catch(_err){}
      }finally{
        state.saving = false;
        saveBtn.disabled = false;
        updateAvailability();
      }
    });

    const refresh = ()=> updateAvailability();

    const controls = {
      refresh,
      hide: hideForm
    };
    dialog.__partnerFollowUpControls = controls;
    updateAvailability();

    if(!dialog.__partnerFollowUpObserver){
      try{
        const observer = new MutationObserver(()=> updateAvailability());
        observer.observe(dialog, { attributes:true, attributeFilter:['data-partner-id'] });
        dialog.__partnerFollowUpObserver = observer;
      }catch (_err){}
    }
    if(!dialog.__partnerFollowUpClose){
      const closeHandler = ()=> hideForm();
      dialog.addEventListener('close', closeHandler);
      dialog.__partnerFollowUpClose = closeHandler;
    }

    return controls;
  }

  function installPartnerTouchLogging(detail){
    const dialog = detail && detail.dialog ? detail.dialog : null;
    if(!dialog) return;
    const form = detail && detail.form ? detail.form : dialog.querySelector('#partner-form');
    if(!form) return;
    const footer = form.querySelector('[data-component="form-footer"]') || form.querySelector('.modal-footer');
    if(!footer) return;
    const start = footer.querySelector('.form-footer__start');
    if(!start) return;

    const followUp = ensurePartnerFollowUpControls(dialog, start);
    if(followUp && typeof followUp.refresh === 'function'){
      followUp.refresh();
    }

    let controls = dialog.__partnerTouchControls || null;
    if(!controls){
      const logButton = document.createElement('button');
      logButton.type = 'button';
      logButton.className = 'btn';
      logButton.dataset.role = 'log-touch';
      logButton.textContent = 'Log a Touch';
      logButton.setAttribute('aria-haspopup', 'true');
      logButton.setAttribute('aria-expanded', 'false');

      const menu = document.createElement('div');
      menu.dataset.role = 'touch-menu';
      menu.setAttribute('role', 'menu');
      menu.hidden = true;
      menu.style.display = 'none';
      menu.style.marginLeft = '8px';
      menu.style.gap = '4px';
      menu.style.flexWrap = 'wrap';

      start.appendChild(logButton);
      start.appendChild(menu);
      controls = { button: logButton, menu };
      dialog.__partnerTouchControls = controls;
    }else{
      controls.button.textContent = 'Log a Touch';
    }

    const { button: logButton, menu } = controls;
    if(!logButton || !menu) return;

    TOUCH_OPTIONS.forEach(option => {
      let optBtn = menu.querySelector(`button[data-touch-key="${option.key}"]`);
      if(!optBtn){
        optBtn = document.createElement('button');
        optBtn.type = 'button';
        optBtn.className = 'btn ghost';
        optBtn.dataset.touchKey = option.key;
        optBtn.textContent = option.label;
        optBtn.setAttribute('role', 'menuitem');
        menu.appendChild(optBtn);
      }else{
        optBtn.textContent = option.label;
      }
    });
    Array.from(menu.querySelectorAll('button[data-touch-key]')).forEach(btn => {
      if(!TOUCH_OPTIONS.some(option => option.key === btn.dataset.touchKey)){
        btn.remove();
      }
    });

    const hideMenu = ()=>{
      if(menu.hidden) return;
      menu.hidden = true;
      menu.style.display = 'none';
      logButton.setAttribute('aria-expanded', 'false');
    };
    const showMenu = ()=>{
      if(!menu.hidden) return;
      menu.hidden = false;
      menu.style.display = 'flex';
      logButton.setAttribute('aria-expanded', 'true');
      const first = menu.querySelector('button[data-touch-key]');
      if(first && typeof first.focus === 'function'){
        first.focus({ preventScroll: true });
      }
    };

    let logging = false;
    const logTouch = async (key)=>{
      if(logging) return null;
      logging = true;
      try{
        const notesField = dialog.querySelector('#p-notes');
        const lastTouchInput = dialog.querySelector('#p-lasttouch');
        if(!notesField || !lastTouchInput){
          return null;
        }
        const entry = createTouchLogEntry(key);
        const existing = notesField.value || '';
        const remainderRaw = existing.replace(/^\s+/, '');
        const remainder = remainderRaw ? `\n${remainderRaw}` : '';
        const nextValue = `${entry}${remainder}`;
        notesField.value = nextValue;
        notesField.dispatchEvent(new Event('input', { bubbles: true }));
        if(typeof notesField.focus === 'function'){
          notesField.focus({ preventScroll: true });
        }
        if(typeof notesField.setSelectionRange === 'function'){
          const caretIndex = entry.length;
          try{ notesField.setSelectionRange(caretIndex, caretIndex); }
          catch(_err){}
        }
        const today = formatTouchDate(new Date());
        if(today){
          lastTouchInput.value = today;
          lastTouchInput.dispatchEvent(new Event('input', { bubbles: true }));
          lastTouchInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if(typeof openDB !== 'function' || typeof dbPut !== 'function'){
          toastError('Unable to log touch right now.');
          return null;
        }
        const baseRecord = Object.assign({}, dialog.__currentPartnerBase || {});
        if(!baseRecord.id){
          baseRecord.id = dialog.dataset.partnerId || (typeof window.uuid === 'function' ? window.uuid() : `partner-${Date.now()}`);
        }
        const rec = Object.assign({}, baseRecord, {
          id: baseRecord.id,
          name: dialog.querySelector('#p-name')?.value?.trim() || '',
          company: dialog.querySelector('#p-company')?.value?.trim() || '',
          email: dialog.querySelector('#p-email')?.value?.trim() || '',
          phone: dialog.querySelector('#p-phone')?.value?.trim() || '',
          partnerType: dialog.querySelector('#p-type')?.value || 'Realtor Partner',
          tier: dialog.querySelector('#p-tier')?.value || 'Developing',
          focus: dialog.querySelector('#p-focus')?.value || 'Purchase',
          priority: dialog.querySelector('#p-priority')?.value || 'Emerging',
          preferredContact: dialog.querySelector('#p-pref')?.value || 'Phone',
          cadence: dialog.querySelector('#p-cadence')?.value || 'Monthly',
          address: dialog.querySelector('#p-address')?.value?.trim() || '',
          city: dialog.querySelector('#p-city')?.value?.trim() || '',
          state: (dialog.querySelector('#p-state')?.value || '').toUpperCase(),
          zip: dialog.querySelector('#p-zip')?.value?.trim() || '',
          referralVolume: dialog.querySelector('#p-volume')?.value || '1-2 / month',
          lastTouch: lastTouchInput.value || '',
          nextTouch: dialog.querySelector('#p-nexttouch')?.value || '',
          relationshipOwner: dialog.querySelector('#p-owner')?.value?.trim() || '',
          collaborationFocus: dialog.querySelector('#p-collab')?.value || 'Co-Marketing',
          notes: notesField.value || '',
          updatedAt: Date.now()
        });
        const wasSaved = Boolean(dialog.__partnerWasSaved);
        await openDB();
        await dbPut('partners', rec);
        dialog.__currentPartnerBase = Object.assign({}, rec);
        dialog.dataset.partnerId = String(rec.id || '');
        dialog.__partnerWasSaved = true;
        const changeDetail = {
          scope: 'partners',
          partnerId: String(rec.id || ''),
          action: wasSaved ? 'update' : 'create',
          source: 'partner:modal',
          sourceHint: dialog.__partnerSourceHint || dialog.dataset?.sourceHint || ''
        };
        if(typeof window.dispatchAppDataChanged === 'function'){
          window.dispatchAppDataChanged(changeDetail);
        }else{
          document.dispatchEvent(new CustomEvent('app:data:changed', { detail: changeDetail }));
        }
        toastSuccess(touchSuccessMessage(key));
        return rec;
      }catch (err){
        try{ console && console.warn && console.warn('[partners] touch log failed', err); }
        catch(_err){}
        toastError('Unable to log touch');
        return null;
      }finally{
        logging = false;
      }
    };

    if(!logButton.__touchToggle){
      logButton.__touchToggle = true;
      logButton.addEventListener('click', (event)=>{
        event.preventDefault();
        if(menu.hidden){ showMenu(); }
        else { hideMenu(); }
      });
      logButton.addEventListener('keydown', (event)=>{
        if(event.key === 'Escape' && !menu.hidden){
          event.preventDefault();
          hideMenu();
          logButton.blur?.();
          return;
        }
        if((event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') && menu.hidden){
          event.preventDefault();
          showMenu();
        }
      });
    }

    if(!menu.__touchHandlers){
      menu.__touchHandlers = true;
      menu.addEventListener('click', (event)=>{
        const target = event.target && event.target.closest('button[data-touch-key]');
        if(!target) return;
        event.preventDefault();
        hideMenu();
        logTouch(target.dataset.touchKey);
      });
      menu.addEventListener('keydown', (event)=>{
        if(event.key === 'Escape'){
          event.preventDefault();
          hideMenu();
          if(typeof logButton.focus === 'function'){
            logButton.focus({ preventScroll: true });
          }
        }
      });
    }

    if(!dialog.__partnerTouchOutside){
      const outsideHandler = (event)=>{
        if(menu.hidden) return;
        if(event && (event.target === logButton || logButton.contains(event.target))) return;
        if(event && menu.contains(event.target)) return;
        hideMenu();
      };
      dialog.addEventListener('click', outsideHandler);
      dialog.__partnerTouchOutside = outsideHandler;
    }

    if(!menu.__touchCloseHook){
      const closeHandler = ()=> hideMenu();
      try{ dialog.addEventListener('close', closeHandler); }
      catch(_err){ dialog.addEventListener('close', closeHandler); }
      menu.__touchCloseHook = closeHandler;
    }
  }

  function ensurePartnerTouchListener(){
    if(typeof document === 'undefined') return;
    if(document.__partnerTouchReadyListener) return;
    const handler = (event)=>{
      try{
        const detail = event && event.detail ? event.detail : {};
        installPartnerTouchLogging(detail);
        applyPartnerFavorite(detail);
      }catch (err){
        try{ console && console.warn && console.warn('[partners] touch logging init failed', err); }
        catch(_err){}
      }
    };
    document.addEventListener('partner:modal:ready', handler);
    document.__partnerTouchReadyListener = handler;
  }

  ensurePartnerTouchListener();

  if (ctx && ctx.logger && typeof ctx.logger.log === 'function'){
    ctx.logger.log('[partners] bootstrapped');
  }

  return true;
}

ensurePartnersBoot();

// Phase 1 migration scaffold: optional init(ctx)
export async function init(ctx){
  try {
    const fresh = ensurePartnersBoot(ctx);
    if (ctx && ctx.logger && typeof ctx.logger.log === 'function'){
      ctx.logger.log('[partners.init] invoked', { alreadyInitialised: fresh === false });
    }
  } catch (e) {
    console.warn('[soft] [partners.init]', e);
  }
}
