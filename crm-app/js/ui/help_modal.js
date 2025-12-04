import { ensureSingletonModal, closeSingletonModal, registerModalCleanup } from './modal_singleton.js';

const MODAL_KEY = 'help-modal';
let lastTrigger = null;

function focusElement(el) {
  if (!el || typeof el.focus !== 'function') return;
  try {
    el.focus({ preventScroll: true });
  } catch (_err) {
    try { el.focus(); } catch (__err) { /* ignore */ }
  }
}

function restoreFocus() {
  const target = lastTrigger;
  lastTrigger = null;
  if (!target || typeof target.focus !== 'function') return;
  try {
    target.focus({ preventScroll: true });
  } catch (_err) {
    try { target.focus(); } catch (__err) { /* ignore */ }
  }
}

function createSection(title, description, bullets = []) {
  const section = document.createElement('section');
  section.className = 'help-section';

  const heading = document.createElement('h4');
  heading.textContent = title;
  section.appendChild(heading);

  if (description) {
    const para = document.createElement('p');
    para.className = 'muted';
    para.textContent = description;
    section.appendChild(para);
  }

  if (bullets.length) {
    const list = document.createElement('ul');
    list.className = 'help-list';
    bullets.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    section.appendChild(list);
  }

  return section;
}

function buildContent(container) {
  if (!container) return;
  container.innerHTML = '';

  const sections = [
    createSection(
      'Offline & Local Data',
      'Everything you enter here stays on this browser using local storage (IndexedDB) so the machine you use matters.',
      [
        'This build does not sync to a shared cloud — keep using the same browser/profile to see your data.',
        'Back up or export from Settings when you want a snapshot of your workspace.'
      ]
    ),
    createSection(
      'Safe Mode (?safe=1)',
      'Safe Mode starts the CRM in a defensive posture to protect local data.',
      [
        'Launch with the ?safe=1 query parameter (example: https://app.local/?safe=1).',
        'Some experimental or write-heavy features may be limited when Safe Mode is on.'
      ]
    ),
    createSection(
      'Key Views',
      'Jump between the core workspaces from the top navigation.',
      [
        'Dashboard gives a focused overview; Labs is the experimental dashboard.',
        'Contacts tracks people and partners you work with.',
        'Pipeline shows deal flow by stage.',
        'Tasks/To-Do keeps lightweight reminders inside the dashboard widgets.'
      ]
    ),
    createSection(
      'Data & Reset',
      'If you need a clean slate or a backup, use the built-in tools.',
      [
        'Settings → General → Maintenance includes “Delete All Local Data” and demo data seeding.',
        'Settings → Data Tools has export/import options for full workspace snapshots.'
      ]
    )
  ];

  sections.forEach((section) => container.appendChild(section));
}

function createHelpModal() {
  if (typeof document === 'undefined' || !document.body) return null;

  const dialog = document.createElement('dialog');
  dialog.className = 'help-dialog';
  dialog.setAttribute('aria-label', 'Help and Quick Tour');

  dialog.innerHTML = `
    <div class="dlg help-modal" role="document">
      <header class="modal-header">
        <h3 class="grow" data-role="help-title" tabindex="-1">Help &amp; Quick Tour</h3>
        <button class="btn ghost" type="button" data-role="help-close">Close</button>
      </header>
      <div class="modal-body help-body" data-role="help-body"></div>
    </div>
  `;

  const body = dialog.querySelector('[data-role="help-body"]');
  buildContent(body);

  document.body.appendChild(dialog);
  return dialog;
}

function wireHelpModal(modal) {
  if (!modal || modal.__helpWired) return;
  modal.__helpWired = true;

  const closeBtn = modal.querySelector('[data-role="help-close"]');
  const onClose = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    closeHelpModal();
  };

  if (closeBtn) closeBtn.addEventListener('click', onClose);
  modal.addEventListener('cancel', onClose);
  registerModalCleanup(modal, () => {
    if (closeBtn) closeBtn.removeEventListener('click', onClose);
    modal.removeEventListener('cancel', onClose);
  });
}

function focusHelpModal(modal) {
  if (!modal) return;
  const heading = modal.querySelector('[data-role="help-title"]');
  if (heading) {
    focusElement(heading);
    return;
  }
  const closeBtn = modal.querySelector('[data-role="help-close"]');
  focusElement(closeBtn);
}

export function openHelpModal(trigger) {
  if (typeof document === 'undefined') return null;
  lastTrigger = trigger || document.activeElement || null;
  const modal = ensureSingletonModal(MODAL_KEY, createHelpModal);
  if (!modal) return null;
  wireHelpModal(modal);
  focusHelpModal(modal);
  return modal;
}

export function closeHelpModal() {
  if (typeof document === 'undefined') return;
  const modal = document.querySelector(`[data-modal-key="${MODAL_KEY}"]`) || document.querySelector('.help-dialog');
  if (!modal) return;
  closeSingletonModal(modal, { beforeRemove: restoreFocus });
}

export default { openHelpModal, closeHelpModal };
