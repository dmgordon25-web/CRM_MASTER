import { Templates } from '../email/templates_store.js';
import { compile, sampleData } from '../email/merge_vars.js';

const fromHere = (p) => new URL(p, import.meta.url).href;
const PLACEHOLDER_KEYS = [
  '{{FirstName}}',
  '{{LastName}}',
  '{{FullName}}',
  '{{PreferredName}}',
  '{{AgentName}}',
  '{{LoanOfficerName}}',
  '{{Company}}',
  '{{TodayDate}}',
  '{{CloseDate}}',
  '{{PreapprovalExpiryDate}}',
  '{{LoanAmount}}',
  '{{PropertyAddress}}',
];

function onNodeRemoved(node, callback) {
  if (!node || typeof callback !== 'function' || typeof MutationObserver !== 'function') {
    return () => {};
  }
  let done = false;
  const observer = new MutationObserver(() => {
    if (done || node.isConnected) return;
    done = true;
    observer.disconnect();
    try { callback(); } catch (_) {}
  });
  observer.observe(node.ownerDocument?.body || document.body, { childList: true, subtree: true });
  return () => {
    if (done) return;
    done = true;
    observer.disconnect();
  };
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function snippet(text, limit = 80) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  if (!source) return '';
  if (source.length <= limit) return source;
  return `${source.slice(0, Math.max(0, limit - 3))}...`;
}

function buildLayout(root) {
  root.innerHTML = `
    <section data-role="automation-templates" aria-label="Automation Templates" style="display:flex;flex-direction:column;gap:16px;">
      <header style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="flex:1 1 auto;">
          <h3 style="margin:0;font-size:20px;">Automation / Templates</h3>
          <p style="margin:4px 0 0;font-size:13px;color:var(--muted,#475569);">
            Manage reusable email content for automation triggers and quick outreach.
          </p>
        </div>
        <button type="button" data-action="new" class="btn brand" style="align-self:flex-start;">New Template</button>
      </header>
      <div style="display:grid;grid-template-columns:320px 1fr;gap:20px;align-items:flex-start;">
        <aside data-role="list-panel" style="display:flex;flex-direction:column;gap:12px;border:1px solid rgba(15,23,42,0.08);border-radius:12px;padding:12px;">
          <label style="display:block;width:100%;">
            <span class="muted" style="display:block;font-size:12px;margin-bottom:4px;">Search</span>
            <input type="search" data-role="search" placeholder="Search templates" style="width:100%;padding:8px 10px;border:1px solid rgba(15,23,42,0.16);border-radius:8px;font:inherit;" />
          </label>
          <div data-role="list" style="display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto;">
            <div data-role="empty" class="muted" style="font-size:13px;">No templates yet. Click "New Template" to create your first one.</div>
          </div>
        </aside>
        <section data-role="editor" style="border:1px solid rgba(15,23,42,0.08);border-radius:12px;padding:16px;min-height:420px;">
          <div data-role="placeholder" class="muted" style="font-size:14px;">Select a template to edit, or create a new one.</div>
        </section>
      </div>
    </section>
  `;
}

