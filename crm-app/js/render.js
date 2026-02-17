// render.js — clean
import { STR, text as translate } from './ui/strings.js';
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_KEYS,
  NORMALIZE_STAGE,
  stageKeyFromLabel,
  stageLabelFromKey,
} from './pipeline/stages.js';
import {
  renderStageChip,
  canonicalStage,
  STAGES as CANONICAL_STAGE_META,
  normalizeStatus,
  toneForStage,
  toneClassName
} from './pipeline/constants.js';
import { NONE_PARTNER_ID } from './constants/ids.js';
// import { openContactEditor } from './contacts.js'; // REMOVED to fix circular dependency/syntax error
import { openPartnerEditor } from './editors/partner_entry.js';
import { registerRenderer } from './app_services.js';
import { renderPortfolioMixWidget } from './dashboard/widgets/portfolio_mix.js';
import { renderReferralLeadersWidget } from './dashboard/widgets/referral_leaders.js';
import { renderPipelineMomentumWidget } from './dashboard/widgets/pipeline_momentum.js';
import { renderTodoWidget } from './dashboard/widgets/todo_widget.js';
import { ensureFavoriteState, normalizeFavoriteSnapshot, applyFavoriteSnapshot, renderFavoriteToggle, toggleFavorite } from './util/favorites.js';
import { clearSelectionForSurface } from './services/selection_reset.js';
import { createLegendPopover, STAGE_LEGEND_ENTRIES } from './ui/legend_popover.js';
import { attachLoadingBlock, detachLoadingBlock, applyTableSkeleton, markTableHasData } from './ui/loading_block.js';
import { syncTableLayout } from './ui/table_layout.js';
import { getColumnsForView } from './tables/column_config.js';
import { getUiMode } from './ui/ui_mode.js';
import { logError } from './util/errors.js';

const perf = typeof performance !== 'undefined' ? performance : null;
const perfReady = perf && typeof perf.now === 'function';
const perfEnabled = () => Boolean(perfReady && typeof window !== 'undefined' && window.__CRM_DEBUG_PERF);
const perfMark = (label) => ({ label, start: perfEnabled() ? perf.now() : 0 });
const perfLog = (mark) => {
  if (!mark || !mark.label || !perfEnabled() || !mark.start) return;
  try {
    const duration = perf.now() - mark.start;
    console.log(`[PERF] ${mark.label} ${duration.toFixed(1)} ms`);
  } catch (err) { logError('render:perf-log', err); }
};

const RENDER_SCOPE_TOKENS = new Set(['dashboard', 'contacts', 'pipeline', 'partners', 'tasks', 'longshots', 'documents']);

function normalizeScopeInput(value, into) {
  const target = into || [];
  if (value == null) return target;
  if (Array.isArray(value)) {
    value.forEach((entry) => normalizeScopeInput(entry, target));
    return target;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed) target.push(trimmed);
    return target;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.scopes)) normalizeScopeInput(value.scopes, target);
    else if (typeof value.scope === 'string') normalizeScopeInput(value.scope, target);
    return target;
  }
  return target;
}

function parseRenderScopes(request) {
  const scopes = normalizeScopeInput(request, []);
  const valid = scopes.filter(token => RENDER_SCOPE_TOKENS.has(token));
  return valid.length ? new Set(valid) : null;
}

function shouldRenderScope(scopeSet, ...aliases) {
  if (!scopeSet || scopeSet.size === 0) return true;
  return aliases.some(alias => scopeSet.has(alias));
}

// IIFE Removed
const STAGES_PIPE = ['application', 'processing', 'underwriting'];
const STAGES_CLIENT = ['approved', 'cleared-to-close', 'funded', 'post-close'];
const TABLE_IDS = [
  'tbl-inprog',
  'tbl-status-active',
  'tbl-status-clients',
  'tbl-status-longshots',
  'tbl-partners',
  'tbl-pipeline',
  'tbl-clients',
  'tbl-longshots',
  'tbl-funded',
  'tbl-ledger-received',
  'tbl-ledger-projected',
  'tbl-doc-templates',
  'tbl-msg-templates'
];
const DASHBOARD_BLOCKS = [
  '#dashboard-focus',
  '#dashboard-filters',
  '#dashboard-kpis',
  '#dashboard-pipeline-overview',
  '#dashboard-today',
  '#dashboard-todo',
  '#referral-leaderboard',
  '#dashboard-stale',
  '#dashboard-insights',
  '#goal-progress-card',
  '#numbers-portfolio-card',
  '#numbers-referrals-card',
  '#numbers-momentum-card',
  '#pipeline-calendar-card'
];
const CALENDAR_CARD_SELECTOR = '#view-calendar .calendar-card';
const TABLE_LOADING_OPTIONS = Object.freeze({ lines: 6, reserve: 'table', minHeight: 280 });
const DASHBOARD_LOADING_OPTIONS = Object.freeze({ lines: 4, reserve: 'widget', minHeight: 220 });
const CALENDAR_LOADING_OPTIONS = Object.freeze({ lines: 0, reserve: 'calendar', minHeight: 320 });
let loadingPrimed = false;
const hostLoadingCounts = new WeakMap();
const pendingLoadingReleases = [];

function acquireLoadingForHost(host, options = {}) {
  if (!host || typeof host !== 'object') return () => { };
  const previous = hostLoadingCounts.get(host) || 0;
  if (previous === 0) {
    try { attachLoadingBlock(host, options); }
    catch (_err) { }
  }
  hostLoadingCounts.set(host, previous + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = hostLoadingCounts.get(host) || 0;
    const next = Math.max(0, current - 1);
    if (next === 0) {
      hostLoadingCounts.delete(host);
      try { detachLoadingBlock(host); }
      catch (_err) { }
    } else {
      hostLoadingCounts.set(host, next);
    }
  };
}

function rememberLoadingRelease(release) {
  if (typeof release === 'function') pendingLoadingReleases.push(release);
}

function releasePendingLoading() {
  while (pendingLoadingReleases.length) {
    const release = pendingLoadingReleases.pop();
    try { release(); }
    catch (_err) { }
  }
}

function findListLoadingHost(table) {
  if (!table || typeof table !== 'object') return null;
  let host = null;
  if (typeof table.closest === 'function') {
    const selectors = ['[data-loading-host]', '.card', '.table-card', '.status-table-wrap'];
    for (const selector of selectors) {
      const candidate = table.closest(selector);
      if (candidate && candidate !== table) {
        host = candidate;
        break;
      }
    }
  }
  if (!host) {
    const parent = table.parentElement;
    if (parent && parent !== table && parent !== document.body && parent !== document.documentElement) {
      host = parent;
    }
  }
  return host || null;
}

function asEl(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') return document.getElementById(ref) || null;
  return (ref instanceof Element) ? ref : null;
}

function setText(target, value) {
  const el = asEl(target);
  if (!el) {
    if (target) console.warn('render: missing node for', target);
    return;
  }
  el.textContent = value ?? '';
}
function renderTableBody(table, body, html) {
  if (!body) return;
  body.innerHTML = html;
  const host = table || (body.closest ? body.closest('table') : null);
  if (host) {
    markTableHasData(host);
    syncTableLayout(host);
    if (typeof window !== 'undefined') {
      try {
        // Ensure select-all checkbox is wired up for all tables
        if (typeof window.ensureRowCheckHeaders === 'function') {
          window.ensureRowCheckHeaders(host);
          // Also ensure all tables in the document are wired
          requestAnimationFrame(() => {
            if (typeof window.ensureRowCheckHeaders === 'function') {
              window.ensureRowCheckHeaders(document);
            }
          });
        }
        const scope = host.getAttribute ? host.getAttribute('data-selection-scope') : null;
        if (scope && typeof window.syncSelectionScope === 'function') {
          window.syncSelectionScope(scope, { root: host });
        }
      } catch (_err) { }
    }
  }
}
function primeLoadingPlaceholders() {
  if (loadingPrimed || typeof document === 'undefined') return;
  loadingPrimed = true;
  TABLE_IDS.forEach(id => {
    const table = applyTableSkeleton(id);
    if (!table) return;
    const host = findListLoadingHost(table);
    if (!host) return;
    rememberLoadingRelease(acquireLoadingForHost(host, Object.assign({}, TABLE_LOADING_OPTIONS)));
  });
  DASHBOARD_BLOCKS.forEach(sel => {
    const node = document.querySelector(sel);
    if (!node) return;
    rememberLoadingRelease(acquireLoadingForHost(node, Object.assign({}, DASHBOARD_LOADING_OPTIONS)));
  });
  const calendarCard = document.querySelector(CALENDAR_CARD_SELECTOR);
  if (calendarCard) rememberLoadingRelease(acquireLoadingForHost(calendarCard, Object.assign({}, CALENDAR_LOADING_OPTIONS)));
}
function releaseLoadingPlaceholders() {
  if (typeof document === 'undefined') return;
  releasePendingLoading();
}
function html(el, v) { if (el) el.innerHTML = v; }
function money(n) { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n || 0)); } catch (_) { return '$' + (Number(n || 0).toFixed(0)); } }
function percentValue(n) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 }).format(Number(n || 0));
  } catch (_) {
    const numeric = Number(n || 0);
    if (!Number.isFinite(numeric)) return '0%';
    return `${Math.round(numeric * 100)}%`;
  }
}
function integer(n) {
  const numeric = Number(n || 0);
  if (!Number.isFinite(numeric)) return '0';
  try { return numeric.toLocaleString(); }
  catch (_) { return String(Math.round(numeric)); }
}
function fullName(c) { return [c.first, c.last].filter(Boolean).join(' ') || c.name || '—'; }
function safe(v) { return String(v == null ? '' : v).replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch])); }
function attr(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch])); }
function resolveColumnMode() {
  try { return getUiMode(); }
  catch (_err) { return 'advanced'; }
}
function avatarCharToken(ch) {
  if (!ch) return '';
  const upper = ch.toLocaleUpperCase();
  const lower = ch.toLocaleLowerCase();
  if (upper !== lower) return upper;
  return /[0-9]/.test(ch) ? ch : '';
}
function computeInitialsToken(name) {
  const parts = Array.from(String(name || '').trim().split(/\s+/).filter(Boolean));
  if (!parts.length) return '';
  const tokens = parts.map(part => {
    const chars = Array.from(part);
    for (const ch of chars) {
      const token = avatarCharToken(ch);
      if (token) return token;
    }
    return '';
  }).filter(Boolean);
  if (!tokens.length) return '';
  let first = tokens[0] || '';
  let second = '';
  if (tokens.length > 1) {
    second = tokens[tokens.length - 1] || '';
  } else {
    const chars = Array.from(parts[0]).slice(1);
    for (const ch of chars) {
      const token = avatarCharToken(ch);
      if (token) {
        second = token;
        break;
      }
    }
  }
  const combined = (first + second).slice(0, 2);
  return combined || first || '';
}
function initials(name) {
  return computeInitialsToken(name) || '—';
}
function renderAvatar(name) {
  const tokens = computeInitialsToken(name);
  const classes = ['initials-avatar'];
  let value = tokens;
  if (!tokens) {
    classes.push('is-empty');
    value = '?';
  }
  return `<span class="${classes.join(' ')}" aria-hidden="true" data-initials="${attr(value)}"></span>`;
}
function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;
  if (typeof value === 'string' && value.length === 10) {
    const alt = new Date(value + 'T00:00:00');
    if (!Number.isNaN(alt.getTime())) return alt;
  }
  return null;
}
const displayDate = (value) => { const d = toDate(value); return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : '—'; };
function daysAgo(date, ref) { if (!date) return null; const diff = Math.floor((ref.getTime() - date.getTime()) / 86400000); return diff; }
const stageLabels = {
  'long shot': translate('stage.long-shot'),
  application: translate('stage.application'),
  processing: translate('stage.processing'),
  underwriting: translate('stage.underwriting'),
  approved: translate('stage.approved'),
  'cleared-to-close': translate('stage.cleared-to-close'),
  funded: translate('stage.funded'),
  'post-close': translate('stage.post-close'),
  nurture: translate('stage.nurture'),
  lost: translate('stage.lost'),
  denied: translate('stage.denied')
};
const stageColors = {
  application: '#6366f1',
  processing: '#f97316',
  underwriting: '#f59e0b',
  approved: '#10b981',
  'cleared-to-close': '#0ea5e9',
  funded: '#0f172a',
  'post-close': '#0284c7',
  nurture: '#0ea5e9',
  lost: '#ef4444',
  denied: '#ef4444',
  'long shot': '#94a3b8'
};
const tierColors = {
  core: '#0f766e',
  preferred: '#047857',
  strategic: '#5b21b6',
  developing: '#92400e',
  partner: '#4f46e5'
};
function parseHexColor(value) {
  if (!value) return null;
  const hex = String(value).trim();
  const match = /^#?([a-f0-9]{6})$/i.exec(hex);
  if (!match) return null;
  const raw = match[1];
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16)
  };
}
function tintedColor(color, alpha) {
  const rgb = parseHexColor(color);
  if (!rgb) return null;
  const a = typeof alpha === 'number' ? Math.max(0, Math.min(1, alpha)) : 0;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}
function rowToneStyle(color) {
  if (!color || !parseHexColor(color)) return '';
  const pieces = [`--row-accent:${color}`];
  const tint = tintedColor(color, 0.08);
  const hover = tintedColor(color, 0.16);
  if (tint) pieces.push(`--row-tint:${tint}`);
  if (hover) pieces.push(`--row-hover:${hover}`);
  return pieces.length ? ` style="${attr(pieces.join(';'))}"` : '';
}

function ensurePipelineLegend() {
  if (typeof document === 'undefined') return;
  const card = document.getElementById('kanban-card');
  if (!card) return;
  const header = card.querySelector('.row');
  if (!header || header.__legendAttached) return;
  if (typeof header.appendChild !== 'function') {
    header.__legendAttached = true;
    return;
  }
  const legend = createLegendPopover({
    id: 'pipeline-stage-legend',
    summaryLabel: 'Legend',
    summaryAriaLabel: 'Pipeline color legend',
    title: 'Stage colors',
    entries: STAGE_LEGEND_ENTRIES,
    note: 'Row highlights and Kanban chips share these pipeline colors.'
  });
  if (!legend) return;
  const canInsertBefore = typeof header.insertBefore === 'function';
  const controls = typeof header.querySelector === 'function' ? header.querySelector('.kanban-controls') : null;
  if (controls && canInsertBefore) {
    header.insertBefore(legend, controls);
  } else {
    const grow = typeof header.querySelector === 'function' ? header.querySelector('.grow') : null;
    if (grow && grow.parentElement === header && canInsertBefore) {
      header.insertBefore(legend, grow.nextSibling);
    } else {
      header.appendChild(legend);
    }
  }
  header.__legendAttached = true;
}

