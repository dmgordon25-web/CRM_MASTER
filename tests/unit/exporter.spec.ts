import { describe, expect, it, vi } from 'vitest';
import { buildExportSnapshot, renderExportPreview, EXPORTER_INTERNALS } from '../../crm-app/js/exporter.js';

describe('exporter normalization', () => {
  it('normalizes email and phone fields in export snapshot', async () => {
    const partners = [
      { id: 'p-1', partnerId: 'p-1', name: 'Partner', email: 'PARTNER@Example.COM ', phone: '(555) 777-8888', city: 'Austin' }
    ];
    const contacts = [
      { id: 'c-1', contactId: 'c-1', first: 'Alex', last: 'Smith', email: ' ALEX@Example.com ', phone: '+1 (555) 999-0000', city: 'Dallas' }
    ];
    (globalThis as any).dbGetAll = vi.fn(async (store: string) => {
      if (store === 'partners') return partners;
      if (store === 'contacts') return contacts;
      return [];
    });

    const snapshot = await buildExportSnapshot();
    expect(snapshot.partners[0].email).toBe('partner@example.com');
    expect(snapshot.partners[0].phone).toBe('5557778888');
    expect(snapshot.contacts[0].email).toBe('alex@example.com');
    expect(snapshot.contacts[0].phone).toBe('+15559990000');

    const preview = renderExportPreview(snapshot, { limit: 1 });
    expect(preview).toContain('Partners: 1');
    expect(preview).toContain('<partner@example.com>');
    expect(preview).toContain('Contacts: 1');
    expect(preview).toContain('<alex@example.com>');

    const normalizedPartner = EXPORTER_INTERNALS.normalizePartnerRow(partners[0]);
    expect(normalizedPartner.partnerId).toBe('p-1');
  });
});
