const DAY_MS = 86400000;

const DEFAULT_RULE = { today: false, all: true };

export const BASELINE_WIDGET_POLICY = Object.freeze({
  focus: { today: true, all: false },
  filters: { today: false, all: true },
  kpis: { today: true, all: true },
  pipeline: { today: true, all: true },
  today: { today: true, all: true },
  favorites: { today: true, all: true },
  leaderboard: { today: false, all: true },
  stale: { today: false, all: true },
  goalProgress: { today: false, all: true },
  numbersPortfolio: { today: false, all: true },
  numbersReferrals: { today: false, all: true },
  numbersMomentum: { today: false, all: true },
  pipelineCalendar: { today: false, all: true },
  todo: { today: true, all: true },
  priorityActions: { today: false, all: true },
  milestones: { today: false, all: true },
  docPulse: { today: false, all: true },
  relationshipOpportunities: { today: false, all: true },
  clientCareRadar: { today: false, all: true },
  closingWatch: { today: false, all: true },
  docCenter: { today: false, all: true }
});

export function computeWidgetVisibility(mode, widgetSettings = {}, policy = BASELINE_WIDGET_POLICY) {
  const normalizedMode = mode === 'all' ? 'all' : 'today';
  const visibility = {};
  const keys = new Set([...Object.keys(policy), ...Object.keys(widgetSettings)]);
  keys.forEach((key) => {
    const rule = policy[key] || DEFAULT_RULE;
    const allowed = rule[normalizedMode] !== false;
    const preference = widgetSettings[key];
    visibility[key] = allowed && preference !== false;
  });
  return visibility;
}