function ensureStatusStackLegend() {
  if (typeof document === 'undefined') return;
  const stack = document.getElementById('dashboard-status-stack');
  if (!stack) return;
  // Check if legend already exists
  if (stack.__legendAttached || stack.querySelector('[data-legend="status-stack"]')) return;
  const legend = createLegendPopover({
    id: 'status-stack-stage-legend',
    summaryLabel: 'Legend',
    summaryAriaLabel: 'Status table color legend',
    title: 'Stage colors',
    entries: STAGE_LEGEND_ENTRIES,
    note: 'All status tables use these colors for stage identification.'
  });
  if (!legend) return;
  legend.setAttribute('data-legend', 'status-stack');
  legend.style.marginBottom = '12px';
  // Insert at the beginning of the status stack
  const firstPanel = stack.querySelector('.status-panel');
  if (firstPanel && typeof stack.insertBefore === 'function') {
    stack.insertBefore(legend, firstPanel);
  } else {
    stack.insertBefore(legend, stack.firstChild);
  }
  stack.__legendAttached = true;
}
function classToken(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function colorForStage(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (stageColors[lowered]) return stageColors[lowered];
  const normalized = normalizeStatus(raw);
  if (normalized) {
    if (stageColors[normalized]) return stageColors[normalized];
    const spaced = normalized.replace(/-/g, ' ');
    if (stageColors[spaced]) return stageColors[spaced];
  }
  const spacedRaw = lowered.replace(/-/g, ' ');
  if (stageColors[spacedRaw]) return stageColors[spacedRaw];
  return null;
}
function colorForTier(value) {
  if (!value) return null;
  const lowered = String(value).trim().toLowerCase();
  if (!lowered) return null;
  return tierColors[lowered] || null;
}
const $ = (sel, root = document) => root.querySelector(sel);
const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function ensureFavoriteColumn(table) {
  if (!table || !table.tHead || !table.tHead.rows || !table.tHead.rows[0]) return;
  const head = table.tHead.rows[0];
  const hasFavorite = Array.from(head.cells || []).some(cell => cell && cell.dataset && cell.dataset.column === 'favorite');
  if (hasFavorite) return;
  const th = document.createElement('th');
  th.dataset.column = 'favorite';
  th.className = 'favorite-col';
  th.setAttribute('aria-label', 'Favorite');
  th.title = 'Favorite';
  th.innerHTML = '<span aria-hidden="true">★</span>';
  th.style.width = '36px';
  th.style.minWidth = '36px';
  th.style.textAlign = 'center';
  head.insertBefore(th, head.cells[1] || null);
}

function renderContactHeader(table, columns, selectId) {
  if (!table) return;
  const head = table.tHead || table.createTHead();
  const row = head.rows[0] || head.insertRow();
  const selectCell = `<th data-role="select" data-column="select" style="width:44px;text-align:center;"><input aria-label="Select all" data-ui="row-check-all" data-role="select-all"${selectId ? ` id="${attr(selectId)}"` : ''} type="checkbox"></th>`;
  const numberColumns = new Set(['loanAmount', 'referrals', 'funded', 'active', 'volume', 'conversion']);
  const headerCells = columns.map((col) => {
    const sortKey = col.sortKey || col.id;
    if (sortKey) {
      const typeAttr = numberColumns.has(sortKey) ? ' data-type="number"' : '';
      return `<th data-column="${attr(col.id)}"><button class="sort-btn" data-key="${attr(sortKey)}"${typeAttr} type="button">${safe(col.label || col.id)} <span aria-hidden="true" class="sort-icon">↕</span></button></th>`;
    }
    return `<th data-column="${attr(col.id)}">${safe(col.label || col.id)}</th>`;
  });
  row.innerHTML = [selectCell, ...headerCells].join('');
}

function renderPartnerHeader(table, columns) {
  if (!table) return;
  const head = table.tHead || table.createTHead();
  const row = head.rows[0] || head.insertRow();
  const selectCell = '<th data-role="select" data-column="select" style="width:44px;text-align:center;"><input aria-label="Select all" data-ui="row-check-all" data-role="select-all" id="partners-all" type="checkbox"></th>';
  const sortableMeta = {
    name: { sortKey: 'name' },
    company: { sortKey: 'company' },
    tier: { sortKey: 'tier' },
    referrals: { sortKey: 'referrals', type: 'number' },
    funded: { sortKey: 'funded', type: 'number' },
    active: { sortKey: 'active', type: 'number' },
    volume: { sortKey: 'volume', type: 'number' },
    conversion: { sortKey: 'conversion', type: 'number' },
    email: { sortKey: 'email' },
    phone: { sortKey: 'phone' }
  };
  const headerCells = columns.map((col) => {
    const meta = sortableMeta[col.id];
    if (meta) {
      const typeAttr = meta.type ? ` data-type="${attr(meta.type)}"` : '';
      return `<th data-column="${attr(col.id)}"><button class="sort-btn" data-key="${attr(meta.sortKey)}"${typeAttr} type="button">${safe(col.label || col.id)} <span aria-hidden="true" class="sort-icon">↕</span></button></th>`;
    }
    return `<th data-column="${attr(col.id)}">${safe(col.label || col.id)}</th>`;
  });
  row.innerHTML = [selectCell, ...headerCells].join('');
}

function extractFavoritesSnapshot(rawSettings) {
  if (!rawSettings) return null;
  if (Array.isArray(rawSettings)) {
    const record = rawSettings.find(entry => entry && entry.id === 'app:settings');
    return record && record.favorites ? normalizeFavoriteSnapshot(record.favorites) : null;
  }
  if (rawSettings && typeof rawSettings === 'object' && rawSettings.favorites) {
    return normalizeFavoriteSnapshot(rawSettings.favorites);
  }
  return null;
}

function stageInfo(value) {
  const raw = value == null ? '' : String(value);
  const trimmed = raw.trim();
  const normalizedStage = normalizeStatus(trimmed);
  const normalizedKey = normalizedStage || trimmed.toLowerCase();
  const mappedLabel =
    stageLabels[normalizedKey] ||
    stageLabels[trimmed.toLowerCase()] ||
    trimmed;
  const canonicalSource = normalizedStage || mappedLabel || trimmed;
  const canonicalKey =
    canonicalStage(canonicalSource) ||
    canonicalStage(mappedLabel) ||
    canonicalStage(trimmed);
  const chipHtml =
    renderStageChip(canonicalSource) ||
    renderStageChip(trimmed) ||
    renderStageChip(mappedLabel);
  const canonicalLabel = canonicalKey ? (CANONICAL_STAGE_META[canonicalKey]?.label || mappedLabel) : mappedLabel;
  const label = canonicalLabel || mappedLabel || 'Stage';
  const fallbackTone = toneForStage(canonicalKey || canonicalSource || trimmed);
  const fallbackClass = toneClassName(fallbackTone);
  const fallbackClassSuffix = fallbackClass ? ` ${fallbackClass}` : '';
  const fallbackAttr = fallbackTone ? ` data-tone="${fallbackTone}"` : '';
  const html =
    chipHtml ||
    `<span class="stage-chip stage-generic${fallbackClassSuffix}" data-role="stage-chip" data-qa="stage-chip-generic"${fallbackAttr}>${safe(label)}</span>`;
  return { html, canonicalKey, normalizedKey, label };
}

window.__OLD_KANBAN_OFF__ = true;

const KANBAN_STAGE_LABELS = PIPELINE_STAGES.slice();
const KANBAN_STAGE_KEYS = PIPELINE_STAGE_KEYS.slice();
const KANBAN_STAGE_LABEL_SET = new Set(KANBAN_STAGE_LABELS.map(label => label.toLowerCase()));
const KANBAN_STAGE_KEY_SET = new Set(KANBAN_STAGE_KEYS);
const KANBAN_STAGE_KEY_TO_LABEL = new Map(
  KANBAN_STAGE_KEYS.map((key, index) => [key, KANBAN_STAGE_LABELS[index]])
);

function canonicalKanbanStage(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (KANBAN_STAGE_KEY_SET.has(lowered)) {
    return stageLabelFromKey(lowered);
  }
  const direct = KANBAN_STAGE_LABELS.find(label => label.toLowerCase() === lowered);
  if (direct) return direct;
  const normalized = NORMALIZE_STAGE(raw);
  if (normalized && KANBAN_STAGE_LABEL_SET.has(normalized.toLowerCase())) {
    return normalized;
  }
  const key = stageKeyFromLabel(raw);
  if (KANBAN_STAGE_KEY_SET.has(key)) {
    return KANBAN_STAGE_KEY_TO_LABEL.get(key) || stageLabelFromKey(key);
  }
  return null;
}

function deriveLaneStage(node) {
  if (!node) return null;
  const cues = [];
  if (node.dataset && node.dataset.stage) cues.push(node.dataset.stage);
  cues.push(node.getAttribute && node.getAttribute('data-stage'));
  cues.push(node.getAttribute && node.getAttribute('data-stage-label'));
  cues.push(node.dataset && node.dataset.stageLabel);
  cues.push(node.getAttribute && node.getAttribute('aria-label'));
  const header = node.querySelector ? node.querySelector('[data-role="title"], [data-role="header"], [data-role="stage"], .kanban-column-title, header h3, header h4, header strong, h3, h4, legend, summary') : null;
  if (header && typeof header.textContent === 'string') cues.push(header.textContent);
  if (typeof node.textContent === 'string' && node.classList && node.classList.contains('kanban-column-title')) {
    cues.push(node.textContent);
  }
  for (const cue of cues) {
    const stage = canonicalKanbanStage(cue);
    if (stage) return stage;
  }
  return null;
}

function ensureKanbanStageAttributes() {
  const root = document.querySelector('[data-kanban], #kanban-area, #kanban, .kanban-board');
  if (!root) return;
  const laneSelectors = '[data-stage],[data-lane],[data-column],.kanban-column,.kanban-lane';
  const laneNodes = Array.from(root.querySelectorAll(laneSelectors)).filter(node => {
    if (!(node instanceof Element)) return false;
    return !!node.querySelector('[data-role="list"],[data-list],.kanban-drop,.kanban-list,.lane-list,.cards');
  });
  laneNodes.forEach(lane => {
    let stage = canonicalKanbanStage(lane.dataset.stage);
    if (!stage) stage = deriveLaneStage(lane);
    if (!stage) return;
    const stageKey = stageKeyFromLabel(stage);
    if (lane.dataset.stage !== stage) lane.dataset.stage = stage;
    if (lane.dataset.stageKey !== stageKey) lane.dataset.stageKey = stageKey;
    if (lane.dataset.stageLabel !== stage) lane.dataset.stageLabel = stage;
    if (!lane.hasAttribute('data-stage')) lane.setAttribute('data-stage', stage);
    if (!lane.hasAttribute('data-stage-key')) lane.setAttribute('data-stage-key', stageKey);
    if (!lane.hasAttribute('data-stage-label')) lane.setAttribute('data-stage-label', stage);
    const list = lane.querySelector('[data-role="list"],[data-list],.kanban-drop,.kanban-list,.lane-list,.cards');
    if (list) {
      if (list.dataset.stage !== stage) list.dataset.stage = stage;
      if (list.dataset.stageKey !== stageKey) list.dataset.stageKey = stageKey;
      if (list.dataset.stageLabel !== stage) list.dataset.stageLabel = stage;
      if (!list.hasAttribute('data-stage')) list.setAttribute('data-stage', stage);
      if (!list.hasAttribute('data-stage-key')) list.setAttribute('data-stage-key', stageKey);
      if (!list.hasAttribute('data-stage-label')) list.setAttribute('data-stage-label', stage);
    }
  });
  const cards = Array.from(root.querySelectorAll('[data-card-id],[data-id]'));
  cards.forEach(card => {
    if (!(card instanceof Element)) return;
    const id = card.getAttribute('data-id') || card.getAttribute('data-card-id');
    if (id && card.dataset.id !== String(id)) card.dataset.id = String(id);
  });
}


function shortDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function withLayoutGuard(moduleName, work) {
  const debug = typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.DEBUG === true;
  if (!debug) return work();
  let hadRead = false;
  let lastOp = null;
  let violations = 0;
  const markRead = () => {
    if (lastOp === 'write' && hadRead) violations += 1;
    lastOp = 'read';
    hadRead = true;
  };
  const markWrite = () => {
    lastOp = 'write';
  };
  const restorers = [];
  const wrapMethod = (obj, key, marker) => {
    if (!obj || typeof obj[key] !== 'function') return;
    const original = obj[key];
    obj[key] = function () {
      marker();
      return original.apply(this, arguments);
    };
    restorers.push(() => { obj[key] = original; });
  };
  const wrapDescriptor = (proto, key, onGet, onSet) => {
    if (!proto) return;
    let desc;
    try { desc = Object.getOwnPropertyDescriptor(proto, key); }
    catch (_err) { return; }
    if (!desc || desc.configurable === false) return;
    const next = {
      configurable: true,
      enumerable: desc.enumerable
    };
    if (typeof desc.get === 'function') {
      next.get = function () { if (onGet) onGet(); return desc.get.call(this); };
    }
    if (typeof desc.set === 'function') {
      next.set = function (value) { if (onSet) onSet(); return desc.set.call(this, value); };
    }
    try {
      Object.defineProperty(proto, key, next);
      restorers.push(() => { Object.defineProperty(proto, key, desc); });
    } catch (_err) { }
  };
  wrapMethod(Element.prototype, 'getBoundingClientRect', markRead);
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const original = window.getComputedStyle;
    window.getComputedStyle = function () {
      markRead();
      return original.apply(window, arguments);
    };
    restorers.push(() => { window.getComputedStyle = original; });
  }
  ['appendChild', 'insertBefore', 'removeChild', 'replaceChild'].forEach(key => wrapMethod(Node.prototype, key, markWrite));
  if (typeof DOMTokenList !== 'undefined' && DOMTokenList.prototype) {
    ['add', 'remove', 'toggle', 'replace'].forEach(key => wrapMethod(DOMTokenList.prototype, key, markWrite));
  }
  if (typeof CSSStyleDeclaration !== 'undefined' && CSSStyleDeclaration.prototype) {
    ['setProperty', 'removeProperty'].forEach(key => wrapMethod(CSSStyleDeclaration.prototype, key, markWrite));
  }
  wrapDescriptor(Element.prototype, 'innerHTML', null, markWrite);
  wrapDescriptor(Element.prototype, 'outerHTML', null, markWrite);
  wrapDescriptor(Node.prototype, 'textContent', null, markWrite);
  if (typeof HTMLElement !== 'undefined' && HTMLElement.prototype) {
    ['innerText', 'outerText', 'offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight', 'scrollTop', 'scrollLeft', 'scrollHeight', 'scrollWidth'].forEach(prop => {
      const onSet = (prop === 'scrollTop' || prop === 'scrollLeft') ? markWrite : null;
      wrapDescriptor(HTMLElement.prototype, prop, markRead, onSet);
    });
  }
  let finalized = false;
  const finalize = () => {
    if (finalized) return;
    finalized = true;
    while (restorers.length) {
      const restore = restorers.pop();
      try { restore(); }
      catch (_err) { }
    }
    if (violations >= 5 && console && typeof console.info === 'function') {
      console.info(`[LAYOUT] possible thrash at ${moduleName} (x${violations})`);
    }
  };
  try {
    const result = work();
    if (result && typeof result.then === 'function') {
      return result.finally(finalize);
    }
    finalize();
    return result;
  } catch (err) {
    finalize();
    throw err;
  }
}

