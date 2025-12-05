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

function setMeta(metaEl, text, metaClass) {
  if (!metaEl) return;
  const hasMeta = text !== undefined && text !== null && text !== '';
  metaEl.textContent = hasMeta ? text : '';
  metaEl.hidden = !hasMeta;
  metaEl.classList.remove('is-positive', 'is-negative', 'is-neutral');
  if (metaClass) {
    metaEl.classList.add(metaClass);
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
    || 'Borrower';
  const secondaryText = opts.secondaryText
    || loanDisplay.stageLabel
    || loanDisplay.stage
    || 'Stage not set';
  const metaText = opts.metaText ?? (loanDisplay.loanAmountLabel ?? loanDisplay.loanAmount ?? loanDisplay.amount);

  setText(primary, primaryText);
  setText(secondary, secondaryText);
  setMeta(meta, metaText, opts.metaClass);
  setBadge(badge, opts.badgeText);
  return rowEl;
}

export function renderPartnerRow(rowEl, partnerDisplay = {}, opts = {}) {
  const { primary, secondary, meta, badge } = ensureRowParts(rowEl, 'partner');
  const primaryText = opts.primaryText || partnerDisplay.name || partnerDisplay.company || 'Partner';
  const secondaryText = opts.secondaryText || partnerDisplay.tier || partnerDisplay.company || DEFAULT_PLACEHOLDER;
  const metaText = opts.metaText ?? partnerDisplay.currentCount ?? partnerDisplay.volume ?? partnerDisplay.delta;

  setText(primary, primaryText);
  setText(secondary, secondaryText);
  setMeta(meta, metaText, opts.metaClass);
  setBadge(badge, opts.badgeText);
  return rowEl;
}

export function renderContactRow(rowEl, contactDisplay = {}, opts = {}) {
  const { primary, secondary, meta, badge } = ensureRowParts(rowEl, 'contact');
  const primaryText = opts.primaryText || contactDisplay.name || 'Contact';
  const secondaryText = opts.secondaryText || contactDisplay.lastTouchLabel || contactDisplay.reasonLabel || DEFAULT_PLACEHOLDER;
  const metaText = opts.metaText ?? contactDisplay.ageLabel;

  setText(primary, primaryText);
  setText(secondary, secondaryText);
  setMeta(meta, metaText, opts.metaClass);
  setBadge(badge, opts.badgeText);
  return rowEl;
}
