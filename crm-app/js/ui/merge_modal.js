import { chooseValue } from '../merge/merge_core.js';

let mergeModalEl = null;
let modalState = { mode: null, ids: [], legacy: null };

function ensureModal(){
  if (mergeModalEl && mergeModalEl.isConnected) return mergeModalEl;
  const modal = document.createElement('div');
  modal.setAttribute('data-ui', 'merge-modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
  modal.style.zIndex = '2147483647';
  modal.style.padding = '16px';

  const content = document.createElement('div');
  content.setAttribute('data-ui', 'merge-content');
  content.style.background = '#fff';
  content.style.borderRadius = '8px';
  content.style.minWidth = '280px';
  content.style.maxWidth = '420px';
  content.style.width = '100%';
  content.style.boxShadow = '0 20px 45px rgba(15, 23, 42, 0.2)';
  content.style.padding = '20px';
  content.style.color = '#0f172a';
  content.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const heading = document.createElement('h2');
  heading.textContent = 'Merge';
  heading.style.margin = '0 0 16px';
  heading.style.fontSize = '20px';
  heading.style.lineHeight = '1.2';

  const columns = document.createElement('div');
  columns.setAttribute('data-ui', 'merge-columns');
  columns.style.display = 'grid';
  columns.style.gridTemplateColumns = '1fr 1fr';
  columns.style.gap = '12px';
  columns.style.marginBottom = '20px';

  const left = document.createElement('div');
  left.setAttribute('data-ui', 'merge-left');
  left.style.padding = '12px';
  left.style.border = '1px solid rgba(148, 163, 184, 0.6)';
  left.style.borderRadius = '6px';
  left.style.wordBreak = 'break-word';
  left.style.background = 'rgba(248, 250, 252, 0.8)';

  const right = document.createElement('div');
  right.setAttribute('data-ui', 'merge-right');
  right.style.padding = '12px';
  right.style.border = '1px solid rgba(148, 163, 184, 0.6)';
  right.style.borderRadius = '6px';
  right.style.wordBreak = 'break-word';
  right.style.background = 'rgba(248, 250, 252, 0.8)';

  const actions = document.createElement('div');
  actions.setAttribute('data-ui', 'merge-actions');
  actions.style.display = 'flex';
  actions.style.justifyContent = 'flex-end';
  actions.style.gap = '12px';

  const cancelBtn = document.createElement('button');
  cancelBtn.setAttribute('data-ui', 'merge-cancel');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.padding = '8px 14px';
  cancelBtn.style.borderRadius = '6px';
  cancelBtn.style.border = '1px solid rgba(148, 163, 184, 0.8)';
  cancelBtn.style.background = '#fff';
  cancelBtn.style.color = '#0f172a';
  cancelBtn.style.cursor = 'pointer';

  const confirmBtn = document.createElement('button');
  confirmBtn.setAttribute('data-ui', 'merge-confirm');
  confirmBtn.type = 'button';
  confirmBtn.textContent = 'Confirm Merge';
  confirmBtn.style.padding = '8px 14px';
  confirmBtn.style.borderRadius = '6px';
  confirmBtn.style.border = 'none';
  confirmBtn.style.background = '#2563eb';
  confirmBtn.style.color = '#fff';
  confirmBtn.style.cursor = 'pointer';

  actions.append(cancelBtn, confirmBtn);
  columns.append(left, right);
  content.append(heading, columns, actions);
  modal.appendChild(content);

  cancelBtn.addEventListener('click', () => handleCancel());
  confirmBtn.addEventListener('click', () => handleConfirm());

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      handleCancel();
    }
  });

  mergeModalEl = modal;
  return modal;
}

function formatRecordSummary(record, fallback){
  if (!record || typeof record !== 'object') return fallback;
  const name = [record.first, record.last].filter(Boolean).join(' ').trim();
  if (name) return `${name}${record.id ? ` (${record.id})` : ''}`;
  if (record.name) return `${record.name}${record.id ? ` (${record.id})` : ''}`;
  if (record.id) return String(record.id);
  return fallback;
}

function updateModalContent(state){
  if (!mergeModalEl) return;
  const left = mergeModalEl.querySelector('[data-ui="merge-left"]');
  const right = mergeModalEl.querySelector('[data-ui="merge-right"]');
  const [a, b] = state.ids;
  if (state.mode === 'legacy' && state.legacy){
    const { options } = state.legacy;
    const textA = formatRecordSummary(options?.recordA, a || 'Record A');
    const textB = formatRecordSummary(options?.recordB, b || 'Record B');
    if (left) left.textContent = textA;
    if (right) right.textContent = textB;
  } else {
    if (left) left.textContent = a != null ? String(a) : '';
    if (right) right.textContent = b != null ? String(b) : '';
  }
}

