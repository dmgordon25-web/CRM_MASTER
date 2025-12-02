import { openContactModal } from '../contacts.js';
import { openPartnerEditModal } from '../ui/modals/partner_edit/index.js';
import { renderRelationshipMap } from './map.js';
import { NONE_PARTNER_ID } from '../constants/ids.js';

const soon = typeof queueMicrotask === 'function' ? queueMicrotask : (fn) => Promise.resolve().then(fn);
const norm = (id) => String(id ?? '').trim();
const ready = () => {
  if (typeof document === 'undefined') return Promise.resolve();
  return document.readyState === 'loading'
    ? new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    : Promise.resolve();
};
const ensureHost = () => {
  if (typeof document === 'undefined') return null;
  const card = document.getElementById('rel-opps-card');
  if (!card) return null;
  let host = card.querySelector('[data-ui="relationships-map"]');
  if (!host) {
    host = document.createElement('div');
    host.dataset.ui = 'relationships-map';
    host.className = 'rel-map-host';
    card.appendChild(host);
  }
  return host;
};
const cloneRecords = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => (entry && typeof entry === 'object' ? { ...entry } : entry));
};
const readSeedDataset = (scope) => {
  const dataset = scope && typeof scope === 'object' ? scope.__SEED_DATA__ : null;
  if (!dataset || typeof dataset !== 'object') return { contacts: [], partners: [] };
  return {
    contacts: cloneRecords(dataset.contacts),
    partners: cloneRecords(dataset.partners)
  };
};
const loadRecords = async () => {
  const win = typeof window !== 'undefined' ? window : {};
  const openDb = typeof win.openDB === 'function' ? win.openDB : (typeof win.opendb === 'function' ? win.opendb : null);
  if (openDb) {
    try { await openDb(); }
    catch (_err) {}
  }
  const dbGetAll = typeof win.dbGetAll === 'function' ? win.dbGetAll.bind(win) : null;
  if (!dbGetAll) return { contacts: [], partners: [] };
  try {
    const [contacts, partners] = await Promise.all([
      dbGetAll('contacts').catch(() => []),
      dbGetAll('partners').catch(() => [])
    ]);
    let normalizedContacts = Array.isArray(contacts) ? Array.from(contacts) : [];
    let normalizedPartners = Array.isArray(partners) ? Array.from(partners) : [];
    if (!normalizedContacts.length || !normalizedPartners.length) {
      const seeds = readSeedDataset(win);
      if (!normalizedContacts.length && seeds.contacts.length) normalizedContacts = seeds.contacts;
      if (!normalizedPartners.length && seeds.partners.length) normalizedPartners = seeds.partners;
    }
    return { contacts: normalizedContacts, partners: normalizedPartners };
  } catch (_err) {
    const seeds = readSeedDataset(win);
    return { contacts: seeds.contacts, partners: seeds.partners };
  }
};
const safeDebug = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const nodes = document.querySelectorAll('[data-qa="rel-node"]').length;
  const edges = document.querySelectorAll('[data-qa="rel-edge"]').length;
  const keyboardAccess = !!document.querySelector('[data-qa="rel-node"][tabindex="0"]');
  window.__REL_DEBUG__ = { nodes, edges, keyboardAccess };
  try { console.log('REL_SUMMARY', window.__REL_DEBUG__); }
  catch (_err) {}
};
let hostNode = null;
let token = 0;
let scheduled = false;
const render = async () => {
  if (!hostNode || !hostNode.isConnected) hostNode = ensureHost();
  if (!hostNode) { safeDebug(); return; }
  const requestId = ++token;
  hostNode.innerHTML = '<div class="muted">Loading relationships…</div>';
  try {
    const { contacts, partners } = await loadRecords();
    if (requestId !== token) return;
    const noneId = typeof window !== 'undefined' && window.NONE_PARTNER_ID ? window.NONE_PARTNER_ID : NONE_PARTNER_ID;
    renderRelationshipMap({
      root: hostNode,
      contacts,
      partners,
      nonePartnerId: noneId,
      openContact: (id) => {
        const normalized = norm(id);
        if (!normalized) return;
        try { openContactModal(normalized, { sourceHint: 'relationships:map' }); }
        catch (_err) {}
      },
      openPartner: (id) => {
        const normalized = norm(id);
        if (!normalized) return;
        try { openPartnerEditModal(normalized, { sourceHint: 'relationships:map' }); }
        catch (_err) {}
      }
    });
  } catch (err) {
    console.warn('relationship map render failed', err);
    hostNode.innerHTML = '<div class="muted">Unable to load relationship map.</div>';
    safeDebug();
  }
};
const schedule = () => {
  if (scheduled) return;
  scheduled = true;
  soon(() => { scheduled = false; render(); });
};
const handleChange = (event) => {
  const detail = event && event.detail ? event.detail : event;
  const topic = detail && typeof detail.topic === 'string' ? detail.topic : '';
  const store = detail && typeof detail.store === 'string' ? detail.store : '';
  const scope = detail && typeof detail.scope === 'string' ? detail.scope : '';
  const normalized = topic.toLowerCase();
  const storeKey = store.toLowerCase();
  const scopeKey = scope.toLowerCase();
  if (
    normalized.startsWith('relationships') ||
    normalized.startsWith('contacts') ||
    normalized.startsWith('partners') ||
    storeKey === 'contacts' ||
    storeKey === 'partners' ||
    scopeKey === 'relationships'
  ) {
    schedule();
  }
};
ready().then(() => {
  schedule();
  if (typeof document !== 'undefined') document.addEventListener('app:data:changed', handleChange);
  if (typeof window !== 'undefined') window.addEventListener('relationships:refresh', handleChange);
});
