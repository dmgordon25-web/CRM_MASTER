// utils.js
window.$ = (sel, root=document) => root.querySelector(sel);
window.$all = (sel, root=document) => Array.from(root.querySelectorAll(sel));
window.toast = (input, opts) => {
  const hasToastApi = window.Toast && typeof window.Toast.show === 'function';
  if(hasToastApi){
    if(input && typeof input === 'object' && !Array.isArray(input)){
      const payload = Object.assign({}, input);
      const message = 'message' in payload ? payload.message : '';
      delete payload.message;
      window.Toast.show(message, payload);
      return;
    }
    window.Toast.show(input, opts);
    return;
  }
  const payload = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
  const message = typeof input === 'string' ? input : String(payload.message || '');
  if(!message){ return; }
  const t = $('#toast');
  if(!t){
    if(typeof alert === 'function') alert(message);
    return;
  }
  t.textContent = message;
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), Number(payload.duration)||2000);
};
window.money = (n) => {
  const v = Number(n||0);
  return v.toLocaleString(undefined, {style:'currency', currency:'USD', maximumFractionDigits:0});
};
window.fullName = (c) => [c.first||'', c.last||''].filter(Boolean).join(' ').trim();
window.lc = (s) => String(s||'').toLowerCase();
window.uuid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);


// --- Shims (safe no-ops if modules haven't loaded yet) ---
// Provide a temporary renderContactModal to avoid early load errors; the real one will overwrite this.
if (typeof window.renderContactModal !== 'function') {
  window.renderContactModal = async function(id){ console.warn('renderContactModal shim invoked; module will overwrite when ready.', id); };
}

if (typeof window.openQuickAddCompat !== 'function') {
  window.openQuickAddCompat = (function(){
    let shimDialog = null;
    let wired = false;

    function ensureShimDialog(){
      if (typeof globalThis.__openQuickAddCompat === 'function') {
        return globalThis.__openQuickAddCompat();
      }
      if (!shimDialog) {
        const dlg = document.createElement('dialog');
        dlg.id = 'quick-add-modal';
        dlg.innerHTML = '<form method="dialog" class="quick-add-form">'
          + '<header class="quick-add-header"><h2>Quick Add Contact</h2><button type="button" data-close aria-label="Close">×</button></header>'
          + '<section class="quick-add-body">'
          + '<label>First Name<input id="quick-first" autocomplete="off"></label>'
          + '<label>Last Name<input id="quick-last" autocomplete="off"></label>'
          + '<label>Email<input id="quick-email" type="email" autocomplete="off"></label>'
          + '<label>Phone<input id="quick-phone" autocomplete="off"></label>'
          + '<label>Notes<textarea id="quick-notes"></textarea></label>'
          + '</section>'
          + '<footer class="quick-add-footer"><button type="button" data-close id="quick-add-cancel">Cancel</button><button type="submit" id="quick-add-save">Save Contact</button></footer>'
          + '</form>';
        dlg.style.padding = '0';
        dlg.style.border = 'none';
        document.body.appendChild(dlg);
        shimDialog = dlg;
      }
      if (!wired && shimDialog) {
        wired = true;
        const form = shimDialog.querySelector('form');
        const closeButtons = shimDialog.querySelectorAll('[data-close]');
        closeButtons.forEach(btn => {
          btn.addEventListener('click', (event) => {
            event.preventDefault();
            closeShim();
          });
        });
        shimDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeShim(); });
        shimDialog.addEventListener('close', () => closeShim(true));
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const record = {
            id: (typeof window.uuid === 'function') ? window.uuid() : `contact-${Date.now()}`,
            first: String(form.querySelector('#quick-first')?.value || '').trim(),
            last: String(form.querySelector('#quick-last')?.value || '').trim(),
            email: String(form.querySelector('#quick-email')?.value || '').trim(),
            phone: String(form.querySelector('#quick-phone')?.value || '').trim(),
            notes: String(form.querySelector('#quick-notes')?.value || '').trim(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            stage: 'application',
            status: 'inprogress'
          };
          try {
            if (window.Contacts && typeof window.Contacts.createQuick === 'function') {
              await window.Contacts.createQuick(record);
            } else if (typeof window.dbPut === 'function') {
              await window.dbPut('contacts', record);
            }
            try { window.dispatchAppDataChanged?.('quick-add:contact'); } catch (_) {}
          } catch (err) {
            try { console.warn('[quick-add shim] save failed', err); } catch (_) {}
          } finally {
            closeShim();
          }
        });
      }
      return shimDialog;
    }

    function closeShim(force){
      if (!shimDialog) return;
      try { shimDialog.removeAttribute('data-loading'); } catch (_) {}
      try { shimDialog.removeAttribute('open'); } catch (_) {}
      try { shimDialog.style.display = 'none'; } catch (_) {}
      if (!force) {
        try { shimDialog.close?.(); } catch (_) {}
      }
    }

    function openShim(){
      const real = typeof globalThis.__openQuickAddCompat === 'function' ? globalThis.__openQuickAddCompat : null;
      if (real && real !== openShim) {
        return real();
      }
      const dlg = ensureShimDialog();
      if (!dlg) return null;
      try { dlg.style.display = 'block'; } catch (_) {}
      let opened = false;
      if (typeof dlg.showModal === 'function') {
        try { dlg.showModal(); opened = true; }
        catch (_) {}
      }
      if (!opened) {
        try { dlg.setAttribute('open', ''); } catch (_) {}
      }
      try { dlg.setAttribute('open', ''); } catch (_) {}
      return dlg;
    }

    function wireClickDelegate(){
      if (document.__quickAddCompatShim) return;
      document.__quickAddCompatShim = true;
      document.addEventListener('click', (event) => {
        const target = event.target?.closest('#quick-add');
        if (!target) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openShim();
      }, true);
    }

    wireClickDelegate();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', wireClickDelegate, { once: true });
    }

    return openShim;
  })();
}
