import { NONE_PARTNER_ID } from '../../constants/ids.js';

function buildPartnerResolver(partners = []) {
  const lookup = new Map();

  const register = (key, partner) => {
    const normalized = String(key == null ? '' : key).trim();
    if (!normalized) return;
    if (!lookup.has(normalized)) lookup.set(normalized, partner);
    const lower = normalized.toLowerCase();
    if (!lookup.has(lower)) lookup.set(lower, partner);
  };

  partners.forEach((partner) => {
    if (!partner) return;
    const id = partner.id == null ? null : String(partner.id).trim();
    if (!id) return;
    register(id, partner);
    const compact = id.replace(/^partner[-_]?/i, '');
    if (compact && compact !== id) register(compact, partner);
  });

  const resolve = (rawId) => {
    const key = String(rawId == null ? '' : rawId).trim();
    if (!key) return { id: '', record: null };
    const hit = lookup.get(key) || lookup.get(key.toLowerCase());
    if (hit) return { id: hit.id == null ? '' : String(hit.id), record: hit };
    return { id: key, record: null };
  };

  return { resolve };
}

export function computeReferralLeaders({ contacts = [], partners = [], limit = 3 } = {}) {
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const safePartners = Array.isArray(partners) ? partners : [];
  const { resolve } = buildPartnerResolver(safePartners);
  const referralStats = new Map();

  safeContacts.forEach((contact) => {
    if (!contact) return;
    const buyerId = contact.buyerPartnerId == null ? '' : String(contact.buyerPartnerId);
    const listingId = contact.listingPartnerId == null ? '' : String(contact.listingPartnerId);
    const partnerId = buyerId || listingId;
    if (!partnerId || partnerId === NONE_PARTNER_ID) return;
    const { id: resolvedPartnerId } = resolve(partnerId);
    if (!resolvedPartnerId) return;
    const entry = referralStats.get(resolvedPartnerId) || { count: 0, volume: 0, contacts: [] };
    entry.count += 1;
    entry.volume += Number(contact.loanAmount || 0) || 0;
    entry.contacts.push(contact);
    referralStats.set(resolvedPartnerId, entry);
  });

  const leaders = Array.from(referralStats.entries())
    .sort((a, b) => (b[1]?.count || 0) - (a[1]?.count || 0))
    .slice(0, limit)
    .map(([partnerId, stat]) => {
      const { id: resolvedPartnerId, record } = resolve(partnerId);
      return { partnerId: resolvedPartnerId, partner: record, ...stat };
    });

  const totalReferrals = Array.from(referralStats.values()).reduce((sum, entry) => sum + (entry.count || 0), 0) || 0;

  return { leaders, totalReferrals };
}
