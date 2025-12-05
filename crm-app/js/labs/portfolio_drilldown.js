import {
  PORTFOLIO_SEGMENT_DOMAINS,
  buildPortfolioSegment,
  formatCurrency,
  formatRelativeTime,
  getContactsForPortfolioSegment,
  getLoansForPortfolioSegment,
  getPartnersForPortfolioSegment,
  normalizeStagesForDisplay,
  STAGE_CONFIG
} from './data.js';
import { ensureSingletonModal, closeSingletonModal } from '../ui/modal_singleton.js';

const MODAL_KEY = 'labs-portfolio-drilldown';

function createHeader(titleText, count, noun) {
  const header = document.createElement('div');
  header.className = 'labs-drilldown-header';

  const title = document.createElement('h3');
  title.className = 'labs-drilldown-title';
  title.textContent = `${titleText} (${count} ${noun})`;
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'labs-drilldown-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => closeSingletonModal(MODAL_KEY));
  header.appendChild(closeBtn);

  return header;
}

function createPartnerRow(partner, model) {
  const row = document.createElement('div');
  row.className = 'labs-drilldown-row portfolio-partner-row';

  const name = document.createElement('div');
  name.className = 'drilldown-name';
  const displayName = model?.getPartnerDisplayName?.(partner?.id) || partner?.name || partner?.company || 'Partner';
  name.textContent = displayName;

  const tier = document.createElement('div');
  tier.className = 'drilldown-stage';
  tier.textContent = partner?.tier || 'Uncategorized';

  const meta = document.createElement('div');
  meta.className = 'drilldown-meta';
  const metaPieces = [];
  if (partner?.company) metaPieces.push(partner.company);
  const volumeValue = Number(partner?.volume || partner?.referralVolume);
  if (Number.isFinite(volumeValue) && volumeValue > 0) {
    metaPieces.push(formatCurrency(volumeValue));
  }
  if (partner?.updatedAt || partner?.updatedTs) {
    metaPieces.push(`Updated ${formatRelativeTime(partner.updatedTs || partner.updatedAt)}`);
  }
  meta.textContent = metaPieces.join(' • ') || '—';

  row.appendChild(name);
  row.appendChild(tier);
  row.appendChild(meta);
  return row;
}

function createContactRow(contact, model) {
  const row = document.createElement('div');
  row.className = 'labs-drilldown-row portfolio-contact-row';

  const name = document.createElement('div');
  name.className = 'drilldown-name';
  const displayName = model?.getContactDisplayName?.(contact?.id) || contact?.displayName || contact?.name || 'Contact';
  name.textContent = displayName;

  const stageKey = normalizeStagesForDisplay(contact?.stage || contact?.lane);
  const stageConfig = stageKey ? STAGE_CONFIG[stageKey] || {} : {};
  const stage = document.createElement('div');
  stage.className = 'drilldown-stage';
  stage.textContent = stageConfig.label || stageKey || 'Unknown';

  const meta = document.createElement('div');
  meta.className = 'drilldown-meta';
  const metaPieces = [];
  if (contact?.segmentLabel) metaPieces.push(contact.segmentLabel);
  if (contact?.updatedTs) metaPieces.push(`Updated ${formatRelativeTime(contact.updatedTs)}`);
  meta.textContent = metaPieces.join(' • ') || '—';

  row.appendChild(name);
  row.appendChild(stage);
  row.appendChild(meta);
  return row;
}

