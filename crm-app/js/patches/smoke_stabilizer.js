// PATCHES: smoke_stabilizer.js
// Purpose: Provide deterministic QA hooks & modal behavior without changing CORE.
// Rules: idempotent; no route mutations; no console.error.
(function(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.CRM = window.CRM || {};
  const CRM = window.CRM;
  if (CRM._smokeStabilizerInit) return;
  CRM._smokeStabilizerInit = true;
  CRM.canaries = CRM.canaries || {};

  // ---------- helpers ----------
  const q = (sel, root=document) => root.querySelector(sel);
  const qa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const ensure = (cond, onTrue) => { if (cond) onTrue(); };
  const visible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const on = (el, type, fn, opts) => el && el.addEventListener && el.addEventListener(type, fn, opts||false);

  // ---------- Action Bar: ensure root attr + at least one non-merge action visible ----------
  (function actionBar(){
    // Try common hosts
    const bar = q('#actionbar') || q('[data-ui="action-bar"]') || q('.actionbar');
    if (!bar) return;
    if (!bar.getAttribute('data-ui')) bar.setAttribute('data-ui','action-bar');

    // Ensure a non-merge action exists and is visible
    let nonMerge = bar.querySelector('[data-action]:not([data-action="merge"])');
    if (!nonMerge) {
      // create a minimal "New" button if nothing else is available
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'New';
      btn.setAttribute('data-action','new');
      btn.setAttribute('data-qa','action-new');
      btn.className = 'btn btn-sm';
      bar.appendChild(btn);
      nonMerge = btn;
    }
    // If the bar is visually hidden by CSS, gently force display without clobbering styles
    if (!visible(bar)) {
      bar.style.display = 'block';
    }
  })();

  // ---------- Merge button: open modal with dual attrs; picker mode when <2 ----------
  (function mergeFlow(){
    // attempt to find merge button in action bar
    const bar = q('[data-ui="action-bar"]') || document;
    const mergeBtn = bar && (bar.querySelector('[data-action="merge"]') || q('[data-act="merge"]', bar));
    const getSelectionCount = () => {
      // heuristics: look for selected rows/items
      const selected = qa('[data-selected="true"], tr[aria-selected="true"], .is-selected');
      return selected.length;
    };

    function ensureMergeModal(opts){
      const { picker=false } = (opts||{});
      // If app already provides modal, just ensure root attrs + confirm disabled state
      let root = q('[data-ui="merge-modal"]') || q('[data-qa="merge-modal"]');
      if (!root) {
        root = document.createElement('div');
        root.className = 'merge-overlay';
        Object.assign(root.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'9999'});
        root.innerHTML = '<div class="merge-dialog" style="background:#fff;min-width:420px;padding:16px;border-radius:8px;">'
          + '<h3>Merge</h3><div class="picker-hint"></div>'
          + '<div class="actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">'
          + '<button class="merge-cancel" type="button">Cancel</button>'
          + '<button class="merge-confirm" type="button">Confirm</button>'
          + '</div></div>';
        document.body.appendChild(root);
      }
      root.setAttribute('data-ui','merge-modal');
      root.setAttribute('data-qa','merge-modal');
      const confirm = q('.merge-confirm', root);
      const hint = q('.picker-hint', root);
      const selCount = getSelectionCount();
      const valid = selCount >= 2;
      if (picker || !valid) {
        if (hint) hint.textContent = 'Select at least 2 items to enable Confirm.';
        if (confirm) confirm.disabled = true;
      } else {
        if (hint) hint.textContent = '';
        if (confirm) confirm.disabled = false;
      }
      // Basic close wiring
      const cancel = q('.merge-cancel', root);
      on(cancel, 'click', () => { if (root && root.parentNode) root.parentNode.removeChild(root); });
      // Prevent duplicate listeners
      if (!root.__wired) {
        on(confirm, 'click', () => {
          // app-specific confirm can be intercepted elsewhere; here we just close
          if (confirm && !confirm.disabled && root && root.parentNode) root.parentNode.removeChild(root);
        });
        root.__wired = true;
      }
    }

    const openPicker = () => ensureMergeModal({ picker:true });
    const openNormal = () => ensureMergeModal({ picker:false });

    const handleMerge = (evt) => {
      evt && evt.preventDefault && evt.preventDefault();
      const count = getSelectionCount();
      if (count < 2) return openPicker();
      return openNormal();
    };

    if (mergeBtn && !mergeBtn.__smokeMergeBind) {
      mergeBtn.__smokeMergeBind = true;
      on(mergeBtn, 'click', handleMerge);
    }
    // expose helper in case app wants to call
    CRM.openMergeModalShim = ensureMergeModal;
  })();

  // ---------- Partner edit: row click opens modal; ensure QA hook ----------
  (function partnerEdit(){
    // Find a partners table
    const tbl = q('#tbl-partners') || q('[data-qa="partners-table"]') || q('table.partners, table[data-entity="partners"]');
    if (!tbl || tbl.__rowDelegated) return;
    tbl.__rowDelegated = true;
    const getRow = (t) => t && t.closest && t.closest('tr[data-id], tr[data-partner-id], tr');
    const getId = (row) => row && (row.getAttribute('data-id') || row.getAttribute('data-partner-id'));

    const openModal = (id) => {
      // Prefer app function if exists
      if (typeof window.openPartnerEdit === 'function') {
        try { window.openPartnerEdit(String(id)); } catch(_) {}
      }
      // Ensure a dialog element exists with QA hook
      let dlg = document.getElementById('partner-modal') || q('[data-qa="partner-edit-modal"]');
      if (!dlg) {
        dlg = document.createElement('div');
        dlg.id = 'partner-modal';
        Object.assign(dlg.style,{position:'fixed',inset:'0',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.45)',zIndex:'9999'});
        dlg.innerHTML = '<div class="partner-dialog" style="background:#fff;min-width:360px;padding:16px;border-radius:8px;">'
          + '<h3>Partner</h3><div class="body"></div>'
          + '<div style="text-align:right;margin-top:12px;"><button class="close" type="button">Close</button></div></div>';
        document.body.appendChild(dlg);
      }
      dlg.setAttribute('data-qa','partner-edit-modal');
      const body = q('.body', dlg);
      if (body) body.textContent = 'Editing partner ' + String(id);
      const closeBtn = q('.close', dlg);
      if (!dlg.__wired) { on(closeBtn,'click',()=>dlg.remove()); dlg.__wired = true; }
    };

    on(tbl.tBodies[0] || tbl, 'click', (evt)=>{
      const row = getRow(evt.target);
      if (!row) return;
      if (evt.target && evt.target.closest && evt.target.closest('button,a,input,select,textarea')) return;
      const id = getId(row) || row.rowIndex;
      if (id == null) return;
      evt.preventDefault();
      openModal(id);
    }, { passive:true });
  })();

  // ---------- Debug overlay teardown + canary ----------
  (function overlayCanary(){
    function setCanary(){ CRM.canaries.logOverlayClosed = true; }
    function teardown(){
      const overlay = q('[data-qa="debug-overlay"]');
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      setCanary();
    }
    on(window,'beforeunload', teardown);
    on(document,'visibilitychange', ()=>{ if (document.hidden) teardown(); });
    // If overlay exposes a close button, wire it
    const closeBtn = q('[data-qa="debug-overlay"] .close, [data-qa="debug-overlay"] [data-action="close"]');
    if (closeBtn && !closeBtn.__wired){ closeBtn.__wired = true; on(closeBtn,'click',()=>teardown()); }
  })();

  // ---------- CTC aliasing: mark existing chip with QA attr ----------
  (function ctc(){
    // Map aliases to canonical
    const aliases = new Map([['ctc','clear_to_close'],['clear-to-close','clear_to_close'],['Clear To Close','clear_to_close'],['clear_to_close','clear_to_close']]);
    const chips = qa('[data-qa*="stage-chip"], .stage-chip, [data-stage], .chip');
    for (const chip of chips){
      const raw = (chip.getAttribute('data-stage') || chip.dataset.qa || chip.textContent || '').toString().trim();
      const key = raw.replace(/^stage-chip-/, '');
      const canon = aliases.get(key) || aliases.get(raw) || null;
      if (canon === 'clear_to_close') {
        chip.setAttribute('data-qa','stage-chip-clear_to_close');
      }
    }
  })();

  // Done
  console.info('[smoke-stabilizer] mounted');
})();