function notify(message) {
  if (typeof window.toast === 'function') window.toast(message);
  else console.log(message);
}

function normalizeKey(value) {
  if (value == null) return '';
  const str = String(value).trim().toLowerCase();
  if (!str || str === '—' || str === '-') return '';
  return str.replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  if (value == null) return '';
  const str = String(value).trim().toLowerCase();
  if (!str || str === '—') return '';
  return str;
}

function normalizePhone(value) {
  if (value == null) return '';
  const digits = String(value).replace(/\D+/g, '');
  return digits.length ? digits : '';
}

function parseAmountNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

const DEFAULT_STAGE_KEY = stageKeyFromLabel('Application');

function normalizeStageKey(value) {
  const raw = value == null ? '' : value;
  const stringValue = String(raw);
  try {
    if (typeof window.canonicalizeStage === 'function') {
      const canonical = window.canonicalizeStage(raw);
      if (canonical) return String(canonical);
    }
  } catch (_err) { }
  if (!stringValue.trim()) return DEFAULT_STAGE_KEY;
  return stageKeyFromLabel(stringValue);
}

function uniqueAdd(map, key, id) {
  if (!key) return;
  if (!map.has(key)) { map.set(key, id); return; }
  const existing = map.get(key);
  if (existing === id || existing === null) return;
  map.set(key, null);
}

function addToGroup(groups, key, meta) {
  if (!key) return;
  const bucket = groups.get(key) || [];
  bucket.push(meta);
  groups.set(key, bucket);
}

function gatherEmails(record) {
  const fields = ['email', 'workEmail', 'personalEmail', 'primaryEmail', 'secondaryEmail'];
  const list = [];
  const seen = new Set();
  fields.forEach(field => {
    const key = normalizeEmail(record && record[field]);
    if (key && !seen.has(key)) { seen.add(key); list.push(key); }
  });
  return list;
}

function gatherPhones(record) {
  const fields = ['phone', 'mobile', 'cell', 'secondaryPhone', 'workPhone', 'homePhone', 'primaryPhone'];
  const list = [];
  const seen = new Set();
  fields.forEach(field => {
    const key = normalizePhone(record && record[field]);
    if (key && !seen.has(key)) { seen.add(key); list.push(key); }
  });
  return list;
}

function buildPartnerIndex(list) {
  const index = {
    type: 'partners',
    byId: new Map(),
    byEmail: new Map(),
    byPhone: new Map(),
    byName: new Map(),
    groupsByName: new Map(),
    byCompany: new Map(),
    groupsByCompany: new Map(),
    ordered: [],
    nameById: new Map()
  };
  (list || []).forEach(partner => {
    if (!partner || partner.id == null) return;
    const id = String(partner.id);
    index.ordered.push(id);
    const meta = {
      id,
      record: partner,
      nameKey: normalizeKey(partner.name),
      companyKey: normalizeKey(partner.company),
      tier: normalizeKey(partner.tier),
      emails: gatherEmails(partner),
      phones: gatherPhones(partner)
    };
    index.byId.set(id, meta);
    index.nameById.set(id, partner.name || partner.company || '');
    meta.emails.forEach(key => uniqueAdd(index.byEmail, key, id));
    meta.phones.forEach(key => uniqueAdd(index.byPhone, key, id));

    [meta.nameKey, meta.companyKey].forEach(name => {
      if (!name) return;
      const existing = index.byName.get(name);
      if (existing === undefined) index.byName.set(name, id);
      else if (existing !== id) index.byName.set(name, null);
      addToGroup(index.groupsByName, name, meta);
    });

    if (meta.companyKey) {
      uniqueAdd(index.byCompany, meta.companyKey, id);
      addToGroup(index.groupsByCompany, meta.companyKey, meta);
    }
  });
  index.ordered.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return index;
}

function buildContactIndex(list, partnerNameMap) {
  const index = {
    type: 'contacts',
    byId: new Map(),
    byEmail: new Map(),
    byPhone: new Map(),
    byName: new Map(),
    groupsByName: new Map(),
    ordered: []
  };
  (list || []).forEach(contact => {
    if (!contact || contact.id == null) return;
    const id = String(contact.id);
    index.ordered.push(id);
    const nameParts = [normalizeKey(contact.name), normalizeKey([contact.first, contact.last].filter(Boolean).join(' '))];
    const meta = {
      id,
      record: contact,
      stage: normalizeStageKey(contact.stage || 'application'),
      loan: normalizeKey(contact.loanType || contact.loanProgram),
      amount: Number(contact.loanAmount || 0) || 0,
      referredBy: normalizeKey(contact.referredBy),
      partnerNames: new Set(),
      emails: gatherEmails(contact),
      phones: gatherPhones(contact)
    };
    [contact.buyerPartnerId, contact.listingPartnerId, contact.partnerId].forEach(pid => {
      if (pid == null) return;
      const label = partnerNameMap.get(String(pid)) || '';
      const key = normalizeKey(label);
      if (key) meta.partnerNames.add(key);
    });
    const referralKey = normalizeKey(contact.referredBy);
    if (referralKey) meta.partnerNames.add(referralKey);
    index.byId.set(id, meta);
    meta.emails.forEach(key => uniqueAdd(index.byEmail, key, id));
    meta.phones.forEach(key => uniqueAdd(index.byPhone, key, id));
    const seenNames = new Set();
    nameParts.concat([normalizeKey(contact.company)]).forEach(name => {
      if (!name || seenNames.has(name)) return;
      seenNames.add(name);
      const existing = index.byName.get(name);
      if (existing === undefined) index.byName.set(name, id);
      else if (existing !== id) index.byName.set(name, null);
      addToGroup(index.groupsByName, name, meta);
    });
  });
  index.ordered.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return index;
}

function widgetEventsForSource(source) {
  const store = window.__WIDGET_DATA__ || {};
  const mapTaskEvent = (task, label) => {
    if (!task) return null;
    const date = task.dueDate instanceof Date ? task.dueDate : toDate(task.dueDate);
    if (!date) return null;
    const title = task.title || task.raw?.title || task.raw?.text || 'Task';
    const contactName = task.name && task.name !== 'General Task' ? task.name : '';
    const summary = contactName ? `${contactName} — ${title}` : title;
    const descParts = [];
    if (label) descParts.push(label);
    if (task.stage) descParts.push(task.stage);
    if (task.dueLabel) descParts.push(`Due ${task.dueLabel}`);
    return { date, summary, description: descParts.filter(Boolean).join(' • ') };
  };
  switch (source) {
    case 'rel-opps':
      return (store.relOpportunities || []).map(({ contact }) => {
        if (!contact) return null;
        const date = toDate(contact.nextFollowUp || contact.lastContact);
        if (!date) return null;
        const stageKey = normalizeStatus(contact.stage);
        const stage = stageLabels[stageKey] || (contact.stage || STR['stage.pipeline']);
        const parts = [stage];
        if (contact.loanType) parts.push(contact.loanType);
        if (contact.loanAmount) parts.push(`Amount: ${money(contact.loanAmount)}`);
        return { date, summary: `Follow up — ${fullName(contact)}`, description: parts.filter(Boolean).join(' • ') };
      }).filter(Boolean);
    case 'nurture':
      return (store.nurtureCandidates || []).map(({ contact }) => {
        if (!contact) return null;
        const date = toDate(contact.nextFollowUp || contact.anniversary || contact.fundedDate);
        if (!date) return null;
        const parts = [];
        const stageKey = normalizeStatus(contact.stage);
        const stage = stageLabels[stageKey] || (contact.stage || STR['kanban.placeholder.client']);
        parts.push(stage);
        if (contact.fundedDate) parts.push(`Funded: ${contact.fundedDate}`);
        return { date, summary: `Nurture — ${fullName(contact)}`, description: parts.filter(Boolean).join(' • ') };
      }).filter(Boolean);
    case 'closing-watch':
      return (store.closingCandidates || []).map(item => {
        if (!item || !item.contact) return null;
        const date = item.date instanceof Date ? item.date : toDate(item.date);
        if (!date) return null;
        const contact = item.contact;
        const stageKey = normalizeStatus(contact.stage);
        const stage = stageLabels[stageKey] || (contact.stage || '');
        const parts = [stage];
        if (contact.loanAmount) parts.push(`Amount: ${money(contact.loanAmount)}`);
        return { date, summary: `Closing — ${fullName(contact)}`, description: parts.filter(Boolean).join(' • ') };
      }).filter(Boolean);
    case 'pipeline-calendar':
      return (store.pipelineEvents || []).map(ev => {
        if (!ev) return null;
        const date = ev.date instanceof Date ? ev.date : toDate(ev.date);
        if (!date) return null;
        const descParts = [];
        if (ev.meta) descParts.push(ev.meta);
        if (ev.typeLabel) descParts.push(ev.typeLabel);
        return { date, summary: ev.label || 'Pipeline Event', description: descParts.filter(Boolean).join(' • ') };
      }).filter(Boolean);
    case 'priority-actions':
      return (store.attention || []).map(task => mapTaskEvent(task, 'Priority Task')).filter(Boolean);
    case 'milestones':
      return (store.timeline || []).map(task => mapTaskEvent(task, 'Upcoming Milestone')).filter(Boolean);
    default:
      return [];
  }
}

async function exportWidgetIcs(source) {
  try {
    const events = widgetEventsForSource(source);
    if (!events.length) { notify('No dated records to export'); return; }
    if (typeof window.exportCustomEventsToIcs !== 'function') { notify('ICS export unavailable'); return; }
    await window.exportCustomEventsToIcs(events, `crm-${source}.ics`);
    notify('ICS file generated');
  } catch (err) {
    console.warn('widget ics', err);
    notify('ICS export failed');
  }
}

async function dispatchContactModal(contactId, options) {
  if (!contactId) return null;

  // Verify contact exists before attempting to open modal
  try {
    if (typeof window.dbGet === 'function') {
      const contact = await window.dbGet('contacts', contactId);
      if (!contact) {
        if (typeof notify === 'function') {
          notify('Contact not found', 'warn');
        }
        console && console.warn && console.warn('Contact not found:', contactId);
        return null;
      }
    }
  } catch (err) {
    console && console.warn && console.warn('Contact lookup error:', err);
    if (typeof notify === 'function') {
      notify('Unable to load contact', 'error');
    }
    return null;
  }

  const editorFn = (window.Contacts && window.Contacts.open) ? window.Contacts.open : null;
  if (typeof editorFn !== 'function') {
    try { console && console.warn && console.warn('contact modal unavailable', { contactId }); }
    catch (_err) { }
    return null;
  }

  try {
    const result = editorFn(contactId, Object.assign({ source: 'render', context: options && options.context }, options));
    if (result && typeof result.catch === 'function') {
      result.catch(err => {
        try { console && console.warn && console.warn('openContactEditor failed', err); }
        catch (_err) { }
      });
    }
    return result;
  } catch (err) {
    try { console && console.warn && console.warn('openContactEditor failed', err); }
    catch (_err) { }
  }
  return null;
}

function dispatchPartnerModal(partnerId, options) {
  if (!partnerId) return null;
  if (typeof openPartnerEditor !== 'function') {
    try { console && console.warn && console.warn('partner modal unavailable', { partnerId }); }
    catch (_err) { }
    return null;
  }
  try {
    const result = openPartnerEditor(partnerId, Object.assign({ source: 'render', context: options && options.context }, options));
    if (result && typeof result.catch === 'function') {
      result.catch(err => {
        try { console && console.warn && console.warn('openPartnerEditor failed', err); }
        catch (_err) { }
      });
    }
    return result;
  } catch (err) {
    try { console && console.warn && console.warn('openPartnerEditor failed', err); }
    catch (_err) { }
  }
  return null;
}

function normalizeRecordRefs(rawContactId, rawPartnerId, contact) {
  const contactObj = contact && typeof contact === 'object' ? contact : null;
  const pickId = (value, fallbackObj) => {
    if (value == null || value === '') return '';
    if (typeof value === 'object') {
      if (value.id != null && value.id !== '') return String(value.id);
      if (value.contactId != null && value.contactId !== '') return String(value.contactId);
      if (value.contact_id != null && value.contact_id !== '') return String(value.contact_id);
    }
    if (fallbackObj && typeof fallbackObj === 'object') {
      if (fallbackObj.id != null && fallbackObj.id !== '') return String(fallbackObj.id);
      if (fallbackObj.contactId != null && fallbackObj.contactId !== '') return String(fallbackObj.contactId);
      if (fallbackObj.contact_id != null && fallbackObj.contact_id !== '') return String(fallbackObj.contact_id);
    }
    return String(value);
  };

  const contactId = pickId(rawContactId, contactObj);
  const partnerId = (() => {
    const picked = pickId(rawPartnerId, null);
    if (picked) return picked;
    if (contactObj && contactObj.partnerId != null && contactObj.partnerId !== '') return String(contactObj.partnerId);
    if (contactObj && contactObj.partner_id != null && contactObj.partner_id !== '') return String(contactObj.partner_id);
    if (contactObj && contactObj.partner && contactObj.partner.id != null && contactObj.partner.id !== '') return String(contactObj.partner.id);
    return '';
  })();

  return { contactId, partnerId };
}

function buildRecordDataAttrs(ids, widgetKey) {
  const contactAttr = ids && ids.contactId ? attr(ids.contactId) : '';
  const partnerAttr = ids && ids.partnerId ? attr(ids.partnerId) : '';
  const taskAttr = ids && ids.taskId ? attr(ids.taskId) : '';
  const attrs = [];
  if (widgetKey) {
    const widgetAttr = attr(widgetKey);
    attrs.push(
      `data-widget="${widgetAttr}"`,
      `data-dash-widget="${widgetAttr}"`,
      `data-widget-id="${widgetAttr}"`
    );
  }
  if (contactAttr) attrs.push(`data-contact-id="${contactAttr}"`, `data-id="${contactAttr}"`);
  if (partnerAttr) attrs.push(`data-partner-id="${partnerAttr}"`);
  if (taskAttr) attrs.push(`data-task-id="${taskAttr}"`);
  return attrs.length ? ` ${attrs.join(' ')}` : '';
}

