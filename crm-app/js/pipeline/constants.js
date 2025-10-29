import { stageKeyFromLabel, PIPELINE_STAGE_KEYS } from './stages.js';

// crm-app/js/pipeline/constants.js
// Canonical pipeline stage definitions used for color-coded chips.

export const PIPELINE_TONES = Object.freeze(['progress', 'success', 'warning', 'danger']);

export const DEFAULT_STAGE_TONE = 'progress';

export function toneClassName(tone) {
  const key = String(tone || '').trim().toLowerCase();
  return PIPELINE_TONES.includes(key) ? `tone-${key}` : '';
}

export function normalizeTone(tone, fallback = DEFAULT_STAGE_TONE) {
  const key = String(tone || '').trim().toLowerCase();
  if (PIPELINE_TONES.includes(key)) return key;
  return fallback;
}

export const TONE_CLASSNAMES = Object.freeze(PIPELINE_TONES.map((tone) => `tone-${tone}`));

export const STAGES = {
  new: { label: 'New', tone: 'progress' },
  qualified: { label: 'Qualified', tone: 'progress' },
  negotiating: { label: 'Negotiating', tone: 'warning' },
  clear_to_close: { label: 'Clear to Close', tone: 'success' },
  won: { label: 'Won', tone: 'success' },
  lost: { label: 'Lost', tone: 'danger' }
};

export const STATUS_ALIASES = Object.freeze({
  CTC: 'cleared-to-close',
  'Clear to Close': 'cleared-to-close',
  'Clear-to-Close': 'cleared-to-close'
});

export const STAGE_ALIASES = Object.assign(
  Object.create(null),
  STATUS_ALIASES,
  {
    CTC: 'clear_to_close',
    'Clear to Close': 'clear_to_close',
    'Clear-to-Close': 'clear_to_close'
  },
  {
    'Clear To Close': 'clear_to_close',
    'Clear 2 Close': 'clear_to_close',
    'Clear2Close': 'clear_to_close',
    'clear to close': 'clear_to_close',
    'clear-to-close': 'clear_to_close',
    'Cleared to Close': 'clear_to_close',
    'Cleared-To-Close': 'clear_to_close',
    'cleared-to-close': 'clear_to_close',
    'cleared to close': 'clear_to_close',
    clear_to_close: 'clear_to_close',
    ctc: 'clear_to_close'
  },
  {
    // Legacy pipeline labels mapped to canonical buckets
    'Long Shot': 'new',
    'Long-Shot': 'new',
    LongShot: 'new',
    'long-shot': 'new',
    'long shot': 'new',
    longshot: 'new',
    lead: 'new',
    leads: 'new',
    prospect: 'new',
    'New Lead': 'new',
    'Buyer Lead': 'new',
    'buyer lead': 'new',
    application: 'qualified',
    Application: 'qualified',
    'Application Started': 'qualified',
    'App Started': 'qualified',
    'Nurture': 'qualified',
    nurture: 'qualified',
    'Pre-Approved': 'qualified',
    PreApproved: 'qualified',
    preapproved: 'qualified',
    'Preapproved': 'qualified',
    'Pre Approved': 'qualified',
    'Pre-App': 'qualified',
    'Pre App': 'qualified',
    'pre app': 'qualified',
    'Pre Application': 'qualified',
    'Pre-Application': 'qualified',
    'Preapproval': 'qualified',
    'Pre-Approval': 'qualified',
    'Docs Gathering': 'negotiating',
    'Doc Gathering': 'negotiating',
    'Docs-Gathering': 'negotiating',
    'Processing': 'negotiating',
    processing: 'negotiating',
    'Underwriting': 'negotiating',
    underwriting: 'negotiating',
    'Under-write': 'negotiating',
    'Underwrite': 'negotiating',
    'Under Writing': 'negotiating',
    approved: 'negotiating',
    Approved: 'negotiating',
    // Closed / won
    funded: 'won',
    Funded: 'won',
    'Funded/Closed': 'won',
    'funded/closed': 'won',
    'Post Close': 'won',
    'Post-Close': 'won',
    postclose: 'won',
    'Past Client': 'won',
    'Past Clients': 'won',
    client: 'won',
    clients: 'won',
    closed: 'won',
    'Closed Won': 'won',
    'post-close': 'won',
    'Post Funded': 'won',
    'Post-Funded': 'won',
    'post-funded': 'won',
    won: 'won',
    // Lost / denied
    lost: 'lost',
    Lost: 'lost',
    denied: 'lost',
    Denied: 'lost',
    cancelled: 'lost',
    canceled: 'lost',
    withdrawn: 'lost',
    'Closed Lost': 'lost'
  }
);

