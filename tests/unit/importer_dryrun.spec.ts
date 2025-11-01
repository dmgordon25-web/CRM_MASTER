import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createImporterHarness } from './helpers/importerHarness';
import { REQ_PARTNER, REQ_CONTACT } from '../../crm-app/js/importer.js';

function buildRow(headers: string[], values: Record<string, any>) {
  return headers.map((header) => values[header] ?? '');
}

let internals: any;
let cleanup: () => void;

beforeAll(async () => {
  const harness = await createImporterHarness();
  internals = harness.internals;
  cleanup = harness.cleanup;
});

afterAll(() => {
  if (cleanup) cleanup();
});

describe('importer dry-run summaries', () => {
  it('reports partner dedupes and creates with normalized previews', async () => {
    const existingPartners = [
      { id: 'p-1', partnerId: 'p-1', name: 'Existing', email: 'Existing@Example.com', phone: '+1 (555) 010-0000', city: 'Austin' }
    ];
    (globalThis as any).dbGetAll = vi.fn(async (store: string) => (store === 'partners' ? existingPartners : []));
    (globalThis as any).dbBulkPut = vi.fn();

    const headers = [...REQ_PARTNER];
    const rows = [
      buildRow(headers, {
        partnerId: '',
        name: 'Existing',
        company: 'Existing',
        email: 'existing@example.com',
        phone: '+1 555-010-0000',
        city: 'Austin'
      }),
      buildRow(headers, {
        partnerId: '',
        name: 'New Partner',
        company: 'New Co',
        email: 'NEW@Example.com',
        phone: '(555) 222-3333',
        city: 'Dallas'
      })
    ];

    const result = await internals.__importPartners(rows, headers, 'dry-run', {});
    expect(result.dedupes).toBe(1);
    expect(result.creates).toBe(1);
    expect(Array.isArray(result.groups)).toBe(true);
    const dedupe = result.groups.find((group: any) => group.reason === 'would-dedupe');
    expect(dedupe).toBeTruthy();
    expect(dedupe.matchedBy).toBe('email');
    expect(dedupe.existing.email).toBe('existing@example.com');
    expect(internals.formatDryRunGroup(dedupe)).toContain('would-dedupe');
    expect((globalThis as any).dbBulkPut).not.toHaveBeenCalled();
  });

  it('notes contact auto-linked partners during dry-run', async () => {
    const existingContacts = [
      { id: 'c-1', contactId: 'c-1', email: 'match@Example.com', phone: '+1 555 444 0000', first: 'Match', last: 'User', city: 'Austin' }
    ];
    const existingPartners = [
      { id: 'p-existing', name: 'Existing Partner', email: 'partner@example.com', phone: '(555) 000-1111', city: 'Austin' }
    ];
    (globalThis as any).dbGetAll = vi.fn(async (store: string) => {
      if (store === 'contacts') return existingContacts;
      if (store === 'partners') return existingPartners;
      return [];
    });
    (globalThis as any).dbBulkPut = vi.fn();

    const headers = [...REQ_CONTACT];
    const dedupeValues = {
      contactId: 'c-1',
      first: 'Match',
      last: 'User',
      email: 'match@example.com',
      phone: '(555) 444-0000',
      city: 'Austin',
      stage: 'Processing',
      loanAmount: '0',
      rate: '0',
      fundedDate: '',
      status: ''
    } as Record<string, any>;
    const createValues = {
      contactId: '',
      first: 'New',
      last: 'Lead',
      email: 'NEW.LEAD@Example.com',
      phone: '+1 (555) 999-0000',
      city: 'Dallas',
      buyerPartnerName: 'Auto Partner',
      buyerPartnerEmail: 'auto@Example.com',
      buyerPartnerPhone: '(555) 123-4567',
      stage: 'Application',
      loanAmount: '0',
      rate: '0',
      fundedDate: '',
      status: ''
    } as Record<string, any>;
    const rows = [buildRow(headers, dedupeValues), buildRow(headers, createValues)];

    const result = await internals.__importContacts(rows, headers, 'dry-run', {});
    expect(result.dedupes).toBe(1);
    expect(result.creates).toBe(1);
    expect(result.partnersAutocreated).toBeGreaterThanOrEqual(1);
    const autoPartnerGroup = result.groups.find((group: any) => group.kind === 'partner');
    expect(autoPartnerGroup).toBeTruthy();
    expect(autoPartnerGroup.reason).toBe('would-create');
    expect(autoPartnerGroup.note).toBe('auto-partner');
    expect(internals.formatDryRunGroup(autoPartnerGroup)).toContain('auto partner link');
    const preview = internals.renderDryRunPreview(result);
    expect(preview).toContain('Dry run');
    expect((globalThis as any).dbBulkPut).not.toHaveBeenCalled();
  });
});
