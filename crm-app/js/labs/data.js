// Labs CRM Data Helper
// Connects to actual CRM database and provides data for Labs dashboard

import { deriveBaselineSnapshot } from '../dashboard/baseline_snapshot.js';
import { normalizeWorkflow, CANONICAL_STAGE_ORDER, canonicalStageKey, classifyLane } from '../workflow/state_model.js';
import { stageLabelFromKey } from '../pipeline/stages.js';
import { getTodayTasks, getOverdueTasks, getDueTaskGroups } from '../tasks/task_scopes.js';
import { countTodayTasks, countOverdueTasks, countOpenTasks, getOpenTasks } from '../tasks/task_counts.js';

function dedupeById(items = []) {
  const map = new Map();
  items.forEach((item) => {
    const id = item?.id || item?._id;
    if (!id || map.has(id)) return;
    map.set(id, item);
  });
  return Array.from(map.values());
}

function getDbApi(method) {
  const scope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
  if (scope && typeof scope[method] === 'function') return scope[method];
  if (scope && scope.db && typeof scope.db[method] === 'function') return scope.db[method].bind(scope.db);
  return null;
}

// Ensure database is open
export async function ensureDatabase() {
  const openDB = getDbApi('openDB');
  if (typeof openDB !== 'function') {
    console.error('[labs] Database API unavailable');
    return false;
  }
  try {
    await openDB();
    return true;
  } catch (err) {
    console.error('[labs] Database connection failed:', err);
    return false;
  }
}

// Get all contacts from CRM database
export async function getAllContacts() {
  const dbGetAll = getDbApi('dbGetAll');
  if (typeof dbGetAll !== 'function') {
    console.error('[labs] dbGetAll is not available');
    return [];
  }
  try {
    const contacts = await dbGetAll('contacts');
    return Array.isArray(contacts) ? contacts.filter((c) => !c.isDeleted) : [];
  } catch (err) {
    console.error('[labs] Failed to fetch contacts:', err);
    return [];
  }
}

// Get all partners from CRM database
export async function getAllPartners() {
  const dbGetAll = getDbApi('dbGetAll');
  if (typeof dbGetAll !== 'function') {
    console.error('[labs] dbGetAll is not available');
    return [];
  }
  try {
    const partners = await dbGetAll('partners');
    return Array.isArray(partners) ? partners : [];
  } catch (err) {
    console.error('[labs] Failed to fetch partners:', err);
    return [];
  }
}

// Get all tasks from CRM database
export async function getAllTasks() {
  const dbGetAll = getDbApi('dbGetAll');
  if (typeof dbGetAll !== 'function') {
    console.error('[labs] dbGetAll is not available');
    return [];
  }
  try {
    const tasks = await dbGetAll('tasks');
    return Array.isArray(tasks) ? tasks : [];
  } catch (err) {
    console.error('[labs] Failed to fetch tasks:', err);
    return [];
  }
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  const date = new Date(value);
  const ts = date.getTime();
  return Number.isNaN(ts) ? null : ts;
}

function normalizeContact(contact = {}) {
  const normalizedWorkflow = normalizeWorkflow(contact);
  const createdTs = normalizeTimestamp(contact.createdTs || contact.createdAt || contact.created);
  const updatedTs = normalizeTimestamp(contact.updatedAt || contact.updatedTs || contact.updated);
  const fundedTs = normalizeTimestamp(contact.fundedTs || contact.funded_at || contact.fundedAt);
  const stageMap = contact.stageMap || {};
  return {
    ...contact,
    stage: normalizedWorkflow.stage,
    status: normalizedWorkflow.status,
    milestone: normalizedWorkflow.milestone,
    lane: normalizedWorkflow.stage,
    createdTs: createdTs || null,
    updatedTs: updatedTs || createdTs || null,
    fundedTs: fundedTs || null,
    stageMap
  };
}

function normalizeTask(task = {}) {
  const dueTs = normalizeTimestamp(task.dueTs || task.dueDate || task.due);
  return {
    ...task,
    due: task.due || task.dueDate || (dueTs ? new Date(dueTs).toISOString() : null),
    dueTs: dueTs || null,
    completed: !!task.completed
  };
}

// KPI calculation helpers powered by canonical baseline snapshot
export function calculateKPIsFromSnapshot(snapshot) {
  if (!snapshot || !snapshot.kpis) return null;
  return snapshot.kpis;
}

// Group contacts by stage for pipeline visualization using canonical model
export function groupByStage(contacts = []) {
  const groups = {};
  const order = CANONICAL_STAGE_ORDER.concat(['lost']);
  order.forEach((stage) => { groups[stage] = []; });
  contacts.forEach((contact) => {
    const stage = canonicalStageKey(contact.stage || contact.lane);
    if (groups[stage]) {
      groups[stage].push(contact);
    } else {
      groups.other = groups.other || [];
      groups.other.push(contact);
    }
  });
  return groups;
}

function getStageEntryTimestamp(stageEntry = {}) {
  return normalizeTimestamp(stageEntry.enteredAt || stageEntry.entered || stageEntry.ts || stageEntry.timestamp);
}

