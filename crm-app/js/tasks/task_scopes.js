const DAY_MS = 86400000;

function normalizeDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value === undefined || value === null) return null;

  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    const dateFromNumber = new Date(asNumber);
    return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value) {
  const date = normalizeDate(value ?? Date.now());
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function taskDueStart(task) {
  if (!task) return null;
  const dueCandidate = task.due ?? task.dueDate;
  const dueTs = Number(task.dueTs);
  const dueDate = Number.isFinite(dueTs) ? new Date(dueTs) : normalizeDate(dueCandidate);
  if (!dueDate) return null;
  return new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
}

function sortTasks(tasks) {
  return tasks.slice().sort((a, b) => (a.dueTs || 0) - (b.dueTs || 0)
    || String(a.title || '').localeCompare(String(b.title || ''), undefined, { numeric: true, sensitivity: 'base' }));
}

function filterTasksByDue(tasks = [], todayDate, predicate) {
  const todayStart = startOfDay(todayDate || Date.now());
  if (!todayStart) return [];
  const todayTs = todayStart.getTime();

  const filtered = (Array.isArray(tasks) ? tasks : []).filter((task) => {
    if (!task || task.completed) return false;
    const dueStart = taskDueStart(task);
    if (!dueStart) return false;
    const diff = Math.floor((dueStart.getTime() - todayTs) / DAY_MS);
    return predicate(diff);
  });

  return sortTasks(filtered);
}

export function getTodayTasks(tasks, todayDate) {
  return filterTasksByDue(tasks, todayDate, (diff) => diff === 0);
}

export function getOverdueTasks(tasks, todayDate) {
  return filterTasksByDue(tasks, todayDate, (diff) => diff < 0);
}

export function getDueTaskGroups(tasks, todayDate) {
  return {
    today: getTodayTasks(tasks, todayDate),
    overdue: getOverdueTasks(tasks, todayDate)
  };
}

