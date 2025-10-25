// partners.js — partner modal wiring & selection helpers
import { debounce } from './patch_2025-10-02_baseline_ux_cleanup.js';
import { openPartnerEditModal } from './ui/modals/partner_edit/index.js';
import { scheduleFollowUpTask } from './tasks/api.js';
import { toastError, toastWarn } from './ui/toast_helpers.js';
import { TOUCH_OPTIONS, createTouchLogEntry, formatTouchDate, touchSuccessMessage } from './util/touch_log.js';
import { toastError, toastSuccess } from './ui/toast_helpers.js';

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

  const isoToday = ()=>{
    const now = new Date();
    now.setHours(0,0,0,0);
    return now.toISOString().slice(0,10);
  };

  const normalizeDateInput = (value)=>{
    if(value instanceof Date){
      const clone = new Date(value);
      if(!Number.isNaN(clone.getTime())){
        clone.setHours(0,0,0,0);
        return clone.toISOString().slice(0,10);
      }
    }
    if(typeof value === 'number' && Number.isFinite(value)){
      const fromNum = new Date(value);
      if(!Number.isNaN(fromNum.getTime())){
        fromNum.setHours(0,0,0,0);
        return fromNum.toISOString().slice(0,10);
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
  };

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

  function ensurePartnerFollowUpControls(dialog){
    if(!dialog) return;
    const summary = dialog.querySelector('#partner-summary');
    if(!summary) return;
    let controls = summary.querySelector('[data-role="partner-followup"]');
    if(!controls){
      controls = document.createElement('div');
      controls.className = 'summary-actions';
      controls.dataset.role = 'partner-followup';
      controls.innerHTML = `
        <button class="btn brand compact" type="button" data-role="followup-open">Schedule Follow-up</button>
        <div class="inline-prompt" data-role="followup-prompt" hidden>
          <label data-role="followup-date-label">Due Date<input type="date" data-role="followup-date"></label>
          <label data-role="followup-note-label">Note (optional)<textarea data-role="followup-note" rows="2"></textarea></label>
          <div class="row followup-buttons" data-role="followup-buttons">
            <button class="btn brand" type="button" data-role="followup-save">Schedule</button>
            <button class="btn ghost" type="button" data-role="followup-cancel">Cancel</button>
          </div>
        </div>
        <p class="muted" data-role="followup-status"></p>
      `;
      summary.appendChild(controls);
    }
    const openBtn = controls.querySelector('[data-role="followup-open"]');
    const prompt = controls.querySelector('[data-role="followup-prompt"]');
    const dateInput = controls.querySelector('[data-role="followup-date"]');
    const noteInput = controls.querySelector('[data-role="followup-note"]');
    const saveBtn = controls.querySelector('[data-role="followup-save"]');
    const cancelBtn = controls.querySelector('[data-role="followup-cancel"]');
    const statusLine = controls.querySelector('[data-role="followup-status"]');
    const nextTouchInput = dialog.querySelector('#p-nexttouch');
    const summaryNote = dialog.querySelector('#p-summary-note');
    if(summaryNote && !summaryNote.dataset.defaultText){
      summaryNote.dataset.defaultText = summaryNote.textContent || '';
    }
    const setSummaryNote = (dueValue)=>{
      if(!summaryNote) return;
      const baseText = summaryNote.dataset.defaultText || 'Keep this partner nurtured with intentional follow-up and co-branded touchpoints.';
      if(dueValue){
        summaryNote.textContent = `Follow-up scheduled for ${dueValue}.`;
      }else{
        summaryNote.textContent = baseText;
      }
    };
    const updateStatus = (dueValue)=>{
      if(statusLine){
        statusLine.textContent = dueValue ? `Next follow-up: ${dueValue}` : '';
      }
      setSummaryNote(dueValue || '');
    };
    const hidePrompt = ()=>{
      if(prompt){
        prompt.hidden = true;
        prompt.style.display = 'none';
      }
      if(openBtn){
        openBtn.style.display = '';
        openBtn.setAttribute('aria-expanded', 'false');
      }
    };
    const showPrompt = ()=>{
      if(prompt){
        prompt.hidden = false;
        prompt.style.display = 'block';
      }
      if(openBtn){
        openBtn.style.display = 'none';
        openBtn.setAttribute('aria-expanded', 'true');
      }
      const baseDueRaw = nextTouchInput?.value?.trim() || '';
      const baseDue = baseDueRaw ? normalizeDateInput(baseDueRaw) : isoToday();
      if(dateInput){
        dateInput.value = baseDue;
        try{ dateInput.focus(); }
        catch(_err){}
      }
      if(noteInput){
        noteInput.value = '';
      }
    };
    if(prompt){
      prompt.hidden = true;
      prompt.style.display = 'none';
    }
    const existingDueRaw = nextTouchInput?.value?.trim() || '';
    const existingDue = existingDueRaw ? normalizeDateInput(existingDueRaw) : '';
    updateStatus(existingDue);
    if(openBtn){
      openBtn.setAttribute('aria-expanded', 'false');
      openBtn.textContent = existingDue ? 'Reschedule Follow-up' : 'Schedule Follow-up';
      if(!openBtn.__partnerFollowup){
        openBtn.__partnerFollowup = true;
        openBtn.addEventListener('click', showPrompt);
      }
    }
    if(cancelBtn && !cancelBtn.__partnerFollowup){
      cancelBtn.__partnerFollowup = true;
      cancelBtn.addEventListener('click', ()=>{
        hidePrompt();
        if(noteInput) noteInput.value = '';
      });
    }
    if(saveBtn && !saveBtn.__partnerFollowup){
      saveBtn.__partnerFollowup = true;
      saveBtn.addEventListener('click', async ()=>{
        if(saveBtn.dataset.loading === '1') return;
        const partnerId = dialog.dataset?.partnerId ? String(dialog.dataset.partnerId).trim() : '';
        if(!partnerId){
          toastWarn('Save this partner before scheduling follow-up.');
          return;
        }
        saveBtn.dataset.loading = '1';
        saveBtn.disabled = true;
        saveBtn.setAttribute('aria-busy', 'true');
        const dueRaw = dateInput?.value?.trim() || '';
        const noteRaw = noteInput?.value?.trim() || '';
        const nameField = dialog.querySelector('#p-name');
        const companyField = dialog.querySelector('#p-company');
        const summaryName = dialog.querySelector('#p-summary-name [data-role="summary-name-text"]');
        const nameParts = [];
        const explicitName = nameField?.value?.trim();
        const explicitCompany = companyField?.value?.trim();
        if(explicitName) nameParts.push(explicitName);
        if(explicitCompany) nameParts.push(explicitCompany);
        const label = summaryName?.textContent?.trim() || nameParts.join(' · ') || explicitName || explicitCompany || 'Partner';
        try{
          const result = await scheduleFollowUpTask({
            entity: 'partner',
            entityId: partnerId,
            due: dueRaw || undefined,
            note: noteRaw,
            title: label ? `Follow up: ${label}` : 'Follow up',
            name: label
          });
          if(result && result.status === 'ok'){
            const normalizedDue = normalizeDateInput(result.task?.due || dueRaw);
            if(nextTouchInput) nextTouchInput.value = normalizedDue;
            if(openBtn) openBtn.textContent = 'Reschedule Follow-up';
            updateStatus(normalizedDue);
            hidePrompt();
          }else if(result && result.reason === 'missing-id'){
            toastWarn('Save this partner before scheduling follow-up.');
          }else if(result && result.status === 'error'){
            toastError('Unable to schedule follow-up');
          }
        }catch (err){
          console && console.warn && console.warn('partner follow-up scheduling failed', err);
          toastError('Unable to schedule follow-up');
        }finally{
          if(noteInput) noteInput.value = '';
          delete saveBtn.dataset.loading;
          saveBtn.disabled = false;
          saveBtn.removeAttribute('aria-busy');
        }
      });
    }
  }

  function handlePartnerModalReady(evt){
    const dialog = evt?.detail?.dialog || null;
    if(!dialog) return;
    ensurePartnerFollowUpControls(dialog);
  }

  if(typeof document !== 'undefined'){
    if(!document.__partnerFollowUpListener){
      document.__partnerFollowUpListener = true;
      document.addEventListener('partner:modal:ready', handlePartnerModalReady, { passive: true });
    }
    const openDialog = document.querySelector('[data-ui="partner-edit-modal"][data-open="1"], [data-ui="partner-edit-modal"][data-open="true"]');
    if(openDialog){
      ensurePartnerFollowUpControls(openDialog);
    }
  }

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
        installPartnerTouchLogging(event && event.detail ? event.detail : {});
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
