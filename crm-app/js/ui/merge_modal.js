const ACTIVE_GUARD = '__MERGE_MODAL_ACTIVE__';
let activeModal = null;

function showToast(kind, message) {
  const text = String(message == null ? '' : message).trim();
  if (!text) return;
  const toast = typeof window !== 'undefined' ? window.Toast : undefined;
  if (toast && typeof toast[kind] === 'function') {
    try { toast[kind](text); return; }
    catch (_) {}
  }
  if (toast && typeof toast.show === 'function') {
    try { toast.show(text); return; }
    catch (_) {}
  }
  const legacy = typeof window !== 'undefined' ? window.toast : undefined;
  if (typeof legacy === 'function') {
    try { legacy(text); }
    catch (_) {}
  }
}

function dispatchMergeEvent(name, detail) {
  if (typeof document === 'undefined' || typeof document.dispatchEvent !== 'function') return;
  try {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (err) {
    console.warn('[merge-modal] dispatch failed', err);
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      const id = String(entry ?? index + 1);
      return { id, scope: 'default', label: `Record ${index + 1}`, record: { id, scope: 'default' } };
    }
    const id = entry.id != null ? String(entry.id) : `item-${index + 1}`;
    const scope = entry.scope && String(entry.scope).trim() ? String(entry.scope).trim() : 'default';
    const labelSource = entry.label ?? entry.name ?? entry.title ?? entry.record?.label ?? entry.record?.name;
    const label = labelSource ? String(labelSource) : `Record ${index + 1}`;
    const recordBase = typeof entry.record === 'object' && entry.record
      ? { ...entry.record }
      : typeof entry.data === 'object' && entry.data
        ? { ...entry.data }
        : {};
    if (!recordBase.id) recordBase.id = id;
    if (!recordBase.scope) recordBase.scope = scope;
    if (!recordBase.label && label) recordBase.label = label;
    return { id, scope, label, record: recordBase };
  });
}

function isEmptyValue(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

async function mergeRecords(primary, secondaries) {
  const primaryRecord = { ...(primary?.record || {}), id: primary?.id, scope: primary?.scope };
  secondaries.forEach((item) => {
    const data = item?.record || {};
    Object.keys(data).forEach((key) => {
      if (key === 'id' || key === 'scope') return;
      if (isEmptyValue(primaryRecord[key]) && !isEmptyValue(data[key])) {
        primaryRecord[key] = data[key];
      }
    });
  });

  const store = typeof window !== 'undefined' ? window.SelectionStore : null;
  if (store && typeof store.get === 'function' && typeof store.set === 'function') {
    try {
      const scope = primary?.scope || 'default';
      const snapshot = store.get(scope);
      if (snapshot instanceof Set) {
        secondaries.forEach((item) => snapshot.delete(item.id));
        if (primary?.id) snapshot.add(primary.id);
        store.set(snapshot, scope);
      }
    } catch (err) {
      console.warn('[merge-modal] selection cleanup failed', err);
    }
  }

  const mergedSecondaries = secondaries.map((item) => ({ ...item, mergedInto: primary?.id }));
  return { primary: { ...primary, record: primaryRecord }, secondaries: mergedSecondaries, merged: primaryRecord };
}

function buildContainer() {
  const overlay = document.createElement('div');
  overlay.dataset.qa = 'merge-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '10000';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.background = 'rgba(15, 23, 42, 0.55)';

  const shell = document.createElement('div');
  shell.style.width = 'min(92vw, 960px)';
  shell.style.maxHeight = '80vh';
  shell.style.background = '#fff';
  shell.style.borderRadius = '12px';
  shell.style.boxShadow = '0 20px 48px rgba(15, 23, 42, 0.25)';
  shell.style.display = 'flex';
  shell.style.flexDirection = 'column';
  shell.style.overflow = 'hidden';

  overlay.appendChild(shell);
  return { overlay, shell };
}

function createColumn(title, description) {
  const column = document.createElement('div');
  column.style.flex = '1';
  column.style.display = 'flex';
  column.style.flexDirection = 'column';
  column.style.gap = '12px';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.flexDirection = 'column';
  header.style.gap = '4px';

  const titleEl = document.createElement('div');
  titleEl.style.fontSize = '16px';
  titleEl.style.fontWeight = '600';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  if (description) {
    const desc = document.createElement('div');
    desc.style.fontSize = '12px';
    desc.style.color = '#64748b';
    desc.textContent = description;
    header.appendChild(desc);
  }

  column.appendChild(header);

  const list = document.createElement('div');
  list.style.flex = '1';
  list.style.overflow = 'auto';
  list.style.border = '1px solid #e2e8f0';
  list.style.borderRadius = '8px';
  list.style.padding = '8px';
  list.style.background = '#f8fafc';
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '8px';

  column.appendChild(list);

  return { column, list };
}

function describeItem(item) {
  const wrap = document.createElement('label');
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '12px';
  wrap.style.padding = '8px 10px';
  wrap.style.borderRadius = '8px';
  wrap.style.background = '#fff';
  wrap.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.05)';

  const textWrap = document.createElement('div');
  textWrap.style.flex = '1';
  textWrap.style.display = 'flex';
  textWrap.style.flexDirection = 'column';
  textWrap.style.gap = '2px';

  const name = document.createElement('span');
  name.textContent = item.label || item.record?.label || item.id;
  name.style.fontWeight = '600';
  name.style.fontSize = '14px';
  textWrap.appendChild(name);

  const meta = document.createElement('span');
  meta.style.fontSize = '12px';
  meta.style.color = '#64748b';
  const summary = item.record?.summary || item.record?.email || item.scope;
  meta.textContent = summary ? String(summary) : `ID: ${item.id}`;
  textWrap.appendChild(meta);

  wrap.appendChild(textWrap);
  return wrap;
}

