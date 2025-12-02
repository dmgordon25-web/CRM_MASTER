const NONE_PARTNER_ID = '00000000-0000-none-partner-000000000000';

const normalizeId = (value) => {
  const text = String(value ?? '').trim();
  if (!text || text === 'null' || text === 'undefined') return '';
  if (text === NONE_PARTNER_ID) return '';
  return text;
};

const normalizeToken = (value) => String(value ?? '').trim().toLowerCase();

function partnerTokens(partner) {
  const tokens = new Set();
  if (!partner || typeof partner !== 'object') return tokens;
  [partner.name, partner.company].forEach((value) => {
    const token = normalizeToken(value);
    if (token) tokens.add(token);
  });
  return tokens;
}

async function safeGetAll(store) {
  if (typeof window === 'undefined') return [];
  if (typeof window.dbGetAll !== 'function') return [];
  try { return await window.dbGetAll(store); }
  catch (_err) { return []; }
}

async function persistContacts(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return false;
  if (typeof window.dbBulkPut === 'function') {
    await window.dbBulkPut('contacts', list);
    return true;
  }
  if (typeof window.dbPut === 'function') {
    for (const row of list) {
      try { await window.dbPut('contacts', row); }
      catch (_err) { }
    }
    return true;
  }
  return false;
}

function buildPartnerIndex(partners) {
  const index = new Map();
  const ids = new Set();
  partners.forEach((partner) => {
    if (!partner) return;
    const id = normalizeId(partner.id);
    if (id) ids.add(id);
    partnerTokens(partner).forEach((token) => {
      if (!token || index.has(token)) return;
      index.set(token, partner);
    });
  });
  return { index, ids };
}

function resolveReferralPartner(contact, partnerIndex) {
  if (!contact) return null;
  const hint = normalizeToken(contact.referralPartnerName || contact.referredBy);
  if (!hint) return null;
  return partnerIndex.get(hint) || null;
}

async function linkStrayReferrals(options = {}) {
  const partners = Array.isArray(options.partners) && options.partners.length
    ? options.partners
    : await safeGetAll('partners');
  const contacts = Array.isArray(options.contacts) && options.contacts.length
    ? options.contacts
    : await safeGetAll('contacts');
  if (!partners.length || !contacts.length) return 0;

  const { index, ids } = buildPartnerIndex(partners);
  if (!index.size) return 0;

  const updates = [];
  contacts.forEach((contact) => {
    if (!contact || typeof contact !== 'object') return;
    const currentId = normalizeId(contact.referralPartnerId);
    if (currentId && ids.has(currentId)) return;
    const partner = resolveReferralPartner(contact, index);
    if (!partner || !partner.id) return;
    const nameFallback = contact.referralPartnerName || contact.referredBy || '';
    updates.push(Object.assign({}, contact, {
      referralPartnerId: partner.id,
      referralPartnerName: partner.name || partner.company || nameFallback,
      updatedAt: Date.now()
    }));
  });

  if (!updates.length) return 0;
  await persistContacts(updates);

  try {
    const detail = {
      scope: 'contacts',
      source: options.source || 'referral-linker',
      action: 'link-referrals',
      count: updates.length
    };
    if (typeof window.dispatchAppDataChanged === 'function') {
      window.dispatchAppDataChanged(detail);
    } else if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('app:data:changed', { detail }));
    }
  } catch (_err) { }

  return updates.length;
}

async function linkStrayReferralsForPartner(partner, options = {}) {
  if (!partner) return 0;
  const partners = [partner];
  const contacts = Array.isArray(options.contacts) ? options.contacts : undefined;
  return linkStrayReferrals({ partners, contacts, source: options.source || 'partner-link' });
}

export { linkStrayReferrals, linkStrayReferralsForPartner };
export default { linkStrayReferrals, linkStrayReferralsForPartner };