function isLegacyOptions(value){
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if ('recordA' in value || 'recordB' in value) return true;
  if (Array.isArray(value.contacts) && value.contacts.length >= 2) return true;
  return false;
}

function buildLegacyPicks(recordA = {}, recordB = {}){
  const keys = new Set([...Object.keys(recordA || {}), ...Object.keys(recordB || {})]);
  const picks = {};
  keys.forEach((field) => {
    if (/^id$/i.test(field) || /^createdAt$/i.test(field) || /^updatedAt$/i.test(field)) return;
    if (/^__/.test(field)) return;
    const va = recordA?.[field];
    const vb = recordB?.[field];
    if (Array.isArray(va) || Array.isArray(vb)){
      if (Array.isArray(va) && Array.isArray(vb)) picks[field] = 'UNION';
      else if (Array.isArray(va)) picks[field] = 'A';
      else if (Array.isArray(vb)) picks[field] = 'B';
      return;
    }
    const choice = chooseValue(field, recordA || {}, recordB || {});
    picks[field] = choice.from;
  });
  return picks;
}

function openLegacyMergeModal(options){
  const contacts = Array.isArray(options?.contacts) ? options.contacts : null;
  if (contacts && contacts.length >= 2){
    const [first, second] = contacts;
    modalState = {
      mode: 'legacy',
      ids: [first?.id ? String(first.id) : '', second?.id ? String(second.id) : ''],
      legacy: { options: { recordA: first, recordB: second, onConfirm: options.onConfirm, onCancel: options.onCancel }, picks: buildLegacyPicks(first, second) }
    };
  } else {
    const recordA = options?.recordA || {};
    const recordB = options?.recordB || {};
    modalState = {
      mode: 'legacy',
      ids: [recordA?.id ? String(recordA.id) : '', recordB?.id ? String(recordB.id) : ''],
      legacy: { options: options || {}, picks: buildLegacyPicks(recordA, recordB) }
    };
  }
  const modal = ensureModal();
  updateModalContent(modalState);
  if (modal && document?.body){
    if (!document.body.contains(modal)) document.body.appendChild(modal);
  }
}

function handleConfirm(){
  const ids = Array.isArray(modalState.ids) ? modalState.ids.slice(0, 2) : [];
  try {
    console.info('merge-confirm', { ids });
  } catch (_) {}
  if (modalState.mode === 'legacy' && modalState.legacy){
    const { options, picks } = modalState.legacy;
    try {
      if (typeof options?.onConfirm === 'function'){
        options.onConfirm(Object.assign({}, picks));
      }
    } catch (err) {
      console.warn('[merge-modal] legacy confirm failed', err);
    }
  }
  closeMergeModal();
}

function handleCancel(){
  if (modalState.mode === 'legacy' && modalState.legacy){
    const { options } = modalState.legacy;
    try {
      if (typeof options?.onCancel === 'function'){
        options.onCancel();
      }
    } catch (err) {
      console.warn('[merge-modal] legacy cancel failed', err);
    }
  }
  closeMergeModal();
}

function openIdsModal(values){
  const normalized = Array.from(values || []).map((value) => {
    if (value == null) return '';
    if (typeof value === 'object'){
      if (value.id != null) return String(value.id);
      if ('value' in value && value.value != null) return String(value.value);
      if ('record' in value && value.record && value.record.id != null) return String(value.record.id);
    }
    return String(value);
  }).filter(Boolean);
  if (normalized.length < 2) return;
  modalState = { mode: 'ids', ids: normalized.slice(0, 2), legacy: null };
  const modal = ensureModal();
  updateModalContent(modalState);
  if (modal && document?.body){
    if (!document.body.contains(modal)) document.body.appendChild(modal);
  }
}

export function openMergeModal(input){
  if (isLegacyOptions(input)){
    openLegacyMergeModal(input || {});
    return;
  }
  const list = Array.isArray(input) ? input : (input == null ? [] : [input]);
  openIdsModal(list);
}

export function closeMergeModal(){
  if (mergeModalEl && mergeModalEl.isConnected){
    mergeModalEl.remove();
  }
  mergeModalEl = null;
  modalState = { mode: null, ids: [], legacy: null };
}