document.addEventListener('click', evt => {
  const btn = evt.target.closest('[data-ics-source]');
  if (!btn) return;
  const source = btn.dataset.icsSource;
  if (!source) return;
  evt.preventDefault();
  exportWidgetIcs(source);
});

function ensureFavoriteToggleHandlers() {
  if (typeof document === 'undefined') return;
  if (document.__favoriteToggleHandler) return;
  const handler = evt => {
    const target = evt.target && evt.target.closest ? evt.target.closest('[data-role="favorite-toggle"]') : null;
    if (!target) return;
    evt.preventDefault();
    const busy = target.dataset.favoriteBusy === '1';
    if (busy) return;
    const type = target.dataset.favoriteType === 'partner' ? 'partner' : 'contact';
    const id = target.getAttribute('data-record-id') || target.dataset.recordId || '';
    if (!id) return;
    target.dataset.favoriteBusy = '1';
    Promise.resolve(toggleFavorite(type, id)).catch(err => {
      try {
        if (console && console.warn) console.warn('[favorites] toggle failed', err);
      } catch (_warnErr) { }
    }).finally(() => {
      delete target.dataset.favoriteBusy;
    });
  };
  document.addEventListener('click', handler);
  document.__favoriteToggleHandler = handler;
}

ensureFavoriteToggleHandlers();

function buildPartnerValueStats(contacts) {
  const stats = new Map();
  if (!Array.isArray(contacts)) return stats;
  contacts.forEach(contact => {
    if (!contact) return;
    const ids = new Set();
    [contact.buyerPartnerId, contact.listingPartnerId, contact.partnerId, contact.referralPartnerId]
      .forEach(raw => {
        if (raw == null) return;
        const id = String(raw);
        if (!id || id === NONE_PARTNER_ID) return;
        ids.add(id);
      });
    if (!ids.size) return;
    const stageValue = contact.stage || contact.status || '';
    const stageKey = stageKeyFromLabel(stageValue);
    const canonical = canonicalStage(stageKey) || canonicalStage(stageValue) || '';
    const amount = Number(contact.loanAmount ?? contact.amount ?? 0) || 0;
    ids.forEach(id => {
      let entry = stats.get(id);
      if (!entry) {
        entry = { total: 0, funded: 0, active: 0, lost: 0, volume: 0 };
        stats.set(id, entry);
      }
      entry.total += 1;
      if (canonical === 'won') {
        entry.funded += 1;
        entry.volume += amount;
      } else if (canonical === 'lost') {
        entry.lost += 1;
      } else {
        entry.active += 1;
      }
    });
  });
  return stats;
}

function renderPartnersTable(partners, contacts) {
  const table = document.getElementById('tbl-partners');
  const mode = resolveColumnMode();
  const { visibleColumns } = getColumnsForView('partners-main', mode);
  if (table) renderPartnerHeader(table, visibleColumns);
  if (table) ensureFavoriteColumn(table);
  const tbPartners = table && table.tBodies && table.tBodies[0] ? table.tBodies[0] : $('#tbl-partners tbody');
  if (!tbPartners) return;
  const favoriteState = ensureFavoriteState();
  const metrics = buildPartnerValueStats(contacts || []);
  const partnerRows = (partners || []).map(p => {
    const pid = attr(p.id || '');
    const name = p.name || '—';
    const company = p.company || '';
    const email = p.email || '';
    const phone = p.phone || '';
    const tier = p.tier || 'Developing';
    const tierToken = classToken(tier);
    const tierTone = colorForTier(tier) || null;
    const rowClasses = ['status-row', 'partner-tier-row'];
    if (tierToken) rowClasses.push(`tier-${tierToken}`);
    const isFavorite = favoriteState.partners.has(String(p.id || ''));
    if (isFavorite) rowClasses.push('is-favorite');
    const rowToneAttr = tierToken ? ` data-row-tone="${attr(tierToken)}"` : '';
    const emailKey = attr(String(email || '').toLowerCase());
    const nameKey = attr(String(name || '').toLowerCase());
    const companyKey = attr(String(company || '').toLowerCase());
    const phoneKey = attr(String(phone || '').toLowerCase());
    const tierKey = attr(String(tier || '').toLowerCase());
    const stat = metrics.get(String(p.id || '')) || { total: 0, funded: 0, active: 0, lost: 0, volume: 0 };
    const totalReferrals = Number(stat.total || 0);
    const fundedCount = Number(stat.funded || 0);
    const activeCount = Number(stat.active || 0);
    const volumeAmount = Number(stat.volume || 0);
    const conversionRate = totalReferrals > 0 ? fundedCount / totalReferrals : 0;
    const referralsLabel = integer(totalReferrals);
    const fundedLabel = integer(fundedCount);
    const activeLabel = integer(activeCount);
    const volumeLabel = money(volumeAmount);
    const conversionLabel = totalReferrals > 0 ? percentValue(conversionRate) : '—';
    const favoriteCell = `<td class="favorite-cell" data-column="favorite">${renderFavoriteToggle('partner', p.id, isFavorite)}</td>`;
    const favoriteAttr = isFavorite ? ' data-favorite="1"' : '';
    const cells = [
      `<td data-column="select"><input data-ui="row-check" data-role="select" type="checkbox" data-id="${pid}" data-partner-id="${pid}"></td>`,
      favoriteCell,
      ...visibleColumns.map((col) => {
        switch (col.id) {
          case 'name':
            return `<td class="cell-edit" data-partner-id="${pid}" data-column="name"><a href="#" class="link partner-name" data-ui="partner-name" data-partner-id="${pid}">${renderAvatar(name || company)}<span class="name-text">${safe(name)}</span></a></td>`;
          case 'company':
            return `<td data-column="company">${safe(company)}</td>`;
          case 'tier':
            return `<td data-column="tier">${safe(tier)}</td>`;
          case 'referrals':
            return `<td class="numeric" data-column="referrals">${referralsLabel}</td>`;
          case 'funded':
            return `<td class="numeric" data-column="funded">${fundedLabel}</td>`;
          case 'active':
            return `<td class="numeric" data-column="active">${activeLabel}</td>`;
          case 'volume':
            return `<td class="numeric" data-column="volume">${volumeLabel}</td>`;
          case 'conversion':
            return `<td class="numeric" data-column="conversion">${conversionLabel}</td>`;
          case 'email':
            return `<td data-column="email">${safe(email)}</td>`;
          case 'phone':
            return `<td data-column="phone">${safe(phone)}</td>`;
          case 'owner':
            return `<td data-column="owner">${safe(p.owner || '')}</td>`;
          case 'lastTouch':
            return `<td data-column="lastTouch">${safe(p.lastTouch || '')}</td>`;
          case 'nextTouch':
            return `<td data-column="nextTouch">${safe(p.nextTouch || '')}</td>`;
          case 'createdAt':
            return `<td data-column="createdAt">${safe(displayDate(p.createdAt) || '—')}</td>`;
          case 'updatedAt':
            return `<td data-column="updatedAt">${safe(displayDate(p.updatedAt) || '—')}</td>`;
          default:
            return `<td data-column="${attr(col.id)}">—</td>`;
        }
      })
    ];
    return `<tr class="${rowClasses.join(' ')}"${rowToneAttr}${rowToneStyle(tierTone)} data-id="${pid}" data-partner-id="${pid}" data-email="${emailKey}" data-name="${nameKey}" data-company="${companyKey}" data-phone="${phoneKey}" data-tier="${tierKey}" data-referrals="${attr(String(totalReferrals))}" data-funded="${attr(String(fundedCount))}" data-active="${attr(String(activeCount))}" data-volume="${attr(String(volumeAmount))}" data-conversion="${attr(String(conversionRate))}"${favoriteAttr}>${cells.join('')}</tr>`;
  }).join('');
  renderTableBody(table, tbPartners, partnerRows);
  $all('#tbl-partners tbody tr').forEach(tr => {
    const nameCell = tr.querySelector('[data-column="name"] .name-text');
    const normalized = nameCell ? nameCell.textContent.trim().toLowerCase() : '';
    if (normalized === 'none') tr.style.display = 'none';
  });
  if (typeof window.ensureSortable === 'function') {
    try { window.ensureSortable('tbl-partners'); }
    catch (_err) { }
  }
  ensurePartnerRowOpener(table);
}

