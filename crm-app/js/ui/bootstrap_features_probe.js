const win = typeof window !== 'undefined' ? window : null;
const doc = typeof document !== 'undefined' ? document : null;

if (win && doc) {
  let started = false;
  let headerModulePromise = null;

  const importWithFallback = async (paths) => {
    for (const spec of paths) {
      try {
        const mod = await import(spec);
        console.info('[A_BEACON] probe import ok', spec);
        return mod;
      } catch (err) {
        console.info('[A_BEACON] probe import fail', spec, err && (err.message || err));
      }
    }
    return null;
  };

  const loadHeaderModule = () => {
    if (!headerModulePromise) {
      const base = import.meta.url;
      const H_PATHS = [
        'crm/ui/header_toolbar.js',
        './ui/header_toolbar.js',
        new URL('../ui/header_toolbar.js', base).href
      ];
      headerModulePromise = importWithFallback(H_PATHS);
    }
    return headerModulePromise;
  };

  const ensureContactButton = () => {
    try {
      const contactModal = doc.getElementById('contact-modal');
      if (!contactModal) return;
      if (contactModal.querySelector('button[aria-label="Add Contact"]')) return;
      const addBtn = doc.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn';
      addBtn.textContent = 'Add Contact';
      addBtn.setAttribute('aria-label', 'Add Contact');
      addBtn.addEventListener('click', () => {
        try {
          win.renderContactModal?.(null);
        } catch (err) {
          console.info('[A_BEACON] contact modal open error', err && (err.message || err));
        }
      });
      const footer = contactModal.querySelector('[data-form-footer="contact"]');
      const target = footer || contactModal;
      const saveBtn = target.querySelector('#btn-save-contact');
      if (saveBtn && saveBtn.parentElement === target) {
        target.insertBefore(addBtn, saveBtn);
      } else {
        target.appendChild(addBtn);
      }
    } catch (err) {
      console.info('[A_BEACON] contact bootstrap error', err && (err.message || err));
    }
  };

  const ensureAvatarInput = async () => {
    try {
      const panel = doc.getElementById('lo-profile-settings');
      if (!panel) return;
      const avatarInput = panel.querySelector('input[type="file"][accept="image/*"]');
      if (avatarInput) return;
      const headerModule = await loadHeaderModule();
      try {
        headerModule?.ensureProfileControls?.();
      } catch (err) {
        console.info('[A_BEACON] ensureProfileControls call failed', err && (err.message || err));
      }
    } catch (err) {
      console.info('[A_BEACON] avatar bootstrap error', err && (err.message || err));
    }
  };

  const run = async () => {
    console.info('[A_BEACON] probe loaded');
    if (!win.__WIRED_HEADER_TOOLBAR__) {
      await loadHeaderModule().catch(() => null);
    }
    ensureContactButton();
    await ensureAvatarInput();
  };

  const kickoff = () => {
    if (started) return;
    started = true;
    run().catch((err) => {
      console.info('[A_BEACON] probe run error', err && (err.message || err));
    });
  };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', kickoff, { once: true });
  } else {
    kickoff();
  }
} else {
  try {
    console.info('[A_BEACON] probe skipped (no document)');
  } catch (_) {}
}
