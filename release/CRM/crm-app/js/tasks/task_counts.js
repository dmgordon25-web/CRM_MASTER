// Canonical task count helpers shared across CRM surfaces.
// These helpers intentionally avoid DOM access and operate purely on task data.
// Rule: only tasks that are not completed/done/archived/cancelled contribute to counts.

import { getTodayTasks, getOverdueTasks } from './task_scopes.js';

function normalizeStatus(task) {
  const raw = task && (task.status || task.state || task.raw?.status);
  return raw ? String(raw).trim().toLowerCase() : '';
}

function isCountableTask(task) {
  if (!task || task.deleted) return false;
  if (task.completed || task.done === true) return false;
  const status = normalizeStatus(task);
  if (status === 'done' || status === 'completed' || status === 'archived') return false;
  if (status === 'cancelled' || status === 'canceled') return false;
  return true;
}

function filterOpenTasks(tasks = []) {
  return (Array.isArray(tasks) ? tasks : []).filter(isCountableTask);
}

export function countTodayTasks(tasks, todayDate) {
  return getTodayTasks(filterOpenTasks(tasks), todayDate).length;
}

export function countOverdueTasks(tasks, todayDate) {
  return getOverdueTasks(filterOpenTasks(tasks), todayDate).length;
}

export function countOpenTasks(tasks) {
  return filterOpenTasks(tasks).length;
}

export function getOpenTasks(tasks) {
  return filterOpenTasks(tasks);
}

export default {
  countTodayTasks,
  countOverdueTasks,
  countOpenTasks,
  getOpenTasks
};
