import { createDeltaBar, createInlineBar } from './micro_charts.js';

const DEFAULT_PLACEHOLDER = '—';

function ensureRowParts(row, type) {
  if (!(row instanceof HTMLElement)) {
    throw new Error('render row expects an element');
  }

  if (!row.classList.contains('labs-row')) {
    row.classList.add('labs-row');
  }
  if (type) {
    row.classList.add(`labs-row--${type}`);
  }

  // ZERO-UNKNOWN ENFORCEMENT
  // If we mistakenly render a row that should be hidden, ensure we can toggle it.
  row.hidden = false;

  const primary = row.querySelector('.labs-row__primary');
  const secondary = row.querySelector('.labs-row__secondary');
  const meta = row.querySelector('.labs-row__meta');
  const badge = row.querySelector('.labs-row__badge');

  if (primary && secondary && meta && badge) {
    return { primary, secondary, meta, badge };
  }

  const rebuilt = createRowContainer(type);
  while (row.firstChild) {
    row.removeChild(row.firstChild);
  }
  while (rebuilt.firstChild) {
    row.appendChild(rebuilt.firstChild);
  }

  return {
    primary: row.querySelector('.labs-row__primary'),
    secondary: row.querySelector('.labs-row__secondary'),
    meta: row.querySelector('.labs-row__meta'),
    badge: row.querySelector('.labs-row__badge')
  };
}

function setText(element, value, placeholder = DEFAULT_PLACEHOLDER) {
  if (!element) return;
  const safeValue = value === undefined || value === null || value === '' ? placeholder : value;
  element.textContent = safeValue;
  element.classList.toggle('is-empty', safeValue === placeholder);
}

function setBadge(badgeEl, text) {
  if (!badgeEl) return;
  if (text) {
    badgeEl.textContent = text;
    badgeEl.hidden = false;
  } else {
    badgeEl.textContent = '';
    badgeEl.hidden = true;
  }
}

function appendInlineBar(metaEl, value, max, ariaLabel) {
  if (metaEl === null || metaEl === undefined) return;
  if (value === undefined || value === null) return;
  if (max === undefined || max === null) return;
  const bar = createInlineBar({ value, max, ariaLabel });
  if (bar) {
    bar.classList.add('labs-microbar--inline');
    metaEl.appendChild(bar);
    metaEl.hidden = false;
  }
}

function appendDelta(metaEl, current, previous, ariaLabel) {
  if (metaEl === null || metaEl === undefined) return;
  if (current === undefined || current === null) return;
  if (previous === undefined || previous === null) return;
  const deltaEl = createDeltaBar({ current, previous, ariaLabel });
  if (deltaEl) {
    metaEl.appendChild(deltaEl);
    metaEl.hidden = false;
  }
}

function setMeta(metaEl, text, metaClass, ariaLabel) {
  if (!metaEl) return;
  const hasMeta = text !== undefined && text !== null && text !== '';
  metaEl.textContent = hasMeta ? text : '';
  metaEl.hidden = !hasMeta;
  metaEl.classList.remove('is-positive', 'is-negative', 'is-neutral');
  if (metaClass) {
    metaEl.classList.add(metaClass);
  }
  if (ariaLabel) {
    metaEl.setAttribute('aria-label', ariaLabel);
  } else if (metaEl.hasAttribute('aria-label')) {
    metaEl.removeAttribute('aria-label');
  }
}

export function createRowContainer(type) {
  const row = document.createElement('div');
  row.className = 'labs-row';
  if (type) {
    row.classList.add(`labs-row--${type}`);
  }

  const main = document.createElement('div');
  main.className = 'labs-row__main';

  const badge = document.createElement('div');
  badge.className = 'labs-row__badge';
  badge.hidden = true;

  const textWrap = document.createElement('div');
  textWrap.className = 'labs-row__text';

  const primary = document.createElement('div');
  primary.className = 'labs-row__primary';

  const secondary = document.createElement('div');
  secondary.className = 'labs-row__secondary';

  textWrap.appendChild(primary);
  textWrap.appendChild(secondary);

  main.appendChild(badge);
  main.appendChild(textWrap);

  const meta = document.createElement('div');
  meta.className = 'labs-row__meta';
  meta.hidden = true;

  row.appendChild(main);
  row.appendChild(meta);

  return row;
}