function getStageAge(contact, now) {
  const stageKey = canonicalStageKey(contact.stage || contact.lane);
  const stageEntry = contact.stageMap?.[stageKey];
  const stageTs = getStageEntryTimestamp(stageEntry);
  const fallbackTs = contact.updatedTs || contact.updatedAt || contact.createdTs;
  const ts = stageTs || fallbackTs;
  if (!ts) return null;
  const diffMs = now - ts;
  return diffMs < 0 ? 0 : Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export const VELOCITY_BUCKETS = [
  { id: 'lt3', label: '< 3d', maxDays: 2 },
  { id: 'd3to7', label: '3-7d', minDays: 3, maxDays: 7 },
  { id: 'gt7', label: '> 7d', minDays: 8 }
];

export const ANALYTICS_SEGMENT_TYPES = {
  STAGE: 'stage',
  VELOCITY: 'velocity',
  RISK: 'risk'
};

export function computeStageFunnel(contacts = []) {
  const funnel = [];
  const groups = groupByStage(contacts);

  CANONICAL_STAGE_ORDER.forEach((stage) => {
    const stageContacts = groups[stage] || [];
    const count = stageContacts.length;
    const totalAmount = stageContacts.reduce((sum, contact) => sum + (Number(contact.loanAmount) || 0), 0);
    funnel.push({
      stageId: stage,
      label: STAGE_CONFIG[stage]?.label || stageLabelFromKey(stage),
      count,
      totalAmount
    });
  });

  return funnel;
}

export function computeStageAgeBuckets(contacts = [], now = Date.now()) {
  const buckets = VELOCITY_BUCKETS.map((bucket) => ({ ...bucket, count: 0 }));
  contacts.forEach((contact) => {
    const stage = canonicalStageKey(contact.stage || contact.lane);
    if (!stage || ['lost', 'funded', 'post-close', 'past-client', 'returning'].includes(stage)) return;
    const age = getStageAge(contact, now);
    if (age === null) return;
    const bucket = buckets.find((b) => {
      const minOk = typeof b.minDays === 'number' ? age >= b.minDays : true;
      const maxOk = typeof b.maxDays === 'number' ? age <= b.maxDays : true;
      return minOk && maxOk;
    });
    if (bucket) {
      bucket.count += 1;
    }
  });
  return buckets;
}

export function getStageAgeInDays(contact, now = Date.now()) {
  return getStageAge(contact, now);
}

export function computeStaleSummary(contacts = [], days = 14) {
  const staleDeals = getStaleDeals(contacts, days);
  const byStage = {};
  staleDeals.forEach((deal) => {
    const stage = canonicalStageKey(deal.stage || deal.lane);
    const key = stage || 'unknown';
    byStage[key] = (byStage[key] || 0) + 1;
  });
  return {
    total: staleDeals.length,
    byStage
  };
}

export function getLoansForAnalyticsSegment(model = {}, segment = {}, now = Date.now()) {
  const contacts = Array.isArray(model.contacts) ? model.contacts : [];
  if (!segment || !segment.type) return [];

  switch (segment.type) {
    case ANALYTICS_SEGMENT_TYPES.STAGE: {
      const key = canonicalStageKey(segment.key);
      return contacts.filter((contact) => canonicalStageKey(contact.stage || contact.lane) === key);
    }
    case ANALYTICS_SEGMENT_TYPES.VELOCITY: {
      const bucket = VELOCITY_BUCKETS.find((b) => b.id === segment.key);
      if (!bucket) return [];
      return contacts.filter((contact) => {
        const stage = canonicalStageKey(contact.stage || contact.lane);
        if (!stage || ['lost', 'funded', 'post-close', 'past-client', 'returning'].includes(stage)) return false;
        const age = getStageAge(contact, now);
        if (age === null) return false;
        const minOk = typeof bucket.minDays === 'number' ? age >= bucket.minDays : true;
        const maxOk = typeof bucket.maxDays === 'number' ? age <= bucket.maxDays : true;
        return minOk && maxOk;
      });
    }
    case ANALYTICS_SEGMENT_TYPES.RISK: {
      const staleDeals = getStaleDeals(contacts, segment.days || 14);
      if (!segment.key || segment.key === 'all') return staleDeals;
      const key = canonicalStageKey(segment.key);
      return staleDeals.filter((deal) => canonicalStageKey(deal.stage || deal.lane) === key);
    }
    default:
      return [];
  }
}

// Calculate partner tier distribution
export function groupPartnersByTier(partners) {
  const tiers = {};

  partners.forEach((partner) => {
    const tier = partner.tier || 'Unknown';
    if (!tiers[tier]) {
      tiers[tier] = [];
    }
    tiers[tier].push(partner);
  });

  return tiers;
}

// Get top referral partners
export function getTopReferralPartners(partners, limit = 10) {
  return partners
    .filter((p) => p.referralVolume || p.name)
    .sort((a, b) => (b.referralVolume || 0) - (a.referralVolume || 0))
    .slice(0, limit);
}

// Get stale deals (no update in X days)
export function getStaleDeals(contacts, days = 14) {
  const now = Date.now();
  const threshold = days * 24 * 60 * 60 * 1000;

  return contacts.filter((contact) => {
    const stage = canonicalStageKey(contact.stage);
    if (['lost', 'funded', 'post-close', 'past-client', 'returning'].includes(stage)) {
      return false;
    }

    const updated = contact.updatedTs || contact.updatedAt || contact.createdTs || 0;
    return updated && (now - updated) > threshold;
  });
}

// Get upcoming birthdays/anniversaries
export function getUpcomingCelebrations(contacts, days = 7) {
  const celebrations = [];
  const now = new Date();
  const targetDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));

  contacts.forEach((contact) => {
    if (contact.birthday) {
      const bday = new Date(contact.birthday);
      bday.setFullYear(now.getFullYear());
      if (bday >= now && bday <= targetDate) {
        celebrations.push({
          type: 'birthday',
          date: bday,
          contact
        });
      }
    }

    if (contact.anniversary) {
      const anni = new Date(contact.anniversary);
      anni.setFullYear(now.getFullYear());
      if (anni >= now && anni <= targetDate) {
        celebrations.push({
          type: 'anniversary',
          date: anni,
          contact
        });
      }
    }
  });

  return celebrations.sort((a, b) => a.date - b.date);
}

