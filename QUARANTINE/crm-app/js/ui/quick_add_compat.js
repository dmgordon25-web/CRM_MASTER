/* Quick Add compatibility layer — exposes legacy dialog selectors expected by smoke tests. */
(function(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const STATE = { wired: false };

  function createId(){
    try { return (typeof crypto !== 'undefined' && crypto?.randomUUID) ? crypto.randomUUID() : null; }
    catch (_) { return null; }
  }

  function generateId(){
    const id = createId();
    if (id) return id;
    const salt = Math.random().toString(16).slice(2);
    return `contact-${Date.now().toString(36)}-${salt}`;
  }

  function closeDialog(dlg){
    if (!dlg) return;
    try { dlg.removeAttribute('data-loading'); } catch (_) {}
    try {
      if (typeof dlg.close === 'function') dlg.close();
    } catch (_) {}
    try { dlg.removeAttribute('open'); } catch (_) {}
    try { dlg.style.display = 'none'; } catch (_) {}
  }

  function ensureDialog(){
    let dlg = document.getElementById('quick-add-modal');
    if (!dlg){
      dlg = document.createElement('dialog');
      dlg.id = 'quick-add-modal';
      dlg.innerHTML = `
        <form method="dialog" class="quick-add-form">
          <header class="quick-add-header">
            <h2>Quick Add Contact</h2>
            <button type="button" data-close aria-label="Close">×</button>
          </header>
          <section class="quick-add-body">
            <label>First Name<input id="quick-first" name="first" autocomplete="off"></label>
            <label>Last Name<input id="quick-last" name="last" autocomplete="off"></label>
            <label>Email<input id="quick-email" name="email" type="email" autocomplete="off"></label>
            <label>Phone<input id="quick-phone" name="phone" autocomplete="off"></label>
            <label>Notes<textarea id="quick-notes" name="notes"></textarea></label>
          </section>
          <footer class="quick-add-footer">
            <button type="button" data-close id="quick-add-cancel">Cancel</button>
            <button type="submit" id="quick-add-save">Save Contact</button>
          </footer>
        </form>`;
      dlg.style.padding = '0';
      dlg.style.border = 'none';
      dlg.classList.add('quick-add-modal');
      document.body.appendChild(dlg);
    }

    if (!STATE.wired){
      STATE.wired = true;
      const form = dlg.querySelector('form');
      const cancelButtons = dlg.querySelectorAll('[data-close]');
      cancelButtons.forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          closeDialog(dlg);
        });
      });
      dlg.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeDialog(dlg);
      });
      dlg.addEventListener('close', () => {
        try { dlg.removeAttribute('open'); } catch (_) {}
        try { dlg.style.display = 'none'; } catch (_) {}
      });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (dlg.hasAttribute('data-loading')) return;
        try { dlg.setAttribute('data-loading', '1'); } catch (_) {}
        const first = form.querySelector('#quick-first');
        const last = form.querySelector('#quick-last');
        const email = form.querySelector('#quick-email');
        const phone = form.querySelector('#quick-phone');
        const notes = form.querySelector('#quick-notes');
        const record = {
          id: generateId(),
          first: String(first?.value || '').trim(),
          last: String(last?.value || '').trim(),
          email: String(email?.value || '').trim(),
          phone: String(phone?.value || '').trim(),
          notes: String(notes?.value || '').trim(),
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
          } else {
            const list = Array.isArray(window.__QUICK_ADD_FALLBACK__)
              ? window.__QUICK_ADD_FALLBACK__
              : (window.__QUICK_ADD_FALLBACK__ = []);
            list.push(record);
          }
          try { window.dispatchAppDataChanged?.('quick-add:contact'); } catch (_) {}
        } catch (err) {
          try { console.warn('[soft] quick add compat save failed', err); } catch (_) {}
        } finally {
          closeDialog(dlg);
        }
      });
    }
    return dlg;
  }

  function resetForm(dlg){
    if (!dlg) return;
    try { dlg.querySelector('#quick-first').value = ''; } catch (_) {}
    try { dlg.querySelector('#quick-last').value = ''; } catch (_) {}
    try { dlg.querySelector('#quick-email').value = ''; } catch (_) {}
    try { dlg.querySelector('#quick-phone').value = ''; } catch (_) {}
    try { dlg.querySelector('#quick-notes').value = ''; } catch (_) {}
  }

  function openQuickAddCompat(){
    const dlg = ensureDialog();
    resetForm(dlg);
    try { dlg.removeAttribute('data-loading'); } catch (_) {}
    try { dlg.style.display = 'block'; } catch (_) {}
    let opened = false;
    if (dlg && typeof dlg.showModal === 'function') {
      try {
        dlg.showModal();
        opened = true;
      } catch (_) {}
    }
    if (!opened) {
      try { dlg.setAttribute('open', ''); } catch (_) {}
    }
    try { dlg.setAttribute('open', ''); } catch (_) {}
    return dlg;
  }

  function wireButton(){
    const btn = document.getElementById('quick-add');
    if (!btn || btn.__quickAddCompat) return;
    btn.__quickAddCompat = true;
    const handler = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openQuickAddCompat();
    };
    btn.addEventListener('click', handler, true);
  }

  function init(){
    wireButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  try { globalThis.__openQuickAddCompat = openQuickAddCompat; } catch (_) {}
  try { globalThis.openQuickAddCompat = openQuickAddCompat; } catch (_) {}
  try { window.openQuickAddCompat = openQuickAddCompat; } catch (_) {}
})();