function createLoanRow(loan, model) {
  const row = document.createElement('div');
  row.className = 'labs-drilldown-row portfolio-loan-row';

  const name = document.createElement('div');
  name.className = 'drilldown-name';
  name.textContent = loan?.borrowerName || loan?.displayName || loan?.name || 'Loan';

  const partner = document.createElement('div');
  partner.className = 'drilldown-stage';
  const partnerName = loan?.partnerName || loan?.referralPartnerName || model?.getPartnerDisplayName?.(loan?.partnerId);
  partner.textContent = partnerName || 'Partner';

  const meta = document.createElement('div');
  meta.className = 'drilldown-meta';
  const metaPieces = [];
  const amountValue = Number(loan?.amount || loan?.loanAmount);
  if (Number.isFinite(amountValue) && amountValue > 0) {
    metaPieces.push(formatCurrency(amountValue));
  }
  if (loan?.stage) {
    metaPieces.push(loan.stageLabel || normalizeStagesForDisplay(loan.stage));
  }
  if (loan?.updatedTs) {
    metaPieces.push(`Updated ${formatRelativeTime(loan.updatedTs)}`);
  }
  meta.textContent = metaPieces.join(' • ') || '—';

  const navBtn = document.createElement('button');
  navBtn.type = 'button';
  navBtn.className = 'drilldown-nav';
  navBtn.textContent = 'Open';
  navBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const hash = loan?.id ? `pipeline/${loan.id}` : 'pipeline';
    if (globalThis.Router?.goto) {
      globalThis.Router.goto(hash);
    } else if (typeof globalThis.location === 'object') {
      globalThis.location.hash = `#${hash}`;
    }
    closeSingletonModal(MODAL_KEY);
  });

  row.appendChild(name);
  row.appendChild(partner);
  row.appendChild(meta);
  row.appendChild(navBtn);
  return row;
}

function renderList(domain, entries, model) {
  const list = document.createElement('div');
  list.className = 'labs-drilldown-list';

  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No records in this segment.';
    list.appendChild(empty);
    return list;
  }

  entries.forEach((entry) => {
    if (domain === PORTFOLIO_SEGMENT_DOMAINS.PARTNERS) {
      list.appendChild(createPartnerRow(entry, model));
    } else if (domain === PORTFOLIO_SEGMENT_DOMAINS.CONTACTS) {
      list.appendChild(createContactRow(entry, model));
    } else if (domain === PORTFOLIO_SEGMENT_DOMAINS.LOANS) {
      list.appendChild(createLoanRow(entry, model));
    }
  });

  return list;
}

function buildBody(domain, segment, entries, model) {
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-drilldown-body';

  const description = document.createElement('p');
  description.className = 'labs-drilldown-desc';
  description.textContent = `Showing ${domain} for ${segment.label || segment.key || 'segment'}`;
  wrapper.appendChild(description);

  wrapper.appendChild(renderList(domain, entries, model));
  return wrapper;
}

export function openPortfolioDrilldown(model, segment) {
  if (typeof document === 'undefined') return;
  if (!segment) return;

  const normalizedSegment = buildPortfolioSegment(segment.domain, segment.type, segment.key, segment.label);
  const domain = normalizedSegment.domain || PORTFOLIO_SEGMENT_DOMAINS.PARTNERS;

  let entries = [];
  if (domain === PORTFOLIO_SEGMENT_DOMAINS.PARTNERS) {
    entries = getPartnersForPortfolioSegment(model, normalizedSegment);
  } else if (domain === PORTFOLIO_SEGMENT_DOMAINS.CONTACTS) {
    entries = getContactsForPortfolioSegment(model, normalizedSegment);
  } else if (domain === PORTFOLIO_SEGMENT_DOMAINS.LOANS) {
    const rawLoans = getLoansForPortfolioSegment(model, normalizedSegment);
    const displayLoans = Array.isArray(rawLoans)
      ? rawLoans.map((loan) => (typeof model?.getLoanDisplay === 'function' ? model.getLoanDisplay(loan) : loan)).filter(Boolean)
      : [];
    entries = displayLoans;
  }

  const noun = domain === PORTFOLIO_SEGMENT_DOMAINS.PARTNERS
    ? 'partners'
    : domain === PORTFOLIO_SEGMENT_DOMAINS.CONTACTS
    ? 'contacts'
    : 'loans';

  const modal = ensureSingletonModal(MODAL_KEY, () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'labs-drilldown-modal';
    dialog.setAttribute('aria-label', 'Portfolio drilldown');
    dialog.addEventListener('cancel', (evt) => {
      evt.preventDefault();
      closeSingletonModal(MODAL_KEY);
    });
    dialog.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') {
        evt.preventDefault();
        closeSingletonModal(MODAL_KEY);
      }
    });
    return dialog;
  });

  if (!modal) return;

  modal.innerHTML = '';
  modal.appendChild(createHeader(normalizedSegment.label || normalizedSegment.key || 'Segment', entries.length, noun));
  modal.appendChild(buildBody(domain, normalizedSegment, entries, model));
  modal.focus({ preventScroll: true });
}

export function closePortfolioDrilldown() {
  closeSingletonModal(MODAL_KEY);
}

export default openPortfolioDrilldown;
