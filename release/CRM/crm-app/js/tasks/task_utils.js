// crm-app/js/tasks/task_utils.js
// Shared helpers for task scheduling and follow-up suggestions.

import { followUpCadenceDaysForStage, DEFAULT_STAGE_FOLLOW_UP_DAYS } from '../pipeline/constants.js';

const DAY_MS = 86400000;

function normalizeDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const date = new Date(value.getTime());
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }
  const raw = new Date(value);
  if (Number.isNaN(raw.getTime())) return null;
  raw.setHours(0, 0, 0, 0);
  return raw;
}

export function suggestFollowUpSchedule(options = {}) {
  const {
    stage,
    lastActivity,
    existingDue,
    today = new Date(),
    fallbackDays = DEFAULT_STAGE_FOLLOW_UP_DAYS
  } = options;

  const reference = normalizeDateOnly(today) || normalizeDateOnly(new Date());
  const cadenceDays = followUpCadenceDaysForStage(stage);
  const offsetDays = Number.isFinite(cadenceDays) ? cadenceDays : fallbackDays;

  const lastActivityDate = normalizeDateOnly(lastActivity);
  const existingDueDate = normalizeDateOnly(existingDue);

  let dueDate = null;
  if (lastActivityDate) {
    dueDate = new Date(lastActivityDate);
    dueDate.setDate(dueDate.getDate() + offsetDays);
    if (dueDate < reference) {
      dueDate = new Date(reference);
    }
  } else if (existingDueDate && existingDueDate >= reference) {
    dueDate = existingDueDate;
  }

  if (!dueDate) {
    dueDate = new Date(reference);
    dueDate.setDate(dueDate.getDate() + offsetDays);
  }

  const isoDue = dueDate.toISOString().slice(0, 10);
  const daysSinceLastActivity = lastActivityDate
    ? Math.floor((reference - lastActivityDate) / DAY_MS)
    : null;

  return {
    dueDate,
    isoDue,
    offsetDays,
    referenceDate: reference,
    lastActivityDate,
    existingDueDate,
    daysSinceLastActivity
  };
}

export function describeFollowUpCadence({
  stageLabel,
  suggestion
}) {
  if (!suggestion) return '';
  const parts = [];
  if (stageLabel) parts.push(stageLabel);
  if (suggestion.daysSinceLastActivity != null && Number.isFinite(suggestion.daysSinceLastActivity)) {
    parts.push(`${suggestion.daysSinceLastActivity}d since touch`);
  } else {
    parts.push('No recorded touch');
  }
  if (suggestion.offsetDays != null && Number.isFinite(suggestion.offsetDays)) {
    parts.push(`+${suggestion.offsetDays}d cadence`);
  }
  return parts.join(' • ');
}

export { DAY_MS };

