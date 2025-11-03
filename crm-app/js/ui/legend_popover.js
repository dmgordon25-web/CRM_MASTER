const openLegends = new Set();
let handlersBound = false;

function ensureDocument(){
  if (typeof document === 'undefined') return null;
  return document;
}

function ensureGlobalHandlers(doc){
  if (!doc || handlersBound) return;
  const closeAll = (target)=>{
    const toClose = [];
    openLegends.forEach((legend) => {
      if (!legend || !legend.isConnected || !legend.open) {
        toClose.push(legend);
        return;
      }
      if (target && legend.contains(target)) return;
      toClose.push(legend);
    });
    toClose.forEach((legend) => {
      if (!legend) return;
      try { legend.open = false; }
      catch (_err) {}
      openLegends.delete(legend);
    });
  };
  doc.addEventListener('click', (event) => {
    const target = event && event.target instanceof Element ? event.target : null;
    closeAll(target);
  }, true);
  doc.addEventListener('focusin', (event) => {
    const target = event && event.target instanceof Element ? event.target : null;
    closeAll(target);
  });
  handlersBound = true;
}

function createSwatch(doc, color){
  const swatch = doc.createElement('span');
  swatch.className = 'legend-swatch';
  if (color) {
    if (swatch.style && typeof swatch.style.setProperty === 'function') {
      swatch.style.setProperty('--legend-swatch-color', color);
    } else {
      swatch.setAttribute('style', `--legend-swatch-color:${color}`);
    }
  }
  swatch.setAttribute('aria-hidden', 'true');
  return swatch;
}

function createEntry(doc, entry){
  const item = doc.createElement('li');
  item.className = 'legend-item';

  const swatch = createSwatch(doc, entry.color || '');
  item.appendChild(swatch);

  const body = doc.createElement('div');
  body.className = 'legend-item-body';

  const title = doc.createElement('span');
  title.className = 'legend-item-title';
  title.textContent = entry.label || '';
  body.appendChild(title);

  if (entry.description) {
    const desc = doc.createElement('span');
    desc.className = 'legend-item-desc';
    desc.textContent = entry.description;
    body.appendChild(desc);
  }

  item.appendChild(body);
  return item;
}

export const STAGE_LEGEND_ENTRIES = [
  { label: 'Leads & nurture', description: 'Lead-stage, nurture, and brand-new leads', color: 'var(--stage-new)' },
  { label: 'Application / Pre-Approved', description: 'Application, qualification, and pre-approval work', color: 'var(--stage-qualified)' },
  { label: 'Processing / Underwriting', description: 'Files actively in processing or underwriting', color: 'var(--stage-negotiating)' },
  { label: 'Clear to Close', description: 'Clear-to-close approvals ready to schedule closing', color: 'var(--stage-ctc)' },
  { label: 'Funded / Clients', description: 'Funded loans, post-close nurture, and client care', color: 'var(--stage-won)' },
  { label: 'Lost / Denied', description: 'Lost, denied, or withdrawn opportunities', color: 'var(--stage-lost)' }
];

export function createLegendPopover(options = {}){
  const doc = options.document || ensureDocument();
  if (!doc) return null;
  const details = doc.createElement('details');
  details.className = 'legend-popover';
  if (options.id) {
    details.id = options.id;
  }

  const summary = doc.createElement('summary');
  summary.className = 'legend-summary';
  const label = options.summaryLabel || 'Legend';
  summary.textContent = label;
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-haspopup', 'true');
  summary.setAttribute('aria-expanded', 'false');
  summary.setAttribute('aria-label', options.summaryAriaLabel || label);
  details.appendChild(summary);

  const content = doc.createElement('div');
  content.className = 'legend-content';

  if (options.title) {
    const title = doc.createElement('strong');
    title.className = 'legend-title';
    title.textContent = options.title;
    content.appendChild(title);
  }

  const entries = Array.isArray(options.entries) ? options.entries : [];
  if (entries.length) {
    const list = doc.createElement('ul');
    list.className = 'legend-list';
    entries.forEach((entry) => {
      if (!entry) return;
      list.appendChild(createEntry(doc, entry));
    });
    content.appendChild(list);
  }

  if (options.note) {
    const note = doc.createElement('p');
    note.className = 'legend-note';
    note.textContent = options.note;
    content.appendChild(note);
  }

  details.appendChild(content);

  details.addEventListener('toggle', () => {
    const open = details.open === true || details.getAttribute('open') === '';
    summary.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      openLegends.add(details);
    } else {
      openLegends.delete(details);
    }
  });

  details.addEventListener('keydown', (event) => {
    if (event && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      details.open = false;
      try { summary.focus({ preventScroll: true }); }
      catch (_err) { summary.focus(); }
    }
  });

  ensureGlobalHandlers(doc);
  return details;
}

export default {
  createLegendPopover,
  STAGE_LEGEND_ENTRIES
};