export async function renderAll(request) {
  const scopeSet = parseRenderScopes(request && typeof request === 'object' ? (request.scopes || request.scope || request) : request);
  const wantsDashboard = shouldRenderScope(scopeSet, 'dashboard', 'tasks', 'documents');
  const wantsContacts = shouldRenderScope(scopeSet, 'contacts', 'longshots', 'dashboard');
  const wantsPipeline = shouldRenderScope(scopeSet, 'pipeline', 'dashboard');
  const wantsContactTables = shouldRenderScope(scopeSet, 'contacts', 'longshots');
  const wantsPipelineTable = shouldRenderScope(scopeSet, 'pipeline');
  const wantsPartners = shouldRenderScope(scopeSet, 'partners');
  const wantsCalendar = shouldRenderScope(scopeSet, 'calendar');

  if (wantsCalendar && typeof window.renderCalendar === 'function') {
    try {
      // Calendar is self-contained and handles its own async loading
      window.renderCalendar();
    } catch (err) {
      console.warn('[render] Calendar render failed', err);
    }
  }

  return withLayoutGuard('render.js', async () => {
    const totalMark = perfMark('renderAll');
    let dashboardMark = null;
    let pipelineMark = null;
    let partnersMark = null;
    primeLoadingPlaceholders();
    try {
      await openDB();
      const settingsPromise = (window.Settings && typeof window.Settings.get === 'function')
        ? window.Settings.get()
        : dbGetAll('settings');
      const [rawContacts, partners, tasks, rawSettings, documents] = await Promise.all([
        dbGetAll('contacts'),
        dbGetAll('partners'),
        dbGetAll('tasks'),
        settingsPromise,
        dbGetAll('documents')
      ]);
      const contacts = (Array.isArray(rawContacts) ? rawContacts : []).filter((record) => {
        if (!record) return false;
        if (record.deleted || record.isDeleted) return false;
        const deletedAt = Number(record.deletedAt);
        if (Number.isFinite(deletedAt) && deletedAt > 0) return false;
        const pendingAt = Number(record.deletedAtPending);
        if (Number.isFinite(pendingAt) && pendingAt > 0) return false;
        return true;
      });
      const partnerNameMap = new Map((partners || []).map(p => [String(p.id), p.name || p.company || '']));
      const partnerIndex = buildPartnerIndex(partners || []);
      const contactIndex = buildContactIndex(contacts || [], partnerNameMap);
      window.__RECORD_INDEX__ = { contacts: contactIndex, partners: partnerIndex };
      const nameLookup = {};
      contactIndex.byName.forEach((val, key) => { if (typeof val === 'string' && val) nameLookup[key] = val; });
      partnerIndex.byName.forEach((val, key) => { if (typeof val === 'string' && val) nameLookup[key] = val; });
      window.__NAME_ID_MAP__ = nameLookup;
      const favoritesSnapshot = extractFavoritesSnapshot(rawSettings) || { contacts: [], partners: [] };
      applyFavoriteSnapshot(favoritesSnapshot);
      const favoriteState = ensureFavoriteState();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const contactById = new Map((contacts || []).map(c => [String(c.id), c]));
      const openTasks = (tasks || []).filter(t => t && t.due && !t.done).map(t => {
        const dueDate = toDate(t.due);
        const contactId = t && t.contactId != null ? String(t.contactId) : '';
        const partnerId = t && t.partnerId != null ? String(t.partnerId) : '';
        const fallbackContact = (t && t.contact) || (t && t.contactRecord) || null;
        const contact = contactById.get(contactId) || fallbackContact;
        const ids = normalizeRecordRefs(contactId || (contact && contact.id), partnerId || (contact && contact.partnerId), contact);
        const stageKey = contact ? normalizeStatus(contact.stage) : '';
        const stage = stageKey ? (stageLabels[stageKey] || stageKey.replace(/-/g, ' ')) : '';
        const diffFromToday = dueDate ? Math.floor((dueDate.getTime() - today.getTime()) / 86400000) : null;
        let status = 'ready';
        if (diffFromToday != null) {
          if (diffFromToday < 0) status = 'overdue';
          else if (diffFromToday <= 3) status = 'soon';
        }
        const dueLabel = dueDate ? dueDate.toISOString().slice(0, 10) : 'No date';
        return {
          raw: t,
          title: t.title || t.text || 'Follow up',
          dueDate,
          dueLabel,
          status,
          diffFromToday,
          contactId: ids.contactId,
          partnerId: ids.partnerId,
          contact,
          name: contact ? fullName(contact) : 'General Task',
          stage
        };
      }).sort((a, b) => {
        const ad = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });

      let relOpportunities = [];
      let nurtureCandidates = [];
      let closingCandidates = [];
      let pipelineEvents = [];
      let attention = [];
      let timeline = [];

      if (wantsDashboard) {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const fundedThisMonth = (contacts || []).filter(c => {
          const fundedDate = toDate(c.fundedDate);
          return fundedDate && fundedDate >= startOfMonth && fundedDate < nextMonth;
        });
        const fundedCount = fundedThisMonth.length;
        const fundedVolume = fundedThisMonth.reduce((sum, c) => sum + (Number(c.loanAmount || 0) || 0), 0);
        let goalRec = {};
        if (rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)) {
          goalRec = rawSettings.goals || {};
        } else {
          const records = Array.isArray(rawSettings) ? rawSettings : [];
          goalRec = records.find(s => s && s.id === 'goals') || {};
        }
        const fundedGoal = Number(goalRec.monthlyFundedGoal || 0);
        const volumeGoal = Number(goalRec.monthlyVolumeGoal || 0);
        const hasFundedGoal = fundedGoal > 0;
        const hasVolumeGoal = volumeGoal > 0;
        const hasGoal = hasFundedGoal || hasVolumeGoal;
        const fundedPct = hasFundedGoal ? Math.min(100, Math.round((fundedCount / Math.max(fundedGoal, 1)) * 100)) : (fundedCount > 0 ? 100 : 0);
        const volumePct = hasVolumeGoal ? Math.min(100, Math.round((fundedVolume / Math.max(volumeGoal, 1)) * 100)) : (fundedVolume > 0 ? 100 : 0);
        const fundedLabel = asEl('goal-funded-label');
        if (fundedLabel) {
          fundedLabel.textContent = hasFundedGoal ? `${fundedCount} of ${fundedGoal}` : `${fundedCount} funded this month`;
        }
        const volumeLabel = asEl('goal-volume-label');
        if (volumeLabel) {
          volumeLabel.textContent = hasVolumeGoal ? `${money(fundedVolume)} of ${money(volumeGoal)}` : `${money(fundedVolume)} this month`;
        }
        const fundedBar = asEl('goal-funded-bar');
        if (fundedBar) {
          const pct = hasFundedGoal ? fundedPct : (fundedCount > 0 ? 100 : 0);
          fundedBar.style.width = `${pct}%`;
          fundedBar.style.opacity = pct > 0 ? '1' : '0.2';
        }
        const volumeBar = asEl('goal-volume-bar');
        if (volumeBar) {
          const pct = hasVolumeGoal ? volumePct : (fundedVolume > 0 ? 100 : 0);
          volumeBar.style.width = `${pct}%`;
          volumeBar.style.opacity = pct > 0 ? '1' : '0.2';
        }
        const metricsWrap = asEl('goal-progress-metrics');
        const emptyState = asEl('goal-empty-state');
        if (metricsWrap && emptyState) {
          metricsWrap.style.visibility = hasGoal ? 'visible' : 'hidden';
          emptyState.style.visibility = hasGoal ? 'hidden' : 'visible';
        }
        const footnote = asEl('goal-progress-footnote');
        if (footnote) {
          if (hasGoal) {
            let note = 'Targets reset each calendar month.';
            if (goalRec.updatedAt) {
              const updated = new Date(goalRec.updatedAt);
              if (!Number.isNaN(updated.getTime())) {
                note = `Last updated ${updated.toLocaleDateString()} • Targets reset each calendar month.`;
              }
            }
            footnote.textContent = note;
          } else {
            footnote.textContent = 'Set a funded loan or volume goal to unlock progress tracking.';
          }
        }

        dashboardMark = perfMark('dashboard');
        const total = contacts.length;
        const funded = contacts.filter(c => normalizeStatus(c.stage) === 'funded').length;
        const loanVol = contacts.reduce((s, c) => s + (Number(c.loanAmount || 0) || 0), 0);
        setText($('#kpi-total'), total);
        setText($('#kpi-funded'), funded);
        setText($('#kpi-loanvol'), money(loanVol));
        setText($('#kpi-conv'), total ? Math.round((funded / total) * 100) + '%' : '0%');
        setText($('#kpi-comm-pipeline'), money(loanVol * 0.01));
        setText($('#kpi-comm-earned'), money(loanVol * 0.008));
        setText($('#kpi-comm-received'), money(loanVol * 0.005));
        setText($('#kpi-comm-proj'), money(loanVol * 0.012));

        try {
          renderPortfolioMixWidget({
            host: $('#partner-tier-breakdown'),
            countEl: asEl('partner-portfolio-count'),
            partners,
            safe,
            colorForTier
          });
        } catch (err) {
          const host = $('#partner-tier-breakdown');
          if (host) host.innerHTML = '<div class="mini-bar-chart portfolio-chart"><div class="mini-bar-row error">Error loading widget. Please refresh.</div></div>';
          console.warn('Portfolio widget render failed:', err);
        }

        try {
          renderReferralLeadersWidget({
            host: $('#top3'),
            contacts,
            partners,
            safe,
            money,
            attr,
            initials,
            normalizeStatus,
            stageLabels
          });
        } catch (err) {
          const host = $('#top3');
          if (host) host.innerHTML = '<li class="error">Error loading referral leaders. Please refresh.</li>';
          console.warn('Referral leaders widget render failed:', err);
        }

        attention = openTasks.filter(t => t.status === 'overdue' || t.status === 'soon').slice(0, 6);
        if (Array.isArray(window?.store?.attention) && window.store.attention.length) {
          const seededAttention = window.store.attention.slice(0, 6).map((item) => ({
            status: item?.status || 'soon',
            diffFromToday: Number(item?.diffFromToday ?? item?.diff ?? 0) || 0,
            title: item?.title || item?.name || 'Priority item',
            name: item?.name || item?.contact?.name || '',
            stage: item?.stage || item?.contact?.stage || '',
            dueLabel: item?.dueLabel || item?.due || '',
            contactId: item?.contactId || item?.contact_id || item?.contact?.id || '',
            partnerId: item?.partnerId || item?.partner_id || item?.contact?.partnerId || '',
            raw: item?.raw || item,
            contact: item?.contact || null
          }));
          const mergedAttention = [];
          const seen = new Set();
          [...seededAttention, ...attention].forEach((task) => {
            const key = String(task?.contactId || task?.partnerId || task?.id || task?.raw?.id || task?.title || '');
            if (!key || seen.has(key)) return;
            seen.add(key);
            mergedAttention.push(task);
          });
          attention = mergedAttention.slice(0, 6);
        }
        if (!$('#needs-attn')) {
          const priorityCard = document.getElementById('priority-actions-card');
          if (priorityCard && !priorityCard.querySelector('#needs-attn')) {
            const list = document.createElement('ul');
            list.id = 'needs-attn';
            list.className = 'insight-list actionable';
            priorityCard.appendChild(list);
          }
        }
        html($('#needs-attn'), attention.length ? attention.map(task => {
          const cls = task.status === 'overdue' ? 'bad' : (task.status === 'soon' ? 'warn' : 'good');
          const phr = task.status === 'overdue' ? `${Math.abs(task.diffFromToday || 0)}d overdue` : (task.status === 'soon' ? `Due in ${task.diffFromToday}d` : 'Scheduled');
          const taskId = task.raw && task.raw.id ? task.raw.id : task.id;
          const ids = normalizeRecordRefs(task.contactId || (task.raw && task.raw.contactId), task.partnerId || (task.raw && task.raw.partnerId), task.contact);
          ids.taskId = taskId;
          // Priority Actions drilldown matches the Pipeline Calendar pattern:
          //   buildRecordDataAttrs → data-contact-id / data-partner-id on <li> → dashboard delegate opens the editor.
          const widgetAttrs = buildRecordDataAttrs(ids, 'priorityActions');
          const entityAttrs = [];
          const contactAttr = ids && ids.contactId ? attr(ids.contactId) : '';
          const partnerAttr = ids && ids.partnerId ? attr(ids.partnerId) : '';
          if (contactAttr) entityAttrs.push(`data-contact-id="${contactAttr}"`, `data-id="${contactAttr}"`);
          if (partnerAttr) entityAttrs.push(`data-partner-id="${partnerAttr}"`);
          const rowEntityAttrs = entityAttrs.length ? ` ${entityAttrs.join(' ')}` : '';
          return `<li class="${task.status}"${widgetAttrs}${rowEntityAttrs}>
        <div class="list-main"${rowEntityAttrs}>
          <span class="status-dot ${task.status}"></span>
          <div>
            <div class="insight-title">${safe(task.title)}</div>
            <div class="insight-sub">${safe(task.name)}${task.stage ? ` • ${safe(task.stage)}` : ''}</div>
          </div>
        </div>
        <div class="insight-meta ${cls}"${rowEntityAttrs}>${phr} · ${task.dueLabel}</div>
      </li>`;
        }).join('') : '<li class="empty">No urgent follow-ups — nice work!</li>');

        timeline = openTasks.filter(t => t.status !== 'overdue').slice(0, 6);
        html($('#upcoming'), timeline.length ? timeline.map(task => {
          const cls = task.status === 'soon' ? 'warn' : 'good';
          const phr = task.status === 'soon' ? `Due in ${task.diffFromToday}d` : 'Scheduled';
          const taskId = task.raw && task.raw.id ? task.raw.id : task.id;
          const ids = normalizeRecordRefs(task.contactId || (task.raw && task.raw.contactId), task.partnerId || (task.raw && task.raw.partnerId), task.contact);
          ids.taskId = taskId;
          // Milestones Ahead drilldown mirrors the pipeline calendar wiring with data-contact-id / data-partner-id on the row.
          const widgetAttrs = buildRecordDataAttrs(ids, 'milestonesAhead');
          const entityAttrs = [];
          const contactAttr = ids && ids.contactId ? attr(ids.contactId) : '';
          const partnerAttr = ids && ids.partnerId ? attr(ids.partnerId) : '';
          if (contactAttr) entityAttrs.push(`data-contact-id="${contactAttr}"`, `data-id="${contactAttr}"`);
          if (partnerAttr) entityAttrs.push(`data-partner-id="${partnerAttr}"`);
          const rowEntityAttrs = entityAttrs.length ? ` ${entityAttrs.join(' ')}` : '';
          return `<li${widgetAttrs}${rowEntityAttrs}>
        <div class="list-main"${rowEntityAttrs}>
          <span class="status-dot ${task.status}"></span>
          <div>
            <div class="insight-title">${safe(task.title)}</div>
            <div class="insight-sub">${safe(task.name)}${task.stage ? ` • ${safe(task.stage)}` : ''}</div>
          </div>
        </div>
        <div class="insight-meta ${cls}"${rowEntityAttrs}>${phr} · ${task.dueLabel}</div>
      </li>`;
        }).join('') : '<li class="empty">No events scheduled. Add tasks to stay proactive.</li>');

        let todoHost = document.getElementById('dashboard-todo');
        const ensureTodoHost = () => {
          let latest = document.getElementById('dashboard-todo');
          if (!latest) {
            latest = document.createElement('section');
            latest.id = 'dashboard-todo';
            latest.className = 'card';
            latest.setAttribute('data-widget-id', 'todo');
            const anchor = document.getElementById('dashboard-today');
            if (anchor && anchor.parentNode) {
              anchor.parentNode.insertBefore(latest, anchor.nextSibling);
            } else {
              const root = document.querySelector('[data-ui="dashboard-root"]');
              if (root) {
                root.appendChild(latest);
              } else {
                document.body.appendChild(latest);
              }
            }
          }
          if (latest && todoHost !== latest) {
            todoHost = latest;
          }
          if (todoHost) {
            todoHost.classList.remove('hidden');
            const card = todoHost.closest('.insight-card');
            if (card && card.classList) {
              card.classList.remove('hidden');
            }
          }
          return todoHost;
        };
        if (todoHost) {
          const renderTodo = () => {
            const host = ensureTodoHost();
            if (!host) return;
            host.classList.remove('hidden');
            const card = host.closest('.insight-card');
            if (card && card.classList) {
              card.classList.remove('hidden');
            }
            renderTodoWidget({
              root: host
            });
          };

          renderTodo();
        }

        try {
          renderPipelineMomentumWidget({
            host: $('#pipeline-breakdown'),
            countEl: asEl('pipeline-momentum-count'),
            contacts,
            safe,
            normalizeStatus,
            stageLabels,
            colorForStage
          });
        } catch (err) {
          const host = $('#pipeline-breakdown');
          if (host) host.innerHTML = '<div class="mini-bar-chart momentum-chart"><div class="mini-bar-row error">Error loading pipeline momentum. Please refresh.</div></div>';
          console.warn('Pipeline momentum widget render failed:', err);
        }

        const docs = documents || [];
        const docHost = $('#doc-status-summary');
        if (docHost) {
          if (!docs.length) {
            docHost.innerHTML = '<div class="empty muted">Add documents to begin tracking checklist progress.</div>';
          } else {
            const normalizeStatus = (value) => {
              const raw = String(value || '').trim().toLowerCase();
              if (!raw) return 'requested';
              if (raw === 'followup' || raw === 'follow-up') return 'follow up';
              if (raw.includes('follow')) return 'follow up';
              if (raw.includes('receive')) return 'received';
              if (raw.includes('waive')) return 'waived';
              if (raw.includes('request')) return 'requested';
              return raw;
            };
            const counts = docs.reduce((acc, doc) => {
              const key = normalizeStatus(doc.status);
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {});
            const totalDocs = docs.length;
            const updatedAt = docs.reduce((max, doc) => Math.max(max, Number(doc.updatedAt || 0) || 0), 0);
            const lastUpdated = updatedAt ? new Date(updatedAt) : null;
            const statusOrder = [
              { key: 'requested', label: 'Requested', tone: 'pending', color: '#f97316', helper: 'Awaiting borrower upload' },
              { key: 'follow up', label: 'Follow Up', tone: 'follow', color: '#ef4444', helper: 'Needs outreach' },
              { key: 'received', label: 'Received', tone: 'ok', color: '#10b981', helper: 'Filed and ready' },
              { key: 'waived', label: 'Waived', tone: 'waived', color: '#64748b', helper: 'No longer required' }
            ];
            const outstanding = statusOrder
              .filter(s => s.key === 'requested' || s.key === 'follow up')
              .reduce((sum, s) => sum + (counts[s.key] || 0), 0);
            const pendingLabel = outstanding === 1 ? '1 item pending' : `${outstanding} items pending`;
            const overviewMetaParts = [`${totalDocs} total docs`];
            if (lastUpdated && !Number.isNaN(lastUpdated.getTime())) {
              overviewMetaParts.push(`Updated ${lastUpdated.toLocaleDateString()}`);
            }
            const rows = statusOrder.map(entry => {
              const count = counts[entry.key] || 0;
              const pct = totalDocs ? Math.round((count / totalDocs) * 100) : 0;
              const barWidth = count ? Math.max(pct, 6) : 0;
              return `<div class="doc-status-row">
            <span class="status-pill" data-tone="${entry.tone}">${safe(entry.label)}</span>
            <div class="bar" style="--bar-color:${entry.color}"><span style="width:${barWidth}%"></span></div>
            <div class="count">${count}</div>
            <div class="meta">${pct}% • ${safe(entry.helper)}</div>
          </div>`;
            }).join('');
            docHost.innerHTML = `<div class="doc-status-overview"><strong>${pendingLabel}</strong><span>${safe(overviewMetaParts.join(' • '))}</span></div>${rows}`;
          }
        }

        perfLog(dashboardMark);
      }
      if (wantsContacts || wantsPipeline) {
        pipelineMark = perfMark('pipeline/contacts');
        const inpr = contacts.filter(c => {
          const stageKey = normalizeStatus(c.stage);
          const status = String(c.status || '').toLowerCase();
          return STAGES_PIPE.includes(stageKey) || status === 'inprogress';
        }).sort((a, b) => (fullName(a) || '').localeCompare(fullName(b) || ''));

        const lshot = contacts.filter(c => {
          const status = String(c.status || '').toLowerCase();
          const stageKey = normalizeStatus(c.stage);
          return status === 'prospect' || status === 'longshot' || status === 'nurture' || status === 'paused' || (stageKey || '').includes('long') || (stageKey || '').includes('nurture');
        }).sort((a, b) => (fullName(a) || '').localeCompare(fullName(b) || ''));

        const pipe = contacts.filter(c => {
          const stageKey = normalizeStatus(c.stage);
          return STAGES_PIPE.includes(stageKey);
        }).sort((a, b) => (fullName(a) || '').localeCompare(fullName(b) || ''));

        const clientsTbl = contacts.filter(c => {
          const stageKey = normalizeStatus(c.stage);
          return STAGES_CLIENT.includes(stageKey);
        }).sort((a, b) => (fullName(a) || '').localeCompare(fullName(b) || ''));

        const columnMode = resolveColumnMode();
        const pipelineColumns = getColumnsForView('pipeline-main', columnMode).visibleColumns;
        const clientColumns = getColumnsForView('clients', columnMode).visibleColumns;
        const longshotColumns = getColumnsForView('leads-main', columnMode).visibleColumns;

        setText($('#count-inprog'), inpr.length);
        setText($('#count-active'), pipe.length);
        setText($('#count-clients'), clientsTbl.length);
        setText($('#count-longshots'), lshot.length);

        const partnerMap = new Map(partners.map(p => [String(p.id), p]));
        const isoDate = (value) => { const d = toDate(value); return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : ''; };
        const contactLink = (c) => {
          const nameParts = [];
          if (c && c.first) nameParts.push(c.first);
          if (c && c.last) nameParts.push(c.last);
          const avatarSource = nameParts.length ? nameParts.join(' ') : (c && c.name) || '';
          const avatar = renderAvatar(avatarSource);
          const full = fullName(c);
          const displayName = safe(full);
          const titleAttr = attr(full || '');
          return `<a href="#" class="status-name-link contact-name" data-role="contact-name" data-ui="name-link" data-id="${attr(c.id || '')}" title="${titleAttr}">${avatar}<span class="name-text">${displayName}</span></a>`;
        };

        const buildContactCell = (contact, columnId, ctx = {}) => {
          const stageMeta = ctx.stageMeta || stageInfo(contact.stage);
          const loanLabel = ctx.loanLabel ?? (contact.loanType || contact.loanProgram || '');
          const amountVal = ctx.amountVal ?? (Number(contact.loanAmount || 0) || 0);
          const formatDate = ctx.formatDate || displayDate;
          const partnerMap = ctx.partnerMap;
          const referralFromMap = (id) => {
            if (!id || !partnerMap) return '';
            const partner = partnerMap.get(String(id));
            if (!partner) return '';
            return partner.name || partner.company || '';
          };
          switch (columnId) {
            case 'name':
              return `<td class="contact-name" data-column="name" data-role="contact-name">${contactLink(contact)}</td>`;
            case 'stage':
              return `<td data-column="stage">${stageMeta.html}</td>`;
            case 'status':
              return `<td data-column="status">${safe(contact.status || contact.stage || '—')}</td>`;
            case 'pipelineMilestone': {
              const milestone = contact.pipelineMilestone || contact.milestone || '';
              return `<td data-column="pipelineMilestone">${safe(milestone || '—')}</td>`;
            }
            case 'loanType':
              return `<td data-column="loanType">${safe(loanLabel || '')}</td>`;
            case 'loanAmount':
              return `<td class="numeric" data-column="loanAmount">${amountVal ? money(amountVal) : '—'}</td>`;
            case 'referredBy':
              return `<td data-column="referredBy">${safe(contact.referredBy || referralFromMap(contact.referralPartnerId) || referralFromMap(contact.partnerId) || '')}</td>`;
            case 'email':
              return `<td data-column="email">${safe(contact.email || '—')}</td>`;
            case 'phone':
              return `<td data-column="phone">${safe(contact.phone || '—')}</td>`;
            case 'city':
              return `<td data-column="city">${safe(contact.city || '—')}</td>`;
            case 'fundedDate':
              return `<td data-column="fundedDate">${safe(formatDate(contact.fundedDate) || '—')}</td>`;
            case 'owner': {
              const owner = contact.owner || contact.ownerName || '';
              return `<td data-column="owner">${safe(owner || '—')}</td>`;
            }
            case 'lastTouch': {
              const lastVal = contact.lastContact || contact.nextFollowUp || '';
              return `<td data-column="lastTouch">${safe(lastVal || '—')}</td>`;
            }
            case 'nextAction': {
              const nextVal = contact.nextFollowUp || '';
              return `<td data-column="nextAction">${safe(nextVal || '—')}</td>`;
            }
            case 'createdAt':
              return `<td data-column="createdAt">${safe(formatDate(contact.createdAt) || '—')}</td>`;
            case 'updatedAt':
              return `<td data-column="updatedAt">${safe(formatDate(contact.updatedAt) || '—')}</td>`;
            default:
              return `<td data-column="${attr(columnId)}">—</td>`;
          }
        };


        relOpportunities = inpr.map(c => {
          const lastTouch = toDate(c.lastContact || c.nextFollowUp);
          const days = lastTouch ? daysAgo(lastTouch, now) : null;
          return { contact: c, lastTouch, days };
        }).filter(row => row.days == null || row.days >= 5).sort((a, b) => {
          const ad = a.days == null ? Number.MAX_SAFE_INTEGER : a.days;
          const bd = b.days == null ? Number.MAX_SAFE_INTEGER : b.days;
          if (ad === bd) {
            const aAmt = Number(a.contact.loanAmount || 0);
            const bAmt = Number(b.contact.loanAmount || 0);
            return bAmt - aAmt;
          }
          return bd - ad;
        }).slice(0, 5);

        nurtureCandidates = clientsTbl.map(c => {
          const last = toDate(c.lastContact || c.fundedDate || c.anniversary);
          const days = last ? daysAgo(last, now) : null;
          return { contact: c, lastTouch: last, days };
        }).filter(row => row.days == null || row.days >= 21).sort((a, b) => {
          const ad = a.days == null ? Number.MAX_SAFE_INTEGER : a.days;
          const bd = b.days == null ? Number.MAX_SAFE_INTEGER : b.days;
          return bd - ad;
        }).slice(0, 5);

        closingCandidates = contacts.map(c => {
          const stageKey = normalizeStatus(c.stage);
          const dateValue = c.expectedClosing || c.closingDate || c.fundedDate;
          const date = toDate(dateValue);
          return { contact: c, date, stage: stageKey };
        }).filter(row => row.date).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5);

        const pipelineTypeLabels = { task: 'Task', deal: 'Closing', followup: 'Follow-Up', expiring: 'Expiring' };
        pipelineEvents = (() => {
          const horizon = new Date(today);
          horizon.setDate(horizon.getDate() + 30);
          const rangeStart = today.getTime();
          const rangeEnd = horizon.getTime();
          const events = [];
          // Pipeline calendar click path:
          //   addEvent(normalizeRecordRefs) → buildRecordDataAttrs on <li>
          //   dashboard delegated click (handleDashboardTap) reads data-contact-id / data-partner-id
          //   dispatches Contacts/Partner editors just like table rows
          const addEvent = (rawDate, label, meta, type, contactId, partnerId) => {
            const when = rawDate instanceof Date ? rawDate : toDate(rawDate);
            if (!when) return;
            const stamp = when.getTime();
            if (Number.isNaN(stamp) || stamp < rangeStart || stamp > rangeEnd) return;
            const typeKey = pipelineTypeLabels[type] ? type : 'task';
            const typeLabel = pipelineTypeLabels[typeKey] || pipelineTypeLabels.task;
            const ids = normalizeRecordRefs(contactId, partnerId);
            events.push({ date: when, label, meta, type: typeKey, typeLabel, contactId: ids.contactId, partnerId: ids.partnerId });
          };
          openTasks.forEach(task => {
            if (task.dueDate) {
              const metaParts = [task.name];
              if (task.stage) metaParts.push(task.stage);
              const ids = normalizeRecordRefs(task.contactId, task.partnerId, task.contact);
              addEvent(task.dueDate, task.title, metaParts.filter(Boolean).join(' • '), 'task', ids.contactId, ids.partnerId);
            }
          });
          contacts.forEach(c => {
            if (c.nextFollowUp) {
              const stageKey = normalizeStatus(c.stage);
              const stage = stageLabels[stageKey] || c.stage || STR['stage.pipeline'];
              const ids = normalizeRecordRefs(c.id, c.partnerId, c);
              addEvent(c.nextFollowUp, `${fullName(c)} — Next Touch`, stage, 'followup', ids.contactId, ids.partnerId);
            }
            if (c.preApprovalExpires) {
              const ids = normalizeRecordRefs(c.id, c.partnerId, c);
              addEvent(c.preApprovalExpires, `${fullName(c)} — Pre-Approval`, 'Expires', 'expiring', ids.contactId, ids.partnerId);
            }
          });
          closingCandidates.forEach(item => {
            const c = item.contact;
            const stage = stageLabels[item.stage] || (c.stage || '');
            const metaParts = [stage];
            if (Number(c.loanAmount || 0)) metaParts.push(money(c.loanAmount));
            const ids = normalizeRecordRefs(c.id, c.partnerId, c);
            addEvent(item.date, `${fullName(c)} — Closing`, metaParts.filter(Boolean).join(' • '), 'deal', ids.contactId, ids.partnerId);
          });
          events.sort((a, b) => a.date.getTime() - b.date.getTime());
          return events;
        })();

        if (wantsPipeline) {
          html($('#rel-opps'), relOpportunities.length ? relOpportunities.map(item => {
            const c = item.contact;
            const ids = normalizeRecordRefs(c.id, c.partnerId, c);
            const widgetAttrs = buildRecordDataAttrs(ids, 'rel-opps');
            const name = fullName(c);
            const last = item.days == null ? 'No touches yet' : (item.days <= 0 ? 'Touched today' : `${item.days}d since touch`);
            const urgencyClass = item.days == null || item.days > 14 ? 'bad' : 'warn';
            const stageKey = normalizeStatus(c.stage);
            const stage = stageLabels[stageKey] || (c.stage || '');
            const amount = Number(c.loanAmount || 0) ? ` • ${money(c.loanAmount)}` : '';
            return `<li${widgetAttrs}>
        <div class="list-main">
          <span class="insight-avatar">${initials(name)}</span>
          <div>
            <div class="insight-title">${safe(name)}</div>
            <div class="insight-sub">${safe(stage)}${amount}</div>
          </div>
        </div>
        <div class="insight-meta ${urgencyClass}">${last}</div>
      </li>`;
          }).join('') : '<li class="empty">Pipeline borrowers are up to date.</li>');

          html($('#nurture'), nurtureCandidates.length ? nurtureCandidates.map(item => {
            const c = item.contact;
            const ids = normalizeRecordRefs(c.id, c.partnerId, c);
            const widgetAttrs = buildRecordDataAttrs(ids, 'nurture');
            const name = fullName(c);
            const last = item.days == null ? 'Never nurtured' : `${item.days}d since touch`;
            const stageKey = normalizeStatus(c.stage);
            const stage = stageLabels[stageKey] || (c.stage || STR['kanban.placeholder.client']);
            const funded = c.fundedDate ? `${translate('calendar.event.funded')} ${safe(c.fundedDate)}` : STR['kanban.placeholder.client'];
            return `<li${widgetAttrs}>
        <div class="list-main">
          <span class="insight-avatar">${initials(name)}</span>
          <div>
            <div class="insight-title">${safe(name)}</div>
            <div class="insight-sub">${safe(stage)} • ${safe(funded)}</div>
          </div>
        </div>
        <div class="insight-meta warn">${last}</div>
      </li>`;
          }).join('') : '<li class="empty">All clients recently nurtured. Schedule your next campaign!</li>');

          html($('#closing-watch'), closingCandidates.length ? closingCandidates.map(item => {
            const c = item.contact;
            const name = fullName(c);
            const stage = stageLabels[item.stage] || (c.stage || '');
            const when = item.date.toISOString().slice(0, 10);
            const amount = Number(c.loanAmount || 0) ? money(c.loanAmount) : 'TBD';
            const statusClass = item.stage === 'funded' ? 'good' : 'warn';
            const ids = normalizeRecordRefs(c.id, c.partnerId, c);
            const widgetAttrs = buildRecordDataAttrs(ids, 'closing-watch');
            return `<li${widgetAttrs} data-date="${attr(when)}">
          <div class="list-main">
            <span class="insight-avatar">${initials(name)}</span>
            <div>
              <div class="insight-title">${safe(name)}</div>
              <div class="insight-sub">${safe(stage)} • ${amount}</div>
            </div>
          </div>
          <div class="insight-meta ${statusClass}">${when}</div>
        </li>`;
          }).join('') : '<li class="empty">No scheduled closings yet — load deals to track them here.</li>');

          const pipelineCal = $('#pipeline-calendar');
          if (pipelineCal) {
            if (!pipelineEvents.length) {
              pipelineCal.innerHTML = '<div class="empty">No upcoming milestones in the next 30 days.</div>';
            } else {
              const items = pipelineEvents.slice(0, 8).map(ev => {
                const typeClass = `pipeline-type ${safe(ev.type.toLowerCase())}`;
                const badge = pipelineTypeLabels[ev.type.toLowerCase()] || ev.type;
                const metaLine = ev.meta ? `<div class="pipeline-meta">${safe(ev.meta)}</div>` : '';
                // Pipeline calendar click path:
                //   record ids → buildRecordDataAttrs → data-contact-id / data-partner-id on <li>
                //   dashboard delegated click (handleDashboardTap) → dispatchContactModal / dispatchPartnerModal
                const widgetAttrs = buildRecordDataAttrs(normalizeRecordRefs(ev.contactId, ev.partnerId), 'pipeline-calendar');
                return `<li${widgetAttrs}><div class="pipeline-date">${safe(shortDate(ev.date))}</div><div class="pipeline-detail"><div class="pipeline-label">${safe(ev.label)}</div>${metaLine}</div><span class="${typeClass}">${safe(badge)}</span></li>`;
              }).join('');
              pipelineCal.innerHTML = `<ul class="pipeline-timeline">${items}</ul>`;
            }
          }
        }

        const MAX_FAVORITE_WIDGET_ITEMS = 8;

        function computeFavoriteRecords() {
          const state = ensureFavoriteState();
          const index = window.__RECORD_INDEX__ || {};
          const contactEntries = index.contacts && index.contacts.byId instanceof Map ? index.contacts.byId : new Map();
          const partnerEntries = index.partners && index.partners.byId instanceof Map ? index.partners.byId : new Map();
          const records = [];
          state.contacts.forEach(id => {
            const meta = contactEntries.get(String(id));
            const contact = meta && meta.record ? meta.record : null;
            if (!contact) return;
            const stageMeta = stageInfo(contact.stage);
            const stageLabel = stageMeta.label || 'Stage';
            const nextRaw = contact.nextFollowUp || contact.fundedDate || contact.lastContact || '';
            const nextDate = toDate(nextRaw);
            const nextLabel = nextDate ? `Next ${shortDate(nextDate)}` : '';
            const amountLabel = Number(contact.loanAmount || 0) ? money(contact.loanAmount) : '';
            const subtitleParts = [];
            if (nextLabel) subtitleParts.push(nextLabel);
            if (amountLabel) subtitleParts.push(amountLabel);
            records.push({
              type: 'contact',
              id: String(contact.id || ''),
              name: fullName(contact) || '—',
              subtitle: subtitleParts.filter(Boolean).join(' • ') || '—',
              meta: stageLabel,
              record: contact
            });
          });
          state.partners.forEach(id => {
            const meta = partnerEntries.get(String(id));
            const partner = meta && meta.record ? meta.record : null;
            if (!partner) return;
            const tierLabel = partner.tier || 'Partner';
            const companyLabel = partner.company || '';
            const cadence = partner.cadence || '';
            const subtitleParts = [];
            if (companyLabel) subtitleParts.push(companyLabel);
            if (cadence) subtitleParts.push(cadence);
            records.push({
              type: 'partner',
              id: String(partner.id || ''),
              name: partner.name || partner.company || '—',
              subtitle: subtitleParts.filter(Boolean).join(' • ') || '—',
              meta: tierLabel,
              record: partner
            });
          });
          records.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
          return records;
        }

        function renderFavoritesWidget() {
          if (typeof document === 'undefined') return;
          const card = document.getElementById('favorites-card');
          if (!card) return;
          const listEl = card.querySelector('[data-role="favorites-list"]') || card.querySelector('#favorites-list');
          if (!listEl) return;
          const emptyEl = card.querySelector('[data-role="favorites-empty"]');
          const countEl = card.querySelector('[data-role="favorites-count"]');
          const favorites = computeFavoriteRecords();
          if (countEl) countEl.textContent = favorites.length === 1 ? '1 favorite' : `${favorites.length} favorites`;
          if (!favorites.length) {
            listEl.innerHTML = '';
            listEl.hidden = true;
            if (emptyEl) emptyEl.hidden = false;
            card.setAttribute('data-has-favorites', '0');
            return;
          }
          const itemsHtml = favorites.slice(0, MAX_FAVORITE_WIDGET_ITEMS).map(item => {
            const idAttr = attr(item.id || '');
            const ids = item.type === 'partner'
              ? normalizeRecordRefs('', idAttr, item.record)
              : normalizeRecordRefs(idAttr, (item.record && item.record.partnerId) || '', item.record);
            const widgetAttrs = buildRecordDataAttrs(ids, 'favorites');
            const dataIdAttr = item.type === 'partner' ? ` data-id="${idAttr}"` : '';
            const kindAttr = ` data-kind="${item.type === 'partner' ? 'partner' : 'contact'}"`;
            const avatar = initials(item.name);
            const subtitle = item.subtitle ? safe(item.subtitle) : '—';
            const metaLabel = item.meta ? safe(item.meta) : (item.type === 'partner' ? 'Partner' : 'Contact');
            return `<li${widgetAttrs}${dataIdAttr}${kindAttr}>
        <div class="list-main">
          <span class="insight-avatar">${safe(avatar)}</span>
          <div>
            <div class="insight-title">${safe(item.name)}</div>
            <div class="insight-sub">${subtitle}</div>
          </div>
        </div>
        <div class="insight-meta">${metaLabel}</div>
      </li>`;
          }).join('');
          listEl.innerHTML = itemsHtml;
          listEl.hidden = false;
          if (emptyEl) emptyEl.hidden = true;
          card.setAttribute('data-has-favorites', '1');
        }

        window.renderFavoritesWidget = renderFavoritesWidget;

        const favoritesForWidget = computeFavoriteRecords();
        window.__WIDGET_DATA__ = { relOpportunities, nurtureCandidates, closingCandidates, pipelineEvents, attention, timeline, favorites: favoritesForWidget };
        renderFavoritesWidget();

        // Workbench restoration: Removed explicit deletion of .status-stack
        // ensurePipelineLegend();
        ensureStatusStackLegend();

        if (wantsPipelineTable) {
          const tblPipeline = document.getElementById('tbl-pipeline');
          if (tblPipeline) renderContactHeader(tblPipeline, pipelineColumns, 'pipe-all');
          if (tblPipeline) ensureFavoriteColumn(tblPipeline);
          const tbPipe = tblPipeline && tblPipeline.tBodies && tblPipeline.tBodies[0] ? tblPipeline.tBodies[0] : $('#tbl-pipeline tbody');
          if (tbPipe) {
            const pipelineRows = pipe.map(c => {
              const contactId = String(c.id || '');
              const idAttr = attr(contactId);
              const nameAttr = attr(fullName(c).toLowerCase());
              const stageMeta = stageInfo(c.stage);
              const stageAttr = attr(stageMeta.normalizedKey);
              const stageCanonicalAttr = stageMeta.canonicalKey ? ` data-stage-canonical="${attr(stageMeta.canonicalKey)}"` : '';
              const stageClass = classToken(stageMeta.canonicalKey || stageMeta.normalizedKey || c.stage || '');
              const stageToneKey = stageMeta.canonicalKey || stageMeta.normalizedKey || c.stage || '';
              const stageTone = colorForStage(stageToneKey);
              const rowClasses = ['status-row', 'contact-stage-row'];
              if (stageClass) rowClasses.push(`stage-${stageClass}`);
              const isFavorite = favoriteState.contacts.has(contactId);
              if (isFavorite) rowClasses.push('is-favorite');
              const rowToneAttr = stageClass ? ` data-row-tone="${attr(stageClass)}"` : '';
              const loanLabel = c.loanType || c.loanProgram || '';
              const loanAttr = attr(String(loanLabel).toLowerCase());
              const amountVal = Number(c.loanAmount || 0) || 0;
              const amountAttr = attr(amountVal);
              const emailAttr = attr((c.email || '').trim().toLowerCase());
              const phoneAttr = attr(normalizePhone(c.phone || ''));
              const statusAttr = attr(String(c.status || '').toLowerCase());
              const cityAttr = attr(String(c.city || c.location || '').toLowerCase());
              const ownerAttr = attr(String(c.owner || c.relationshipOwner || c.loanOfficer || '').toLowerCase());
              const milestoneAttr = attr(String(c.pipelineMilestone || c.milestone || '').toLowerCase());
              const lastAttr = attr(isoDate(c.lastContact || c.lastTouch) || '');
              const nextAttr = attr(isoDate(c.nextFollowUp || c.nextTouch) || '');
              const createdAttr = attr(isoDate(c.createdAt) || '');
              const updatedAttr = attr(isoDate(c.updatedAt) || '');
              const refTokens = [];
              if (c.referredBy) refTokens.push(String(c.referredBy));
              [c.buyerPartnerId, c.listingPartnerId, c.partnerId].forEach(pid => {
                if (!pid && pid !== 0) return;
                const partner = partnerMap.get(String(pid));
                if (partner && partner.name) refTokens.push(partner.name);
                if (partner && partner.company) refTokens.push(partner.company);
              });
              const refAttr = attr(refTokens.map(val => String(val || '').toLowerCase()).filter(Boolean).join('|'));
              const favoriteCell = `<td class="favorite-cell">${renderFavoriteToggle('contact', contactId, isFavorite)}</td>`;
              const favoriteAttr = isFavorite ? ' data-favorite="1"' : '';
              const cells = [
                `<td data-column="select"><input data-ui="row-check" data-role="select" type="checkbox" data-id="${idAttr}"></td>`,
                favoriteCell,
                ...pipelineColumns.map((col) => buildContactCell(c, col.id, { stageMeta, loanLabel, amountVal, formatDate: displayDate, partnerMap }))
              ];
              return `<tr class="${rowClasses.join(' ')}"${rowToneAttr}${rowToneStyle(stageTone)} data-id="pipe:${idAttr}" data-contact-id="${idAttr}" data-name="${nameAttr}" data-stage="${stageAttr}"${stageCanonicalAttr} data-status="${statusAttr}" data-city="${cityAttr}" data-owner="${ownerAttr}" data-pipeline-milestone="${milestoneAttr}" data-loan="${loanAttr}" data-amount="${amountAttr}" data-email="${emailAttr}" data-phone="${phoneAttr}" data-last-touch="${lastAttr}" data-next-action="${nextAttr}" data-created-at="${createdAttr}" data-updated-at="${updatedAttr}" data-ref="${refAttr}"${favoriteAttr}>${cells.join('')}</tr>`;
            }).join('');
            renderTableBody(tblPipeline, tbPipe, pipelineRows);
          }
        }
        if (wantsContactTables) {
          const tblClients = document.getElementById('tbl-clients');
          if (tblClients) renderContactHeader(tblClients, clientColumns, 'clients-all');
          if (tblClients) ensureFavoriteColumn(tblClients);
          const tbClients = tblClients && tblClients.tBodies && tblClients.tBodies[0] ? tblClients.tBodies[0] : $('#tbl-clients tbody');
          if (tbClients) {
            const clientRows = clientsTbl.map(c => {
              const contactId = String(c.id || '');
              const idAttr = attr(contactId);
              const nameAttr = attr(fullName(c).toLowerCase());
              const stageMeta = stageInfo(c.stage);
              const stageAttr = attr(stageMeta.normalizedKey);
              const stageCanonicalAttr = stageMeta.canonicalKey ? ` data-stage-canonical="${attr(stageMeta.canonicalKey)}"` : '';
              const stageClass = classToken(stageMeta.canonicalKey || stageMeta.normalizedKey || c.stage || '');
              const stageToneKey = stageMeta.canonicalKey || stageMeta.normalizedKey || c.stage || '';
              const stageTone = colorForStage(stageToneKey);
              const rowClasses = ['status-row', 'contact-stage-row'];
              if (stageClass) rowClasses.push(`stage-${stageClass}`);
              const isFavorite = favoriteState.contacts.has(contactId);
              if (isFavorite) rowClasses.push('is-favorite');
              const rowToneAttr = stageClass ? ` data-row-tone="${attr(stageClass)}"` : '';
              const loanLabel = c.loanType || c.loanProgram || '';
              const loanAttr = attr(String(loanLabel).toLowerCase());
              const amountVal = Number(c.loanAmount || 0) || 0;
              const amountAttr = attr(amountVal);
              const emailAttr = attr((c.email || '').trim().toLowerCase());
              const phoneAttr = attr(normalizePhone(c.phone || ''));
              const statusAttr = attr(String(c.status || '').toLowerCase());
              const cityAttr = attr(String(c.city || c.location || '').toLowerCase());
              const ownerAttr = attr(String(c.owner || c.relationshipOwner || c.loanOfficer || '').toLowerCase());
              const milestoneAttr = attr(String(c.pipelineMilestone || c.milestone || '').toLowerCase());
              const lastAttr = attr(isoDate(c.lastContact || c.lastTouch) || '');
              const nextAttr = attr(isoDate(c.nextFollowUp || c.nextTouch) || '');
              const createdAttr = attr(isoDate(c.createdAt) || '');
              const updatedAttr = attr(isoDate(c.updatedAt) || '');
              const fundedIso = attr(isoDate(c.fundedDate) || '');
              const refTokens = [];
              if (c.referredBy) refTokens.push(String(c.referredBy));
              [c.buyerPartnerId, c.listingPartnerId, c.partnerId].forEach(pid => {
                if (!pid && pid !== 0) return;
                const partner = partnerMap.get(String(pid));
                if (partner && partner.name) refTokens.push(partner.name);
                if (partner && partner.company) refTokens.push(partner.company);
              });
              const refAttr = attr(refTokens.map(val => String(val || '').toLowerCase()).filter(Boolean).join('|'));
              const favoriteCell = `<td class="favorite-cell">${renderFavoriteToggle('contact', contactId, isFavorite)}</td>`;
              const favoriteAttr = isFavorite ? ' data-favorite="1"' : '';
              const cells = [
                `<td data-column="select"><input data-ui="row-check" data-role="select" type="checkbox" data-id="${idAttr}"></td>`,
                favoriteCell,
                ...clientColumns.map((col) => buildContactCell(c, col.id, { stageMeta, loanLabel, amountVal, formatDate: displayDate, partnerMap }))
              ];
              return `<tr class="${rowClasses.join(' ')}"${rowToneAttr}${rowToneStyle(stageTone)} data-id="client:${idAttr}" data-contact-id="${idAttr}" data-name="${nameAttr}" data-stage="${stageAttr}"${stageCanonicalAttr} data-status="${statusAttr}" data-city="${cityAttr}" data-owner="${ownerAttr}" data-pipeline-milestone="${milestoneAttr}" data-loan="${loanAttr}" data-amount="${amountAttr}" data-email="${emailAttr}" data-phone="${phoneAttr}" data-last-touch="${lastAttr}" data-next-action="${nextAttr}" data-created-at="${createdAttr}" data-updated-at="${updatedAttr}" data-funded="${fundedIso}" data-ref="${refAttr}"${favoriteAttr}>${cells.join('')}</tr>`;
            }).join('');
            renderTableBody(tblClients, tbClients, clientRows);
          }
          const tblLongshots = document.getElementById('tbl-longshots');
          if (tblLongshots) renderContactHeader(tblLongshots, longshotColumns, 'ls-all');
          if (tblLongshots) ensureFavoriteColumn(tblLongshots);
          const tbLs = tblLongshots && tblLongshots.tBodies && tblLongshots.tBodies[0] ? tblLongshots.tBodies[0] : $('#tbl-longshots tbody');
          if (tbLs) {
            const longshotRows = lshot.map(c => {
              const contactId = String(c.id || '');
              const idAttr = attr(contactId);
              const nameAttr = attr(fullName(c).toLowerCase());
              const loanLabel = c.loanType || c.loanProgram || '';
              const loanAttr = attr(String(loanLabel).toLowerCase());
              const amountVal = Number(c.loanAmount || 0) || 0;
              const amountAttr = attr(amountVal);
              const emailAttr = attr((c.email || '').trim().toLowerCase());
              const phoneAttr = attr(normalizePhone(c.phone || ''));
              const statusAttr = attr(String(c.status || '').toLowerCase());
              const cityAttr = attr(String(c.city || c.location || '').toLowerCase());
              const ownerAttr = attr(String(c.owner || c.relationshipOwner || c.loanOfficer || '').toLowerCase());
              const milestoneAttr = attr(String(c.pipelineMilestone || c.milestone || '').toLowerCase());
              const longshotStageKey = normalizeStatus(c.stage) || normalizeStatus(c.status) || 'long shot';
              const stageMeta = stageInfo(c.stage || c.status || longshotStageKey);
              const longshotClass = classToken(longshotStageKey);
              const longshotTone = colorForStage(longshotStageKey) || colorForStage('long shot');
              const rowClasses = ['status-row', 'contact-stage-row'];
              if (longshotClass) rowClasses.push(`stage-${longshotClass}`);
              const isFavorite = favoriteState.contacts.has(contactId);
              if (isFavorite) rowClasses.push('is-favorite');
              const rowToneAttr = longshotClass ? ` data-row-tone="${attr(longshotClass)}"` : '';
              const lastIso = attr(isoDate(c.lastContact || c.nextFollowUp || c.lastTouch) || '');
              const nextIso = attr(isoDate(c.nextFollowUp || c.nextTouch) || '');
              const createdAttr = attr(isoDate(c.createdAt) || '');
              const updatedAttr = attr(isoDate(c.updatedAt) || '');
              const refTokens = [];
              if (c.referredBy) refTokens.push(String(c.referredBy));
              [c.buyerPartnerId, c.listingPartnerId, c.partnerId].forEach(pid => {
                if (!pid && pid !== 0) return;
                const partner = partnerMap.get(String(pid));
                if (partner && partner.name) refTokens.push(partner.name);
                if (partner && partner.company) refTokens.push(partner.company);
              });
              const refAttr = attr(refTokens.map(val => String(val || '').toLowerCase()).filter(Boolean).join('|'));
              const favoriteCell = `<td class="favorite-cell" data-column="favorite">${renderFavoriteToggle('contact', contactId, isFavorite)}</td>`;
              const favoriteAttr = isFavorite ? ' data-favorite="1"' : '';
              const cells = [
                `<td data-column="select" data-role="select"><input data-ui="row-check" data-role="select" type="checkbox" data-id="${idAttr}"></td>`,
                favoriteCell,
                ...longshotColumns.map((col) => buildContactCell(c, col.id, { stageMeta, loanLabel, amountVal, formatDate: displayDate, partnerMap }))
              ];
              return `<tr class="${rowClasses.join(' ')}"${rowToneAttr}${rowToneStyle(longshotTone)} data-id="longshot:${idAttr}" data-contact-id="${idAttr}" data-name="${nameAttr}" data-status="${statusAttr}" data-city="${cityAttr}" data-owner="${ownerAttr}" data-pipeline-milestone="${milestoneAttr}" data-loan="${loanAttr}" data-amount="${amountAttr}" data-email="${emailAttr}" data-phone="${phoneAttr}" data-ref="${refAttr}" data-last="${lastIso}" data-next-action="${nextIso}" data-created-at="${createdAttr}" data-updated-at="${updatedAttr}"${favoriteAttr}>${cells.join('')}</tr>`;
            }).join('');
            renderTableBody(tblLongshots, tbLs, longshotRows);
          }
          const tblContacts = document.getElementById('tbl-contacts');
          if (tblContacts) {
            const contactColumns = getColumnsForView('contacts', columnMode).visibleColumns;
            renderContactHeader(tblContacts, contactColumns, 'contacts-all');
            ensureFavoriteColumn(tblContacts);
            const tbContacts = tblContacts.tBodies[0] || $('#tbl-contacts tbody');
            if (tbContacts) {
              const contactRows = contacts.map(c => {
                const contactId = String(c.id || '');
                const idAttr = attr(contactId);
                const nameAttr = attr(fullName(c).toLowerCase());
                const stageMeta = stageInfo(c.stage);
                const stageAttr = attr(stageMeta.normalizedKey);
                const stageCanonicalAttr = stageMeta.canonicalKey ? ` data-stage-canonical="${attr(stageMeta.canonicalKey)}"` : '';
                const stageClass = classToken(stageMeta.canonicalKey || stageMeta.normalizedKey || c.stage || '');
                const stageToneKey = stageMeta.canonicalKey || stageMeta.normalizedKey || c.stage || '';
                const stageTone = colorForStage(stageToneKey);
                const rowClasses = ['status-row', 'contact-stage-row'];
                if (stageClass) rowClasses.push(`stage-${stageClass}`);
                const isFavorite = favoriteState.contacts.has(contactId);
                if (isFavorite) rowClasses.push('is-favorite');
                const rowToneAttr = stageClass ? ` data-row-tone="${attr(stageClass)}"` : '';
                const loanLabel = c.loanType || c.loanProgram || '';
                const loanAttr = attr(String(loanLabel).toLowerCase());
                const amountVal = Number(c.loanAmount || 0) || 0;
                const amountAttr = attr(amountVal);
                const emailAttr = attr((c.email || '').trim().toLowerCase());
                const phoneAttr = attr(normalizePhone(c.phone || ''));
                const statusAttr = attr(String(c.status || '').toLowerCase());
                const cityAttr = attr(String(c.city || c.location || '').toLowerCase());
                const ownerAttr = attr(String(c.owner || c.relationshipOwner || c.loanOfficer || '').toLowerCase());
                const milestoneAttr = attr(String(c.pipelineMilestone || c.milestone || '').toLowerCase());
                const lastAttr = attr(isoDate(c.lastContact || c.lastTouch) || '');
                const nextAttr = attr(isoDate(c.nextFollowUp || c.nextTouch) || '');
                const createdAttr = attr(isoDate(c.createdAt) || '');
                const updatedAttr = attr(isoDate(c.updatedAt) || '');
                const refTokens = [];
                if (c.referredBy) refTokens.push(String(c.referredBy));
                [c.buyerPartnerId, c.listingPartnerId, c.partnerId].forEach(pid => {
                  if (!pid && pid !== 0) return;
                  const partner = partnerMap.get(String(pid));
                  if (partner && partner.name) refTokens.push(partner.name);
                  if (partner && partner.company) refTokens.push(partner.company);
                });
                const refAttr = attr(refTokens.map(val => String(val || '').toLowerCase()).filter(Boolean).join('|'));
                const favoriteCell = `<td class="favorite-cell">${renderFavoriteToggle('contact', contactId, isFavorite)}</td>`;
                const favoriteAttr = isFavorite ? ' data-favorite="1"' : '';
                const cells = [
                  `<td data-column="select"><input data-ui="row-check" data-role="select" type="checkbox" data-id="${idAttr}"></td>`,
                  favoriteCell,
                  ...contactColumns.map((col) => buildContactCell(c, col.id, { stageMeta, loanLabel, amountVal, formatDate: displayDate, partnerMap }))
                ];
                return `<tr class="${rowClasses.join(' ')}"${rowToneAttr}${rowToneStyle(stageTone)} data-id="${idAttr}" data-contact-id="${idAttr}" data-name="${nameAttr}" data-stage="${stageAttr}"${stageCanonicalAttr} data-status="${statusAttr}" data-city="${cityAttr}" data-owner="${ownerAttr}" data-pipeline-milestone="${milestoneAttr}" data-loan="${loanAttr}" data-amount="${amountAttr}" data-email="${emailAttr}" data-phone="${phoneAttr}" data-last-touch="${lastAttr}" data-next-action="${nextAttr}" data-created-at="${createdAttr}" data-updated-at="${updatedAttr}" data-ref="${refAttr}"${favoriteAttr}>${cells.join('')}</tr>`;
              }).join('');
              renderTableBody(tblContacts, tbContacts, contactRows);
              ensureContactRowOpener(tblContacts);
            }
          }
          if (typeof window.ensureSortable === 'function') {
            ['tbl-pipeline', 'tbl-clients', 'tbl-longshots', 'tbl-contacts'].forEach((id) => {
              try { window.ensureSortable(id); }
              catch (_err) { }
            });
          }
        }

        ensureKanbanStageAttributes();
        perfLog(pipelineMark);
      }
      partnersMark = perfMark('partners');
      renderPartnersTable(partners, contacts);
      perfLog(partnersMark);

      if (typeof window.applyFilters === 'function') {
        try { window.applyFilters(); }
        catch (err) { console && console.warn && console.warn('applyFilters', err); }
      }

    } finally {
      releaseLoadingPlaceholders();
      perfLog(totalMark);
    }

  });
}

