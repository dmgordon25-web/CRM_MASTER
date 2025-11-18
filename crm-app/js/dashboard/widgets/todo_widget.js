import { normalizeStatus } from '../../pipeline/constants.js';

function normalizeTaskStatus(task) {
  const raw = task && (task.status || task.raw?.status || task.state);
  return raw ? normalizeStatus(raw) : '';
}

function readDueDate(task) {
  const raw = task && (task.due || task.dueDate || task.date);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  if (typeof raw === 'string' && raw.length === 10) {
    const alt = new Date(`${raw}T00:00:00`);
    if (!Number.isNaN(alt.getTime())) return alt;
  }
  return null;
}

function taskSortKey(task) {
  const due = readDueDate(task);
  const dueTs = due ? due.getTime() : Number.MAX_SAFE_INTEGER;
  const created = Number(task?.createdAt || task?.created || task?.createdTs);
  const createdTs = Number.isFinite(created) ? created : Number.MAX_SAFE_INTEGER;
  return { dueTs, createdTs, title: String(task?.title || task?.note || task?.text || '').toLowerCase() };
}

export function getTodoTasksForDashboard(allTasks = [], options = {}) {
  const limit = Number.isFinite(options.limit) ? Math.max(1, options.limit) : 10;
  const filtered = (Array.isArray(allTasks) ? allTasks : []).filter((task) => {
    if (!task || task.deleted) return false;
    const status = normalizeTaskStatus(task);
    const done = task.done === true || status === 'done' || status === 'completed';
    if (done) return false;
    if (status === 'archived' || status === 'cancelled' || status === 'canceled') return false;
    const kind = (task.kind || task.type || '').toString().toLowerCase();
    if (kind && kind.includes('note')) return false;
    return true;
  });

  const sorted = filtered.sort((a, b) => {
    const aKey = taskSortKey(a);
    const bKey = taskSortKey(b);
    if (aKey.dueTs !== bKey.dueTs) return aKey.dueTs - bKey.dueTs;
    if (aKey.createdTs !== bKey.createdTs) return aKey.createdTs - bKey.createdTs;
    return aKey.title.localeCompare(bKey.title, undefined, { numeric: true, sensitivity: 'base' });
  });
  return sorted.slice(0, limit);
}

function renderEmptyState(list) {
  const empty = document.createElement('li');
  empty.className = 'empty';
  empty.textContent = 'Nothing to do — add a task to get started.';
  list.appendChild(empty);
}

function renderTaskItem(task, options) {
  const item = document.createElement('li');
  item.className = 'todo-item';
  const label = document.createElement('label');
  label.className = 'todo-row';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task && task.done === true;
  checkbox.setAttribute('aria-label', `Complete ${task.title || 'task'}`);
  const busyIds = Array.isArray(options?.busyIds) ? new Set(options.busyIds) : (options?.busyIds || new Set());
  if (busyIds.has(String(task.id || ''))) {
    checkbox.disabled = true;
  }
  const title = document.createElement('span');
  title.className = 'todo-title';
  title.textContent = task.title || task.note || task.text || 'Task';
  const meta = document.createElement('span');
  meta.className = 'todo-meta';
  const due = readDueDate(task);
  meta.textContent = due ? due.toISOString().slice(0, 10) : '';
  label.appendChild(checkbox);
  label.appendChild(title);
  label.appendChild(meta);
  item.appendChild(label);

  if (typeof options?.onToggle === 'function') {
    checkbox.addEventListener('change', () => {
      if (checkbox.disabled) return;
      const nextChecked = checkbox.checked === true;
      checkbox.disabled = true;
      Promise.resolve()
        .then(() => options.onToggle(task, nextChecked))
        .catch(() => { checkbox.checked = !nextChecked; })
        .finally(() => { checkbox.disabled = false; });
    });
  }
  return item;
}

export function renderTodoWidget(options = {}) {
  const root = options.root || options.host || null;
  if (!root) return;
  const tasks = Array.isArray(options.tasks) ? options.tasks : [];
  const adding = options.adding === true;

  root.innerHTML = '';
  root.classList.add('todo-widget');

  const header = document.createElement('div');
  header.className = 'row';
  header.style.alignItems = 'center';
  header.style.gap = '8px';
  const title = document.createElement('strong');
  title.textContent = 'To-Do';
  title.style.fontSize = '16px';
  title.style.lineHeight = '1.4';
  header.appendChild(title);
  header.appendChild(document.createElement('span')).className = 'grow';

  const addForm = document.createElement('form');
  addForm.className = 'todo-add';
  addForm.setAttribute('aria-label', 'Add a new task');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Add a task';
  input.setAttribute('data-qa', 'todo-add-task-input');
  input.style.flex = '1';
  input.style.minWidth = '0';
  const addButton = document.createElement('button');
  addButton.type = 'submit';
  addButton.className = 'btn subtle';
  addButton.textContent = adding ? 'Saving…' : 'Add';
  addButton.setAttribute('data-qa', 'todo-add-task');
  addButton.disabled = adding;
  addForm.appendChild(input);
  addForm.appendChild(addButton);
  addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (typeof options.onAdd !== 'function' || addButton.disabled) return;
    const value = input.value ? input.value.trim() : '';
    if (!value) return;
    addButton.disabled = true;
    Promise.resolve()
      .then(() => options.onAdd(value))
      .then((ok) => { if (ok !== false) input.value = ''; })
      .catch(() => {})
      .finally(() => { addButton.disabled = false; addButton.textContent = 'Add'; });
  });
  header.appendChild(addForm);
  root.appendChild(header);

  const list = document.createElement('ul');
  list.className = 'todo-list';
  list.style.listStyle = 'none';
  list.style.padding = '0';
  list.style.margin = '12px 0 0';
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '8px';

  if (tasks.length === 0) {
    renderEmptyState(list);
  } else {
    tasks.forEach((task) => {
      list.appendChild(renderTaskItem(task, options));
    });
  }

  root.appendChild(list);
}
