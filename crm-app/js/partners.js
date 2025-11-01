// partners.js — partner modal wiring & selection helpers
import { debounce } from './patch_2025-10-02_baseline_ux_cleanup.js';
import { openPartnerEditModal } from './ui/modals/partner_edit/index.js';
import { ensureSingletonModal } from './ui/modal_singleton.js';
import { TOUCH_OPTIONS, createTouchLogEntry, formatTouchDate, touchSuccessMessage } from './util/touch_log.js';
import { toastError, toastSuccess } from './ui/toast_helpers.js';
import { ensureFavoriteState, renderFavoriteToggle } from './util/favorites.js';
import { acquireRouteLifecycleToken } from './ui/route_lifecycle.js';
import { clearSelectionForSurface } from './services/selection_reset.js';
import { REFERRAL_ROLLUP_RANGES, computeReferralRollup } from './reports/referrals.js';
import { openContactModal } from './contacts.js';

export function validatePartner(model){
  const source = model && typeof model === 'object' ? model : {};
  const name = typeof source.name === 'string' ? source.name.trim() : '';
  const errors = {};
  if(!name){
    errors.name = 'required';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

const STRAY_DIALOG_ALLOW = '[data-ui="merge-modal"],[data-ui="merge-confirm"],[data-ui="toast"]';

const referralRollupState = {
  initialized: false,
  root: null,
  range: '90d',
  contacts: [],
  partnersById: new Map(),
  deals: [],
  rangeSelect: null,
  countBtn: null,
  volumeBtn: null,
  empty: null,
  listenersBound: false
};

function formatNumber(value){
  const n = Number(value || 0);
  if(!Number.isFinite(n)) return '0';
  try{ return n.toLocaleString(); }
  catch(_err){ return String(n); }
}

function formatMoney(value){
  const n = Number(value || 0);
  if(!Number.isFinite(n) || n === 0) return '$0';
  try{ return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }
  catch(_err){ return `$${Math.round(n)}`; }
}

function formatDate(value){
  if(value == null) return '—';
  try{ return new Date(value).toISOString().slice(0, 10); }
  catch(_err){ return '—'; }
}

function partnerDisplayName(record, fallbackId){
  if(!record){
    return fallbackId ? `Partner ${fallbackId}` : '';
  }
  const preferred = String(record.name || '').trim();
  if(preferred) return preferred;
  const company = String(record.company || '').trim();
  if(company) return company;
  const email = String(record.email || '').trim();
  if(email) return email;
  const phone = String(record.phone || '').trim();
  if(phone) return phone;
  return fallbackId ? `Partner ${fallbackId}` : '';
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case '\'': return '&#39;';
      default: return ch;
    }
  });
}

