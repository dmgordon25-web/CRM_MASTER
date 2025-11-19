import { normalizeStatus } from '../pipeline/constants.js';

const PIPELINE_STAGE_KEYS = Object.freeze(['application', 'processing', 'underwriting']);

function getGlobalScope(){
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined') return globalThis;
  return null;
}

function normalizeStageValue(stage){
  const canonical = normalizeStatus(stage);
  if (canonical) return canonical;
  return null;
}

function ensureArray(input){
  return Array.isArray(input) ? input : [];
}

function canonicalizeContacts(dataset){
  if (!dataset || typeof dataset !== 'object') return { contacts: [], hasCtc: false, pipelineCount: 0 };
  const contacts = Array.isArray(dataset.contacts) ? dataset.contacts : (dataset.contacts = []);
  let hasCtc = false;
  let pipelineCount = 0;
  const seenIds = new Set();

  contacts.forEach((record) => {
    if (!record || typeof record !== 'object') return;
    if (record.id != null) seenIds.add(String(record.id));
    if (!Object.prototype.hasOwnProperty.call(record, 'stage')) return;
    const canonical = normalizeStageValue(record.stage);
    if (canonical === 'cleared-to-close') {
      record.stage = canonical;
      hasCtc = true;
      return;
    }
    if (canonical && PIPELINE_STAGE_KEYS.includes(canonical)) {
      pipelineCount += 1;
    }
    const raw = record.stage == null ? '' : String(record.stage).trim();
    if (normalizeStageValue(raw) === 'cleared-to-close') {
      hasCtc = true;
    }
  });

  return { contacts, hasCtc, seenIds, pipelineCount };
}

function uniqueSeedId(seenIds, prefix = 'seed'){
  let index = 1;
  let candidate = `${prefix}-${index}`;
  while (seenIds.has(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
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
  const id = uniqueSeedId(seenIds, 'seed-ctc');
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

function synthesizePipelineContact(dataset, contacts, seenIds, stage, ordinal){
  const normalizedStage = normalizeStageValue(stage) || 'application';
  const { buyerId, listingId } = pickPartnerIds(dataset);
  const order = typeof ordinal === 'number' && Number.isFinite(ordinal) ? ordinal : 0;
  const indexLabel = order + 1;
  const stageLabel = normalizedStage.replace(/-/g, ' ');
  const today = new Date().toISOString().slice(0, 10);
  const milestoneByStage = {
    application: 'Application Submitted',
    processing: 'Processing Docs',
    underwriting: 'Conditions Review'
  };
  const loanPrograms = ['Conventional', 'FHA', 'VA', 'Jumbo'];
  const loanType = loanPrograms[order % loanPrograms.length];
  const id = uniqueSeedId(seenIds, `seed-pipeline-${normalizedStage}`);
  const contact = {
    id,
    first: 'Pipeline',
    last: `${stageLabel.replace(/(^|\s)\w/g, (ch) => ch.toUpperCase())} ${indexLabel}`.trim(),
    email: `pipeline.${normalizedStage}.${indexLabel}@example.com`,
    phone: '555-2020',
    stage: normalizedStage,
    status: 'inprogress',
    pipelineMilestone: milestoneByStage[normalizedStage] || 'Pipeline Follow Up',
    loanType,
    loanAmount: 325000 + (order * 5000),
    buyerPartnerId: buyerId,
    listingPartnerId: listingId,
    referredBy: 'Sample Pipeline Seed',
    lastContact: today,
    createdAt: today,
    updatedAt: today
  };
  contacts.push(contact);
  seenIds.add(id);
}

(function normalizeSeedData(){
  const globalScope = getGlobalScope();
  if (!globalScope) return;

  const dataset = globalScope.__SEED_DATA__;
  const { contacts, hasCtc, seenIds, pipelineCount } = canonicalizeContacts(dataset);
  if (pipelineCount < 2 && contacts === dataset?.contacts) {
    const deficit = Math.max(2 - pipelineCount, 0);
    for (let i = 0; i < deficit; i += 1) {
      const stage = PIPELINE_STAGE_KEYS[i % PIPELINE_STAGE_KEYS.length];
      synthesizePipelineContact(dataset, contacts, seenIds, stage, i);
    }
  }
  if (!hasCtc && contacts.length) {
    synthesizeCtcContact(dataset, contacts, seenIds);
  } else if (!hasCtc && dataset && contacts === dataset.contacts) {
    // dataset exists but contacts empty; still push a synthetic record to showcase stage
    synthesizeCtcContact(dataset, contacts, seenIds);
  }
})();
