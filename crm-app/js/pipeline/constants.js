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