// Stage display configuration derived from canonical workflow
const STAGE_PALETTE = ['#94a3b8', '#06b6d4', '#8b5cf6', '#3b82f6', '#6366f1', '#10b981', '#059669', '#22c55e', '#84cc16', '#0ea5e9'];
const STAGE_ICONS = ['👋', '📝', '✅', '⚙️', '🔍', '👍', '🎯', '💰', '🎉', '🔁'];
export const STAGE_CONFIG = CANONICAL_STAGE_ORDER.reduce((acc, stage, index) => {
  const lane = classifyLane(stage);
  acc[stage] = {
    label: lane.label || stageLabelFromKey(stage),
    color: STAGE_PALETTE[index % STAGE_PALETTE.length],
    icon: STAGE_ICONS[index % STAGE_ICONS.length]
  };
  return acc;
}, { lost: { label: 'Lost', color: '#ef4444', icon: '✗' } });

export function normalizeStagesForDisplay(stageKey) {
  return canonicalStageKey(stageKey);
}

export {
  getTodayTasks,
  getOverdueTasks,
  getDueTaskGroups,
  countTodayTasks,
  countOverdueTasks,
  countOpenTasks,
  getOpenTasks
};

export async function buildLabsModel() {
  const [contactsRaw, partnersRaw, tasksRaw] = await Promise.all([
    getAllContacts(),
    getAllPartners(),
    getAllTasks()
  ]);

  const normalizedContacts = contactsRaw
    .map(normalizeContact)
    .filter((contact) => contact && contact.id);
  const contacts = dedupeById(normalizedContacts).filter((contact) => {
    const stage = canonicalStageKey(contact.stage || contact.lane);
    if (!stage) return false;
    const archived = contact.status === 'archived' || contact.isArchived;
    return !archived;
  });

  const normalizedPartners = partnersRaw.filter((partner) => partner && partner.id);
  const partners = dedupeById(normalizedPartners);

  const normalizedTasks = tasksRaw
    .map(normalizeTask)
    .filter((task) => task && task.id && !task.deleted && !task.isDeleted && !task.isTemplate && !task.isPlaceholder);
  const tasks = dedupeById(normalizedTasks);

  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const partnerMap = new Map(partners.map((p) => [p.id, p]));
  const laneOrder = CANONICAL_STAGE_ORDER.concat(['lost']);
  const activeLanes = laneOrder.filter((lane) => !['funded', 'post-close', 'past-client', 'returning', 'lost'].includes(lane));

  const snapshot = deriveBaselineSnapshot({
    contacts,
    visibleTasks: tasks,
    allTasks: tasks,
    contactById: (id) => contactMap.get(id) || null,
    partnerById: (id) => partnerMap.get(id) || null,
    pipelineLaneOrder: laneOrder,
    pipelineActiveLanes: activeLanes,
    canonicalStage: canonicalStageKey
  });

  const activePipelineContacts = contacts.filter((contact) => {
    const stage = canonicalStageKey(contact.stage || contact.lane);
    return stage && !['lost', 'funded', 'post-close', 'past-client', 'returning'].includes(stage);
  });

  const celebrations = getUpcomingCelebrations(activePipelineContacts, 30);
  const analytics = {
    funnel: computeStageFunnel(activePipelineContacts),
    velocityBuckets: computeStageAgeBuckets(activePipelineContacts),
    staleSummary: computeStaleSummary(activePipelineContacts)
  };

  console.debug('[LABS] model loaded', {
    contactCount: contacts.length,
    partnerCount: partners.length,
    taskCount: tasks.length
  });

  return {
    contacts,
    partners,
    tasks,
    snapshot,
    celebrations,
    laneOrder,
    activeLanes,
    analytics
  };
}

// Format currency
export function formatCurrency(amount) {
  if (!amount) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Format number with abbreviation
export function formatNumber(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Format date
export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Format relative time
export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Never';

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}
