// partners.js — partner modal wiring & selection helpers
import { debounce } from './patch_2025-10-02_baseline_ux_cleanup.js';
import { openPartnerEditModal } from './ui/modals/partner_edit/index.js';
import { TOUCH_OPTIONS, createTouchLogEntry, formatTouchDate, touchSuccessMessage } from './util/touch_log.js';
import { toastError, toastSuccess, toastWarn } from './ui/toast_helpers.js';
import { createFollowUpTask } from './tasks/api.js';

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

  function installPartnerTouchLogging(detail){
    const dialog = detail && detail.dialog ? detail.dialog : null;
    if(!dialog) return;
    const form = detail && detail.form ? detail.form : dialog.querySelector('#partner-form');
    if(!form) return;
    const footer = form.querySelector('[data-component="form-footer"]') || form.querySelector('.modal-footer');
    if(!footer) return;
    const start = footer.querySelector('.form-footer__start');
    if(!start) return;

    const ensureFollowUpScheduler = ()=>{
      let controls = dialog.__partnerFollowUpControls || null;
      if(!controls){
        const wrapper = document.createElement('div');
        wrapper.dataset.role = 'followup-control';
        wrapper.style.position = 'relative';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '8px';
        wrapper.style.marginRight = '8px';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn ghost';
        button.textContent = 'Schedule Follow-up';
        button.setAttribute('aria-expanded', 'false');

        const panel = document.createElement('div');
        panel.dataset.role = 'followup-panel';
        panel.hidden = true;
        panel.style.display = 'none';
        panel.style.position = 'absolute';
        panel.style.top = 'calc(100% + 4px)';
        panel.style.left = '0';
        panel.style.zIndex = '40';
        panel.style.background = '#ffffff';
        panel.style.borderRadius = '12px';
        panel.style.boxShadow = '0 18px 34px rgba(15, 23, 42, 0.18)';
        panel.style.border = '1px solid rgba(148, 163, 184, 0.35)';
        panel.style.padding = '14px';
        panel.style.flexDirection = 'column';
        panel.style.gap = '10px';
        panel.style.minWidth = '260px';

        const dueGroup = document.createElement('label');
        dueGroup.style.display = 'flex';
        dueGroup.style.flexDirection = 'column';
        dueGroup.style.gap = '4px';

        const dueHeading = document.createElement('span');
        dueHeading.textContent = 'Due date';
        dueHeading.style.fontSize = '12px';
        dueHeading.style.fontWeight = '600';
        dueHeading.style.letterSpacing = '0.05em';
        dueHeading.style.textTransform = 'uppercase';
        dueHeading.style.color = '#475569';

        const dueInput = document.createElement('input');
        dueInput.type = 'date';
        dueInput.required = true;
        dueInput.className = 'input';
        dueInput.dataset.role = 'followup-date';

        dueGroup.append(dueHeading, dueInput);

        const noteGroup = document.createElement('label');
        noteGroup.style.display = 'flex';
        noteGroup.style.flexDirection = 'column';
        noteGroup.style.gap = '4px';

        const noteHeading = document.createElement('span');
        noteHeading.textContent = 'Note (optional)';
        noteHeading.style.fontSize = '12px';
        noteHeading.style.fontWeight = '600';
        noteHeading.style.letterSpacing = '0.05em';
        noteHeading.style.textTransform = 'uppercase';
        noteHeading.style.color = '#475569';

        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.placeholder = 'Add a note';
        noteInput.className = 'input';
        noteInput.dataset.role = 'followup-note';

        noteGroup.append(noteHeading, noteInput);

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';
        actions.style.gap = '8px';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn ghost';
        cancelBtn.textContent = 'Cancel';

        const submitBtn = document.createElement('button');
        submitBtn.type = 'button';
        submitBtn.className = 'btn brand';
        submitBtn.textContent = 'Create Task';

        actions.append(cancelBtn, submitBtn);

        panel.append(dueGroup, noteGroup, actions);
        wrapper.append(button, panel);

        if(start.firstChild){
          start.insertBefore(wrapper, start.firstChild);
        }else{
          start.appendChild(wrapper);
        }

        controls = { wrapper, button, panel, dueInput, noteInput, submitBtn, cancelBtn };
        dialog.__partnerFollowUpControls = controls;
      }else if(controls.wrapper && !start.contains(controls.wrapper)){
        if(start.firstChild){
          start.insertBefore(controls.wrapper, start.firstChild);
        }else{
          start.appendChild(controls.wrapper);
        }
      }

      const { button, panel, dueInput, noteInput, submitBtn, cancelBtn } = controls;
      const todayIso = ()=>{
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const resolveDefaultDue = ()=>{
        const nextField = form.querySelector('#p-nexttouch');
        const raw = nextField && nextField.value ? nextField.value.trim() : '';
        return raw || todayIso();
      };
      const getRecordId = ()=>{
        const attr = dialog.dataset ? dialog.dataset.partnerId : '';
        return attr ? String(attr).trim() : '';
      };
      const getName = ()=>{
        const name = form.querySelector('#p-name')?.value?.trim() || '';
        if(name) return name;
        const company = form.querySelector('#p-company')?.value?.trim() || '';
        if(company) return company;
        const email = form.querySelector('#p-email')?.value?.trim() || '';
        if(email) return email;
        const phone = form.querySelector('#p-phone')?.value?.trim() || '';
        return phone;
      };
      const getStatusLabel = ()=>{
        const tier = form.querySelector('#p-tier')?.value || '';
        if(tier) return tier;
        const priority = form.querySelector('#p-priority')?.value || '';
        return priority;
      };
      const hidePanel = ()=>{
        if(panel.hidden) return;
        panel.hidden = true;
        panel.style.display = 'none';
        button.setAttribute('aria-expanded', 'false');
        noteInput.value = '';
        submitBtn.disabled = false;
        delete submitBtn.dataset.loading;
        submitBtn.removeAttribute('aria-busy');
      };
      const showPanel = ()=>{
        if(!panel.hidden) return;
        panel.hidden = false;
        panel.style.display = 'flex';
        button.setAttribute('aria-expanded', 'true');
        dueInput.value = resolveDefaultDue();
        noteInput.value = '';
        try{ dueInput.focus({ preventScroll: true }); }
        catch(_err){}
      };
      const setBusy = (active)=>{
        if(active){
          submitBtn.disabled = true;
          submitBtn.dataset.loading = '1';
          submitBtn.setAttribute('aria-busy', 'true');
        }else{
          submitBtn.disabled = false;
          delete submitBtn.dataset.loading;
          submitBtn.removeAttribute('aria-busy');
        }
      };
      const updateButtonState = ()=>{
        const id = getRecordId();
        const disabled = !id;
        button.disabled = disabled;
        button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        button.title = disabled ? 'Save this partner to schedule a follow-up' : '';
        if(disabled){
          hidePanel();
        }
      };

      if(!button.__wired){
        button.__wired = true;
        button.addEventListener('click', (event)=>{
          event.preventDefault();
          if(button.disabled) return;
          if(panel.hidden) showPanel();
          else hidePanel();
        });
      }
      if(!cancelBtn.__wired){
        cancelBtn.__wired = true;
        cancelBtn.addEventListener('click', (event)=>{
          event.preventDefault();
          hidePanel();
        });
      }
      if(!submitBtn.__wired){
        submitBtn.__wired = true;
        submitBtn.addEventListener('click', async (event)=>{
          event.preventDefault();
          if(submitBtn.dataset.loading === '1') return;
          const recordId = getRecordId();
          if(!recordId){
            toastWarn('Save this partner before scheduling a follow-up.');
            hidePanel();
            return;
          }
          const dueValue = dueInput.value ? dueInput.value.trim() : '';
          if(!dueValue){
            toastWarn('Choose a due date for the follow-up.');
            try{ dueInput.focus({ preventScroll: true }); }
            catch(_err){}
            return;
          }
          const noteValue = noteInput.value ? noteInput.value.trim() : '';
          const name = getName();
          const status = getStatusLabel();
          setBusy(true);
          try{
            const result = await createFollowUpTask({
              entity: 'partner',
              recordId,
              dueDate: dueValue,
              note: noteValue,
              name,
              statusLabel: status
            });
            if(result && result.status === 'ok'){
              toastSuccess(name ? `Follow-up scheduled for ${name}.` : 'Follow-up scheduled.');
              hidePanel();
            }else{
              toastError('Unable to schedule follow-up.');
            }
          }catch (err){
            console && console.warn && console.warn('partner follow-up scheduling failed', err);
            toastError('Unable to schedule follow-up.');
          }finally{
            setBusy(false);
          }
        });
      }

      if(!controls.keyHandler){
        const keyHandler = (event)=>{
          if(event.key === 'Escape'){
            event.preventDefault();
            hidePanel();
            if(typeof button.focus === 'function'){
              try{ button.focus({ preventScroll: true }); }
              catch(_err){}
            }
            return;
          }
          if(event.key === 'Enter' && panel.contains(event.target)){
            event.preventDefault();
            submitBtn.click();
          }
        };
        panel.addEventListener('keydown', keyHandler);
        controls.keyHandler = keyHandler;
      }

      if(!controls.outsideHandler){
        const outsideHandler = (event)=>{
          if(panel.hidden) return;
          if(!controls.wrapper) return;
          if(controls.wrapper.contains(event.target)) return;
          hidePanel();
        };
        dialog.addEventListener('click', outsideHandler);
        controls.outsideHandler = outsideHandler;
      }
      if(!controls.closeHandler){
        const closeHandler = ()=> hidePanel();
        try{ dialog.addEventListener('close', closeHandler); }
        catch(_err){ dialog.addEventListener('close', closeHandler); }
        controls.closeHandler = closeHandler;
      }

      updateButtonState();
    };

    ensureFollowUpScheduler();

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