function ensureReferralRollupCard(){
  if(typeof document === 'undefined') return;
  const card = document.querySelector('#view-partners .card');
  if(!card) return;
  let host = card.querySelector('#partner-referral-rollup');
  const rangeOptions = REFERRAL_ROLLUP_RANGES
    .map(range => `<option value="${escapeHtml(range.key)}"${range.key === referralRollupState.range ? ' selected' : ''}>${escapeHtml(range.label)}</option>`)
    .join('');
  if(!host){
    host = document.createElement('section');
    host.id = 'partner-referral-rollup';
    host.className = 'partner-referral-rollup';
    host.innerHTML = `
      <div class="row" style="align-items:center;gap:12px;margin-bottom:6px">
        <h4 style="margin:0;font-size:16px">Referral Performance</h4>
        <span class="grow"></span>
        <label class="muted" style="display:flex;align-items:center;gap:6px;font-size:12px">
          Range
          <select data-role="referral-range">${rangeOptions}</select>
        </label>
      </div>
      <div class="summary-metrics partner-referral-rollup-metrics">
        <button type="button" class="summary-metric" data-role="rollup-count">
          <span class="metric-label">Funded Referrals</span>
          <span class="metric-value">0</span>
        </button>
        <button type="button" class="summary-metric" data-role="rollup-volume">
          <span class="metric-label">Funded Volume</span>
          <span class="metric-value">$0</span>
        </button>
      </div>
      <div class="muted fine-print" data-role="rollup-empty" hidden>No funded referrals in this range.</div>`;
    const anchor = card.querySelector('.row.query-save-row');
    if(anchor && anchor.parentNode === card){
      card.insertBefore(host, anchor);
    }else{
      card.insertBefore(host, card.firstChild || null);
    }
  }
  referralRollupState.root = host;
  referralRollupState.rangeSelect = host.querySelector('[data-role="referral-range"]');
  referralRollupState.countBtn = host.querySelector('[data-role="rollup-count"]');
  referralRollupState.volumeBtn = host.querySelector('[data-role="rollup-volume"]');
  referralRollupState.empty = host.querySelector('[data-role="rollup-empty"]');
  if(referralRollupState.rangeSelect){
    referralRollupState.rangeSelect.value = referralRollupState.range;
    if(!referralRollupState.rangeSelect.__wired){
      referralRollupState.rangeSelect.__wired = true;
      referralRollupState.rangeSelect.addEventListener('change', ()=>{
        referralRollupState.range = referralRollupState.rangeSelect.value || referralRollupState.range;
        updateReferralRollup({ reload: false });
      });
    }
  }
  const openModal = (event)=>{
    if(event) event.preventDefault();
    openReferralRollupModal();
  };
  if(referralRollupState.countBtn && !referralRollupState.countBtn.__wired){
    referralRollupState.countBtn.__wired = true;
    referralRollupState.countBtn.addEventListener('click', openModal);
  }
  if(referralRollupState.volumeBtn && !referralRollupState.volumeBtn.__wired){
    referralRollupState.volumeBtn.__wired = true;
    referralRollupState.volumeBtn.addEventListener('click', openModal);
  }
  referralRollupState.initialized = true;
}

async function loadReferralSourceData(){
  try{
    if(typeof openDB === 'function'){
      await openDB();
    }
    const [contacts, partners] = await Promise.all([
      typeof dbGetAll === 'function' ? dbGetAll('contacts') : Promise.resolve([]),
      typeof dbGetAll === 'function' ? dbGetAll('partners') : Promise.resolve([])
    ]);
    referralRollupState.contacts = Array.isArray(contacts) ? contacts : [];
    const partnerEntries = Array.isArray(partners) ? partners.map(partner => [String(partner.id), partner]) : [];
    referralRollupState.partnersById = new Map(partnerEntries);
  }catch (err){
    console && console.warn && console.warn('[partners] referral rollup load failed', err);
  }
}

async function updateReferralRollup(options = {}){
  const opts = options && typeof options === 'object' ? options : {};
  ensureReferralRollupCard();
  if(!referralRollupState.root) return;
  if(opts.reload || !Array.isArray(referralRollupState.contacts) || !referralRollupState.contacts.length){
    await loadReferralSourceData();
  }
  const rangeKey = referralRollupState.rangeSelect ? referralRollupState.rangeSelect.value : referralRollupState.range;
  referralRollupState.range = rangeKey || referralRollupState.range;
  const rollup = computeReferralRollup(referralRollupState.contacts, referralRollupState.range, Date.now());
  referralRollupState.deals = rollup.deals.map(deal => {
    const partner = referralRollupState.partnersById.get(deal.partnerId);
    const partnerName = deal.partnerName || partnerDisplayName(partner, deal.partnerId);
    return Object.assign({}, deal, {
      partnerName,
      fundedDateLabel: deal.fundedDateLabel || (deal.fundedAt != null ? formatDate(deal.fundedAt) : ''),
      contactName: deal.contactName
    });
  });
  const fundedCount = rollup.fundedCount || 0;
  const fundedVolume = rollup.fundedVolume || 0;
  if(referralRollupState.countBtn){
    const valueNode = referralRollupState.countBtn.querySelector('.metric-value');
    if(valueNode) valueNode.textContent = formatNumber(fundedCount);
  }
  if(referralRollupState.volumeBtn){
    const valueNode = referralRollupState.volumeBtn.querySelector('.metric-value');
    if(valueNode) valueNode.textContent = formatMoney(fundedVolume);
  }
  if(referralRollupState.empty){
    referralRollupState.empty.hidden = fundedCount > 0;
  }
}

