import { stageLabelFromKey, stageKeyFromLabel } from './pipeline/stages.js';
import { canonicalStage } from './pipeline/constants.js';
import { openContactModal } from './contacts.js';

const NONE_PARTNER_ID = '00000000-0000-none-partner-000000000000';
const STAGE_ORDER = Object.freeze({ lost: -1, denied: -1, 'long-shot': 0, longshot: 0, application: 1, preapproved: 2, 'pre-approved': 2, processing: 3, underwriting: 4, approved: 5, 'cleared-to-close': 6, 'clear-to-close': 6, ctc: 6, funded: 7, won: 7 });
const fmt = {
  text: (value) => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
  number: (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    try { return n.toLocaleString(); }
    catch (_err) { return String(n); }
  },
  money: (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n === 0) return '$0';
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }
    catch (_err) { return `$${Math.round(n)}`; }
  },
  date: (value) => {
    const ts = toTimestamp(value);
    if (ts == null) return '—';
    try { return new Date(ts).toISOString().slice(0, 10); }
    catch (_err) { return '—'; }
  }
};
const state = { partnerId: '', rows: [], filter: '', stage: 'all', sortKey: 'updated', sortDir: 'desc', dom: null, loading: false };

const toTimestamp = (value) => {
  if (value instanceof Date) { const t = value.getTime(); return Number.isNaN(t) ? null : t; }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) { const parsed = Date.parse(value); return Number.isNaN(parsed) ? null : parsed; }
  return null;
};

const deriveRole = (contact, partnerId) => {
  const id = String(partnerId || '');
  const buyer = contact && contact.buyerPartnerId != null ? String(contact.buyerPartnerId) : '';
  const listing = contact && contact.listingPartnerId != null ? String(contact.listingPartnerId) : '';
  if (id && buyer === id && listing === id) return 'Buyer & Listing';
  if (id && buyer === id) return 'Buyer';
  if (id && listing === id) return 'Listing';
  if (contact && contact.partnerRole) return String(contact.partnerRole);
  return 'Referral';
};

const deriveName = (contact) => {
  if (!contact) return '—';
  const first = contact.first || contact.givenName || '';
  const last = contact.last || contact.surname || '';
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  if (contact.name) return String(contact.name);
  if (contact.title) return String(contact.title);
  return contact.email || contact.phone || '—';
};

const rowFrom = (contact, partnerId) => {
  const id = contact && contact.id != null ? String(contact.id) : '';
  if (!id) return null;
  const stageKey = stageKeyFromLabel(contact && (contact.stage || contact.status || ''));
  const stageLabel = stageLabelFromKey(stageKey);
  const canonical = canonicalStage(stageKey) || canonicalStage(contact && contact.stage) || '';
  const amount = Number(contact && (contact.loanAmount ?? contact.amount) ?? 0) || 0;
  const lastActivity = toTimestamp(contact && (contact.updatedAt ?? contact.lastContact ?? contact.fundedDate ?? contact.createdAt));
  const role = deriveRole(contact, partnerId);
  const name = deriveName(contact);
  const search = [name, stageLabel, role, contact && contact.loanType, contact && contact.referredBy].filter(Boolean).join(' ').toLowerCase();
  const key = String(stageKey).toLowerCase();
  const canonicalKey = String(canonical).toLowerCase();
  return {
    id,
    name,
    nameSort: name.toLowerCase(),
    stageKey,
    stageLabel,
    canonical,
    stageOrder: STAGE_ORDER[key] ?? STAGE_ORDER[canonicalKey] ?? 0,
    amount,
    role,
    roleSort: role.toLowerCase(),
    lastActivity: lastActivity == null ? -Infinity : lastActivity,
    lastActivityLabel: fmt.date(lastActivity),
    search
  };
};

const collectRows = (partnerId, contacts) => {
  if (!partnerId || !Array.isArray(contacts)) return [];
  const target = String(partnerId);
  return contacts
    .filter((contact) => {
      if (!contact) return false;
      const buyer = contact.buyerPartnerId != null ? String(contact.buyerPartnerId) : '';
      const listing = contact.listingPartnerId != null ? String(contact.listingPartnerId) : '';
      if (!buyer && !listing) return false;
      if (buyer === NONE_PARTNER_ID || listing === NONE_PARTNER_ID) return false;
      return buyer === target || listing === target;
    })
    .map((contact) => rowFrom(contact, target))
    .filter(Boolean);
};

