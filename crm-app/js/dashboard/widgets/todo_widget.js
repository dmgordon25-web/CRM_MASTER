import { normalizeStatus } from '../../pipeline/constants.js';

const TODO_STYLE_ID = 'todo-widget-style';

function ensureTodoStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(TODO_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TODO_STYLE_ID;
  style.textContent = `
    .todo-widget-shell { display:flex; flex-direction:column; gap:12px; padding:14px; background:linear-gradient(135deg, #f8fafc, #eef2ff); border:1px solid #e5e7eb; border-radius:14px; box-shadow:0 10px 30px rgba(55, 65, 81, 0.04); }
    .todo-head { display:flex; align-items:flex-start; gap:12px; }
    .todo-icon { width:40px; height:40px; border-radius:12px; display:grid; place-items:center; background:#e0e7ff; color:#4338ca; font-size:20px; box-shadow:inset 0 1px 0 rgba(255,255,255,0.6); }
    .todo-heading { display:flex; flex-direction:column; gap:4px; }
    .todo-heading h4 { margin:0; font-size:17px; line-height:1.3; font-weight:700; letter-spacing:-0.01em; }
    .todo-heading p { margin:0; color:#6b7280; font-size:13px; line-height:1.45; }
    .todo-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
    .todo-item { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:10px 12px; box-shadow:0 4px 12px rgba(0,0,0,0.03); }
    .todo-row { display:flex; align-items:center; gap:10px; }
    .todo-row input[type="checkbox"] { width:18px; height:18px; accent-color:#10b981; flex-shrink:0; }
    .todo-title { font-weight:600; color:#111827; flex:1; }
    .todo-meta { color:#6b7280; font-size:12px; font-weight:500; }
    .todo-add { display:flex; gap:10px; align-items:center; padding:10px 12px; background:#fff; border:1px dashed #cbd5e1; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.02); }
    .todo-add input[type="text"] { border:1px solid #d1d5db; border-radius:10px; padding:10px 12px; font-size:14px; background:#f9fafb; }
    .todo-add input[type="text"]:focus { outline:2px solid #c7d2fe; border-color:#a5b4fc; background:#fff; }
    .todo-add button { border-radius:10px; padding:10px 14px; font-weight:600; background:#4f46e5; color:#fff; border:1px solid #4338ca; box-shadow:0 6px 16px rgba(79,70,229,0.25); }
    .todo-add button:disabled { opacity:0.6; cursor:not-allowed; }
    .todo-empty { display:flex; align-items:center; gap:10px; padding:10px 12px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; color:#4b5563; font-size:14px; box-shadow:inset 0 1px 0 rgba(255,255,255,0.7); }
    .todo-empty .todo-empty-icon { width:28px; height:28px; display:grid; place-items:center; border-radius:8px; background:#e0f2fe; color:#0369a1; }
    .todo-footer-hint { color:#6b7280; font-size:13px; margin:0; display:flex; align-items:center; gap:6px; }
    .todo-footer-hint .dot { width:6px; height:6px; border-radius:999px; background:#10b981; display:inline-block; }
  `;
  document.head.appendChild(style);
}

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
  empty.className = 'todo-empty';
  const icon = document.createElement('div');
  icon.className = 'todo-empty-icon';
  icon.textContent = '🗒️';
  const text = document.createElement('div');
  text.textContent = 'Nothing to do — add a task to get started.';
  empty.appendChild(icon);
  empty.appendChild(text);
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

  ensureTodoStyles();
  root.innerHTML = '';
  root.classList.add('todo-widget');

  const shell = document.createElement('div');
  shell.className = 'todo-widget-shell';

  const header = document.createElement('div');
  header.className = 'todo-head';
  const icon = document.createElement('div');
  icon.className = 'todo-icon';
  icon.textContent = '✅';
  const heading = document.createElement('div');
  heading.className = 'todo-heading';
  const title = document.createElement('h4');
  title.textContent = 'To-Do';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Check off quick follow-ups or add a new task without leaving the dashboard.';
  heading.appendChild(title);
  heading.appendChild(subtitle);
  header.appendChild(icon);
  header.appendChild(heading);
  shell.appendChild(header);

  const addForm = document.createElement('form');
  addForm.className = 'todo-add';
  addForm.setAttribute('aria-label', 'Add a new task');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Describe the task to prefill the modal';
  input.setAttribute('data-qa', 'todo-add-task-input');
  input.style.flex = '1';
  input.style.minWidth = '0';
  const addButton = document.createElement('button');
  addButton.type = 'submit';
  addButton.textContent = adding ? 'Opening…' : 'Add Task';
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
      .finally(() => { addButton.disabled = false; addButton.textContent = 'Add Task'; });
  });
  shell.appendChild(addForm);

  const list = document.createElement('ul');
  list.className = 'todo-list';

  if (tasks.length === 0) {
    renderEmptyState(list);
  } else {
    tasks.forEach((task) => {
      list.appendChild(renderTaskItem(task, options));
    });
  }

  shell.appendChild(list);

  const footer = document.createElement('p');
  footer.className = 'todo-footer-hint';
  const dot = document.createElement('span');
  dot.className = 'dot';
  footer.appendChild(dot);
  footer.appendChild(document.createTextNode(' Completed tasks stay in the record; reopen via the Tasks view if needed.'));
  shell.appendChild(footer);

  root.appendChild(shell);
}
