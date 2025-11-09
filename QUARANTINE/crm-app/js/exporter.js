import { CONTACT_TEMPLATE_FIELDS, PARTNER_TEMPLATE_FIELDS, IMPORTER_INTERNALS } from './importer.js';
import { normalizeEmail, normalizePhone } from './util/strings.js';

const { previewContact, previewPartner } = IMPORTER_INTERNALS || {};

function getDbApi(method) {
  if (typeof globalThis[method] === 'function') return globalThis[method];
  if (globalThis.db && typeof globalThis.db[method] === 'function') return globalThis.db[method].bind(globalThis.db);
  return async () => [];
}

async function readStore(store) {
  const api = getDbApi('dbGetAll');
  try { return await api(store, { includePending: true, includeDeleted: true }); }
  catch (_err) { return []; }
}

function normalizeFieldValue(field, value) {
  if (value == null) return '';
  if (/email/i.test(field)) return normalizeEmail(value);
  if (/phone/i.test(field)) return normalizePhone(value);
  return value;
}

function normalizeRow(record = {}, fields = []) {
  const row = {};
  fields.forEach((field) => {
    row[field] = normalizeFieldValue(field, record[field]);
  });
  return row;
}

function normalizePartnerRow(record = {}) {
  const normalized = normalizeRow(record, PARTNER_TEMPLATE_FIELDS);
  if (!normalized.partnerId && record.partnerId != null) normalized.partnerId = record.partnerId;
  return normalized;
}

function normalizeContactRow(record = {}) {
  const normalized = normalizeRow(record, CONTACT_TEMPLATE_FIELDS);
  if (!normalized.contactId && record.contactId != null) normalized.contactId = record.contactId;
  return normalized;
}

export async function buildExportSnapshot() {
  const [partners, contacts] = await Promise.all([
    readStore('partners'),
    readStore('contacts')
  ]);
  return {
    partners: partners.map(normalizePartnerRow),
    contacts: contacts.map(normalizeContactRow)
  };
}

export function renderExportPreview(snapshot = {}, options = {}) {
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 5;
  const partners = Array.isArray(snapshot.partners) ? snapshot.partners : [];
  const contacts = Array.isArray(snapshot.contacts) ? snapshot.contacts : [];
  const lines = [];
  lines.push(`Partners: ${partners.length}`);
  partners.slice(0, limit).forEach((row) => {
    const preview = typeof previewPartner === 'function' ? previewPartner(row) : row;
    const name = preview?.name || preview?.company || preview?.partnerId || '—';
    const email = preview?.email ? ` <${preview.email}>` : '';
    const phone = preview?.phone ? ` ${preview.phone}` : '';
    lines.push(` • ${name}${email}${phone}`);
  });
  lines.push(`Contacts: ${contacts.length}`);
  contacts.slice(0, limit).forEach((row) => {
    const preview = typeof previewContact === 'function' ? previewContact(row) : row;
    const fullName = `${preview?.first || ''} ${preview?.last || ''}`.trim();
    const name = fullName || preview?.contactId || '—';
    const email = preview?.email ? ` <${preview.email}>` : '';
    const phone = preview?.phone ? ` ${preview.phone}` : '';
    lines.push(` • ${name}${email}${phone}`);
  });
  return lines.join('\n');
}

export const EXPORTER_INTERNALS = {
  normalizePartnerRow,
  normalizeContactRow,
  renderExportPreview
};

export default { buildExportSnapshot, renderExportPreview };
