// Canonical workflow model used to keep statuses, stages, and milestones consistent.
import {
  PIPELINE_STATUS_KEYS,
  PIPELINE_MILESTONES,
  canonicalStage,
  canonicalStatusKey,
  normalizeMilestoneForStatus,
  normalizeStatusForMilestone,
  allowedStatusesForStage,
  allowedMilestonesForStatus
} from '../pipeline/constants.js';
import { stageKeyFromLabel } from '../pipeline/stages.js';

export const CANONICAL_STAGE_ORDER = Object.freeze([
  'long-shot',
  'application',
  'preapproved',
  'processing',
  'underwriting',
  'approved',
  'cleared-to-close',
  'funded',
  'post-close',
  'past-client',
  'returning'
]);

const STAGE_LABELS = Object.freeze({
  'long-shot': 'Long Shot',
  application: 'Application',
  preapproved: 'Pre-Approved',
  processing: 'Processing',
  underwriting: 'Underwriting',
  approved: 'Approved',
  'cleared-to-close': 'Cleared to Close',
  funded: 'Funded',
  'post-close': 'Post Close',
  'past-client': 'Past Client',
  returning: 'Returning'
});

const STATUS_STAGE = Object.freeze({
  nurture: 'long-shot',
  inprogress: 'application',
  active: 'processing',
  paused: 'application',
  client: 'funded',
  lost: 'lost',
  denied: 'lost'
});

const ALLOWED_TRANSITIONS = new Map([
  ['long-shot', new Set(['application', 'lost'])],
  ['application', new Set(['preapproved', 'long-shot', 'lost', 'paused'])],
  ['preapproved', new Set(['processing', 'application', 'paused'])],
  ['processing', new Set(['underwriting', 'approved', 'paused'])],
  ['underwriting', new Set(['approved', 'cleared-to-close', 'paused'])],
  ['approved', new Set(['cleared-to-close', 'processing', 'paused'])],
  ['cleared-to-close', new Set(['funded', 'post-close'])],
  ['funded', new Set(['post-close', 'past-client'])],
  ['post-close', new Set(['past-client', 'returning'])],
  ['past-client', new Set(['returning'])],
  ['returning', new Set(['application'])],
  ['lost', new Set(['returning'])]
]);

const PIPELINE_STAGE_TO_CANONICAL_STAGE = Object.freeze({
  new: 'long-shot',
  qualified: 'application',
  negotiating: 'processing',
  clear_to_close: 'cleared-to-close',
  won: 'funded',
  lost: 'lost'
});

const KNOWN_STAGE_KEYS = new Set([...CANONICAL_STAGE_ORDER, ...ALLOWED_TRANSITIONS.keys()]);

export function canonicalStageKey(value) {
  const pipelineKey = canonicalStage(value);
  if (pipelineKey && PIPELINE_STAGE_TO_CANONICAL_STAGE[pipelineKey]) {
    return PIPELINE_STAGE_TO_CANONICAL_STAGE[pipelineKey];
  }

  const labelKey = stageKeyFromLabel(value);
  if (labelKey && KNOWN_STAGE_KEYS.has(labelKey)) return labelKey;

  const lowered = String(value ?? '').trim().toLowerCase();
  if (KNOWN_STAGE_KEYS.has(lowered)) return lowered;
  return '';
}

export function canonicalStatus(value) {
  return canonicalStatusKey(value) || '';
}

export function canonicalMilestone(value) {
  const idx = PIPELINE_MILESTONES.indexOf(normalizeMilestoneForStatus(value, 'inprogress'));
  if (idx >= 0) return PIPELINE_MILESTONES[idx];
  return PIPELINE_MILESTONES[0];
}

export function statusStageKey(status) {
  const key = canonicalStatus(status);
  if (!key) return '';
  if (STATUS_STAGE[key]) return STATUS_STAGE[key];
  if (PIPELINE_STATUS_KEYS.includes(key)) return STATUS_STAGE[key] || 'application';
  return '';
}

export function allowedStageTransitions(fromStage) {
  const key = canonicalStageKey(fromStage);
  const allowed = ALLOWED_TRANSITIONS.get(key);
  if (allowed && allowed.size) return Array.from(allowed);
  return [];
}

export function isTransitionAllowed(fromStage, toStage) {
  const allowed = new Set(allowedStageTransitions(fromStage));
  const target = canonicalStageKey(toStage);
  return allowed.has(target);
}

export function normalizeStage(value) {
  const key = canonicalStageKey(value);
  if (key) return key;
  const normalized = stageKeyFromLabel(value);
  if (normalized) return normalized;
  return CANONICAL_STAGE_ORDER[0];
}

export function normalizeStatus(value, stage) {
  const normalizedStage = stage ? normalizeStage(stage) : undefined;
  const allowed = normalizedStage ? allowedStatusesForStage(normalizedStage) : PIPELINE_STATUS_KEYS;
  const key = canonicalStatusKey(value);
  if (key && allowed.includes(key)) return key;
  if (allowed.length) return allowed[0];
  return PIPELINE_STATUS_KEYS[0];
}

export function normalizeMilestone(value, status) {
  return normalizeMilestoneForStatus(value, status || 'inprogress');
}

export function normalizeWorkflow(record = {}) {
  const normalizedStage = normalizeStage(record.stage || record.pipelineStage);
  const normalizedStatus = normalizeStatus(record.status, normalizedStage);
  const normalizedMilestone = normalizeMilestone(record.milestone, normalizedStatus);
  const stageAllowedStatuses = new Set(allowedStatusesForStage(normalizedStage));
  let finalStatus = normalizedStatus;
  if (!stageAllowedStatuses.has(normalizedStatus)) {
    const milestoneStatus = normalizeStatusForMilestone(normalizedMilestone, normalizedStatus, {
      stage: normalizedStage
    });
    finalStatus = stageAllowedStatuses.has(milestoneStatus) ? milestoneStatus : allowedStatusesForStage(normalizedStage)[0];
  }
  const statusAllowedMilestones = new Set(allowedMilestonesForStatus(finalStatus));
  const finalMilestone = statusAllowedMilestones.has(normalizedMilestone)
    ? normalizedMilestone
    : normalizeMilestoneForStatus(normalizedMilestone, finalStatus);
  return {
    stage: normalizedStage,
    status: finalStatus,
    milestone: finalMilestone
  };
}

export function classifyLane(stage) {
  const key = canonicalStageKey(stage);
  const index = CANONICAL_STAGE_ORDER.indexOf(key);
  return { key, index, label: STAGE_LABELS[key] || key };
}

export function workflowUniverse() {
  return {
    stages: CANONICAL_STAGE_ORDER.slice(),
    statuses: PIPELINE_STATUS_KEYS.slice(),
    milestones: PIPELINE_MILESTONES.slice()
  };
}

export default {
  CANONICAL_STAGE_ORDER,
  workflowUniverse,
  canonicalStageKey,
  canonicalStatus,
  canonicalMilestone,
  normalizeStage,
  normalizeStatus,
  normalizeMilestone,
  normalizeWorkflow,
  allowedStageTransitions,
  isTransitionAllowed,
  classifyLane,
  statusStageKey
};
