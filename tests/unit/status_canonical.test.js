import { describe, it, expect } from 'vitest';
import { CANONICAL_STAGES, normalizeStage } from '../../crm-app/js/workflows/status_canonical.js';

describe('status canonical stage normalizer', () => {
  it('normalizes CTC variants to cleared-to-close', () => {
    expect(normalizeStage('CTC')).toBe('cleared-to-close');
    expect(normalizeStage('clear_to_close')).toBe('cleared-to-close');
    expect(normalizeStage('Cleared-to-close')).toBe('cleared-to-close');
  });

  it('returns null for unknown values', () => {
    expect(normalizeStage('mystery-stage')).toBeNull();
    expect(normalizeStage('')).toBeNull();
  });

  it('keeps known canonical stage keys', () => {
    for (const key of CANONICAL_STAGES) {
      expect(normalizeStage(key)).toBe(key);
    }
  });
});