export const DEFAULT_STAGE_FOLLOW_UP_DAYS = 3;

export const STAGE_FOLLOW_UP_CADENCE_DAYS = Object.freeze({
  qualified: 3, // Application
  negotiating: 2, // Docs Gathering / Processing / Underwriting
  clear_to_close: 1, // Cleared to Close
  won: 14 // Post-Funded / Funded
});

export function followUpCadenceDaysForStage(stage) {
  const raw = stage == null ? '' : String(stage).trim();
  if (!raw) return DEFAULT_STAGE_FOLLOW_UP_DAYS;
  const key = stageKeyFromLabel(raw);
  const normalizedKey = key || raw.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(STAGE_FOLLOW_UP_CADENCE_DAYS, normalizedKey)) {
    return STAGE_FOLLOW_UP_CADENCE_DAYS[normalizedKey];
  }
  const fallbackKey = raw.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(STAGE_FOLLOW_UP_CADENCE_DAYS, fallbackKey)) {
    return STAGE_FOLLOW_UP_CADENCE_DAYS[fallbackKey];
  }
  return null;
}

export const PIPELINE_MILESTONES = Object.freeze([
  'Intro Call',
  'Application Sent',
  'Application Submitted',
  'UW in Progress',
  'Conditions Out',
  'Clear to Close',
  'Docs Out',
  'Funded / Post-Close'
]);

const MILESTONE_INDEX_LOOKUP = new Map();

function registerMilestoneAlias(value, index) {
  const raw = String(value ?? '').trim();
  if (!raw) return;
  const lowered = raw.toLowerCase();
  const dashed = lowered.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  const squished = lowered.replace(/[^a-z0-9]+/g, '');
  [lowered, dashed, squished].forEach((token) => {
    if (token && !MILESTONE_INDEX_LOOKUP.has(token)) MILESTONE_INDEX_LOOKUP.set(token, index);
  });
}

PIPELINE_MILESTONES.forEach((label, index) => {
  registerMilestoneAlias(label, index);
});

export function milestoneIndex(value) {
  if (value == null) return -1;
  const raw = String(value).trim();
  if (!raw) return -1;
  const lowered = raw.toLowerCase();
  if (MILESTONE_INDEX_LOOKUP.has(lowered)) return MILESTONE_INDEX_LOOKUP.get(lowered);
  const dashed = lowered.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (MILESTONE_INDEX_LOOKUP.has(dashed)) return MILESTONE_INDEX_LOOKUP.get(dashed);
  const squished = lowered.replace(/[^a-z0-9]+/g, '');
  if (MILESTONE_INDEX_LOOKUP.has(squished)) return MILESTONE_INDEX_LOOKUP.get(squished);
  return -1;
}

export function canonicalMilestoneLabel(value) {
  const idx = milestoneIndex(value);
  if (idx >= 0 && PIPELINE_MILESTONES[idx]) return PIPELINE_MILESTONES[idx];
  return PIPELINE_MILESTONES[0];
}

export const PIPELINE_STATUS_KEYS = Object.freeze(['inprogress', 'active', 'client', 'paused', 'lost', 'nurture']);

const STATUS_KEY_LOOKUP = new Map();

function registerStatusAlias(value, key) {
  const raw = String(value ?? '').trim();
  if (!raw) return;
  const lowered = raw.toLowerCase();
  const dashed = lowered.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  const squished = lowered.replace(/[^a-z0-9]+/g, '');
  [lowered, dashed, squished].forEach((token) => {
    if (token) STATUS_KEY_LOOKUP.set(token, key);
  });
}

