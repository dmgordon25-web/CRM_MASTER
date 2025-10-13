import { toCanonicalStage } from '../pipeline/constants.js';

function getGlobalScope(){
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined') return globalThis;
  return null;
}

function normalizeStageValue(stage){
  const canonical = toCanonicalStage(stage);
  if (canonical) return canonical;
  return null;
}

function ensureArray(input){
  return Array.isArray(input) ? input : [];
}

function canonicalizeContacts(dataset){
  if (!dataset || typeof dataset !== 'object') return { contacts: [], hasCtc: false };
  const contacts = Array.isArray(dataset.contacts) ? dataset.contacts : (dataset.contacts = []);
  let hasCtc = false;
  const seenIds = new Set();

  contacts.forEach((record) => {
    if (!record || typeof record !== 'object') return;
    if (record.id != null) seenIds.add(String(record.id));
    if (!Object.prototype.hasOwnProperty.call(record, 'stage')) return;
    const canonical = normalizeStageValue(record.stage);
    if (canonical === 'clear_to_close') {
      record.stage = canonical;
      hasCtc = true;
      return;
    }
    const raw = record.stage == null ? '' : String(record.stage).trim();
    if (raw === 'clear_to_close') {
      hasCtc = true;
    }
  });

  return { contacts, hasCtc, seenIds };
}

function uniqueSeedId(seenIds){
  let index = 1;
  let candidate = `seed-ctc-${index}`;
  while (seenIds.has(candidate)) {
    index += 1;
    candidate = `seed-ctc-${index}`;
  }
  return candidate;
}

function pickPartnerIds(dataset){
  const partners = ensureArray(dataset?.partners);
  const buyerPartner = partners[0] || null;
  const listingPartner = partners[1] || null;
  return {
    buyerId: buyerPartner && buyerPartner.id ? String(buyerPartner.id) : null,
    listingId: listingPartner && listingPartner.id ? String(listingPartner.id) : null,
    buyerName: buyerPartner && buyerPartner.name ? String(buyerPartner.name) : ''
  };
}

function synthesizeCtcContact(dataset, contacts, seenIds){
  const today = '2025-09-27';
  const { buyerId, listingId, buyerName } = pickPartnerIds(dataset);
  const id = uniqueSeedId(seenIds);
  const referral = buyerName ? `${buyerName} Referral` : 'Demo Seed';
  const contact = {
    id,
    first: 'Sample',
    last: 'CTC',
    email: 'sample.ctc@example.com',
    phone: '555-1010',
    stage: 'clear_to_close',
    status: 'inprogress',
    loanType: 'conv',
    loanAmount: 345000,
    rate: 6.25,
    fundedDate: '',
    birthday: '1991-06-01',
    anniversary: '2020-06-01',
    buyerPartnerId: buyerId,
    listingPartnerId: listingId,
    lastContact: today,
    referredBy: referral,
    notes: 'Synthetic seed to showcase the Clear to Close stage.',
    title: 'Sample CTC Deal'
  };
  contacts.push(contact);
  seenIds.add(id);
}

(function normalizeSeedData(){
  const globalScope = getGlobalScope();
  if (!globalScope) return;

  const dataset = globalScope.__SEED_DATA__;
  const { contacts, hasCtc, seenIds } = canonicalizeContacts(dataset);
  if (!hasCtc && contacts.length) {
    synthesizeCtcContact(dataset, contacts, seenIds);
  } else if (!hasCtc && dataset && contacts === dataset.contacts) {
    // dataset exists but contacts empty; still push a synthetic record to showcase stage
    synthesizeCtcContact(dataset, contacts, seenIds);
  }
})();
