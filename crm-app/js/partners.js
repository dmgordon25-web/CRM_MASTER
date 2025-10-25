// partners.js — partner modal wiring & selection helpers
import { debounce } from './patch_2025-10-02_baseline_ux_cleanup.js';
import { openPartnerEditModal } from './ui/modals/partner_edit/index.js';
import { TOUCH_OPTIONS, createTouchLogEntry, formatTouchDate, touchSuccessMessage } from './util/touch_log.js';
import { toastError, toastSuccess } from './ui/toast_helpers.js';
import { ensureFavoriteState, renderFavoriteToggle } from './util/favorites.js';

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

  function installPartnerFollowUp(detail){
    const dialog = detail && detail.dialog ? detail.dialog : null;
    if(!dialog) return;
    const form = detail && detail.form ? detail.form : dialog.querySelector('#partner-form');
    const footer = (form && form.querySelector('[data-component="form-footer"]'))
      || (form && form.querySelector('.modal-footer'))
      || dialog.querySelector('.modal-footer');
    if(!footer) return;
    const start = footer.querySelector('.form-footer__start') || footer.querySelector('.modal-footer__start') || footer;
    if(!start) return;

    if(dialog.__partnerFollowUpAbort && typeof dialog.__partnerFollowUpAbort.abort === 'function' && !dialog.__partnerFollowUpAbort.signal?.aborted){
      dialog.__partnerFollowUpAbort.abort();
    }

    const controller = new AbortController();
    const { signal } = controller;
    dialog.__partnerFollowUpAbort = controller;

    const host = document.createElement('div');
    host.dataset.role = 'partner-followup-host';
    host.className = 'followup-scheduler';
    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.gap = '6px';
    host.style.maxWidth = '240px';

    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'btn ghost';
    actionBtn.textContent = 'Schedule Follow-up';
    actionBtn.setAttribute('aria-haspopup', 'true');
    actionBtn.setAttribute('aria-expanded', 'false');

    const prompt = document.createElement('div');
    prompt.dataset.role = 'partner-followup-prompt';
    prompt.hidden = true;
    prompt.style.display = 'none';
    prompt.style.flexDirection = 'column';
    prompt.style.gap = '6px';
    prompt.style.padding = '8px';
    prompt.style.border = '1px solid var(--border-subtle, #d0d7de)';
    prompt.style.borderRadius = '6px';
    prompt.style.background = 'var(--surface-subtle, #f6f8fa)';

    const dateLabel = document.createElement('label');
    dateLabel.textContent = 'Follow-up date';
    dateLabel.style.display = 'flex';
    dateLabel.style.flexDirection = 'column';
    dateLabel.style.gap = '4px';

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.required = true;
    dateInput.dataset.role = 'followup-date';

    dateLabel.appendChild(dateInput);

    const noteLabel = document.createElement('label');
    noteLabel.textContent = 'Note (optional)';
    noteLabel.style.display = 'flex';
    noteLabel.style.flexDirection = 'column';
    noteLabel.style.gap = '4px';

    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.placeholder = 'Reminder note';
    noteInput.dataset.role = 'followup-note';

    noteLabel.appendChild(noteInput);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '6px';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn brand';
    confirmBtn.textContent = 'Create';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn ghost';
    cancelBtn.textContent = 'Cancel';

    actions.append(confirmBtn, cancelBtn);

    prompt.append(dateLabel, noteLabel, actions);

    const status = document.createElement('div');
    status.dataset.role = 'followup-status';
    status.setAttribute('aria-live', 'polite');
    status.style.fontSize = '12px';
    status.style.minHeight = '16px';

    const setStatus = (message, tone)=>{
      status.textContent = message || '';
      status.dataset.state = tone || '';
      if(tone === 'error'){
        status.style.color = 'var(--danger-text, #b42318)';
      }else if(tone === 'success'){
        status.style.color = 'var(--success-text, #067647)';
      }else{
        status.style.color = 'inherit';
      }
    };

    const closePrompt = ()=>{
      prompt.hidden = true;
      prompt.style.display = 'none';
      actionBtn.setAttribute('aria-expanded', 'false');
    };
    const openPrompt = ()=>{
      prompt.hidden = false;
      prompt.style.display = 'flex';
      actionBtn.setAttribute('aria-expanded', 'true');
      if(!dateInput.value){
        try{
          const today = new Date();
          const iso = today.toISOString().slice(0,10);
          dateInput.value = iso;
        }catch(_err){}
      }
      try{ dateInput.focus({ preventScroll: true }); }
      catch(_err){ dateInput.focus?.(); }
    };

    let submitting = false;
    const resolvePartnerId = ()=>{
      const detailId = detail && detail.record && detail.record.id != null ? detail.record.id : '';
      const direct = String(detailId || '').trim();
      if(direct) return direct;
      if(!form) return '';
      const idInput = form.querySelector('input[name="id"], input[data-role="partner-id"], #p-id');
      if(!idInput) return '';
      return String(idInput.value || '').trim();
    };

    const handleSubmit = ()=>{
      if(submitting) return;
      const linkedId = resolvePartnerId();
      if(!linkedId){
        setStatus('Save the partner before scheduling a follow-up.', 'error');
        return;
      }
      const due = String(dateInput.value || '').trim();
      if(!due){
        setStatus('Choose a follow-up date.', 'error');
        try{ dateInput.focus({ preventScroll: true }); }
        catch(_err){ dateInput.focus?.(); }
        return;
      }
      submitting = true;
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      actionBtn.disabled = true;
      setStatus('Scheduling follow-up…');
      const note = String(noteInput.value || '').trim();
      Promise.resolve().then(async () => {
        const payload = { linkedType: 'partner', linkedId, due, note };
        if(!note){ delete payload.note; }
        const createViaApp = window.App?.tasks?.createMinimal;
        if(typeof createViaApp === 'function'){
          await createViaApp(payload);
        }else{
          const mod = await import(new URL('../tasks/api.js', import.meta.url));
          const fn = mod.createMinimalTask || mod.createTask || mod.default;
          if(typeof fn !== 'function'){
            throw new Error('Task API unavailable');
          }
          await fn(payload);
        }
      }).then(() => {
        setTimeout(() => {
          try{
            window.dispatchEvent(new CustomEvent('tasks:changed'));
          }catch(_err){}
        }, 0);
        setStatus('Follow-up scheduled.', 'success');
        noteInput.value = '';
        submitting = false;
        confirmBtn.disabled = false;
        cancelBtn.disabled = false;
        actionBtn.disabled = false;
        closePrompt();
      }).catch(err => {
        console.warn?.('[followup]', err);
        submitting = false;
        confirmBtn.disabled = false;
        cancelBtn.disabled = false;
        actionBtn.disabled = false;
        setStatus('Unable to schedule follow-up. Try again.', 'error');
      });
    };

    actionBtn.addEventListener('click', (event)=>{
      event.preventDefault();
      setStatus('');
      if(prompt.hidden){ openPrompt(); }
      else { closePrompt(); }
    }, { signal });

    confirmBtn.addEventListener('click', (event)=>{
      event.preventDefault();
      handleSubmit();
    }, { signal });

    cancelBtn.addEventListener('click', (event)=>{
      event.preventDefault();
      closePrompt();
    }, { signal });

    prompt.addEventListener('keydown', (event)=>{
      if(event.key === 'Escape'){
        event.preventDefault();
        closePrompt();
        actionBtn.focus?.({ preventScroll: true });
      }
    }, { signal });

    signal.addEventListener('abort', ()=>{
      if(host.parentElement){ host.remove(); }
      if(dialog.__partnerFollowUpAbort === controller){
        dialog.__partnerFollowUpAbort = null;
      }
    });

    try{ dialog.addEventListener('close', ()=> controller.abort(), { once: true }); }
    catch(_err){ dialog.addEventListener('close', ()=> controller.abort(), { once: true }); }

    host.append(actionBtn, prompt, status);
    if(start.firstChild){
      start.insertBefore(host, start.firstChild);
    }else{
      start.appendChild(host);
    }
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
        installPartnerFollowUp(detail);
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