function renderList(listContainer, items, selectedId) {
  const list = listContainer.querySelector('[data-role="list"]');
  const empty = listContainer.querySelector('[data-role="empty"]');
  list.innerHTML = '';
  if (!items.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  items.forEach((item) => {
    const row = document.createElement('div');
    row.dataset.id = item.id;
    row.setAttribute('data-role', 'row');
    row.style.display = 'flex';
    row.style.alignItems = 'flex-start';
    row.style.gap = '6px';
    row.style.padding = '8px';
    row.style.border = '1px solid rgba(15,23,42,0.08)';
    row.style.borderRadius = '10px';
    row.style.background = selectedId === item.id ? 'rgba(59,130,246,0.08)' : '#fff';

    const select = document.createElement('button');
    select.type = 'button';
    select.dataset.action = 'select';
    select.dataset.id = item.id;
    select.style.flex = '1';
    select.style.textAlign = 'left';
    select.style.border = 'none';
    select.style.background = 'transparent';
    select.style.padding = '0';
    select.style.fontSize = '14px';
    select.style.cursor = 'pointer';
    select.innerHTML = `
      <strong style="display:block;font-weight:600;color:var(--text-strong,#0f172a);">${escapeHtml(item.name || 'Untitled')}</strong>
      <span class="muted" style="display:block;font-size:12px;color:var(--muted,#64748b);">
        ${escapeHtml(snippet(item.subject || item.body || ''))}
      </span>
    `;

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '4px';

    const fav = document.createElement('button');
    fav.type = 'button';
    fav.dataset.action = 'fav';
    fav.dataset.id = item.id;
    fav.textContent = item.fav ? '★' : '☆';
    fav.title = item.fav ? 'Remove favorite' : 'Mark as favorite';
    fav.style.border = 'none';
    fav.style.background = 'transparent';
    fav.style.cursor = 'pointer';
    fav.style.fontSize = '16px';

    const duplicate = document.createElement('button');
    duplicate.type = 'button';
    duplicate.dataset.action = 'duplicate';
    duplicate.dataset.id = item.id;
    duplicate.textContent = 'Duplicate';
    duplicate.style.fontSize = '12px';
    duplicate.style.border = '1px solid rgba(15,23,42,0.18)';
    duplicate.style.borderRadius = '999px';
    duplicate.style.padding = '4px 10px';
    duplicate.style.background = '#fff';
    duplicate.style.cursor = 'pointer';

    const del = document.createElement('button');
    del.type = 'button';
    del.dataset.action = 'delete';
    del.dataset.id = item.id;
    del.textContent = 'Delete';
    del.style.fontSize = '12px';
    del.style.border = '1px solid rgba(239,68,68,0.5)';
    del.style.borderRadius = '999px';
    del.style.padding = '4px 10px';
    del.style.background = '#fff';
    del.style.color = '#b91c1c';
    del.style.cursor = 'pointer';

    actions.append(fav, duplicate, del);
    row.append(select, actions);
    list.appendChild(row);
  });
}

function renderEditor(editorContainer, record) {
  editorContainer.innerHTML = '';
  editorContainer.dataset.id = record ? record.id : '';
  if (!record) {
    const placeholder = document.createElement('div');
    placeholder.textContent = 'Select a template to edit, or create a new one.';
    placeholder.className = 'muted';
    placeholder.style.fontSize = '14px';
    editorContainer.appendChild(placeholder);
    return;
  }

  const form = document.createElement('form');
  form.dataset.role = 'editor-form';
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '12px';

  const nameField = document.createElement('label');
  nameField.innerHTML = `<span style="display:block;font-size:12px;color:var(--muted,#475569);">Template name</span>`;
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.dataset.field = 'name';
  nameInput.value = record.name || '';
  nameInput.style.width = '100%';
  nameInput.style.padding = '8px 10px';
  nameInput.style.border = '1px solid rgba(15,23,42,0.16)';
  nameInput.style.borderRadius = '8px';
  nameInput.style.font = 'inherit';
  nameField.appendChild(nameInput);

  const subjectField = document.createElement('label');
  subjectField.innerHTML = `<span style="display:block;font-size:12px;color:var(--muted,#475569);">Subject</span>`;
  const subjectInput = document.createElement('input');
  subjectInput.type = 'text';
  subjectInput.dataset.field = 'subject';
  subjectInput.placeholder = 'Supports {{Placeholders}}';
  subjectInput.value = record.subject || '';
  subjectInput.style.width = '100%';
  subjectInput.style.padding = '8px 10px';
  subjectInput.style.border = '1px solid rgba(15,23,42,0.16)';
  subjectInput.style.borderRadius = '8px';
  subjectInput.style.font = 'inherit';
  subjectField.appendChild(subjectInput);

  const bodyField = document.createElement('label');
  bodyField.innerHTML = `<span style="display:block;font-size:12px;color:var(--muted,#475569);">Body</span>`;
  const textarea = document.createElement('textarea');
  textarea.dataset.field = 'body';
  textarea.value = record.body || '';
  textarea.style.width = '100%';
  textarea.style.minHeight = '220px';
  textarea.style.padding = '10px';
  textarea.style.border = '1px solid rgba(15,23,42,0.16)';
  textarea.style.borderRadius = '8px';
  textarea.style.font = 'inherit';
  textarea.style.resize = 'vertical';
  bodyField.appendChild(textarea);

  const hint = document.createElement('div');
  hint.className = 'muted';
  hint.style.fontSize = '12px';
  hint.innerHTML = `Available placeholders: ${PLACEHOLDER_KEYS.map(escapeHtml).join(', ')}`;

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '8px';
  controls.style.flexWrap = 'wrap';
  controls.style.justifyContent = 'flex-end';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.dataset.action = 'save';
  saveBtn.className = 'btn brand';
  saveBtn.textContent = 'Save changes';

  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.dataset.action = 'preview';
  previewBtn.textContent = 'Preview sample';
  previewBtn.style.border = '1px solid rgba(15,23,42,0.18)';
  previewBtn.style.borderRadius = '999px';
  previewBtn.style.padding = '6px 14px';
  previewBtn.style.background = '#fff';
  previewBtn.style.cursor = 'pointer';

  const duplicateBtn = document.createElement('button');
  duplicateBtn.type = 'button';
  duplicateBtn.dataset.action = 'duplicate';
  duplicateBtn.textContent = 'Duplicate';
  duplicateBtn.style.border = '1px solid rgba(15,23,42,0.18)';
  duplicateBtn.style.borderRadius = '999px';
  duplicateBtn.style.padding = '6px 14px';
  duplicateBtn.style.background = '#fff';
  duplicateBtn.style.cursor = 'pointer';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.dataset.action = 'delete';
  deleteBtn.textContent = 'Delete';
  deleteBtn.style.border = '1px solid rgba(239,68,68,0.4)';
  deleteBtn.style.borderRadius = '999px';
  deleteBtn.style.padding = '6px 14px';
  deleteBtn.style.background = '#fff';
  deleteBtn.style.color = '#b91c1c';
  deleteBtn.style.cursor = 'pointer';

  controls.append(previewBtn, duplicateBtn, deleteBtn, saveBtn);

  const preview = document.createElement('div');
  preview.dataset.role = 'preview';
  preview.style.marginTop = '12px';
  preview.style.padding = '12px';
  preview.style.border = '1px dashed rgba(15,23,42,0.18)';
  preview.style.borderRadius = '10px';
  preview.style.background = 'rgba(148,163,184,0.08)';
  preview.style.display = 'none';
  preview.style.whiteSpace = 'pre-wrap';
  preview.style.fontSize = '13px';

  form.append(nameField, subjectField, bodyField, hint, controls, preview);
  editorContainer.appendChild(form);
}

function filterTemplates(items, term) {
  const query = term.trim().toLowerCase();
  if (!query) return items.slice();
  return items.filter((item) => {
    const haystack = `${item.name || ''} ${item.subject || ''} ${item.body || ''}`.toLowerCase();
    return haystack.includes(query);
  });
}

function pickNext(items, selectedId) {
  if (!items.length) return '';
  if (selectedId && items.some((item) => item.id === selectedId)) return selectedId;
  return items[0].id;
}

export function renderEmailTemplates(root) {
  if (!root) return;
  buildLayout(root);
  const section = root.querySelector('[data-role="automation-templates"]');
  const listPanel = section.querySelector('[data-role="list-panel"]');
  const editor = section.querySelector('[data-role="editor"]');
  const searchInput = section.querySelector('[data-role="search"]');
  let selectedId = '';
  let searchTerm = '';
  let currentItems = [];

  function sync(stateItems) {
    currentItems = Array.isArray(stateItems) ? stateItems.slice() : [];
    const filtered = filterTemplates(currentItems, searchTerm);
    selectedId = pickNext(filtered, selectedId);
    renderList(listPanel, filtered, selectedId);
    const active = currentItems.find((item) => item.id === selectedId) || null;
    renderEditor(editor, active);
  }

  const unsubscribe = Templates.subscribe((state) => {
    sync(state.items || []);
  });

  Templates.ready?.().catch(() => {});

  searchInput.addEventListener('input', (evt) => {
    searchTerm = evt.target.value || '';
    const filtered = filterTemplates(currentItems, searchTerm);
    selectedId = pickNext(filtered, selectedId);
    renderList(listPanel, filtered, selectedId);
    const active = currentItems.find((item) => item.id === selectedId) || null;
    renderEditor(editor, active);
  });

  listPanel.addEventListener('click', (evt) => {
    const actionEl = evt.target.closest('[data-action]');
    if (!actionEl) return;
    const { action, id } = actionEl.dataset;
    if (!id) return;
    if (action === 'select') {
      selectedId = id;
      const active = currentItems.find((item) => item.id === selectedId) || null;
      renderList(listPanel, filterTemplates(currentItems, searchTerm), selectedId);
      renderEditor(editor, active);
      return;
    }
    if (action === 'fav') {
      const record = Templates.get(id);
      if (record) Templates.markFav(id, !record.fav);
      return;
    }
    if (action === 'duplicate') {
      const source = Templates.get(id);
      if (!source) return;
      const clone = Templates.upsert({
        name: `${source.name || 'Untitled'} (Copy)`,
        subject: source.subject || '',
        body: source.body || '',
        fav: !!source.fav,
      });
      selectedId = clone.id;
      return;
    }
    if (action === 'delete') {
      const row = currentItems.find((item) => item.id === id);
      if (!row) return;
      if (confirm(`Delete "${row.name || 'Untitled template'}"?`)) {
        Templates.remove(id);
        if (selectedId === id) selectedId = '';
      }
    }
  });

  editor.addEventListener('submit', (evt) => {
    const form = evt.target.closest('form[data-role="editor-form"]');
    if (!form) return;
    evt.preventDefault();
    const id = editor.dataset.id || '';
    const name = form.querySelector('[data-field="name"]').value.trim();
    const subject = form.querySelector('[data-field="subject"]').value;
    const body = form.querySelector('[data-field="body"]').value;
    const record = Templates.upsert({ id, name, subject, body });
    selectedId = record.id;
    try {
      import(fromHere('../notifications/notifier.js')).then((mod) => {
        mod?.pushNotification?.({ type: 'templates', title: 'Template saved' });
      }).catch(() => {});
    } catch (_) {}
  });

  editor.addEventListener('click', async (evt) => {
    const button = evt.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const currentId = editor.dataset.id || '';
    if (action === 'preview') {
      const form = editor.querySelector('form[data-role="editor-form"]');
      if (!form) return;
      const subject = form.querySelector('[data-field="subject"]').value;
      const body = form.querySelector('[data-field="body"]').value;
      const preview = form.querySelector('[data-role="preview"]');
      if (!preview) return;
      preview.style.display = 'block';
      preview.textContent = 'Generating preview…';
      try {
        const data = await sampleData();
        const compiledSubject = compile(subject, data);
        const compiledBody = compile(body, data);
        preview.textContent = `Subject: ${compiledSubject}\n\n${compiledBody}`;
      } catch (err) {
        preview.textContent = `Preview unavailable: ${err?.message || err}`;
      }
      return;
    }
    if (action === 'duplicate' && currentId) {
      const source = Templates.get(currentId);
      if (!source) return;
      const copy = Templates.upsert({
        name: `${source.name || 'Untitled'} (Copy)`,
        subject: source.subject || '',
        body: source.body || '',
        fav: !!source.fav,
      });
      selectedId = copy.id;
      return;
    }
    if (action === 'delete' && currentId) {
      const source = Templates.get(currentId);
      if (!source) return;
      if (confirm(`Delete "${source.name || 'Untitled template'}"?`)) {
        Templates.remove(currentId);
        selectedId = '';
      }
    }
  });

  section.querySelector('[data-action="new"]').addEventListener('click', () => {
    const created = Templates.upsert({ name: 'New template', subject: '', body: '' });
    selectedId = created.id;
  });

  onNodeRemoved(section, () => unsubscribe?.());
}

export function initEmailTemplates() {
  const mount = document.getElementById('app-main')
    || document.getElementById('root')
    || document.body;
  renderEmailTemplates(mount);
}

export function render(targetEl) {
  renderEmailTemplates(targetEl);
}
