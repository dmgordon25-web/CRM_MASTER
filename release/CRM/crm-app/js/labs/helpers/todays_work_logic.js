import { deriveBaselineSnapshot } from '../../dashboard/baseline_snapshot.js';

function parseDate(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;
  if (typeof value === 'string' && value.length === 10) {
    const iso = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(iso.getTime())) return iso;
  }
  return null;
}

function startOfDay(date) {
  const d = date instanceof Date ? date : parseDate(date);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function normalizeTasksForToday(tasks = []) {
  return (Array.isArray(tasks) ? tasks : []).filter((task) => {
    if (!task || task.deleted) return false;
    if (task.done === true || task.completed === true) return false;
    return true;
  });
}

export function computeTodaySnapshotFromModel(model = {}) {
  const contacts = Array.isArray(model.contacts) ? model.contacts : [];
  const partners = Array.isArray(model.partners) ? model.partners : [];
  const tasks = normalizeTasksForToday(model.tasks);

  const contactMap = new Map(contacts.map((contact) => [String(contact.id), contact]));
  const partnerMap = new Map(partners.map((partner) => [String(partner.id), partner]));
  const laneOrder = Array.isArray(model.laneOrder)
    ? model.laneOrder
    : Array.isArray(model.pipelineLaneOrder)
      ? model.pipelineLaneOrder
      : [];
  const activeLaneOrder = Array.isArray(model.activeLaneOrder)
    ? model.activeLaneOrder
    : Array.isArray(model.pipelineActiveLanes)
      ? model.pipelineActiveLanes
      : laneOrder;

  const snapshot = deriveBaselineSnapshot({
    contacts,
    visibleTasks: tasks,
    allTasks: Array.isArray(model.tasks) ? model.tasks : tasks,
    contactById: (id) => contactMap.get(String(id)) || null,
    partnerById: (id) => partnerMap.get(String(id)) || null,
    pipelineLaneOrder: laneOrder,
    pipelineActiveLanes: activeLaneOrder,
    partnerNoneId: model.partnerNoneId || null,
    canonicalStage: typeof model.canonicalStage === 'function' ? model.canonicalStage : undefined,
    laneKeyFromStage: typeof model.laneKeyFromStage === 'function' ? model.laneKeyFromStage : undefined,
    formatContactName: typeof model.getContactDisplayName === 'function'
      ? model.getContactDisplayName
      : (typeof model.resolveContactNameStrict === 'function' ? model.resolveContactNameStrict : undefined),
    now: model.today ? new Date(model.today) : new Date(),
    startOfDay: typeof model.startOfDay === 'function' ? model.startOfDay : startOfDay
  });

  return snapshot;
}