function renderSelectionModal(items) {
  if (typeof document === 'undefined') return null;
  if (window[ACTIVE_GUARD]) {
    console.warn('[merge-modal] already open');
    return activeModal;
  }
  window[ACTIVE_GUARD] = true;

  const { overlay, shell } = buildContainer();
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = '16px 20px';
  header.style.borderBottom = '1px solid #e2e8f0';

  const title = document.createElement('div');
  title.textContent = 'Select records to merge';
  title.style.fontSize = '18px';
  title.style.fontWeight = '600';
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.style.fontSize = '22px';
  closeBtn.style.lineHeight = '1';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.color = '#0f172a';
  header.appendChild(closeBtn);

  shell.appendChild(header);

  const body = document.createElement('div');
  body.style.display = 'flex';
  body.style.gap = '16px';
  body.style.padding = '20px';
  body.style.flex = '1';

  const primaryColumn = createColumn('Primary record', 'Keep data from this record');
  primaryColumn.column.dataset.qa = 'merge-primary';
  const secondaryColumn = createColumn('Secondary records', 'These will merge into the primary');
  secondaryColumn.column.dataset.qa = 'merge-secondary';

  body.appendChild(primaryColumn.column);
  body.appendChild(secondaryColumn.column);

  shell.appendChild(body);

  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'flex-end';
  footer.style.gap = '12px';
  footer.style.padding = '16px 20px';
  footer.style.borderTop = '1px solid #e2e8f0';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.dataset.qa = 'merge-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.padding = '8px 16px';
  cancelBtn.style.border = '1px solid #cbd5f5';
  cancelBtn.style.borderRadius = '8px';
  cancelBtn.style.background = '#fff';
  cancelBtn.style.cursor = 'pointer';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.dataset.qa = 'merge-confirm';
  confirmBtn.textContent = 'Merge';
  confirmBtn.style.padding = '8px 20px';
  confirmBtn.style.border = 'none';
  confirmBtn.style.borderRadius = '8px';
  confirmBtn.style.background = '#2563eb';
  confirmBtn.style.color = '#fff';
  confirmBtn.style.cursor = 'pointer';

  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);

  shell.appendChild(footer);

  document.body.appendChild(overlay);

  let primaryId = '';
  let previousPrimaryId = '';
  const secondaryIds = new Set();
  let submitting = false;

  const radios = [];
  const checkboxes = [];

  const updateState = () => {
    const invalid = !primaryId || !secondaryIds.size;
    confirmBtn.disabled = submitting || invalid;
    confirmBtn.style.opacity = confirmBtn.disabled ? '0.5' : '1';
    confirmBtn.style.cursor = confirmBtn.disabled ? 'not-allowed' : 'pointer';
  };

  items.forEach((item, index) => {
    const radioWrap = describeItem(item);
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'merge-primary';
    radio.value = item.id;
    radio.dataset.qa = 'merge-primary';
    radio.style.margin = '0';
    radioWrap.insertBefore(radio, radioWrap.firstChild);
    primaryColumn.list.appendChild(radioWrap);
    radios.push(radio);

    const checkboxWrap = describeItem(item);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item.id;
    checkbox.dataset.qa = 'merge-secondary';
    checkbox.style.margin = '0';
    checkboxWrap.insertBefore(checkbox, checkboxWrap.firstChild);
    secondaryColumn.list.appendChild(checkboxWrap);
    checkboxes.push(checkbox);

    if (index === 0) {
      radio.checked = true;
      primaryId = item.id;
      previousPrimaryId = item.id;
    } else {
      checkbox.checked = true;
      secondaryIds.add(item.id);
    }
  });

  checkboxes.forEach((box) => {
    if (box.value === primaryId) {
      box.checked = false;
      box.disabled = true;
      secondaryIds.delete(box.value);
    }
  });

  updateState();

  const changePrimary = (event) => {
    const value = event && event.target ? event.target.value : '';
    if (!value || value === primaryId) return;
    previousPrimaryId = primaryId;
    primaryId = value;
    checkboxes.forEach((box) => {
      if (box.value === primaryId) {
        box.checked = false;
        box.disabled = true;
        secondaryIds.delete(box.value);
        return;
      }
      if (box.value === previousPrimaryId) {
        box.disabled = false;
        box.checked = true;
        secondaryIds.add(box.value);
        return;
      }
      if (box.checked) {
        secondaryIds.add(box.value);
      } else {
        secondaryIds.delete(box.value);
      }
    });
    updateState();
  };

  const changeSecondary = (event) => {
    const target = event?.target;
    if (!target) return;
    const { checked, value } = target;
    if (value === primaryId) {
      target.checked = false;
      return;
    }
    if (checked) {
      secondaryIds.add(value);
    } else {
      secondaryIds.delete(value);
    }
    updateState();
  };

  const listeners = [];

  radios.forEach((radio) => {
    radio.addEventListener('change', changePrimary);
    listeners.push(() => radio.removeEventListener('change', changePrimary));
  });

  checkboxes.forEach((box) => {
    box.addEventListener('change', changeSecondary);
    listeners.push(() => box.removeEventListener('change', changeSecondary));
  });

  const close = ({ silent } = {}) => {
    if (!window[ACTIVE_GUARD]) return;
    listeners.forEach((stop) => { try { stop(); } catch (_) {} });
    listeners.length = 0;
    try { overlay.remove(); }
    catch (_) {}
    window[ACTIVE_GUARD] = false;
    activeModal = null;
    if (!silent) dispatchMergeEvent('merge:closed');
  };

  const cancel = () => {
    close();
  };

  const outsideClick = (event) => {
    if (event.target === overlay) {
      close();
    }
  };

  overlay.addEventListener('click', outsideClick);
  listeners.push(() => overlay.removeEventListener('click', outsideClick));

  cancelBtn.addEventListener('click', cancel);
  listeners.push(() => cancelBtn.removeEventListener('click', cancel));

  const keydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };
  document.addEventListener('keydown', keydown, true);
  listeners.push(() => document.removeEventListener('keydown', keydown, true));

  const confirm = async () => {
    if (submitting) return;
    if (!primaryId || !secondaryIds.size) return;
    submitting = true;
    updateState();
    try {
      const primary = items.find((item) => item.id === primaryId);
      const secondaries = items.filter((item) => secondaryIds.has(item.id));
      const result = await mergeRecords(primary, secondaries);
      showToast('success', 'Merged');
      dispatchMergeEvent('merge:complete', { primary: result.primary, secondaries: result.secondaries });
      close();
    } catch (err) {
      console.warn('[merge-modal] merge failed', err);
      submitting = false;
      updateState();
    }
  };

  confirmBtn.addEventListener('click', confirm);
  listeners.push(() => confirmBtn.removeEventListener('click', confirm));

  closeBtn.addEventListener('click', cancel);
  listeners.push(() => closeBtn.removeEventListener('click', cancel));

  dispatchMergeEvent('merge:open', { count: items.length });

  activeModal = { close };
  return activeModal;
}

export function openMergeModal(items) {
  const normalized = normalizeItems(items);
  if (normalized.length < 2) {
    console.warn('[merge-modal] at least two items required');
    return null;
  }
  return renderSelectionModal(normalized);
}