PIPELINE_STATUS_KEYS.forEach((key) => registerStatusAlias(key, key));
registerStatusAlias('in-progress', 'inprogress');
registerStatusAlias('in progress', 'inprogress');
registerStatusAlias('in_progress', 'inprogress');
registerStatusAlias('progress', 'inprogress');
registerStatusAlias('active-pipeline', 'active');
registerStatusAlias('pipeline', 'active');
registerStatusAlias('processing', 'active');
registerStatusAlias('underwriting', 'active');
registerStatusAlias('approved', 'active');
registerStatusAlias('ctc', 'active');
registerStatusAlias('cleared-to-close', 'active');
registerStatusAlias('funded', 'client');
registerStatusAlias('closed', 'client');
registerStatusAlias('client', 'client');
registerStatusAlias('customer', 'client');
registerStatusAlias('post-close', 'client');
registerStatusAlias('paused', 'paused');
registerStatusAlias('pause', 'paused');
registerStatusAlias('on hold', 'paused');
registerStatusAlias('on-hold', 'paused');
registerStatusAlias('hold', 'paused');
registerStatusAlias('lost', 'lost');
registerStatusAlias('denied', 'lost');
registerStatusAlias('declined', 'lost');
registerStatusAlias('canceled', 'lost');
registerStatusAlias('cancelled', 'lost');
registerStatusAlias('withdrawn', 'lost');
registerStatusAlias('long-shot', 'nurture');
registerStatusAlias('long shot', 'nurture');
registerStatusAlias('longshot', 'nurture');
registerStatusAlias('prospect', 'nurture');
registerStatusAlias('lead', 'nurture');
registerStatusAlias('nurture', 'nurture');

export function canonicalStatusKey(value) {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const lowered = raw.toLowerCase();
  if (STATUS_KEY_LOOKUP.has(lowered)) return STATUS_KEY_LOOKUP.get(lowered);
  const dashed = lowered.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (STATUS_KEY_LOOKUP.has(dashed)) return STATUS_KEY_LOOKUP.get(dashed);
  const squished = lowered.replace(/[^a-z0-9]+/g, '');
  if (STATUS_KEY_LOOKUP.has(squished)) return STATUS_KEY_LOOKUP.get(squished);
  return lowered;
}

const EXTENDED_STAGE_KEYS = new Set([
  ...PIPELINE_STAGE_KEYS,
  'post-close',
  'nurture',
  'lost',
  'denied',
  'paused'
]);

function canonicalPipelineStage(value) {
  if (value == null) return '';
  const raw = Array.isArray(value) ? value[0] : value;
  const base = String(raw ?? '').trim();
  if (!base) return '';
  const lowered = base.toLowerCase();
  if (lowered === 'post-close' || lowered === 'post close' || lowered === 'postclose') return 'post-close';
  if (lowered === 'nurture') return 'nurture';
  if (lowered === 'lost') return 'lost';
  if (lowered === 'denied') return 'denied';
  if (lowered === 'paused' || lowered === 'on hold' || lowered === 'on-hold') return 'paused';
  const key = stageKeyFromLabel(base);
  if (key && EXTENDED_STAGE_KEYS.has(key)) return key;
  const dashed = lowered.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (EXTENDED_STAGE_KEYS.has(dashed)) return dashed;
  const squished = lowered.replace(/[^a-z0-9]+/g, '');
  if (EXTENDED_STAGE_KEYS.has(squished)) return squished;
  return key || dashed || lowered;
}

const STAGE_DEFAULT_STATUS = Object.freeze({
  'long-shot': 'nurture',
  application: 'inprogress',
  preapproved: 'inprogress',
  processing: 'active',
  underwriting: 'active',
  approved: 'active',
  'cleared-to-close': 'active',
  funded: 'client',
  'post-close': 'client',
  nurture: 'nurture',
  lost: 'lost',
  denied: 'lost',
  paused: 'paused'
});