function defaultStartOfDay(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function defaultCanonicalStage(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

function defaultNameFormatter(contact) {
  if (!contact) return 'Contact';
  if (contact.displayName) return contact.displayName;
  if (contact.name) return contact.name;
  const basic = [contact.first, contact.last].filter(Boolean).join(' ').trim();
  if (basic) return basic;
  if (typeof contact === 'object') {
    if (contact.email) return contact.email;
    if (contact.phone) return contact.phone;
    if (contact.id) return contact.id;
  }
  return 'Contact';
}

function getStageTimestamp(contact, stages, canonicalStage) {
  if (!contact) return null;
  const map = contact.stageMap || {};
  for (const stage of stages) {
    const key = canonicalStage(stage);
    if (key && map[key]) return map[key];
  }
  if (contact.stage && map[contact.stage]) return map[contact.stage];
  return contact.createdTs || null;
}

function groupTasks(tasks, contactLookup) {
  const groups = new Map();
  tasks.forEach((task) => {
    if (!task || !task.contactId) return;
    if (!groups.has(task.contactId)) {
      groups.set(task.contactId, { contact: contactLookup(task.contactId), tasks: [] });
    }
    const group = groups.get(task.contactId);
    group.tasks.push(task);
  });
  const sorted = Array.from(groups.values()).map((group) => {
    group.tasks.sort((a, b) => (a.dueTs || 0) - (b.dueTs || 0)
      || String(a.title || '').localeCompare(String(b.title || ''), undefined, { numeric: true, sensitivity: 'base' }));
    return group;
  });
  return sorted.sort((a, b) => {
    const nameA = (a.contact && a.contact.displayName ? a.contact.displayName : '').toLowerCase();
    const nameB = (b.contact && b.contact.displayName ? b.contact.displayName : '').toLowerCase();
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function isAppointmentTask(task) {
  if (!task) return false;
  const raw = task.raw || {};
  const fields = [raw.type, raw.kind, raw.category, raw.appointmentType, raw.template];
  for (const field of fields) {
    if (typeof field === 'string') {
      const lower = field.toLowerCase();
      if (lower.includes('appointment')
        || lower.includes('meeting')
        || lower.includes('consult')
        || lower.includes('review')
        || lower.includes('call')) {
        return true;
      }
    }
  }
  const title = String(task.title || raw.title || raw.name || '').toLowerCase();
  return /(appointment|meeting|consult|review|call)/.test(title);
}

export function deriveBaselineSnapshot(options = {}) {
  const {
    contacts = [],
    visibleTasks = [],
    allTasks = visibleTasks,
    contactById,
    partnerById,
    pipelineLaneOrder = [],
    pipelineActiveLanes = pipelineLaneOrder,
    partnerNoneId = null,
    canonicalStage = defaultCanonicalStage,
    laneKeyFromStage = (value) => canonicalStage(value),
    now = new Date(),
    startOfDay = defaultStartOfDay,
    staleThresholdDays = 14,
    formatContactName = defaultNameFormatter
  } = options;

  const nowTs = now instanceof Date ? now.getTime() : Number(now) || Date.now();
  const todayStart = startOfDay(now) || defaultStartOfDay(now);
  const todayTs = todayStart ? todayStart.getTime() : nowTs;
  const yearStart = new Date(todayStart.getFullYear(), 0, 1).getTime();
  const sevenDaysAgo = nowTs - (7 * DAY_MS);

  const laneCounts = {};
  const laneOrder = Array.isArray(pipelineLaneOrder) ? pipelineLaneOrder.slice() : [];
  laneOrder.forEach((lane) => { laneCounts[lane] = 0; });
  const activeLaneSet = new Set(pipelineActiveLanes || []);

  let kpiNewLeads7d = 0;
  let kpiActivePipeline = 0;
  const ytdFunded = [];
  const staleDeals = [];
  const partnerStats = new Map();

  contacts.forEach((contact) => {
    if (!contact || contact.deleted) return;
    const created = contact.createdTs || 0;
    if (created && created >= sevenDaysAgo) kpiNewLeads7d += 1;
    const lane = contact.lane || laneKeyFromStage(contact.stage);
    if (!Object.prototype.hasOwnProperty.call(laneCounts, lane)) {
      laneCounts[lane] = 0;
      if (!laneOrder.includes(lane)) laneOrder.push(lane);
    }
    laneCounts[lane] += 1;
    if (activeLaneSet.has(lane)) kpiActivePipeline += 1;
    if (contact.fundedTs && contact.fundedTs >= yearStart) {
      ytdFunded.push(contact);
    }
    if (activeLaneSet.has(lane)) {
      const stageTs = contact.stageMap ? contact.stageMap[canonicalStage(contact.stage)] : null;
      const entered = stageTs
        || (contact.stageMap && contact.stageMap[laneKeyFromStage(contact.stage)])
        || (contact.stageMap && contact.stageMap[contact.stage])
        || contact.createdTs;
      if (entered) {
        const days = Math.floor((todayTs - entered) / DAY_MS);
        if (days > staleThresholdDays) {
          staleDeals.push({ contact, days });
        }
      }
    }
    const partnerIds = Array.isArray(contact.partners) ? contact.partners : [];
    if (partnerIds.length) {
      const isActive = activeLaneSet.has(lane);
      const isLost = contact.lane === 'lost' || contact.lane === 'denied';
      const isFundedYtd = contact.fundedTs && contact.fundedTs >= yearStart;
      const amount = Number(contact.loanAmount || 0) || 0;
      partnerIds.forEach((pid) => {
        if (!pid || pid === partnerNoneId) return;
        const stat = partnerStats.get(pid) || { id: pid, total: 0, active: 0, funded: 0, lost: 0, volume: 0 };
        stat.total += 1;
        if (isActive) stat.active += 1;
        if (isLost) stat.lost += 1;
        if (isFundedYtd) {
          stat.funded += 1;
          stat.volume += amount;
        }
        partnerStats.set(pid, stat);
      });
    }
  });

  const fundedVolumeYtd = ytdFunded.reduce((sum, contact) => sum + Number(contact.loanAmount || 0), 0);
  const cycleDurations = [];
  ytdFunded.forEach((contact) => {
    const fundedTs = contact.fundedTs;
    const startTs = getStageTimestamp(contact, ['long-shot', 'application', 'preapproved'], canonicalStage);
    if (fundedTs && startTs) {
      cycleDurations.push(Math.max(0, (fundedTs - startTs) / DAY_MS));
    }
  });
  const avgCycle = cycleDurations.length
    ? cycleDurations.reduce((a, b) => a + b, 0) / cycleDurations.length
    : 0;

  const dueToday = [];
  const overdue = [];
  visibleTasks.forEach((task) => {
    if (!task || !task.due) return;
    const dueStart = startOfDay(task.due);
    if (!dueStart) return;
    const diff = Math.floor((dueStart.getTime() - todayTs) / DAY_MS);
    if (diff === 0) dueToday.push(task);
    else if (diff < 0) overdue.push(task);
  });

  const dueTodaySorted = dueToday.slice().sort((a, b) => (a.dueTs || 0) - (b.dueTs || 0)
    || String(a.title || '').localeCompare(String(b.title || ''), undefined, { numeric: true, sensitivity: 'base' }));

  const appointmentCandidates = Array.isArray(allTasks) ? allTasks : visibleTasks;
  const appointments = appointmentCandidates.filter((task) => {
    if (!task || !task.dueTs) return false;
    if (task.dueTs < todayTs) return false;
    return isAppointmentTask(task);
  }).sort((a, b) => (a.dueTs || 0) - (b.dueTs || 0)
    || String(a.title || '').localeCompare(String(b.title || ''), undefined, { numeric: true, sensitivity: 'base' })).slice(0, 5);

  const recentLeads = contacts.filter((contact) => {
    if (!contact || contact.deleted) return false;
    if (!contact.createdTs) return false;
    if (activeLaneSet.has(contact.lane)) return true;
    return contact.lane === 'long-shot';
  }).sort((a, b) => (b.createdTs || 0) - (a.createdTs || 0)).slice(0, 5);

  const referralsYtd = ytdFunded.filter((contact) => Array.isArray(contact.partners) && contact.partners.length > 0).length;

  const partnerLookup = typeof partnerById === 'function'
    ? partnerById
    : (id) => ({ name: 'Partner', id });
  const leaderboard = Array.from(partnerStats.values()).map((stat) => {
    const partner = partnerLookup(stat.id) || { name: 'Partner', tier: '', company: '' };
    return {
      id: stat.id,
      name: partner.name || partner.company || 'Partner',
      tier: partner.tier || '',
      volume: stat.volume,
      fundedCount: stat.funded,
      activeCount: stat.active,
      totalCount: stat.total,
      lostCount: stat.lost,
      conversion: stat.total ? stat.funded / stat.total : 0
    };
  });

  staleDeals.sort((a, b) => b.days - a.days);

  const contactLookup = typeof contactById === 'function'
    ? contactById
    : (id) => contacts.find((contact) => contact && contact.id === id) || null;

  const withDisplayName = (contact) => {
    if (!contact) return null;
    if (contact.displayName) return contact;
    const name = formatContactName(contact);
    return Object.assign({}, contact, { displayName: name });
  };

  const focusTasksToday = dueTodaySorted.slice(0, 5);
  const focusAppointments = appointments.slice(0, 5);
  const focusRecentLeads = recentLeads.map(withDisplayName);

  return {
    contacts,
    tasks: visibleTasks,
    pipelineCounts: laneCounts,
    ytdFunded,
    staleDeals,
    leaderboard,
    focus: {
      tasksToday: focusTasksToday,
      nextAppointments: focusAppointments,
      recentLeads: focusRecentLeads
    },
    dueGroups: {
      today: groupTasks(dueToday, (id) => withDisplayName(contactLookup(id))),
      overdue: groupTasks(overdue, (id) => withDisplayName(contactLookup(id)))
    },
    kpis: {
      kpiNewLeads7d,
      kpiActivePipeline,
      kpiFundedYTD: ytdFunded.length,
      kpiFundedVolumeYTD: fundedVolumeYtd,
      kpiAvgCycleLeadToFunded: avgCycle,
      kpiTasksToday: dueToday.length,
      kpiTasksOverdue: overdue.length,
      kpiReferralsYTD: referralsYtd
    }
  };
}

export default {
  computeWidgetVisibility,
  deriveBaselineSnapshot,
  BASELINE_WIDGET_POLICY
};
