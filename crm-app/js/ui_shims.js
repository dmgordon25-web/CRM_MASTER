
// === ui_shims.js : common UI helpers + fallback modals (QA 2025-09-17) ===
(function(){
  try{
    window.__INIT_FLAGS__ = window.__INIT_FLAGS__ || {};
    if (window.__INIT_FLAGS__.ui_shims_v20250917) return;
    window.__INIT_FLAGS__.ui_shims_v20250917 = true;

    function el(html){
      const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild;
    }
    function modal(title, contentHTML){
      let m = document.getElementById('app-modal');
      if(!m){
        m = el(`<div id="app-modal" class="modal hidden">
                  <div class="modal-backdrop"></div>
                  <div class="modal-card">
                    <div class="modal-head"><h3></h3><button class="btn btn-small" id="modal-close">✕</button></div>
                    <div class="modal-body"></div>
                    <div class="modal-foot"></div>
                  </div>
                </div>`);
        document.body.appendChild(m);
        m.querySelector('#modal-close').addEventListener('click', ()=> m.classList.add('hidden'));
        m.addEventListener('click', (e)=>{ if(e.target.classList.contains('modal-backdrop')) m.classList.add('hidden'); });
      }
      m.querySelector('.modal-head h3').textContent = title || '';
      m.querySelector('.modal-body').innerHTML = contentHTML || '';
      const foot = m.querySelector('.modal-foot'); foot.innerHTML = '';
      m.classList.remove('hidden');
      return { root:m, foot };
    }

    // Minimal styles if not present
    const MODAL_SHIM_STYLE_ID = 'modal-shim-css';
    const MODAL_SHIM_STYLE_ORIGIN = 'crm:ui:modal-shim';
    const MODAL_SHIM_STYLE_TEXT = `
      .hidden{ display:none !important; }
      .modal{ position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:9999; }
      .modal-backdrop{ position:absolute; inset:0; background:rgba(0,0,0,.35); }
      .modal-card{ position:relative; background:#fff; width:min(720px, 92vw); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.2); display:flex; flex-direction:column; max-height:86vh; }
      .modal-head{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(0,0,0,.08); }
      .modal-body{ padding:12px 16px; overflow:auto; }
      .modal-foot{ display:flex; gap:8px; justify-content:flex-end; padding:12px 16px; border-top:1px solid rgba(0,0,0,.08); }
      .row{ display:flex; gap:8px; align-items:center; }
      .col{ display:flex; flex-direction:column; gap:6px; }
      .grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .grid-3{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
      input, select, textarea{ width:100%; padding:8px 10px; border:1px solid rgba(0,0,0,.15); border-radius:8px; }
      .btn{ padding:8px 12px; border:1px solid rgba(0,0,0,.2); border-radius:10px; background:#fff; cursor:pointer; }
      .btn-primary{ background:#0b5cff; color:#fff; border-color:#0b5cff; }
      .muted{ opacity:.7; }
      `;
    if(!document.getElementById(MODAL_SHIM_STYLE_ID)){
      const head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
      if(head && typeof head.appendChild === 'function'){
        let css = typeof document.querySelector === 'function' ? document.querySelector(`style[data-origin="${MODAL_SHIM_STYLE_ORIGIN}"]`) : null;
        if(!css){
          css = document.createElement('style');
          css.id = MODAL_SHIM_STYLE_ID;
          css.setAttribute('data-origin', MODAL_SHIM_STYLE_ORIGIN);
          head.appendChild(css);
        }else if(css.getAttribute && css.getAttribute('data-origin') !== MODAL_SHIM_STYLE_ORIGIN){
          try{ css.setAttribute('data-origin', MODAL_SHIM_STYLE_ORIGIN); }
          catch(_err){}
        }
        if(css && css.textContent !== MODAL_SHIM_STYLE_TEXT){
          css.textContent = MODAL_SHIM_STYLE_TEXT;
        }
      }
    }

    // Ensure None partner exists (deterministic)
    async function ensureNonePartner(){
      try{
        await openDB();
        const all = await dbGetAll('partners');
        const id = 'partner-none';
        const exists = all.find(p=>p.id===id) || all.find(p=>/^none$/i.test(p.name||''));
        if(!exists){
          await dbPut('partners', { id, name:'None', bps:0, createdAt: new Date().toISOString() });
        }
        return id;
      }catch (e) { console && console.warn && console.warn('ensureNonePartner failed', e); return 'partner-none'; }
    }

    // Add Contact fallback
    async function openAddContact(){
      const noneId = await ensureNonePartner();
      const partners = await dbGetAll('partners');
      const options = partners.map(p=> `<option value="${p.id}">${p.name}</option>`).join('');
      const body = `
        <div class="grid-2">
          <div class="col"><label>First</label><input id="ac-first"></div>
          <div class="col"><label>Last</label><input id="ac-last"></div>
          <div class="col"><label>Email</label><input id="ac-email" type="email"></div>
          <div class="col"><label>Phone</label><input id="ac-phone"></div>
          <div class="col"><label>Loan Type</label>
            <select id="ac-loan"><option value="">—</option><option>FHA</option><option>VA</option><option>Conventional</option><option>Jumbo</option></select>
          </div>
          <div class="col"><label>Amount</label><input id="ac-amt" type="number" step="1" min="0"></div>
          <div class="col"><label>Due / Follow-up</label><input id="ac-due" type="date"></div>
          <div class="col"><label>Partner</label><select id="ac-partner">${options}</select></div>
        </div>
        <div class="col"><label>Notes</label><textarea id="ac-notes" rows="3"></textarea></div>
      `;
      const {root,foot} = modal('Add Contact', body);
      const save = el('<button class="btn btn-primary">Save</button>');
      const cancel = el('<button class="btn">Cancel</button>');
      cancel.addEventListener('click', ()=> root.classList.add('hidden'));
      save.addEventListener('click', async ()=>{
        try{
          await openDB();
          const c = {
            id: crypto.randomUUID(),
            first: document.getElementById('ac-first').value.trim(),
            last: document.getElementById('ac-last').value.trim(),
            email: document.getElementById('ac-email').value.trim(),
            phone: document.getElementById('ac-phone').value.trim(),
            loanType: document.getElementById('ac-loan').value.trim(),
            amount: Number(document.getElementById('ac-amt').value||0),
            due: document.getElementById('ac-due').value || null,
            partnerId: document.getElementById('ac-partner').value || noneId,
            notes: document.getElementById('ac-notes').value.trim(),
            status: 'IN_PROGRESS',
            createdAt: new Date().toISOString()
          };
          await dbPut('contacts', c);
          root.classList.add('hidden');
          const contactId = c && c.id ? String(c.id) : '';
          const detail = {
            scope: 'contacts',
            action: 'create',
            reason: 'ui-shims:add-contact',
            ids: contactId ? [contactId] : undefined,
            contactId
          };
          document.dispatchEvent(new CustomEvent('app:data:changed', { detail }));
          if (typeof renderAll === 'function') try { await renderAll(); } catch (_) {}
        }catch (e) { console && console.warn && console.warn('[soft] Add contact failed', e); }
      });
      foot.appendChild(cancel); foot.appendChild(save);
    }

    // Partner edit shim — forward to canonical modal
    async function openEditPartner(id, context){
      const partnerId = id == null ? '' : String(id).trim();
      if(!partnerId) return null;

      const trigger = context && context.trigger ? context.trigger : null;
      const event = context && context.event ? context.event : null;
      const openModal = typeof window.openPartnerEdit === 'function'
        ? window.openPartnerEdit
        : (typeof window.openPartnerEditModal === 'function' ? window.openPartnerEditModal : null);

      if(openModal){
        const options = { sourceHint: 'ui-shims:edit-partner' };
        if(trigger) options.trigger = trigger;
        if(event) options.event = event;
        try{
          const result = openModal.call(window, partnerId, options);
          return typeof result?.then === 'function' ? await result : result;
        }catch (err){
          try{ console && console.warn && console.warn('[soft] openPartnerEditModal failed', err); }
          catch(_warnErr){}
        }
      }

      try{ console && console.warn && console.warn('[soft] Partner editor unavailable', { id: partnerId }); }
      catch(_err){}
      if(typeof window.toast === 'function'){
        try{ window.toast('Partner editor unavailable'); }
        catch(_toastErr){}
      }
      return null;
    }

    // Wire header buttons if present
    function wireHeader(){
      const addBtn = Array.from(document.querySelectorAll('button, a')).find(el => /add contact/i.test(el.textContent||''));
      if(addBtn && !addBtn.__wired){ addBtn.__wired = true; addBtn.addEventListener('click', (e)=>{ e.preventDefault(); openAddContact(); }); }
    }
    document.addEventListener('DOMContentLoaded', wireHeader);

    // Expose for other modules
    window.uiShims = { openAddContact, openEditPartner };
    // Delegate for partner edit buttons if any table uses [data-edit-partner]
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-edit-partner]');
      if(!btn) return;
      const id = btn.getAttribute('data-edit-partner');
      if(!id) return;
      if(typeof e.preventDefault === 'function') e.preventDefault();
      if(typeof e.stopPropagation === 'function') e.stopPropagation();
      if(typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      e.__partnerEditHandled = true;
      openEditPartner(id, { trigger: btn, event: e });
    });

  }catch (e) { try{ console.warn('[soft] ui_shims error', e); }catch (_u) {} }
})();