const ensureDom = (root) => {
  if (!root || typeof root.querySelector !== 'function') return null;
  const panel = root.querySelector('.partner-panel[data-panel="linked"]');
  if (!panel) return null;
  let section = panel.querySelector('#partner-referral-section');
  if (!section) {
    const kpiBlocks = [['total', 'Referred Deals'], ['active', 'Active Pipeline'], ['funded', 'Funded Volume'], ['win-rate', 'Win Rate']]
      .map(([key, label]) => `<div class="summary-metric" data-kpi="${key}"><span class="metric-label">${label}</span><span class="metric-value">—</span></div>`)
      .join('');
    section = document.createElement('section');
    section.id = 'partner-referral-section';
    section.className = 'partner-referral-section';
    section.innerHTML = `
      <h5 class="section-subhead">Referral Performance</h5>
      <div class="summary-metrics partner-referral-kpis">${kpiBlocks}</div>
      <div class="referral-controls" data-role="partner-referral-controls">
        <input type="search" data-role="partner-referral-filter" placeholder="Filter referrals" aria-label="Filter referrals">
        <select data-role="partner-referral-stage" aria-label="Filter by referral status">
          <option value="all">All statuses</option>
          <option value="active">Active pipeline</option>
          <option value="won">Won / Funded</option>
          <option value="lost">Lost</option>
        </select>
      </div>
      <div class="referral-table-wrap">
        <table class="table partner-referral-table">
          <thead>
            <tr>
              <th><button class="sort-btn" data-sort-key="name" type="button">Borrower <span aria-hidden="true" class="sort-icon">↕</span></button></th>
              <th><button class="sort-btn" data-sort-key="stage" type="button">Stage <span aria-hidden="true" class="sort-icon">↕</span></button></th>
              <th><button class="sort-btn" data-sort-key="amount" type="button">Loan Amount <span aria-hidden="true" class="sort-icon">↕</span></button></th>
              <th><button class="sort-btn" data-sort-key="role" type="button">Role <span aria-hidden="true" class="sort-icon">↕</span></button></th>
              <th><button class="sort-btn" data-sort-key="updated" type="button">Last Activity <span aria-hidden="true" class="sort-icon">↕</span></button></th>
            </tr>
          </thead>
          <tbody data-role="partner-referral-rows"></tbody>
        </table>
        <div class="muted empty" data-role="partner-referral-empty" hidden>No referrals recorded for this partner yet.</div>
      </div>`;
    const anchor = panel.querySelector('#partner-linked-summary');
    if (anchor && anchor.parentNode === panel) panel.insertBefore(section, anchor);
    else panel.appendChild(section);
  }
  const dom = {
    section,
    kpis: {
      total: section.querySelector('[data-kpi="total"] .metric-value'),
      active: section.querySelector('[data-kpi="active"] .metric-value'),
      funded: section.querySelector('[data-kpi="funded"] .metric-value'),
      winRate: section.querySelector('[data-kpi="win-rate"] .metric-value')
    },
    filter: section.querySelector('[data-role="partner-referral-filter"]'),
    stage: section.querySelector('[data-role="partner-referral-stage"]'),
    table: section.querySelector('[data-role="partner-referral-rows"]'),
    empty: section.querySelector('[data-role="partner-referral-empty"]'),
    sortButtons: Array.from(section.querySelectorAll('button[data-sort-key]'))
  };
  if (!section.__partnerReferralWired) {
    if (dom.filter) dom.filter.addEventListener('input', onFilter);
    if (dom.stage) dom.stage.addEventListener('change', onStageChange);
    if (dom.table) dom.table.addEventListener('click', onRowClick);
    dom.sortButtons.forEach((btn) => btn.addEventListener('click', onSortClick));
    section.__partnerReferralWired = true;
  }
  return dom;
};

