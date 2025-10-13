// partners.js — partner modal wiring & selection helpers
import { debounce } from './patch_2025-10-02_baseline_ux_cleanup.js';
import { openPartnerEdit } from './partners_modal.js';

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

  function ensurePartnerRowAttributes(){
    if (typeof document === 'undefined') return;
    const table = document.getElementById('tbl-partners');
    if (!table) return;
    const sections = table.tBodies && table.tBodies.length
      ? Array.from(table.tBodies)
      : [table];
    sections.forEach(section => {
      if (!section || typeof section.querySelectorAll !== 'function') return;
      section.querySelectorAll('tr').forEach(row => {
        if (!row || row.nodeType !== 1) return;
        const dataset = row.dataset || {};
        const id = row.getAttribute('data-id')
          || dataset.id
          || row.getAttribute('data-partner-id')
          || dataset.partnerId
          || '';
        if (id) {
          const normalized = String(id).trim();
          row.setAttribute('data-id', normalized);
          row.setAttribute('data-partner-id', normalized);
          if (row.dataset) {
            row.dataset.id = normalized;
            row.dataset.partnerId = normalized;
          }
        }
        row.setAttribute('data-qa', 'partner-row');
      });
    });
  }

  function handlePartnerRowClick(evt){
    const table = evt.currentTarget;
    const target = evt && evt.target ? evt.target : null;
    if (!table || !target || typeof target.closest !== 'function') return;
    const ignore = target.closest('input, textarea, select, button, [data-role="select"], [data-ui="row-check"]');
    if (ignore) return;
    const row = target.closest('tr[data-id]');
    if (!row || !table.contains(row)) return;
    ensurePartnerRowAttributes();
    const id = row.getAttribute('data-id');
    if (!id) return;
    const link = target.closest('a');
    if (link) {
      evt.preventDefault();
      evt.stopPropagation();
    }
    try {
      const result = openPartnerEdit(String(id).trim());
      if (result && typeof result.catch === 'function') {
        result.catch(err => {
          try {
            console && console.warn && console.warn('partner row open failed', err);
          } catch (_err) {}
        });
      }
    } catch (err) {
      try {
        console && console.warn && console.warn('partner row open error', err);
      } catch (_err) {}
    }
  }

  function wirePartnerRowClicks(){
    if (typeof document === 'undefined') return;
    const table = document.getElementById('tbl-partners');
    if (!table) return;
    ensurePartnerRowAttributes();
    const globalCRM = window.CRM = window.CRM || {};
    if (globalCRM._partnersRowBound) return;
    table.addEventListener('click', handlePartnerRowClick);
    globalCRM._partnersRowBound = true;
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
  wirePartnerRowClicks();
  if (typeof document !== 'undefined'){
    document.addEventListener('DOMContentLoaded', wireFilter);
    document.addEventListener('DOMContentLoaded', () => {
      ensurePartnerRowAttributes();
      wirePartnerRowClicks();
    });
    document.addEventListener('app:data:changed', () => {
      const input = document.querySelector('#view-partners input[data-table-search="#tbl-partners"], #view-partners input[data-role="partner-search"]');
      if (input && input.value){
        applyFilter(input.value);
      }
      ensurePartnerRowAttributes();
      wirePartnerRowClicks();
    }, { passive: true });
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
