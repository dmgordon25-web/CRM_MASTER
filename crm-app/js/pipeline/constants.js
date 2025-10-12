// crm-app/js/pipeline/constants.js
// Canonical pipeline stage definitions used for color-coded chips.

export const STAGES = {
  new: { label: 'New', colorVar: '--stage-new' },
  qualified: { label: 'Qualified', colorVar: '--stage-qualified' },
  negotiating: { label: 'Negotiating', colorVar: '--stage-negotiating' },
  clear_to_close: { label: 'Clear to Close', colorVar: '--stage-ctc' },
  won: { label: 'Won', colorVar: '--stage-won' },
  lost: { label: 'Lost', colorVar: '--stage-lost' }
};

export const STAGE_ALIASES = {
  CTC: 'clear_to_close',
  'Clear to Close': 'clear_to_close',
  'Clear-to-Close': 'clear_to_close',
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
  ctc: 'clear_to_close',
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
};

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

export function canonicalStage(key) {
  if (key == null) return null;
  const raw = String(key).trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (STAGES[lowered]) return lowered;
  if (STAGES[raw]) return raw;
  if (ALIAS_LOOKUP.has(raw)) return ALIAS_LOOKUP.get(raw);
  if (ALIAS_LOOKUP.has(lowered)) return ALIAS_LOOKUP.get(lowered);
  const squished = lowered.replace(/[^a-z0-9]/g, '');
  if (ALIAS_LOOKUP.has(squished)) return ALIAS_LOOKUP.get(squished);
  return null;
}

export function renderStageChip(key) {
  const canon = canonicalStage(key);
  if (!canon) return '';
  const meta = STAGES[canon];
  if (!meta) return '';
  const originalLabel = key == null ? '' : String(key).trim();
  const { label, colorVar } = meta;
  const qa = `stage-chip-${canon}`;
  const chipLabel = originalLabel || label;
  return `<span class="stage-chip stage-${canon}" data-role="stage-chip" data-qa="${qa}" style="background:var(${colorVar})">${chipLabel}</span>`;
}
