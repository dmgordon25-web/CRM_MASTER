import { deriveBaselineSnapshot } from '../../dashboard/baseline_snapshot.js';
import { getOpenTasks } from '../../tasks/task_counts.js';

export function computeTodaySnapshotFromModel(model = {}) {
  const contacts = Array.isArray(model.contacts) ? model.contacts : [];
  const partners = Array.isArray(model.partners) ? model.partners : [];
  const tasks = Array.isArray(model.tasks) ? model.tasks : [];

  const contactMap = new Map(contacts.map((contact) => [String(contact.id), contact]));
  const partnerMap = new Map(partners.map((partner) => [String(partner.id), partner]));
  const openTasks = getOpenTasks(tasks);
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
    visibleTasks: openTasks,
    allTasks: openTasks,
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
    startOfDay: typeof model.startOfDay === 'function' ? model.startOfDay : undefined
  });

  return snapshot;
}