const STAGE_ALLOWED_STATUS = new Map([
  ['long-shot', new Set(['nurture', 'inprogress'])],
  ['application', new Set(['inprogress', 'paused', 'nurture'])],
  ['preapproved', new Set(['inprogress', 'active', 'paused'])],
  ['processing', new Set(['active', 'paused'])],
  ['underwriting', new Set(['active', 'paused'])],
  ['approved', new Set(['active', 'paused'])],
  ['cleared-to-close', new Set(['active', 'paused'])],
  ['funded', new Set(['client'])],
  ['post-close', new Set(['client'])],
  ['nurture', new Set(['nurture', 'paused'])],
  ['lost', new Set(['lost'])],
  ['denied', new Set(['lost'])],
  ['paused', new Set(['paused'])]
]);

export function allowedStatusesForStage(stage) {
  const key = canonicalPipelineStage(stage);
  const allowed = STAGE_ALLOWED_STATUS.get(key);
  if (allowed && allowed.size) return PIPELINE_STATUS_KEYS.filter((status) => allowed.has(status));
  return PIPELINE_STATUS_KEYS.slice();
}

export function normalizeStatusForStage(stage, status) {
  const key = canonicalPipelineStage(stage);
  const normalizedStatus = canonicalStatusKey(status);
  const allowed = STAGE_ALLOWED_STATUS.get(key);
  if (allowed && allowed.size) {
    if (normalizedStatus && allowed.has(normalizedStatus)) return normalizedStatus;
    const fallback = STAGE_DEFAULT_STATUS[key];
    if (fallback && allowed.has(fallback)) return fallback;
    return Array.from(allowed)[0];
  }
  if (normalizedStatus && PIPELINE_STATUS_KEYS.includes(normalizedStatus)) return normalizedStatus;
  return STAGE_DEFAULT_STATUS[key] || 'inprogress';
}

const STATUS_MILESTONE_RULES = Object.freeze({
  nurture: { min: 0, max: 1, fallback: 'Intro Call' },
  inprogress: { min: 0, max: 3, fallback: 'Application Submitted' },
  active: { min: 2, max: 6, fallback: 'UW in Progress' },
  paused: { min: 0, max: 6, fallback: 'Application Submitted' },
  client: { min: PIPELINE_MILESTONES.length - 1, max: PIPELINE_MILESTONES.length - 1, fallback: 'Funded / Post-Close' },
  lost: { min: 0, max: 2, fallback: 'Application Sent' },
  default: { min: 0, max: PIPELINE_MILESTONES.length - 1, fallback: PIPELINE_MILESTONES[0] }
});

const STATUS_ALLOWED_MILESTONE_CACHE = new Map();
const MILESTONE_ALLOWED_STATUS_CACHE = new Map();
let STATUS_MILESTONE_CACHE_INITIALIZED = false;

function buildStatusMilestoneCaches() {
  if (STATUS_MILESTONE_CACHE_INITIALIZED) return;
  STATUS_MILESTONE_CACHE_INITIALIZED = true;
  STATUS_ALLOWED_MILESTONE_CACHE.clear();
  MILESTONE_ALLOWED_STATUS_CACHE.clear();

  const statusUniverse = new Set([
    ...PIPELINE_STATUS_KEYS,
    ...Object.keys(STATUS_MILESTONE_RULES)
  ]);

  statusUniverse.forEach((rawStatus) => {
    const key = canonicalStatusKey(rawStatus);
    if (!key) return;
    const range = rangeForStatus(key);
    const indices = new Set();
    for (let idx = range.min; idx <= range.max; idx += 1) {
      if (idx >= 0 && idx < PIPELINE_MILESTONES.length) indices.add(idx);
    }
    if (range.fallbackIndex >= 0 && range.fallbackIndex < PIPELINE_MILESTONES.length) {
      indices.add(range.fallbackIndex);
    }
    if (!indices.size) {
      for (let idx = 0; idx < PIPELINE_MILESTONES.length; idx += 1) indices.add(idx);
    }
    STATUS_ALLOWED_MILESTONE_CACHE.set(key, indices);
    indices.forEach((idx) => {
      const allowed = MILESTONE_ALLOWED_STATUS_CACHE.get(idx);
      if (allowed) {
        allowed.add(key);
      } else {
        MILESTONE_ALLOWED_STATUS_CACHE.set(idx, new Set([key]));
      }
    });
  });

  for (let idx = 0; idx < PIPELINE_MILESTONES.length; idx += 1) {
    if (!MILESTONE_ALLOWED_STATUS_CACHE.has(idx)) {
      MILESTONE_ALLOWED_STATUS_CACHE.set(idx, new Set(PIPELINE_STATUS_KEYS));
    }
  }
}

