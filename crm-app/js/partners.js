// partners.js — partner modal wiring & selection helpers
import { debounce } from './patch_2025-10-02_baseline_ux_cleanup.js';

function ensurePartnersBoot(ctx){
  if (!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if (window.__INIT_FLAGS__.partners_plus) return false;
  window.__INIT_FLAGS__.partners_plus = true;

  function $$(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

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
  bindPartnerRowClicks();
  if (typeof document !== 'undefined'){
    document.addEventListener('DOMContentLoaded', wireFilter);
    document.addEventListener('DOMContentLoaded', bindPartnerRowClicks);
    document.addEventListener('app:data:changed', () => {
      const input = document.querySelector('#view-partners input[data-table-search="#tbl-partners"], #view-partners input[data-role="partner-search"]');
      if (input && input.value){
        applyFilter(input.value);
      }
      normalizePartnerRows();
    }, { passive: true });
    document.addEventListener('partners:list:refresh', () => {
      normalizePartnerRows();
      bindPartnerRowClicks();
    });
  }

  function normalizePartnerRows(){
    if (typeof document === 'undefined') return;
    const table = document.getElementById('tbl-partners');
    if (!table || !table.tBodies || !table.tBodies[0]) return;
    table.tBodies[0].querySelectorAll('tr').forEach(row => {
      const dataset = row.dataset || {};
      const rawId = dataset.id || dataset.partnerId || row.getAttribute('data-partner-id');
      if (!rawId) return;
      const normalized = String(rawId).trim();
      if (!normalized) return;
      if (dataset){
        row.dataset.id = normalized;
        if (!row.dataset.partnerId) row.dataset.partnerId = normalized;
      }
      row.setAttribute('data-id', normalized);
      if (!row.getAttribute('data-partner-id')){
        row.setAttribute('data-partner-id', normalized);
      }
    });
  }

  function requestPartnerModal(partnerId){
    if (typeof window.renderPartnerModal === 'function'){
      return window.renderPartnerModal(partnerId);
    }
    const queue = window.__PARTNER_MODAL_QUEUE__ = window.__PARTNER_MODAL_QUEUE__ || [];
    queue.push(partnerId);
    return Promise.resolve();
  }

  window.requestPartnerModal = requestPartnerModal;
  window.openPartnerEdit = (id) => requestPartnerModal(id);

  function bindPartnerRowClicks(){
    if (typeof document === 'undefined') return;
    const tbody = document.querySelector('#tbl-partners tbody');
    if (!tbody || tbody.__partnerRowClicksWired) return;
    normalizePartnerRows();
    tbody.__partnerRowClicksWired = true;
    tbody.addEventListener('click', evt => {
      if (evt.defaultPrevented) return;
      const interactive = evt.target && typeof evt.target.closest === 'function'
        ? evt.target.closest('button, a, input, select, textarea, label, [role="button"], [data-role="select"]')
        : null;
      if (interactive && tbody.contains(interactive)) return;
      const row = evt.target && typeof evt.target.closest === 'function'
        ? evt.target.closest('tr[data-id]')
        : null;
      if (!row || !tbody.contains(row)) return;
      const id = row.getAttribute('data-id');
      if (!id) return;
      try {
        const result = window.openPartnerEdit ? window.openPartnerEdit(id) : requestPartnerModal(id);
        if (result && typeof result.catch === 'function'){
          result.catch(err => {
            try { console && console.warn && console.warn('openPartnerEdit failed', err); }
            catch (_err){}
          });
        }
      } catch (err) {
        try { console && console.warn && console.warn('openPartnerEdit error', err); }
        catch (_err){}
      }
    });
  }

  const addBtn = document.getElementById('btn-add-partner');
  if (addBtn && !addBtn.__wired){
    addBtn.__wired = true;
    addBtn.addEventListener('click', async () => {
      await requestPartnerModal();
    });
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
    console.error('[partners.init]', e);
  }
}
