import { openPartnerEditModal } from './partner_edit_modal.js';

const globalScope = typeof window !== 'undefined'
  ? window
  : (typeof globalThis !== 'undefined' ? globalThis : {});

function ensureDialogShell() {
  if (typeof document === 'undefined') return null;
  let dialog = document.getElementById('quick-add-modal');
  if (dialog && dialog.tagName && dialog.tagName.toLowerCase() !== 'dialog') {
    return dialog;
  }
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'quick-add-modal';
    dialog.setAttribute('data-ui', 'quick-add-modal');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const shell = document.createElement('div');
    shell.className = 'modal-form-shell';
    const heading = document.createElement('h3');
    heading.textContent = 'New';
    const chooserHost = document.createElement('div');
    chooserHost.setAttribute('data-ui', 'quick-add-chooser');
    const footer = document.createElement('footer');
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('data-ui', 'qa-close');
    closeBtn.textContent = 'Close';
    footer.appendChild(closeBtn);
    shell.append(heading, chooserHost, footer);
    dialog.appendChild(shell);
    dialog.style.position = 'fixed';
    dialog.style.left = '-9999px';
    dialog.style.top = 'auto';
    dialog.style.bottom = 'auto';
    dialog.style.opacity = '0';
    dialog.style.pointerEvents = 'none';
    const parent = document.body || document.documentElement || document;
    parent.appendChild(dialog);
  }
  const closeBtn = dialog.querySelector('[data-ui="qa-close"]');
  if (closeBtn && !closeBtn.__qaCloseWired) {
    closeBtn.__qaCloseWired = true;
    closeBtn.addEventListener('click', () => {
      try {
        if (typeof dialog.close === 'function') {
          dialog.close();
        } else {
          dialog.open = false;
        }
      } catch (_) {
        try { dialog.open = false; }
        catch (__) {}
      }
    });
  }
  return dialog;
}

function showToast(kind, message) {
  const text = String(message == null ? '' : message).trim();
  if (!text) return;
  const toast = globalScope.Toast;
  const legacy = globalScope.toast;
  if (toast && typeof toast[kind] === 'function') {
    try { toast[kind](text); return; }
    catch (_) {}
  }
  if (toast && typeof toast.show === 'function') {
    try { toast.show(text); return; }
    catch (_) {}
  }
  if (typeof legacy === 'function') {
    try { legacy(text); }
    catch (_) {}
  }
}

export function renderChooser(targetEl) {
  if (typeof document === 'undefined') return null;
  const host = targetEl || document.querySelector('#quick-add-modal [data-ui="quick-add-chooser"]');
  if (!host) return null;
  while (host.firstChild) {
    host.removeChild(host.firstChild);
  }

  const list = document.createElement('div');
  list.setAttribute('data-ui', 'quick-add-options');

  const createBtn = (label, qa, handler) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.setAttribute('data-ui', qa);
    btn.className = 'qa-choice';
    btn.addEventListener('click', () => {
      try { handler(); }
      catch (err) {
        try { console.warn('[quick-add-compat] handler failed', err); }
        catch (_) {}
      }
    });
    return btn;
  };

  const closeCompat = () => {
    const dialog = document.getElementById('quick-add-modal');
    if (!dialog) return;
    try {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.open = false;
      }
    } catch (_) {
      try { dialog.open = false; }
      catch (__) {}
    }
  };

  list.append(
    createBtn('Contact', 'qa-choice-contact', () => {
      closeCompat();
      const fn = globalScope.renderContactModal;
      if (typeof fn === 'function') {
        try { fn(null); }
        catch (err) { console.warn('[quick-add-compat] renderContactModal failed', err); }
        return;
      }
      showToast('warn', 'Contact quick create unavailable');
    }),
    createBtn('Partner', 'qa-choice-partner', async () => {
      closeCompat();
      try {
        await openPartnerEditModal('', { allowAutoOpen: true });
      } catch (err) {
        console.warn('[quick-add-compat] openPartnerEditModal failed', err);
      }
    }),
    createBtn('Task', 'qa-choice-task', () => {
      closeCompat();
      const handler = typeof globalScope.openTaskQuickAdd === 'function'
        ? globalScope.openTaskQuickAdd
        : (typeof globalScope.openTaskQuickCreate === 'function'
          ? globalScope.openTaskQuickCreate
          : (globalScope.Tasks && typeof globalScope.Tasks.openQuickCreate === 'function'
            ? globalScope.Tasks.openQuickCreate
            : null));
      if (typeof handler === 'function') {
        try { handler(); }
        catch (err) { console.warn('[quick-add-compat] openTaskQuickAdd failed', err); }
        return;
      }
      showToast('info', 'Tasks coming soon');
    })
  );

  host.appendChild(list);
  return host;
}

export function openQuickAddCompat() {
  if (typeof document === 'undefined') return null;
  const dialog = ensureDialogShell();
  if (!dialog) return null;
  try {
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.open = true;
    }
  } catch (err) {
    try { dialog.open = true; }
    catch (_) {}
    try { console.warn('[quick-add-compat] showModal failed', err); }
    catch (__) {}
  }
  try {
    dialog.setAttribute('open', '');
  } catch (_) {}
  renderChooser(dialog.querySelector('[data-ui="quick-add-chooser"]'));
  return dialog;
}

openQuickAddCompat.renderChooser = renderChooser;

if (typeof window !== 'undefined') {
  window.openQuickAddCompat = openQuickAddCompat;
}

export default openQuickAddCompat;