const setLoading = (flag) => {
  state.loading = flag;
  if (!state.dom) return;
  if (flag) {
    if (state.dom.table) state.dom.table.innerHTML = '';
    if (state.dom.empty) {
      state.dom.empty.textContent = 'Loading referrals…';
      state.dom.empty.hidden = false;
    }
  } else if (state.dom.empty && state.dom.empty.textContent === 'Loading referrals…') {
    state.dom.empty.textContent = 'No referrals recorded for this partner yet.';
  }
};

const metrics = (rows) => {
  const funded = rows.filter((row) => row.canonical === 'won');
  const lost = rows.filter((row) => row.canonical === 'lost');
  const active = rows.filter((row) => row.canonical !== 'won' && row.canonical !== 'lost');
  const fundedVolume = funded.reduce((sum, row) => sum + (row.amount || 0), 0);
  const denominator = funded.length + lost.length;
  return { total: rows.length, active: active.length, funded: fundedVolume, winRate: denominator ? Math.round((funded.length / denominator) * 100) : null };
};

const updateKpis = () => {
  if (!state.dom) return;
  const { total, active, funded, winRate } = metrics(state.rows);
  if (state.dom.kpis.total) state.dom.kpis.total.textContent = fmt.number(total);
  if (state.dom.kpis.active) state.dom.kpis.active.textContent = fmt.number(active);
  if (state.dom.kpis.funded) state.dom.kpis.funded.textContent = fmt.money(funded);
  if (state.dom.kpis.winRate) state.dom.kpis.winRate.textContent = winRate == null ? '—' : `${winRate}%`;
};

const filteredRows = () => state.rows.filter((row) => {
  if (state.filter && !row.search.includes(state.filter)) return false;
  if (state.stage === 'active') return row.canonical !== 'won' && row.canonical !== 'lost';
  if (state.stage === 'won') return row.canonical === 'won';
  if (state.stage === 'lost') return row.canonical === 'lost';
  return true;
});

const sortedRows = (rows) => {
  const dir = state.sortDir === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    let av;
    let bv;
    switch (state.sortKey) {
      case 'name': av = a.nameSort; bv = b.nameSort; break;
      case 'stage': av = a.stageOrder; bv = b.stageOrder; if (av === bv) { av = a.nameSort; bv = b.nameSort; } break;
      case 'amount': av = a.amount || 0; bv = b.amount || 0; break;
      case 'role': av = a.roleSort; bv = b.roleSort; break;
      default: av = a.lastActivity; bv = b.lastActivity; break;
    }
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
};

const updateSortIndicators = () => {
  if (!state.dom) return;
  state.dom.sortButtons.forEach((btn) => {
    const key = btn.dataset.sortKey || '';
    const icon = btn.querySelector('.sort-icon');
    if (key === state.sortKey) {
      btn.dataset.sortActive = '1';
      btn.dataset.sortDir = state.sortDir;
      if (icon) icon.textContent = state.sortDir === 'asc' ? '↑' : '↓';
    } else {
      delete btn.dataset.sortActive;
      delete btn.dataset.sortDir;
      if (icon) icon.textContent = '↕';
    }
  });
};

const updateTable = () => {
  if (!state.dom) return;
  const rows = sortedRows(filteredRows());
  updateKpis();
  updateSortIndicators();
  if (!state.dom.table) return;
  if (!rows.length) {
    state.dom.table.innerHTML = '';
    if (state.dom.empty) {
      state.dom.empty.textContent = state.loading ? 'Loading referrals…' : 'No referrals recorded for this partner yet.';
      state.dom.empty.hidden = false;
    }
    return;
  }
  state.dom.table.innerHTML = rows.map((row) => {
    const loan = row.amount ? fmt.money(row.amount) : '—';
    return `<tr data-contact-id="${fmt.text(row.id)}" data-stage="${fmt.text(row.stageKey)}"><td><span class="link">${fmt.text(row.name)}</span></td><td>${fmt.text(row.stageLabel)}</td><td>${fmt.text(loan)}</td><td>${fmt.text(row.role)}</td><td>${fmt.text(row.lastActivityLabel)}</td></tr>`;
  }).join('');
  if (state.dom.empty) state.dom.empty.hidden = true;
};

