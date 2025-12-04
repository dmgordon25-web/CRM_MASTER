// Labs CRM Data Helper
// Connects to actual CRM database and provides data for Labs dashboard

import { deriveBaselineSnapshot } from '../dashboard/baseline_snapshot.js';
import { normalizeWorkflow, CANONICAL_STAGE_ORDER, canonicalStageKey, classifyLane } from '../workflow/state_model.js';
import { stageLabelFromKey } from '../pipeline/stages.js';
import { getTodayTasks, getOverdueTasks, getDueTaskGroups } from '../tasks/task_scopes.js';

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

export { getTodayTasks, getOverdueTasks, getDueTaskGroups };

export async function buildLabsModel() {
  const [contactsRaw, partners, tasksRaw] = await Promise.all([
    getAllContacts(),
    getAllPartners(),
    getAllTasks()
  ]);

  const contacts = contactsRaw.map(normalizeContact);
  const tasks = tasksRaw.map(normalizeTask);
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

  const celebrations = getUpcomingCelebrations(contacts, 30);

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
    activeLanes
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
