import { PIPELINE_STAGE_KEYS } from '../pipeline/stages.js';

export const CANONICAL_STAGES = Object.freeze(PIPELINE_STAGE_KEYS.slice());

export const STAGE_ALIASES = Object.freeze({
  ctc: 'cleared-to-close',
  'clear to close': 'cleared-to-close',
  'clear-to-close': 'cleared-to-close',
  'cleared to close': 'cleared-to-close',
  'cleared-to-close': 'cleared-to-close',
  clear_to_close: 'cleared-to-close',
  cleared_to_close: 'cleared-to-close'
});

function tokenFor(value) {
  return String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
}

export function normalizeStage(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const token = tokenFor(raw);
  if (CANONICAL_STAGES.includes(token)) return token;
  if (Object.prototype.hasOwnProperty.call(STAGE_ALIASES, token)) {
    return STAGE_ALIASES[token] || null;
  }
  return null;
}