window.renderAll = renderAll;
registerRenderer(renderAll);

function renderScopedView(scopes, options) {
  const payload = Object.assign({}, options || {}, { scopes });
  return renderAll(payload);
}

function ensureContactRowOpener(table) {
  if (!table || table.__rowOpenWired) return;
  const handler = async (event) => {
    if (event && event.__crmRowEditorHandled) return;
    const skip = event.target?.closest?.('input,button,select,textarea,label,[data-role="favorite-toggle"]');
    if (skip) return;
    const row = event.target?.closest?.('tr[data-contact-id]');
    if (!row || !table.contains(row)) return;
    const id = row.getAttribute('data-contact-id');
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    event.__crmRowEditorHandled = true;
    clearSelectionForSurface('contacts', { reason: 'contacts:row-open' });
    try {
      const mod = await import('./contacts.js');
      if (mod && typeof mod.openContactEditor === 'function') {
        mod.openContactEditor(id, { sourceHint: 'contacts:list-row', trigger: row });
      }
    } catch (err) {
      try { console && console.warn && console.warn('contact row open failed', err); }
      catch (warnErr) { logError('render:contacts-row-open-warn', warnErr); }
    }
  };
  table.addEventListener('click', handler);
  table.__rowOpenWired = true;
}

function ensurePartnerRowOpener(table) {
  if (!table || table.__rowOpenWired) return;
  const handler = async (event) => {
    if (event && event.__crmRowEditorHandled) return;
    const favorite = event.target?.closest?.('[data-role="favorite-toggle"]');
    if (favorite) return;
    const skip = event.target?.closest?.('input,button,select,textarea,label');
    if (skip) return;
    const row = event.target?.closest?.('tr[data-partner-id]');
    if (!row || !table.contains(row)) return;
    const id = row.getAttribute('data-partner-id');
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    event.__crmRowEditorHandled = true;
    clearSelectionForSurface('partners', { reason: 'partners:row-open' });
    try {
      const mod = await import('./partners.js');
      if (mod && typeof mod.openPartnerEditModal === 'function') {
        mod.openPartnerEditModal(id, { sourceHint: 'partners:list-row', trigger: row });
      }
    } catch (err) {
      try { console && console.warn && console.warn('partner row open failed', err); }
      catch (warnErr) { logError('render:partners-row-open-warn', warnErr); }
    }
  };
  table.addEventListener('click', handler);
  table.__rowOpenWired = true;
}

