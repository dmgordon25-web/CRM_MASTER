import { ensureSingletonModal, closeSingletonModal, registerModalCleanup } from './modal_singleton.js';

const MODAL_KEY = 'help-modal';
const OPT_OUT_KEY = 'ui_help_hide';
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
      'Navigation tabs',
      'Use the top bar to move between work modes.',
      [
        'Dashboard is your daily overview; Dashboard (Configurable) is the customizable version with saved layouts.',
        'Switch views without losing context — the header always stays available.'
      ]
    ),
    createSection(
      'Search bar',
      'Find records without leaving your current page.',
      [
        'Type a name, company, or keyword and jump directly to matching records.',
        'Results open in-place so you can return to your previous work easily.'
      ]
    ),
    createSection(
      'New+ menu',
      'Create new items from anywhere.',
      [
        'Opens shortcuts for new contacts, partners, leads, and tasks.',
        'Stays consistent across Dashboard and Dashboard (Configurable) so you never hunt for “add new.”'
      ]
    ),
    createSection(
      'Settings',
      'Personalize the workspace and manage data.',
      [
        'Update your profile, themes, and notification preferences.',
        'Data tools live here too — exports, imports, and resets stay in one place.'
      ]
    ),
    createSection(
      'Notifications',
      'Keep tabs on activity without blocking your work.',
      [
        'Open the bell to view recent alerts; dismiss items you have already handled.',
        'Badge counts mirror what you see in the nav so you can glance and move on.'
      ]
    ),
    createSection(
      'Edit layout / drag / resize (Dashboard Configurable)',
      'Dashboard (Configurable) lets you rearrange tiles and save your preferred layouts.',
      [
        'Use “Edit layout” in the Customized Dashboard to drag cards, resize panels, and then click done to lock the layout.',
        'Dashboard (Preview) shares the same data but experiments with dashboards — switch back to Dashboard anytime.'
      ]
    )
  ];

  sections.forEach((section) => container.appendChild(section));
}

function readHidePreference() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(OPT_OUT_KEY) === 'true';
  } catch (_err) {
    return false;
  }
}

function persistHidePreference(checked) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (checked) {
      localStorage.setItem(OPT_OUT_KEY, 'true');
    } else {
      localStorage.removeItem(OPT_OUT_KEY);
    }
  } catch (_err) { /* ignore */ }
}

function createHelpModal() {
  if (typeof document === 'undefined' || !document.body) return null;

  const dialog = document.createElement('dialog');
  dialog.className = 'help-dialog';
  dialog.setAttribute('aria-label', 'How this CRM works (quick guide)');

  dialog.innerHTML = `
    <div class="dlg help-modal" role="document">
      <header class="modal-header">
        <h3 class="grow" data-role="help-title" tabindex="-1">How this CRM works (quick guide)</h3>
        <button class="btn ghost" type="button" data-role="help-close">Close</button>
      </header>
      <div class="modal-body help-body" data-role="help-body"></div>
      <footer class="modal-footer" data-role="help-footer">
        <label class="row" style="align-items:center;gap:8px;margin:0;">
          <input type="checkbox" data-role="help-hide-toggle" />
          <span class="muted">Don’t show again</span>
        </label>
        <span class="grow"></span>
        <button class="btn ghost" type="button" data-role="help-close">Close</button>
      </footer>
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

  const closeButtons = Array.from(modal.querySelectorAll('[data-role="help-close"]'));
  const onClose = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    closeHelpModal();
  };

  closeButtons.forEach((btn) => btn.addEventListener('click', onClose));
  modal.addEventListener('cancel', onClose);

  const hideToggle = modal.querySelector('[data-role="help-hide-toggle"]');
  if (hideToggle) {
    hideToggle.checked = readHidePreference();
    const onToggle = (event) => {
      persistHidePreference(event && event.target ? event.target.checked : false);
    };
    hideToggle.addEventListener('change', onToggle);
    registerModalCleanup(modal, () => hideToggle.removeEventListener('change', onToggle));
  }

  registerModalCleanup(modal, () => {
    closeButtons.forEach((btn) => btn.removeEventListener('click', onClose));
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