const loadRows = async (partnerId) => {
  if (!partnerId) {
    state.rows = [];
    updateTable();
    return;
  }
  setLoading(true);
  try {
    if (typeof openDB === 'function') await openDB();
    const contacts = typeof dbGetAll === 'function' ? await dbGetAll('contacts') : [];
    state.rows = collectRows(partnerId, contacts);
  } catch (err) {
    state.rows = [];
    try { if (console && typeof console.warn === 'function') console.warn('[partners:detail] load failed', err); }
    catch (_err) {}
  } finally {
    setLoading(false);
    updateTable();
  }
};

const onFilter = (event) => {
  state.filter = String(event && event.target && event.target.value ? event.target.value : '').trim().toLowerCase();
  updateTable();
};

const onStageChange = (event) => {
  state.stage = String(event && event.target && event.target.value ? event.target.value : 'all');
  updateTable();
};

const onSortClick = (event) => {
  const btn = event && event.currentTarget ? event.currentTarget : (event && event.target && event.target.closest('button[data-sort-key]'));
  if (!btn) return;
  event.preventDefault();
  const key = btn.dataset.sortKey || 'updated';
  if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  else { state.sortKey = key; state.sortDir = key === 'name' ? 'asc' : 'desc'; }
  updateTable();
};

const onRowClick = (event) => {
  const row = event && event.target ? event.target.closest('tr[data-contact-id]') : null;
  if (!row) return;
  event.preventDefault();
  const id = row.getAttribute('data-contact-id');
  if (!id || typeof openContactModal !== 'function') return;
  try { openContactModal(id, { sourceHint: 'partners:detail-referrals', trigger: row }); }
  catch (err) { try { if (console && typeof console.warn === 'function') console.warn('[partners:detail] openContactModal failed', err); }
    catch (_err) {} }
};

const resetState = () => {
  state.rows = [];
  state.filter = '';
  state.stage = 'all';
  state.sortKey = 'updated';
  state.sortDir = 'desc';
  if (state.dom) {
    if (state.dom.filter) state.dom.filter.value = '';
    if (state.dom.stage) state.dom.stage.value = 'all';
    if (state.dom.table) state.dom.table.innerHTML = '';
    if (state.dom.empty) { state.dom.empty.textContent = 'No referrals recorded for this partner yet.'; state.dom.empty.hidden = true; }
  }
};

const handleReady = (event) => {
  const detail = event && event.detail ? event.detail : {};
  const dialog = detail.dialog || null;
  const record = detail.record || null;
  const partnerId = record && record.id != null ? String(record.id) : '';
  if (!dialog || !partnerId) return;
  state.dom = ensureDom(dialog);
  if (!state.dom) return;
  state.partnerId = partnerId;
  state.filter = '';
  state.stage = 'all';
  state.sortKey = 'updated';
  state.sortDir = 'desc';
  if (state.dom.filter) state.dom.filter.value = '';
  if (state.dom.stage) state.dom.stage.value = 'all';
  if (!dialog.__partnerReferralCleanup) {
    const cleanup = () => { dialog.__partnerReferralCleanup = null; state.partnerId = ''; resetState(); };
    try { dialog.addEventListener('close', cleanup, { once: true }); }
    catch (_err) { dialog.addEventListener('close', cleanup); }
    dialog.__partnerReferralCleanup = cleanup;
  }
  loadRows(partnerId);
};

const handleDataChanged = (event) => {
  if (!state.partnerId) return;
  const detail = event && event.detail ? event.detail : {};
  const scope = detail.scope ? String(detail.scope).toLowerCase() : '';
  if (!scope || scope === 'contacts' || scope === 'partners' || scope === 'pipeline') loadRows(state.partnerId);
};

(function install(){
  if (typeof document === 'undefined') return;
  if (!document.__PARTNER_DETAIL_READY__) {
    document.addEventListener('partner:modal:ready', handleReady);
    document.addEventListener('app:data:changed', handleDataChanged);
    document.__PARTNER_DETAIL_READY__ = true;
  }
})();

export async function init(){
  if (state.partnerId) await loadRows(state.partnerId);
}

export default { init };