window.renderDashboardView = function (options) {
  return renderScopedView(['dashboard'], options);
};
window.renderDashboard = window.renderDashboardView;

window.renderContactsView = function (options) {
  return renderScopedView(['contacts'], options);
};

window.renderPipelineView = function (options) {
  return renderScopedView(['pipeline'], options);
};
window.renderKanban = window.renderPipelineView;

export async function renderPartnersView(options) {
  const root = document.getElementById('view-partners');
  if (root) root.innerHTML = ''; // FIX: Clear previous view content (e.g. Calendar artifacts)
  if (root) {
    root.innerHTML = `
            <section class="card">
                <div class="row" style="align-items:center;gap:12px;margin-bottom:8px">
                    <strong>Partners</strong>
                    <span class="help-hint"
                        data-hint="Tag partners on contacts to track referral performance and conversion rates. Partner relationships drive your pipeline.">?</span>
                    <span class="grow">
                    </span>
                    <button class="btn" data-export-table="partners" aria-label="Export to CSV"
                        title="Export to CSV">Export
                        CSV</button>
                    <button class="btn" id="btn-filters-partners" data-filters-scope="partners">
                        Filters
                    </button>
                </div>
                <div class="row query-save-row">
                    <select id="views-partners">
                    </select>
                    <button class="btn" id="btn-saveview-partners">
                        Save Query
                    </button>
                    <button class="btn danger" id="btn-delview-partners">
                        Delete
                    </button>
                </div>
                <div class="query-shell" data-query-scope="partners"></div>
                <div class="table-search">
                    <input aria-label="Search partners" data-table-search="#tbl-partners" placeholder="Search Partners"
                        type="search" />
                </div>
                <table class="table list-table" data-selection-scope="partners" id="tbl-partners">
                    <thead></thead>
                    <tbody></tbody>
                </table>
            </section>`;
  }
  const table = typeof document !== 'undefined' ? document.getElementById('tbl-partners') : null;
  const host = table ? findListLoadingHost(table) : null;
  const releaseLoading = acquireLoadingForHost(host, Object.assign({}, TABLE_LOADING_OPTIONS));
  try {
    await openDB();
    const [partners, contacts] = await Promise.all([
      dbGetAll('partners'),
      dbGetAll('contacts')
    ]);
    renderPartnersTable(partners, contacts);
    if (typeof window.applyFilters === 'function') {
      try { window.applyFilters(); }
      catch (err) { console && console.warn && console.warn('applyFilters', err); }
    }
  } finally {
    releaseLoading();
  }
}
window.renderPartnersView = renderPartnersView;
window.renderPartners = renderPartnersView;


