import { canonicalStage } from '../pipeline/constants.js';

const NONE_PARTNER_ID = '00000000-0000-none-partner-000000000000';

export const REFERRAL_ROLLUP_RANGES = Object.freeze([
  { key: '30d', label: 'Last 30 Days', days: 30 },
  { key: '90d', label: 'Last 90 Days', days: 90 },
  { key: '365d', label: 'Last 12 Months', days: 365 },
  { key: 'all', label: 'All Time', days: null }
]);

function toTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizePartnerId(value) {
  if (value == null) return '';
  const normalized = String(value).trim();
  if (!normalized || normalized === 'null' || normalized === 'undefined') return '';
  if (normalized === NONE_PARTNER_ID) return '';
  return normalized;
}

function normalizeLoanAmount(contact) {
  const amount = Number(contact?.loanAmount ?? contact?.amount ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function canonicalContactStage(contact) {
  if (!contact) return '';
  const direct = canonicalStage(contact.stage);
  if (direct) return direct;
  const fallback = canonicalStage(contact.pipelineStage);
  if (fallback) return fallback;
  return canonicalStage(contact.status);
}

function isFundedContact(contact) {
  const stage = canonicalContactStage(contact);
  if (stage === 'won') return true;
  const status = String(contact?.status ?? '').trim().toLowerCase();
  if (status === 'won' || status === 'funded') return true;
  return false;
}

function deriveFundedTimestamp(contact) {
  return (
    toTimestamp(contact?.fundedDate)
    ?? toTimestamp(contact?.fundedAt)
    ?? toTimestamp(contact?.closeDate)
    ?? toTimestamp(contact?.closedAt)
    ?? toTimestamp(contact?.stageEnteredAt)
    ?? toTimestamp(contact?.updatedAt)
  );
}

function deriveContactName(contact) {
  if (!contact) return 'Contact';
  const first = String(contact.first ?? contact.givenName ?? '').trim();
  const last = String(contact.last ?? contact.surname ?? '').trim();
  const combo = `${first} ${last}`.trim();
  if (combo) return combo;
  if (contact.name) return String(contact.name);
  if (contact.company) return String(contact.company);
  if (contact.email) return String(contact.email);
  if (contact.phone) return String(contact.phone);
  if (contact.id != null) return `Contact ${contact.id}`;
  return 'Contact';
}

function getRangeMeta(rangeKey) {
  const key = String(rangeKey || '').trim().toLowerCase();
  const meta = REFERRAL_ROLLUP_RANGES.find((item) => item.key === key);
  return meta || REFERRAL_ROLLUP_RANGES[1];
}

export function computeReferralRollup(contacts, rangeKey, now = Date.now()) {
  const meta = getRangeMeta(rangeKey);
  const currentTs = toTimestamp(now) ?? Date.now();
  const start = meta.days == null ? null : currentTs - (meta.days * 24 * 60 * 60 * 1000);
  const list = Array.isArray(contacts) ? contacts : [];
  const deals = [];
  let fundedVolume = 0;

  for (const contact of list) {
    if (!contact) continue;
    const id = contact.id != null ? String(contact.id) : '';
    if (!id) continue;
    const partnerId = normalizePartnerId(contact.referralPartnerId);
    if (!partnerId) continue;
    if (!isFundedContact(contact)) continue;
    const fundedAt = deriveFundedTimestamp(contact);
    if (start != null) {
      if (fundedAt == null) continue;
      if (fundedAt < start) continue;
    }
    const loanAmount = normalizeLoanAmount(contact);
    fundedVolume += loanAmount;
    const contactName = deriveContactName(contact);
    const partnerName = String(contact?.referralPartnerName ?? '').trim();
    const fundedDateLabel = fundedAt != null ? new Date(fundedAt).toISOString().slice(0, 10) : '';
    deals.push({
      id,
      contactName,
      partnerId,
      partnerName,
      loanAmount,
      fundedAt,
      fundedDateLabel,
      stage: contact?.stage || '',
      status: contact?.status || ''
    });
  }

  deals.sort((a, b) => {
    const at = a.fundedAt ?? 0;
    const bt = b.fundedAt ?? 0;
    if (bt !== at) return bt - at;
    return a.contactName.localeCompare(b.contactName, undefined, { sensitivity: 'base' });
  });

  return {
    rangeKey: meta.key,
    range: meta,
    fundedCount: deals.length,
    fundedVolume,
    deals
  };
}