function statusAllowedMilestoneIndices(status) {
  buildStatusMilestoneCaches();
  const key = canonicalStatusKey(status);
  const indices = STATUS_ALLOWED_MILESTONE_CACHE.get(key);
  if (indices && indices.size) return Array.from(indices).sort((a, b) => a - b);
  return PIPELINE_MILESTONES.map((_, idx) => idx);
}

function milestoneAllowedStatusKeys(milestone) {
  buildStatusMilestoneCaches();
  const idx = milestoneIndex(milestone);
  if (idx < 0) return PIPELINE_STATUS_KEYS.slice();
  const allowed = MILESTONE_ALLOWED_STATUS_CACHE.get(idx);
  if (allowed && allowed.size) return Array.from(allowed);
  return PIPELINE_STATUS_KEYS.slice();
}

function nearestAllowedMilestoneIndex(targetIndex, allowedIndices, fallbackIndex) {
  const list = Array.isArray(allowedIndices) && allowedIndices.length ? allowedIndices : PIPELINE_MILESTONES.map((_, idx) => idx);
  if (!list.length) return Math.max(0, Math.min(PIPELINE_MILESTONES.length - 1, fallbackIndex || 0));
  if (targetIndex == null || Number.isNaN(targetIndex)) return list[0];
  let best = list[0];
  let bestDiff = Math.abs(best - targetIndex);
  for (let i = 1; i < list.length; i += 1) {
    const candidate = list[i];
    const diff = Math.abs(candidate - targetIndex);
    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }
  return best;
}

function rangeForStatus(status) {
  const key = canonicalStatusKey(status);
  const rule = STATUS_MILESTONE_RULES[key] || STATUS_MILESTONE_RULES.default;
  const min = Number.isFinite(rule.min) ? Math.max(0, Math.min(rule.min, PIPELINE_MILESTONES.length - 1)) : 0;
  const max = Number.isFinite(rule.max) ? Math.max(min, Math.min(rule.max, PIPELINE_MILESTONES.length - 1)) : PIPELINE_MILESTONES.length - 1;
  const fallbackLabel = rule.fallback || STATUS_MILESTONE_RULES.default.fallback;
  const fallbackIndex = milestoneIndex(fallbackLabel) >= 0 ? milestoneIndex(fallbackLabel) : 0;
  return { min, max, fallbackIndex };
}

export function milestoneRangeForStatus(status) {
  const { min, max } = rangeForStatus(status);
  return { min, max };
}

export function normalizeMilestoneForStatus(milestone, status) {
  const range = rangeForStatus(status);
  const allowedIndices = statusAllowedMilestoneIndices(status);
  const fallbackIndex = allowedIndices.includes(range.fallbackIndex)
    ? range.fallbackIndex
    : allowedIndices[0] ?? range.fallbackIndex;
  let idx = milestoneIndex(milestone);
  if (idx < 0) {
    idx = fallbackIndex;
  } else if (!allowedIndices.includes(idx)) {
    idx = nearestAllowedMilestoneIndex(idx, allowedIndices, fallbackIndex);
  }
  if (idx < range.min) idx = range.min;
  if (idx > range.max) idx = range.max;
  const resolved = PIPELINE_MILESTONES[idx];
  if (resolved) return resolved;
  const fallback = PIPELINE_MILESTONES[fallbackIndex];
  if (fallback) return fallback;
  return PIPELINE_MILESTONES[0];
}

export function allowedMilestonesForStatus(status) {
  const indices = statusAllowedMilestoneIndices(status);
  return indices
    .map((idx) => PIPELINE_MILESTONES[idx])
    .filter((label, pos, arr) => typeof label === 'string' && label && arr.indexOf(label) === pos);
}