export function renderLoanRow(rowEl, loanDisplay = {}, opts = {}) {
  const { primary, secondary, meta, badge } = ensureRowParts(rowEl, 'loan');
  const primaryText = opts.primaryText
    || loanDisplay.borrowerName
    || loanDisplay.displayName
    || loanDisplay.name
    || loanDisplay.name;
  // || 'Borrower'; // REMOVED fallback to enforce strictness

  // STRICT PARITY: Hide if no name
  if (!primaryText || primaryText === 'Unknown contact' || primaryText === 'Unknown') {
    rowEl.hidden = true;
    return rowEl;
  }
  const secondaryText = opts.secondaryText
    || loanDisplay.stageLabel
    || loanDisplay.stage
    || 'Stage not set';
  const metaText = opts.metaText ?? (loanDisplay.loanAmountLabel ?? loanDisplay.loanAmount ?? loanDisplay.amount);

  setText(primary, primaryText);
  setText(secondary, secondaryText);
  setMeta(meta, metaText, opts.metaClass, opts.metaAriaLabel);
  if (opts.progressValue !== undefined && opts.progressMax !== undefined) {
    appendInlineBar(meta, opts.progressValue, opts.progressMax, opts.progressAriaLabel);
  }
  setBadge(badge, opts.badgeText);

  // Click wiring
  if (loanDisplay.id || opts.id || loanDisplay.contactId || loanDisplay.borrowerId) {
    const targetId = loanDisplay.contactId || loanDisplay.borrowerId || loanDisplay.id || opts.id;
    if (targetId) {
      rowEl.style.cursor = 'pointer';
      rowEl.setAttribute('role', 'button');
      rowEl.setAttribute('tabindex', '0');
      rowEl.onclick = (e) => {
        e.stopPropagation();
        window.location.hash = `#/contacts/${targetId}`;
      };
    }
  }

  return rowEl;
}

export function renderPartnerRow(rowEl, partnerDisplay = {}, opts = {}) {
  const { primary, secondary, meta, badge } = ensureRowParts(rowEl, 'partner');
  const primaryText = opts.primaryText || partnerDisplay.name || partnerDisplay.company; // removed 'Partner' fallback

  if (!primaryText || primaryText === 'Unknown contact' || primaryText === 'Unknown partner') {
    rowEl.hidden = true;
    return rowEl;
  }
  const secondaryText = opts.secondaryText || partnerDisplay.tier || partnerDisplay.company || DEFAULT_PLACEHOLDER;
  const metaText = opts.metaText ?? partnerDisplay.currentCount ?? partnerDisplay.volume ?? partnerDisplay.delta;

  setText(primary, primaryText);
  setText(secondary, secondaryText);
  setMeta(meta, metaText, opts.metaClass, opts.metaAriaLabel);
  appendInlineBar(meta, opts.currentCount, opts.maxCount, opts.barAriaLabel);
  appendDelta(meta, opts.current, opts.previous, opts.deltaAriaLabel);
  setBadge(badge, opts.badgeText);

  // Click wiring
  if (partnerDisplay.id || opts.id) {
    const targetId = partnerDisplay.id || opts.id;
    rowEl.style.cursor = 'pointer';
    rowEl.setAttribute('role', 'button');
    rowEl.setAttribute('tabindex', '0');
    rowEl.onclick = (e) => {
      e.stopPropagation();
      window.location.hash = `#/partners/${targetId}`;
    };
  }

  return rowEl;
}

export function renderContactRow(rowEl, contactDisplay = {}, opts = {}) {
  const { primary, secondary, meta, badge } = ensureRowParts(rowEl, 'contact');
  const primaryText = opts.primaryText || contactDisplay.name; // removed 'Contact' fallback

  if (!primaryText || primaryText === 'Unknown contact') {
    rowEl.hidden = true;
    return rowEl;
  }
  const secondaryText = opts.secondaryText || contactDisplay.lastTouchLabel || contactDisplay.reasonLabel || DEFAULT_PLACEHOLDER;
  const metaText = opts.metaText ?? contactDisplay.ageLabel;

  setText(primary, primaryText);
  setText(secondary, secondaryText);
  setMeta(meta, metaText, opts.metaClass, opts.metaAriaLabel);
  if (opts.urgencyValue !== undefined && opts.urgencyMax !== undefined) {
    appendInlineBar(meta, opts.urgencyValue, opts.urgencyMax, opts.urgencyAriaLabel);
  }
  setBadge(badge, opts.badgeText);

  // Click wiring
  if (contactDisplay.id || opts.id) {
    const targetId = contactDisplay.id || opts.id;
    rowEl.style.cursor = 'pointer';
    rowEl.setAttribute('role', 'button');
    rowEl.setAttribute('tabindex', '0');
    rowEl.onclick = (e) => {
      e.stopPropagation();
      window.location.hash = `#/contacts/${targetId}`;
    };
  }

  return rowEl;
}