function bindReferralRollupListeners(){
  if(referralRollupState.listenersBound || typeof document === 'undefined') return;
  const handler = (event)=>{
    const detail = event && event.detail ? event.detail : {};
    const scope = typeof detail.scope === 'string' ? detail.scope : '';
    if(scope && scope !== 'contacts' && scope !== 'partners') return;
    updateReferralRollup({ reload: true });
  };
  document.addEventListener('app:data:changed', handler, { passive: true });
  referralRollupState.listenersBound = true;
}

async function openReferralRollupModal(){
  ensureReferralRollupCard();
  if(!referralRollupState.initialized){
    await updateReferralRollup({ reload: true });
  }
  const rangeMeta = REFERRAL_ROLLUP_RANGES.find(range => range.key === referralRollupState.range) || REFERRAL_ROLLUP_RANGES[0];
  let root = ensureSingletonModal('partner-referral-rollup-drill', () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'referral-rollup-modal';
    dialog.innerHTML = `
      <div class="dlg referral-rollup-shell">
        <div class="modal-header" style="display:flex;align-items:center;gap:12px">
          <h3 class="grow" data-role="rollup-heading">Funded Referrals</h3>
          <button type="button" class="btn ghost" data-role="close">Close</button>
        </div>
        <div class="dialog-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Partner</th>
                <th>Stage</th>
                <th>Loan Amount</th>
                <th>Funded</th>
              </tr>
            </thead>
            <tbody data-role="rollup-body"></tbody>
          </table>
          <div class="muted empty" data-role="rollup-empty" hidden>No funded referrals in this range.</div>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    try{ dialog.showModal(); }
    catch(_err){ dialog.setAttribute('open', 'open'); }
    const closeBtn = dialog.querySelector('[data-role="close"]');
    if(closeBtn){
      closeBtn.addEventListener('click', (event)=>{
        event.preventDefault();
        try{ dialog.close(); }
        catch(_err){ dialog.removeAttribute('open'); }
      });
    }
    dialog.addEventListener('close', ()=>{
      try{ dialog.remove(); }
      catch(_err){}
    }, { once: true });
    dialog.addEventListener('click', (event)=>{
      const row = event.target?.closest?.('tr[data-contact-id]');
      if(!row) return;
      event.preventDefault();
      const contactId = row.getAttribute('data-contact-id') || '';
      if(!contactId) return;
      openContactModal(contactId, { sourceHint: 'partners:referral-rollup', trigger: row });
    });
    return dialog;
  });
  root = await Promise.resolve(root);
  if(!root) return;
  const heading = root.querySelector('[data-role="rollup-heading"]');
  if(heading) heading.textContent = `Funded Referrals — ${rangeMeta.label}`;
  const tbody = root.querySelector('[data-role="rollup-body"]');
  const empty = root.querySelector('[data-role="rollup-empty"]');
  if(!tbody) return;
  if(!referralRollupState.deals.length){
    tbody.innerHTML = '';
    if(empty) empty.hidden = false;
    return;
  }
  const rows = referralRollupState.deals.map(deal => {
    const stageLabel = String(deal.stage || '').trim() || 'Funded';
    const amountLabel = formatMoney(deal.loanAmount);
    const fundedLabel = deal.fundedDateLabel || (deal.fundedAt != null ? formatDate(deal.fundedAt) : '—');
    return `<tr data-contact-id="${escapeHtml(deal.id)}"><td>${escapeHtml(deal.contactName)}</td><td>${escapeHtml(deal.partnerName || '')}</td><td>${escapeHtml(stageLabel)}</td><td>${escapeHtml(amountLabel)}</td><td>${escapeHtml(fundedLabel)}</td></tr>`;
  }).join('');
  tbody.innerHTML = rows;
  if(empty) empty.hidden = true;
}

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

  const ROW_BIND_ONCE = (typeof window !== 'undefined'
    ? (window.__ROW_BIND_ONCE__ = window.__ROW_BIND_ONCE__ || {})
    : {});

  function getPartnerRowState(){
    const state = ROW_BIND_ONCE.partners || (ROW_BIND_ONCE.partners = {});
    if(!state.watchers) state.watchers = [];
    if(!state.surface) state.surface = 'partners';
    return state;
  }

  const schedulePartnerTask = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (fn) => {
      try {
        if(typeof Promise === 'function'){ Promise.resolve().then(() => fn()).catch(() => {}); return; }
      } catch (_) {}
      try { fn(); }
      catch (_) {}
    };

  function clearPartnerSelection(table){
    clearSelectionForSurface('partners', { reason: 'partners:row-open' });
    if(!table || typeof table.querySelectorAll !== 'function') return;
    table.querySelectorAll('[data-ui="row-check"]').forEach((node) => {
      try {
        if(node.checked) node.checked = false;
      } catch (_err){}
    });
    table.querySelectorAll('[data-selected="1"]').forEach((row) => {
      try { row.removeAttribute('data-selected'); }
      catch (_err){}
    });
  }

  function detachPartnerHandler(state){
    if(state.root && state.handler){
      try { state.root.removeEventListener('click', state.handler); }
      catch (_err){}
    }
    state.root = null;
    state.handler = null;
    state.bound = false;
  }

  function bindPartnerRow(){
    const state = getPartnerRowState();
    if(!state.active) return;
    if(typeof document === 'undefined') return;
    const table = document.getElementById('tbl-partners');
    if(!table){
      detachPartnerHandler(state);
      return;
    }
    if(state.root === table && state.bound) return;
    detachPartnerHandler(state);
    const handler = (event) => {
      if(!event || event.__crmRowEditorHandled || event.__partnerEditHandled) return;
      const skip = event.target?.closest?.('[data-ui="row-check"],[data-role="favorite-toggle"],[data-role="partner-actions"]');
      if(skip) return;
      const control = event.target?.closest?.('button,[role="button"],input,select,textarea,label');
      if(control) return;
      const anchor = event.target?.closest?.('a');
      if(anchor && !anchor.closest('a.partner-name,[data-ui="partner-name"],[data-role="partner-name"]')) return;
      const row = event.target?.closest?.('tr[data-partner-id],tr[data-id]');
      if(!row || !table.contains(row)) return;
      const partnerId = row.getAttribute('data-partner-id') || row.getAttribute('data-id') || '';
      if(!partnerId) return;
      event.preventDefault();
      event.stopPropagation();
      event.__crmRowEditorHandled = true;
      event.__partnerEditHandled = true;
      clearPartnerSelection(table);
      try {
        openPartnerEditModal(partnerId, { sourceHint: 'partners:list-row', trigger: row });
      } catch (err) {
        try { console && console.warn && console.warn('[partners] row open failed', err); }
        catch (_warn){}
      }
    };
    table.addEventListener('click', handler);
    state.root = table;
    state.handler = handler;
    state.bound = true;
    state.surface = 'partners';
  }

  function schedulePartnerBind(){
    const state = getPartnerRowState();
    if(!state.active) return;
    if(state.pendingBind) return;
    state.pendingBind = true;
    schedulePartnerTask(() => {
      state.pendingBind = false;
      if(!state.active){
        detachPartnerHandler(state);
        return;
      }
      bindPartnerRow();
    });
  }

  function ensurePartnerDomReady(state){
    if(typeof document === 'undefined') return;
    if(document.readyState === 'loading'){
      if(state.domReadyListener) return;
      const onReady = () => {
        state.domReadyListener = null;
        if(state.active) schedulePartnerBind();
      };
      try {
        document.addEventListener('DOMContentLoaded', onReady, { once: true });
      } catch (_) {
        document.addEventListener('DOMContentLoaded', onReady);
      }
      state.domReadyListener = onReady;
    }
  }

  function attachPartnerWatchers(state){
    if(state.watchersAttached) return;
    const doc = typeof document !== 'undefined' ? document : null;
    const listeners = [];
    const rebinder = state.rebinder || (state.rebinder = () => schedulePartnerBind());
    const defs = [
      { target: doc, type: 'app:data:changed' },
      { target: doc, type: 'partners:list:refresh' }
    ];
    for(const def of defs){
      const { target, type } = def;
      if(target && typeof target.addEventListener === 'function'){
        try {
          target.addEventListener(type, rebinder);
          listeners.push({ target, type, listener: rebinder });
        } catch (_err){}
      }
    }
    state.watchers = listeners;
    state.watchersAttached = true;
  }

  function detachPartnerWatchers(state){
    if(!state.watchersAttached) return;
    for(const entry of state.watchers || []){
      try { entry.target.removeEventListener(entry.type, entry.listener); }
      catch (_err){}
    }
    state.watchers = [];
    state.watchersAttached = false;
  }

  function mountPartnerRowGateway(){
    if(typeof document === 'undefined') return;
    const state = getPartnerRowState();
    if(!state.active){
      state.active = true;
      state.surface = 'partners';
    }
    attachPartnerWatchers(state);
  ensurePartnerDomReady(state);
  schedulePartnerBind();

  bindReferralRollupListeners();
  if (typeof document !== 'undefined'){
    const onReady = () => {
      ensureReferralRollupCard();
      updateReferralRollup({ reload: true });
    };
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', onReady, { once: true });
    }else{
      onReady();
    }
  }else{
    ensureReferralRollupCard();
    updateReferralRollup({ reload: true });
  }
}

  function unmountPartnerRowGateway(){
    const state = getPartnerRowState();
    state.active = false;
    if(state.domReadyListener && typeof document !== 'undefined'){
      try { document.removeEventListener('DOMContentLoaded', state.domReadyListener); }
      catch (_err){}
    }
    state.domReadyListener = null;
    detachPartnerWatchers(state);
    detachPartnerHandler(state);
    state.pendingBind = false;
  }

  if(typeof window !== 'undefined' || typeof document !== 'undefined'){
    const state = getPartnerRowState();
    state.routeToken = acquireRouteLifecycleToken('partners', {
      mount: () => mountPartnerRowGateway(),
      unmount: () => unmountPartnerRowGateway()
    });
  }

  if (ctx && ctx.logger && typeof ctx.logger.log === 'function'){
    ctx.logger.log('[partners] bootstrapped');
  }

  return true;
}

ensurePartnersBoot();

function ensureFullPartnerButton(){
  if(typeof document === 'undefined') return;
  const header = document.querySelector('#view-partners .card > .row');
  if(!header) return;
  if(header.querySelector('[data-qa="new-partner-full"]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn brand';
  button.dataset.qa = 'new-partner-full';
  button.textContent = 'Open Full Partner Editor';
  button.addEventListener('click', (event) => {
    if(event) event.preventDefault();
    try{
      openPartnerEditModal('', { allowAutoOpen: true, sourceHint: 'partners:full-editor' });
    }catch (err){
      try{ console && console.warn && console.warn('[partners] full editor launch failed', err); }
      catch(_warnErr){}
    }
  });
  const filters = header.querySelector('#btn-filters-partners');
  if(filters && filters.parentNode === header){
    header.insertBefore(button, filters);
  }else{
    const grow = header.querySelector('.grow');
    if(grow && grow.parentNode === header){
      header.insertBefore(button, grow.nextSibling);
    }else{
      header.appendChild(button);
    }
  }
}

if(typeof document !== 'undefined'){
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ensureFullPartnerButton, { once: true });
  }else{
    ensureFullPartnerButton();
  }
}

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
