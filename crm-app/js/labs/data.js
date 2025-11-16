// Labs CRM Data Helper
// Connects to actual CRM database and provides data for Labs dashboard

import { openDB, dbGetAll, dbGet } from '../db.js';

// Ensure database is open
export async function ensureDatabase() {
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
  try {
    const contacts = await dbGetAll('contacts');
    return Array.isArray(contacts) ? contacts.filter(c => !c.isDeleted) : [];
  } catch (err) {
    console.error('[labs] Failed to fetch contacts:', err);
    return [];
  }
}

// Get all partners from CRM database
export async function getAllPartners() {
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
  try {
    const tasks = await dbGetAll('tasks');
    return Array.isArray(tasks) ? tasks : [];
  } catch (err) {
    console.error('[labs] Failed to fetch tasks:', err);
    return [];
  }
}

// Stage normalization (from pipeline logic)
const STAGE_NORMALIZATION = {
  'long-shot': 'longshot',
  'longshot': 'longshot',
  'application': 'application',
  'preapproved': 'qualified',
  'pre-approved': 'qualified',
  'processing': 'processing',
  'underwriting': 'underwriting',
  'approved': 'approved',
  'cleared-to-close': 'cleared-to-close',
  'ctc': 'cleared-to-close',
  'funded': 'funded',
  'post-close': 'post-close',
  'nurture': 'nurture',
  'lost': 'lost',
  'denied': 'lost',
  'paused': 'paused'
};

export function normalizeStage(stage) {
  if (!stage) return 'unknown';
  const lower = String(stage).toLowerCase().trim();
  return STAGE_NORMALIZATION[lower] || lower;
}

// KPI calculation helpers
export function calculateKPIs(contacts) {
  const kpis = {
    newLeads: 0,
    qualified: 0,
    won: 0,
    lost: 0,
    activePipeline: 0,
    totalValue: 0
  };

  contacts.forEach(contact => {
    const stage = normalizeStage(contact.stage);

    if (stage === 'longshot' || stage === 'application') {
      kpis.newLeads++;
    }
    if (stage === 'qualified' || stage === 'preapproved') {
      kpis.qualified++;
    }
    if (stage === 'funded' || stage === 'post-close') {
      kpis.won++;
      if (contact.loanAmount) {
        kpis.totalValue += parseFloat(contact.loanAmount) || 0;
      }
    }
    if (stage === 'lost' || stage === 'denied') {
      kpis.lost++;
    }
    if (!['lost', 'denied', 'funded', 'post-close', 'paused'].includes(stage)) {
      kpis.activePipeline++;
    }
  });

  return kpis;
}

// Group contacts by stage for pipeline visualization
export function groupByStage(contacts) {
  const groups = {};
  const stageOrder = [
    'longshot',
    'application',
    'qualified',
    'processing',
    'underwriting',
    'approved',
    'cleared-to-close',
    'funded',
    'post-close',
    'nurture',
    'lost',
    'paused'
  ];

  stageOrder.forEach(stage => {
    groups[stage] = [];
  });

  contacts.forEach(contact => {
    const stage = normalizeStage(contact.stage);
    if (groups[stage]) {
      groups[stage].push(contact);
    } else {
      if (!groups.other) groups.other = [];
      groups.other.push(contact);
    }
  });

  return groups;
}

// Calculate partner tier distribution
export function groupPartnersByTier(partners) {
  const tiers = {};

  partners.forEach(partner => {
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
    .filter(p => p.referralVolume || p.name)
    .sort((a, b) => (b.referralVolume || 0) - (a.referralVolume || 0))
    .slice(0, limit);
}

// Get stale deals (no update in X days)
export function getStaleDeals(contacts, days = 14) {
  const now = Date.now();
  const threshold = days * 24 * 60 * 60 * 1000;

  return contacts.filter(contact => {
    const stage = normalizeStage(contact.stage);
    if (['lost', 'funded', 'post-close'].includes(stage)) {
      return false; // Ignore completed/lost
    }

    const updated = contact.updatedAt || contact.createdAt || 0;
    return (now - updated) > threshold;
  });
}

// Get upcoming birthdays/anniversaries
export function getUpcomingCelebrations(contacts, days = 7) {
  const celebrations = [];
  const now = new Date();
  const targetDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));

  contacts.forEach(contact => {
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

// Get today's tasks
export function getTodayTasks(tasks) {
  const today = new Date().toISOString().split('T')[0];

  return tasks.filter(task => {
    if (task.completed) return false;
    if (!task.dueDate) return false;
    return task.dueDate.startsWith(today);
  });
}

// Stage display configuration
export const STAGE_CONFIG = {
  longshot: { label: 'Leads', color: '#94a3b8', icon: '👋' },
  application: { label: 'Application', color: '#06b6d4', icon: '📝' },
  qualified: { label: 'Qualified', color: '#8b5cf6', icon: '✓' },
  processing: { label: 'Processing', color: '#3b82f6', icon: '⚙️' },
  underwriting: { label: 'Underwriting', color: '#6366f1', icon: '🔍' },
  approved: { label: 'Approved', color: '#10b981', icon: '✓' },
  'cleared-to-close': { label: 'Clear to Close', color: '#059669', icon: '🎯' },
  funded: { label: 'Funded', color: '#22c55e', icon: '✓' },
  'post-close': { label: 'Post-Close', color: '#84cc16', icon: '🎉' },
  nurture: { label: 'Nurture', color: '#f59e0b', icon: '💚' },
  lost: { label: 'Lost', color: '#ef4444', icon: '✗' },
  paused: { label: 'Paused', color: '#64748b', icon: '⏸' }
};

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
export function formatNumber(num) {
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