function sortStatuses(statuses) {
  const order = new Map(PIPELINE_STATUS_KEYS.map((key, index) => [key, index]));
  return statuses
    .map((key) => canonicalStatusKey(key))
    .filter((key) => key && (PIPELINE_STATUS_KEYS.includes(key) || STATUS_MILESTONE_RULES[key]))
    .filter((key, index, list) => list.indexOf(key) === index)
    .sort((a, b) => {
      const aOrder = order.has(a) ? order.get(a) : Number.POSITIVE_INFINITY;
      const bOrder = order.has(b) ? order.get(b) : Number.POSITIVE_INFINITY;
      if (aOrder === bOrder) return a.localeCompare(b);
      return aOrder - bOrder;
    });
}

export function allowedStatusesForMilestone(milestone) {
  const allowed = milestoneAllowedStatusKeys(milestone);
  return sortStatuses(allowed);
}

export function normalizeStatusForMilestone(milestone, status, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const stageStatuses = opts.stage != null ? new Set(allowedStatusesForStage(opts.stage)) : null;
  const milestoneStatuses = new Set(allowedStatusesForMilestone(milestone));
  const preferred = sortStatuses([
    status,
    opts.preferredStatus
  ]);
  const candidates = [];
  preferred.forEach((key) => {
    if (key && !candidates.includes(key)) candidates.push(key);
  });
  sortStatuses(Array.from(milestoneStatuses)).forEach((key) => {
    if (!candidates.includes(key)) candidates.push(key);
  });
  if (stageStatuses && stageStatuses.size) {
    sortStatuses(Array.from(stageStatuses)).forEach((key) => {
      if (!candidates.includes(key)) candidates.push(key);
    });
  }
  if (!candidates.includes('inprogress')) candidates.push('inprogress');

  for (const candidate of candidates) {
    const key = canonicalStatusKey(candidate);
    if (!key) continue;
    if (milestoneStatuses.size && !milestoneStatuses.has(key)) continue;
    if (stageStatuses && stageStatuses.size && !stageStatuses.has(key)) continue;
    if (!PIPELINE_STATUS_KEYS.includes(key)) continue;
    return key;
  }

  if (stageStatuses && stageStatuses.size) {
    const [first] = stageStatuses;
    if (first) return canonicalStatusKey(first) || 'inprogress';
  }
  if (milestoneStatuses.size) {
    const [first] = milestoneStatuses;
    if (first) return canonicalStatusKey(first) || 'inprogress';
  }
  const fallback = canonicalStatusKey(status);
  if (fallback && PIPELINE_STATUS_KEYS.includes(fallback)) return fallback;
  return 'inprogress';
}

const STATUS_LOOKUP = new Map();
Object.entries(STATUS_ALIASES).forEach(([alias, target]) => {
  if (!alias) return;
  const base = String(alias);
  const normalizedTarget = String(target || '').trim();
  if (!normalizedTarget) return;
  const tokens = new Set([
    base,
    base.toLowerCase(),
    base.replace(/\s+/g, ''),
    base.toLowerCase().replace(/\s+/g, ''),
    base.replace(/[^a-z0-9]/gi, ''),
    base.toLowerCase().replace(/[^a-z0-9]/g, '')
  ]);
  tokens.forEach((token) => {
    if (token) STATUS_LOOKUP.set(token, normalizedTarget);
  });
});
['cleared-to-close', 'cleared to close', 'clearedtoclose', 'cleared_to_close'].forEach((token) => {
  const key = String(token || '').trim().toLowerCase();
  if (key) STATUS_LOOKUP.set(key, 'cleared-to-close');
});
['long shot', 'long-shot', 'longshot'].forEach((token) => {
  const key = String(token || '').trim().toLowerCase();
  if (key) STATUS_LOOKUP.set(key, 'long shot');
});

export function normalizeStatus(value) {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (STATUS_LOOKUP.has(raw)) return STATUS_LOOKUP.get(raw);
  const lowered = raw.toLowerCase();
  if (STATUS_LOOKUP.has(lowered)) return STATUS_LOOKUP.get(lowered);
  const squished = lowered.replace(/[^a-z0-9]/g, '');
  if (STATUS_LOOKUP.has(squished)) return STATUS_LOOKUP.get(squished);
  const dashed = lowered.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (STATUS_LOOKUP.has(dashed)) return STATUS_LOOKUP.get(dashed);
  const compact = lowered.replace(/\s+/g, '');
  if (STATUS_LOOKUP.has(compact)) return STATUS_LOOKUP.get(compact);
  return lowered;
}