(function applyDashOrderPostPaint() {
  function run() {
    try {
      if (window.DashLayout && typeof window.DashLayout.apply === 'function') {
        window.DashLayout.apply();
      }
    } catch (e) { }
  }
  if (window.RenderGuard && typeof window.RenderGuard.registerHook === 'function') {
    try { window.RenderGuard.registerHook(run); } catch (e) { }
  } else {
    setTimeout(run, 0);
  }
})();

import { wireQuickAddUnified } from './ui/quick_add_unified.js';
wireQuickAddUnified();

export function renderDashboardView(options) {
  if (typeof window !== 'undefined' && typeof window.renderDashboardView === 'function') {
    return window.renderDashboardView(options);
  }
  if (typeof window !== 'undefined' && typeof window.renderAll === 'function') {
    return window.renderAll({ scopes: ['dashboard'], ...(options || {}) });
  }
  return Promise.resolve(false);
}

export function renderContactsView(options) {
  if (typeof window !== 'undefined' && typeof window.renderContactsView === 'function') {
    return window.renderContactsView(options);
  }
  if (typeof window !== 'undefined' && typeof window.renderAll === 'function') {
    return window.renderAll({ scopes: ['contacts'], ...(options || {}) });
  }
  return Promise.resolve(false);
}

export function renderPipelineView(options) {
  if (typeof window !== 'undefined' && typeof window.renderPipelineView === 'function') {
    return window.renderPipelineView(options);
  }
  if (typeof window !== 'undefined' && typeof window.renderAll === 'function') {
    return window.renderAll({ scopes: ['pipeline'], ...(options || {}) });
  }
  return Promise.resolve(false);
}

