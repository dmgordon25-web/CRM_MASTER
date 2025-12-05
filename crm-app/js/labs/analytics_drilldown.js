import {
  STAGE_CONFIG,
  formatCurrency,
  formatRelativeTime,
  getLoansForAnalyticsSegment,
  getStageAgeInDays,
  normalizeStagesForDisplay
} from './data.js';
import { ensureSingletonModal, closeSingletonModal } from '../ui/modal_singleton.js';

const MODAL_KEY = 'labs-analytics-drilldown';

function createHeader(titleText, count) {
  const header = document.createElement('div');
  header.className = 'labs-drilldown-header';

  const title = document.createElement('h3');
  title.className = 'labs-drilldown-title';
  title.textContent = `${titleText} (${count} loans)`;
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

function createLoanRow(loan) {
  const row = document.createElement('div');
  row.className = 'labs-drilldown-row';

  const name = document.createElement('div');
  name.className = 'drilldown-name';
  name.textContent = loan.borrowerName || loan.displayName || loan.name || 'Unnamed borrower';

  const stageKey = normalizeStagesForDisplay(loan.stage || loan.lane || loan.stageId);
  const stageConfig = stageKey ? STAGE_CONFIG[stageKey] || {} : {};
  const stage = document.createElement('div');
  stage.className = 'drilldown-stage';
  stage.textContent = loan.stageLabel || stageConfig.label || stageKey || 'Unknown';

  const meta = document.createElement('div');
  meta.className = 'drilldown-meta';
  const pieces = [];
  const amountValue = Number.isFinite(Number(loan.amount)) ? Number(loan.amount) : Number(loan.loanAmount);
  if (Number.isFinite(amountValue) && amountValue > 0) {
    pieces.push(formatCurrency(amountValue));
  }
  if (loan.partnerName || loan.referralPartnerName) {
    pieces.push(loan.partnerName || loan.referralPartnerName);
  }
  const age = getStageAgeInDays(loan);
  if (typeof age === 'number') {
    pieces.push(`${age}d in stage`);
  }
  if (loan.updatedTs) {
    pieces.push(`Updated ${formatRelativeTime(loan.updatedTs)}`);
  }
  meta.textContent = pieces.join(' • ');

  const navBtn = document.createElement('button');
  navBtn.type = 'button';
  navBtn.className = 'drilldown-nav';
  navBtn.textContent = 'Open';
  navBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const hash = loan?.id ? `pipeline/${loan.id}` : 'pipeline';
    if (globalThis.Router && typeof globalThis.Router.goto === 'function') {
      globalThis.Router.goto(hash);
    } else if (typeof globalThis.location === 'object') {
      globalThis.location.hash = `#${hash}`;
    }
    closeSingletonModal(MODAL_KEY);
  });

  row.appendChild(name);
  row.appendChild(stage);
  row.appendChild(meta);
  row.appendChild(navBtn);
  return row;
}

function renderLoansList(loans) {
  const list = document.createElement('div');
  list.className = 'labs-drilldown-list';

  if (!loans.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No loans in this segment.';
    list.appendChild(empty);
    return list;
  }

  loans.forEach((loan) => {
    list.appendChild(createLoanRow(loan));
  });
  return list;
}

function buildDrilldownBody(segment, loans) {
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-drilldown-body';

  const description = document.createElement('p');
  description.className = 'labs-drilldown-desc';
  description.textContent = `Showing loans for ${segment.label || segment.key || 'segment'}`;
  wrapper.appendChild(description);

  wrapper.appendChild(renderLoansList(loans));
  return wrapper;
}

export function openAnalyticsDrilldown(model, segment) {
  if (typeof document === 'undefined') return;
  if (!segment) return;

  const loans = getLoansForAnalyticsSegment(model, segment);
  const displayLoans = Array.isArray(loans)
    ? loans.map((loan) => (typeof model?.getLoanDisplay === 'function' ? model.getLoanDisplay(loan) : loan)).filter(Boolean)
    : [];
  const modal = ensureSingletonModal(MODAL_KEY, () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'labs-drilldown-modal';
    dialog.setAttribute('aria-label', 'Analytics drilldown');
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
  modal.appendChild(createHeader(segment.label || segment.key || 'Segment', displayLoans.length));
  modal.appendChild(buildDrilldownBody(segment, displayLoans));
  modal.focus({ preventScroll: true });
}

export function closeAnalyticsDrilldown() {
  closeSingletonModal(MODAL_KEY);
}

export default openAnalyticsDrilldown;
