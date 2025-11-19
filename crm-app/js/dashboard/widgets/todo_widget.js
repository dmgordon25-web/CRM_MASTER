const TODO_STYLE_ID = 'todo-widget-style';
const TODO_STORAGE_KEY = 'crm.todoWidget.items';

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
    .todo-title { font-weight:600; color:#111827; flex:1; word-break:break-word; }
    .todo-add { display:flex; gap:10px; align-items:center; padding:10px 12px; background:#fff; border:1px dashed #cbd5e1; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.02); }
    .todo-add input[type="text"] { border:1px solid #d1d5db; border-radius:10px; padding:10px 12px; font-size:14px; background:#f9fafb; width:100%; }
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

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseItems(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const id = item.id ? String(item.id) : null;
        const text = item.text ? String(item.text).trim() : '';
        if (!id || !text) return null;
        return { id, text, createdAt: item.createdAt || item.created_at || null };
      })
      .filter(Boolean);
  } catch (_err) {
    return [];
  }
}

export function loadTodoItems() {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(TODO_STORAGE_KEY);
  return parseItems(raw);
}

export function saveTodoItems(items) {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload = Array.isArray(items) ? items : [];
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(payload));
  } catch (_err) {
    /* ignore storage errors */
  }
}

function renderEmptyState(list) {
  const empty = document.createElement('li');
  empty.className = 'todo-empty';
  const icon = document.createElement('div');
  icon.className = 'todo-empty-icon';
  icon.textContent = '🗒️';
  const text = document.createElement('div');
  text.textContent = 'No to-dos yet. Add a quick note or checklist item.';
  empty.appendChild(icon);
  empty.appendChild(text);
  list.appendChild(empty);
}

function renderItem(item, { onRemove }) {
  const row = document.createElement('li');
  row.className = 'todo-item';
  const label = document.createElement('label');
  label.className = 'todo-row';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.setAttribute('aria-label', `Complete ${item.text || 'item'}`);
  const title = document.createElement('span');
  title.className = 'todo-title';
  title.textContent = item.text || '';
  label.appendChild(checkbox);
  label.appendChild(title);
  row.appendChild(label);

  if (typeof onRemove === 'function') {
    checkbox.addEventListener('change', () => onRemove(item));
  }

  return row;
}

export function renderTodoWidget(options = {}) {
  const root = options.root || options.host || null;
  if (!root || typeof document === 'undefined') return;

  ensureTodoStyles();
  root.innerHTML = '';
  root.classList.add('todo-widget');

  try {
    root.classList.remove('hidden');
    const card = root.closest('.insight-card');
    if (card && card.classList) {
      card.classList.remove('hidden');
    }
  } catch (_err) { /* safe guard */ }

  const items = loadTodoItems();

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
  title.textContent = 'To-do';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Keep quick notes and checklist items right on your dashboard.';
  heading.appendChild(title);
  heading.appendChild(subtitle);
  header.appendChild(icon);
  header.appendChild(heading);
  shell.appendChild(header);

  const list = document.createElement('ul');
  list.className = 'todo-list';

  if (items.length === 0) {
    renderEmptyState(list);
  } else {
    items.forEach((item) => {
      list.appendChild(renderItem(item, {
        onRemove: (target) => {
          const next = items.filter((entry) => entry.id !== target.id);
          saveTodoItems(next);
          renderTodoWidget(options);
        }
      }));
    });
  }

  shell.appendChild(list);

  const addForm = document.createElement('form');
  addForm.className = 'todo-add';
  addForm.setAttribute('aria-label', 'Add a new to-do item');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Add a quick note or checklist item';
  input.setAttribute('data-qa', 'todo-add-task-input');
  input.style.flex = '1';
  input.style.minWidth = '0';
  const addButton = document.createElement('button');
  addButton.type = 'submit';
  addButton.textContent = 'Add';
  addButton.setAttribute('data-qa', 'todo-add-task');
  addForm.appendChild(input);
  addForm.appendChild(addButton);

  addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value ? input.value.trim() : '';
    if (!value) return;
    const nextItems = items.concat([{ id: generateId(), text: value, createdAt: new Date().toISOString() }]);
    saveTodoItems(nextItems);
    renderTodoWidget(options);
  });

  shell.appendChild(addForm);

  const footer = document.createElement('p');
  footer.className = 'todo-footer-hint';
  const dot = document.createElement('span');
  dot.className = 'dot';
  footer.appendChild(dot);
  footer.appendChild(document.createTextNode(' Items stay here until you check them off.')); 
  shell.appendChild(footer);

  root.appendChild(shell);
}
