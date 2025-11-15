/**
 * Column Chooser UI
 * Provides an interface for users to select which columns are visible in tables
 */

import { getSurfaceSchema, getVisibleColumns, setVisibleColumns, resetColumns } from './registry.js';

const STYLE_ID = 'column-chooser-style';
const STYLE_ORIGIN = 'crm:table:column-chooser';
const STYLE_TEXT = `
  [data-ui="column-chooser"] {
    position: relative;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    background: var(--surface-muted, #eef2ff);
    color: #1e293b;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }
  [data-ui="column-chooser"]:hover {
    background: var(--surface-hover, #dbeafe);
  }
  [data-ui="column-chooser"]:focus-visible {
    outline: 2px solid var(--primary, #2563eb);
    outline-offset: 2px;
  }
  .column-chooser-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.12);
    border-radius: 12px;
    box-shadow: 0 10px 32px rgba(15, 23, 42, 0.18);
    padding: 12px;
    min-width: 220px;
    max-width: 320px;
    z-index: 1000;
    display: none;
  }
  .column-chooser-menu[data-visible="1"] {
    display: block;
  }
  .column-chooser-menu h4 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  }
  .column-chooser-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 320px;
    overflow-y: auto;
  }
  .column-chooser-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
  }
  .column-chooser-item:hover {
    background: var(--surface-muted, #eef2ff);
  }
  .column-chooser-item input[type="checkbox"] {
    cursor: pointer;
  }
  .column-chooser-item label {
    flex: 1;
    cursor: pointer;
    font-size: 13px;
    color: #334155;
  }
  .column-chooser-actions {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(15, 23, 42, 0.08);
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }
  .column-chooser-actions button {
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 600;
  }
  .column-chooser-actions button.reset {
    background: var(--surface-muted, #eef2ff);
    color: #475569;
  }
  .column-chooser-actions button.reset:hover {
    background: #dbeafe;
  }
  .column-chooser-actions button.close {
    background: var(--primary, #2563eb);
    color: #fff;
  }
  .column-chooser-actions button.close:hover {
    background: #1d4ed8;
  }
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head) return;

  let style = document.querySelector(`style[data-origin="${STYLE_ORIGIN}"]`);
  if (!style && typeof document.getElementById === 'function') {
    style = document.getElementById(STYLE_ID);
  }

  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.setAttribute('data-origin', STYLE_ORIGIN);
    head.appendChild(style);
  }

  if (style.textContent !== STYLE_TEXT) {
    style.textContent = STYLE_TEXT;
  }
}

/**
 * Create a column chooser button
 * @param {string} surface - Surface identifier
 * @param {Function} onChange - Callback when columns change
 * @returns {HTMLButtonElement}
 */
export function createColumnChooser(surface, onChange) {
  ensureStyles();

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-ui', 'column-chooser');
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.textContent = 'Columns';

  const menu = createChooserMenu(surface, button, onChange);
  button.__chooserMenu = menu;

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleMenu(button, menu);
  });

  // Close menu when clicking outside
  if (typeof document !== 'undefined') {
    const closeOnOutside = (event) => {
      if (!button.contains(event.target) && !menu.contains(event.target)) {
        closeMenu(button, menu);
      }
    };

    button.__outsideClickListener = closeOnOutside;
    document.addEventListener('click', closeOnOutside);
  }

  return button;
}

/**
 * Create the chooser menu element
 * @param {string} surface - Surface identifier
 * @param {HTMLButtonElement} trigger - Trigger button
 * @param {Function} onChange - Callback when columns change
 * @returns {HTMLDivElement}
 */
function createChooserMenu(surface, trigger, onChange) {
  const menu = document.createElement('div');
  menu.className = 'column-chooser-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Column visibility');

  const title = document.createElement('h4');
  title.textContent = 'Show Columns';
  menu.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'column-chooser-list';
  list.setAttribute('role', 'group');

  const schema = getSurfaceSchema(surface);
  const visible = getVisibleColumns(surface);
  const visibleIds = new Set(visible.map(col => col.id));

  schema.forEach((column, index) => {
    const item = document.createElement('li');
    item.className = 'column-chooser-item';
    item.setAttribute('role', 'menuitemcheckbox');
    item.setAttribute('aria-checked', visibleIds.has(column.id) ? 'true' : 'false');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `col-chooser-${surface}-${column.id}`;
    checkbox.checked = visibleIds.has(column.id);
    checkbox.setAttribute('data-column-id', column.id);

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = column.label;

    checkbox.addEventListener('change', () => {
      updateColumnVisibility(surface, menu, onChange);
      item.setAttribute('aria-checked', checkbox.checked ? 'true' : 'false');
    });

    item.addEventListener('click', (event) => {
      if (event.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });

    item.appendChild(checkbox);
    item.appendChild(label);
    list.appendChild(item);
  });

  menu.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'column-chooser-actions';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'reset';
  resetBtn.textContent = 'Reset to Defaults';
  resetBtn.addEventListener('click', () => {
    resetColumns(surface);
    refreshMenu(surface, menu, onChange);
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'close';
  closeBtn.textContent = 'Done';
  closeBtn.addEventListener('click', () => {
    closeMenu(trigger, menu);
  });

  actions.appendChild(resetBtn);
  actions.appendChild(closeBtn);
  menu.appendChild(actions);

  // Position menu relative to trigger
  if (trigger.parentElement) {
    const container = trigger.parentElement;
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    container.appendChild(menu);
  }

  return menu;
}

/**
 * Toggle menu visibility
 * @param {HTMLButtonElement} trigger - Trigger button
 * @param {HTMLDivElement} menu - Menu element
 */
function toggleMenu(trigger, menu) {
  const isVisible = menu.getAttribute('data-visible') === '1';
  if (isVisible) {
    closeMenu(trigger, menu);
  } else {
    openMenu(trigger, menu);
  }
}

/**
 * Open the menu
 * @param {HTMLButtonElement} trigger - Trigger button
 * @param {HTMLDivElement} menu - Menu element
 */
function openMenu(trigger, menu) {
  menu.setAttribute('data-visible', '1');
  trigger.setAttribute('aria-expanded', 'true');
}

/**
 * Close the menu
 * @param {HTMLButtonElement} trigger - Trigger button
 * @param {HTMLDivElement} menu - Menu element
 */
function closeMenu(trigger, menu) {
  menu.setAttribute('data-visible', '0');
  trigger.setAttribute('aria-expanded', 'false');
}

/**
 * Update column visibility based on checkboxes
 * @param {string} surface - Surface identifier
 * @param {HTMLDivElement} menu - Menu element
 * @param {Function} onChange - Callback when columns change
 */
function updateColumnVisibility(surface, menu, onChange) {
  const checkboxes = menu.querySelectorAll('input[type="checkbox"][data-column-id]');
  const selectedIds = [];

  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      selectedIds.push(checkbox.getAttribute('data-column-id'));
    }
  });

  setVisibleColumns(surface, selectedIds);

  if (typeof onChange === 'function') {
    try {
      onChange(selectedIds);
    } catch (err) {
      console.warn('[column-chooser] onChange callback failed', err);
    }
  }
}

/**
 * Refresh menu to reflect current column state
 * @param {string} surface - Surface identifier
 * @param {HTMLDivElement} menu - Menu element
 * @param {Function} onChange - Callback when columns change
 */
function refreshMenu(surface, menu, onChange) {
  const visible = getVisibleColumns(surface);
  const visibleIds = new Set(visible.map(col => col.id));

  const checkboxes = menu.querySelectorAll('input[type="checkbox"][data-column-id]');
  checkboxes.forEach(checkbox => {
    const columnId = checkbox.getAttribute('data-column-id');
    checkbox.checked = visibleIds.has(columnId);
    const item = checkbox.closest('.column-chooser-item');
    if (item) {
      item.setAttribute('aria-checked', checkbox.checked ? 'true' : 'false');
    }
  });

  if (typeof onChange === 'function') {
    try {
      onChange(Array.from(visibleIds));
    } catch (err) {
      console.warn('[column-chooser] onChange callback failed', err);
    }
  }
}

/**
 * Destroy column chooser and clean up listeners
 * @param {HTMLButtonElement} button - Column chooser button
 */
export function destroyColumnChooser(button) {
  if (!button) return;

  if (button.__outsideClickListener && typeof document !== 'undefined') {
    document.removeEventListener('click', button.__outsideClickListener);
    button.__outsideClickListener = null;
  }

  if (button.__chooserMenu && button.__chooserMenu.parentElement) {
    button.__chooserMenu.parentElement.removeChild(button.__chooserMenu);
  }

  button.__chooserMenu = null;
}
