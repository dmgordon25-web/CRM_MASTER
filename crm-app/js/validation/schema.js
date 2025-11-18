import { normalizeEmail, normalizePhone } from '../util/strings.js';
import { stageKeyFromLabel } from '../pipeline/stages.js';
import {
  canonicalStatusKey,
  canonicalMilestoneLabel,
  PIPELINE_STATUS_KEYS,
  PIPELINE_MILESTONES,
  normalizeStatusForStage
} from '../pipeline/constants.js';

function canon(value){
  return String(value ?? '').trim();
}

function validateEmail(value){
  const normalized = normalizeEmail(value);
  if(!normalized) return { ok: false, normalized, error: 'email is required' };
  const valid = /.+@.+\..+/.test(normalized);
  return valid ? { ok: true, normalized } : { ok: false, normalized, error: 'email is invalid' };
}

function validatePhone(value){
  const normalized = normalizePhone(value);
  if(!normalized) return { ok: false, normalized, error: 'phone is required' };
  return normalized.length >= 7 ? { ok: true, normalized } : { ok: false, normalized, error: 'phone is invalid' };
}

function validateDate(value){
  if(value == null || value === '') return { ok: true, normalized: '' };
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? { ok: false, normalized: value, error: 'date is invalid' }
    : { ok: true, normalized: date.toISOString() };
}

function normalizeStage(stage){
  const key = stageKeyFromLabel(stage);
  return key || canon(stage);
}

function validateStage(stage){
  const normalized = normalizeStage(stage);
  if(!normalized) return { ok: false, normalized, error: 'stage is required' };
  return { ok: true, normalized };
}

function validateStatus(stage, status){
  const normalized = normalizeStatusForStage(stage, status);
  const key = canonicalStatusKey(normalized);
  if(!key || !PIPELINE_STATUS_KEYS.includes(key)){
    return { ok: false, normalized: key || status, error: 'status is invalid' };
  }
  return { ok: true, normalized: key };
}

function validateMilestone(status, milestone){
  const normalized = canonicalMilestoneLabel(milestone);
  if(!normalized) return { ok: false, normalized, error: 'pipelineMilestone is invalid' };
  const rules = {
    nurture: { min: 0, max: 1 },
    inprogress: { min: 0, max: 3 },
    active: { min: 2, max: 6 },
    paused: { min: 0, max: 6 },
    client: { min: PIPELINE_MILESTONES.length - 1, max: PIPELINE_MILESTONES.length - 1 },
    lost: { min: 0, max: 2 }
  };
  const range = rules[status] || { min: 0, max: PIPELINE_MILESTONES.length - 1 };
  const index = PIPELINE_MILESTONES.indexOf(normalized);
  if(index < 0 || index < range.min || index > range.max){
    return { ok: false, normalized, error: 'pipelineMilestone is out of range' };
  }
  return { ok: true, normalized };
}

export function buildContactDedupeKeys(record){
  const keys = [];
  const contactId = canon(record?.contactId || record?.id);
  if(contactId) keys.push(`id:${contactId}`);
  const email = normalizeEmail(record?.email);
  if(email) keys.push(`em:${email}`);
  const phone = normalizePhone(record?.phone);
  if(phone) keys.push(`ph:${phone}`);
  const fallback = `${canon(record?.first).toLowerCase()}|${canon(record?.last).toLowerCase()}|${canon(record?.city).toLowerCase()}`;
  if(fallback.replace(/\|/g, '').trim()) keys.push(`fb:${fallback}`);
  return keys;
}

export function buildPartnerDedupeKeys(record){
  const keys = [];
  const partnerId = canon(record?.partnerId || record?.id);
  if(partnerId) keys.push(`id:${partnerId}`);
  const email = normalizeEmail(record?.email);
  if(email) keys.push(`em:${email}`);
  const phone = normalizePhone(record?.phone);
  if(phone) keys.push(`ph:${phone}`);
  const fallback = `${canon(record?.name).toLowerCase()}|${canon(record?.company).toLowerCase()}|${canon(record?.city).toLowerCase()}`;
  if(fallback.replace(/\|/g, '').trim()) keys.push(`fb:${fallback}`);
  return keys;
}

async function readStore(store){
  if(typeof globalThis.dbGetAll === 'function') return globalThis.dbGetAll(store);
  if(globalThis.db?.getAll) return globalThis.db.getAll(store);
  return [];
}

export async function findPotentialDuplicates(kind, record){
  const keys = kind === 'partners' ? buildPartnerDedupeKeys(record) : buildContactDedupeKeys(record);
  const store = kind === 'partners' ? 'partners' : 'contacts';
  const existing = await readStore(store);
  const map = new Map();
  existing.forEach((row) => {
    (kind === 'partners' ? buildPartnerDedupeKeys(row) : buildContactDedupeKeys(row)).forEach((key) => {
      if(!map.has(key)) map.set(key, row);
    });
  });
  for(const key of keys){
    if(map.has(key)) return { match: map.get(key), matchedBy: key };
  }
  return { match: null, matchedBy: null };
}

export function validatePartner(record){
  const errors = [];
  const normalized = Object.assign({}, record);

  const emailCheck = validateEmail(record?.email || record?.partnerEmail || '');
  if(!emailCheck.ok) errors.push(emailCheck.error);
  normalized.email = emailCheck.normalized;

  const phoneCheck = validatePhone(record?.phone || record?.partnerPhone || '');
  if(!phoneCheck.ok) errors.push(phoneCheck.error);
  normalized.phone = phoneCheck.normalized;

  normalized.name = canon(record?.name || record?.partnerName);
  normalized.company = canon(record?.company || record?.partnerCompany);
  normalized.city = canon(record?.city);

  return { ok: errors.length === 0, errors, normalized };
}

export function validateContact(record){
  const errors = [];
  const normalized = Object.assign({}, record);

  const emailCheck = validateEmail(record?.email || record?.contactEmail || '');
  if(!emailCheck.ok) errors.push(emailCheck.error);
  normalized.email = emailCheck.normalized;

  const phoneCheck = validatePhone(record?.phone || record?.contactPhone || '');
  if(!phoneCheck.ok) errors.push(phoneCheck.error);
  normalized.phone = phoneCheck.normalized;

  const stageCheck = validateStage(record?.stage);
  if(!stageCheck.ok) errors.push(stageCheck.error);
  normalized.stage = stageCheck.normalized;

  const statusCheck = validateStatus(normalized.stage, record?.status);
  if(!statusCheck.ok) errors.push(statusCheck.error);
  normalized.status = statusCheck.normalized;

  const milestoneCheck = validateMilestone(normalized.status, record?.pipelineMilestone);
  if(!milestoneCheck.ok) errors.push(milestoneCheck.error);
  normalized.pipelineMilestone = milestoneCheck.normalized;

  normalized.first = canon(record?.first || record?.firstName);
  normalized.last = canon(record?.last || record?.lastName);
  normalized.city = canon(record?.city);

  const hasName = normalized.first || normalized.last;
  if(!hasName) errors.push('name is required');

  ['fundedDate','expectedClosing','preApprovalExpires','birthday','anniversary'].forEach((field) => {
    const res = validateDate(record?.[field]);
    if(!res.ok) errors.push(`${field} ${res.error}`);
    normalized[field] = res.normalized;
  });

  return { ok: errors.length === 0, errors, normalized };
}