const ALIAS_LOOKUP = new Map();
Object.entries(STAGE_ALIASES).forEach(([alias, target]) => {
  if (!alias) return;
  const base = String(alias);
  const tokens = new Set([
    base,
    base.toLowerCase(),
    base.replace(/\s+/g, ''),
    base.toLowerCase().replace(/\s+/g, ''),
    base.replace(/[^a-z0-9]/gi, ''),
    base.toLowerCase().replace(/[^a-z0-9]/g, '')
  ]);
  tokens.forEach((token) => {
    if (token) ALIAS_LOOKUP.set(token, target);
  });
});

export function toCanonicalStage(key) {
  if (key == null) return null;
  const raw = String(key).trim();
  if (!raw) return null;
  if (STAGES[raw]) return raw;
  const lowered = raw.toLowerCase();
  if (STAGES[lowered]) return lowered;
  if (ALIAS_LOOKUP.has(raw)) return ALIAS_LOOKUP.get(raw);
  if (ALIAS_LOOKUP.has(lowered)) return ALIAS_LOOKUP.get(lowered);
  const squished = lowered.replace(/[^a-z0-9]/g, '');
  if (ALIAS_LOOKUP.has(squished)) return ALIAS_LOOKUP.get(squished);
  return null;
}

export function canonicalStage(key) {
  return toCanonicalStage(key);
}

const STATUS_TONES = Object.freeze({
  inprogress: 'progress',
  active: 'progress',
  client: 'success',
  funded: 'success',
  approved: 'success',
  nurture: 'warning',
  paused: 'warning',
  followup: 'warning',
  lost: 'danger',
  denied: 'danger',
  canceled: 'danger',
  cancelled: 'danger'
});

const STATUS_TONE_ALIASES = Object.freeze({
  'in-progress': 'inprogress',
  'in progress': 'inprogress',
  'follow-up': 'followup',
  'follow up': 'followup',
  'needs follow up': 'followup',
  'needsfollowup': 'followup',
  'follow': 'followup',
  'follow-up needed': 'followup',
  'followup needed': 'followup',
  'follow needed': 'followup',
  'cancelled': 'cancelled'
});

function canonicalStatusToneKey(value) {
  if (value == null) return '';
  const raw = String(value).trim().toLowerCase();
  if (!raw) return '';
  if (STATUS_TONES[raw]) return raw;
  if (STATUS_TONE_ALIASES[raw]) return STATUS_TONE_ALIASES[raw];
  const compact = raw.replace(/[^a-z0-9]+/g, '');
  if (STATUS_TONES[compact]) return compact;
  if (STATUS_TONE_ALIASES[compact]) return STATUS_TONE_ALIASES[compact];
  return raw;
}

export function toneForStage(key) {
  const canon = toCanonicalStage(key);
  if (canon && STAGES[canon]?.tone) {
    return normalizeTone(STAGES[canon].tone);
  }
  return DEFAULT_STAGE_TONE;
}

export function toneForStatus(value) {
  const key = canonicalStatusToneKey(value);
  if (key && STATUS_TONES[key]) {
    return normalizeTone(STATUS_TONES[key]);
  }
  return DEFAULT_STAGE_TONE;
}

export function renderStageChip(key) {
  const canon = toCanonicalStage(key);
  if (!canon) return '';
  const meta = STAGES[canon];
  if (!meta) return '';
  const { label, tone } = meta;
  const toneKey = normalizeTone(tone);
  const toneClass = toneClassName(toneKey);
  const toneAttr = toneKey ? ` data-tone="${toneKey}"` : '';
  const toneClassSuffix = toneClass ? ` ${toneClass}` : '';
  const qa = `stage-chip-${canon}`;
  return `<span class="stage-chip stage-${canon}${toneClassSuffix}" data-role="stage-chip" data-qa="${qa}"${toneAttr}>${label}</span>`;
}
