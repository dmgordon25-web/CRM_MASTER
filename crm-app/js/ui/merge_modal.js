import { chooseValue } from '../merge/merge_core.js';

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

function isLegacyOptions(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const keys = ['recordA', 'recordB', 'onConfirm', 'onCancel'];
  return keys.some((key) => key in value);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}

function formatLegacyValue(value) {
  try {
    if (value == null) return '';
    if (typeof value === 'string') return escapeHtml(value);
    if (typeof value === 'number' || typeof value === 'boolean') return escapeHtml(String(value));
    if (Array.isArray(value)) {
      const mapped = value.map((entry) => (typeof entry === 'object' ? JSON.stringify(entry) : String(entry)));
      return escapeHtml(mapped.join(', '));
    }
    return escapeHtml(JSON.stringify(value));
  } catch (err) {
    console.warn('[merge-modal] value format failed', err);
    return '';
  }
}

function openLegacyMergeModal({ kind = 'contacts', recordA, recordB, onConfirm, onCancel }) {
  if (typeof document === 'undefined') return null;
  if (window[ACTIVE_GUARD]) {
    console.info('[merge-modal] already open');
    return activeModal;
  }
  window[ACTIVE_GUARD] = true;

  const fields = Array.from(new Set([
    ...Object.keys(recordA || {}),
    ...Object.keys(recordB || {}),
  ])).filter((field) => !/^id$/i.test(field)
    && !/^createdAt$/i.test(field)
    && !/^updatedAt$/i.test(field)
    && !/^__/.test(field));

  const template = document.createElement('template');
  template.innerHTML = `
<div class="merge-overlay" data-ui="legacy-merge-modal" data-qa="merge-modal" role="dialog" aria-modal="true" style="position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;">
  <div class="merge-modal" style="background:#fff;min-width:720px;max-width:960px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.3);">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #eee;">
      <div style="font-size:18px;font-weight:600;">Merge ${kind === 'contacts' ? 'Contacts' : kind === 'partners' ? 'Partners' : 'Records'}</div>
      <button class="merge-close" aria-label="Close" style="border:none;background:transparent;font-size:20px;cursor:pointer;">×</button>
    </div>
    <div style="padding:12px 16px;">
      <div style="display:grid;grid-template-columns:1fr 120px 1fr;gap:8px;align-items:center;font-weight:600;margin-bottom:8px;">
        <div>A</div><div style="text-align:center;">Field</div><div style="text-align:right;">B</div>
      </div>
      <div class="merge-rows" style="max-height:52vh;overflow:auto;border:1px solid #eee;border-radius:8px;padding:8px;">
        ${fields.map((field) => {
          const choice = chooseValue(field, recordA, recordB).from;
          const valueA = formatLegacyValue(recordA?.[field]);
          const valueB = formatLegacyValue(recordB?.[field]);
          const safeField = escapeHtml(field);
          return `
          <div class="merge-row" data-field="${safeField}" style="display:grid;grid-template-columns:1fr 120px 1fr;gap:8px;align-items:start;padding:6px 0;border-bottom:1px solid #f6f6f6;">
            <label style="display:flex;gap:6px;align-items:flex-start;">
              <input type="radio" name="pick:${safeField}" value="A" ${choice === 'A' ? 'checked' : ''}/>
              <div style="white-space:pre-wrap;">${valueA}</div>
            </label>
            <div style="text-align:center;color:#555;font-size:12px;">${safeField}</div>
            <label style="display:flex;gap:6px;align-items:flex-start;justify-content:flex-end;">
              <div style="white-space:pre-wrap;text-align:right;">${valueB}</div>
              <input type="radio" name="pick:${safeField}" value="B" ${choice === 'B' ? 'checked' : ''}/>
            </label>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
        <button class="merge-cancel" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer;">Cancel</button>
        <button class="merge-confirm" data-ui="merge-confirm" style="padding:8px 12px;border-radius:8px;border:1px solid #2b7;background:#2b7;color:#fff;cursor:pointer;">Merge</button>
      </div>
    </div>
  </div>
</div>`.trim();

  const modal = template.content.firstElementChild;
  if (!modal) {
    window[ACTIVE_GUARD] = false;
    console.warn('[merge-modal] failed to create legacy modal');
    return null;
  }

  document.body.appendChild(modal);
  dispatchMergeEvent('merge:open', { count: 2, kind });

  const close = ({ triggerCancel = false } = {}) => {
    try { modal.remove(); } catch (err) {
      console.warn('[merge-modal] close failed', err);
    }
    window[ACTIVE_GUARD] = false;
    activeModal = null;
    if (triggerCancel) {
      try { onCancel?.(); }
      catch (err) { console.warn('[merge-modal] cancel failed', err); }
      dispatchMergeEvent('merge:cancel', { kind });
    }
  };

  modal.querySelector('.merge-close')?.addEventListener('click', () => close({ triggerCancel: true }));
  modal.querySelector('.merge-cancel')?.addEventListener('click', () => close({ triggerCancel: true }));

  const confirmBtn = modal.querySelector('.merge-confirm');
  let submitting = false;
  const setSubmitting = (state) => {
    submitting = state;
    if (!confirmBtn) return;
    confirmBtn.disabled = state;
    confirmBtn.style.opacity = state ? '0.7' : '';
    confirmBtn.style.cursor = state ? 'default' : 'pointer';
  };

  confirmBtn?.addEventListener('click', async () => {
    if (submitting) return;
    setSubmitting(true);
    const picks = {};
    modal.querySelectorAll('.merge-row').forEach((row) => {
      const field = row.getAttribute('data-field');
      if (!field) return;
      const pickB = row.querySelector('input[value="B"]');
      picks[field] = pickB && pickB.checked ? 'B' : 'A';
    });
    try {
      await onConfirm?.(picks);
      dispatchMergeEvent('merge:complete', { kind, picks });
      close();
    } catch (err) {
      console.error('[merge-modal] confirm failed', err);
      setSubmitting(false);
    }
  });

  activeModal = { close };
  return activeModal;
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

function inferSelectionTypeFromItems(primary, secondaries, items) {
  const candidates = [];
  const push = (entry) => {
    if (!entry) return;
    const scope = entry.scope || entry.record?.scope;
    if (typeof scope === 'string' && scope.trim()) {
      candidates.push(String(scope).trim().toLowerCase());
    }
  };
  push(primary);
  (Array.isArray(secondaries) ? secondaries : []).forEach(push);
  (Array.isArray(items) ? items : []).forEach(push);
  for (const candidate of candidates) {
    if (candidate.includes('partner')) return 'partners';
    if (candidate.includes('contact')) return 'contacts';
  }
  return candidates.find((value) => value) || 'contacts';
}

function dispatchUiMerge(detail) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('ui:merge', { detail }));
      return;
    }
  } catch (err) {
    console.warn('[merge-modal] ui:merge dispatch failed', err);
  }
  try {
    if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
      document.dispatchEvent(new CustomEvent('ui:merge', { detail }));
    }
  } catch (err) {
    console.warn('[merge-modal] ui:merge fallback dispatch failed', err);
  }
}

async function delegateSelectionMerge(context = {}) {
  if (typeof window === 'undefined') return false;
  const { primary, secondaries = [], type } = context;
  const primaryId = primary?.id != null ? String(primary.id) : '';
  const target = Array.isArray(secondaries) ? secondaries.find((entry) => entry?.id != null) : null;
  if (!primaryId || !target) return false;
  const secondaryId = String(target.id);
  const pair = [primaryId, secondaryId];
  const scope = (type || '').toLowerCase();

  const crm = window.CRM || {};
  const modules = crm.modules || {};

  const delegates = [];
  if (scope === 'partners') {
    delegates.push(
      modules.partnersMergeOrchestrator?.openPartnersMergeByIds,
      window.openPartnersMergeByIds
    );
  } else {
    delegates.push(
      window.mergeContactsWithIds,
      modules.contactsMerge?.mergeContactsWithIds,
      modules.contactsMergeOrchestrator?.openContactsMergeByIds,
      window.openContactsMergeByIds
    );
  }

  const svc = window.MergeService;
  if (svc && typeof svc === 'object') {
    if (typeof svc.merge === 'function') {
      delegates.push((a, b) => svc.merge({ type: scope || 'contacts', primaryId: a, secondaryId: b }));
    }
    if (scope !== 'partners' && typeof svc.mergeContacts === 'function') {
      delegates.push((a, b) => svc.mergeContacts(a, b));
    }
    if (scope === 'partners' && typeof svc.mergePartners === 'function') {
      delegates.push((a, b) => svc.mergePartners(a, b));
    }
  }

  for (const fn of delegates) {
    if (typeof fn !== 'function') continue;
    try {
      const result = fn.length > 1 ? fn(primaryId, secondaryId) : fn(pair);
      const resolved = await result;
      if (resolved && typeof resolved === 'object') {
        if (resolved.status === 'cancel') continue;
        if (resolved.status === 'error') continue;
      }
      return true;
    } catch (err) {
      console.warn('[merge-modal] delegate failed', err);
    }
  }

  return false;
}

function buildContainer() {
  const overlay = document.createElement('div');
  overlay.dataset.qa = 'merge-modal';
  overlay.dataset.ui = 'merge-modal';
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

function renderSelectionModal(items, options = {}) {
  if (typeof document === 'undefined') return null;
  if (window[ACTIVE_GUARD]) {
    console.info('[merge-modal] already open');
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
  confirmBtn.dataset.ui = 'merge-confirm';
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

    const primary = items.find((item) => item.id === primaryId) || null;
    const chosen = items.filter((item) => secondaryIds.has(item.id));
    const type = inferSelectionTypeFromItems(primary, chosen, items);
    const secondaryIdsList = chosen
      .map((entry) => (entry && entry.id != null ? String(entry.id) : ''))
      .filter((value) => value);
    const context = {
      source: options && typeof options === 'object' ? options.source || null : null,
      items: items.slice(),
      primary,
      secondaries: chosen,
      primaryId,
      secondaryIds: secondaryIdsList,
      type,
      ids: [primaryId, ...secondaryIdsList]
    };

    close({ silent: true });

    let handled = false;
    try {
      if (options && typeof options.onConfirm === 'function') {
        handled = await options.onConfirm(context);
      } else {
        handled = await delegateSelectionMerge(context);
      }
    } catch (err) {
      console.warn('[merge-modal] confirm delegate failed', err);
    }

    if (!handled) {
      let result = null;
      try {
        result = await mergeRecords(primary, chosen);
      } catch (err) {
        console.warn('[merge-modal] merge preview failed', err);
      }
      const detail = {
        type,
        source: context.source,
        primary,
        secondaries: chosen,
        items: context.items,
        ids: context.ids,
        result
      };
      dispatchUiMerge(detail);
      dispatchMergeEvent('merge:complete', detail);
    }

    dispatchMergeEvent('merge:closed', { delegated: handled, type, ids: context.ids });
  };

  confirmBtn.addEventListener('click', confirm);
  listeners.push(() => confirmBtn.removeEventListener('click', confirm));

  closeBtn.addEventListener('click', cancel);
  listeners.push(() => closeBtn.removeEventListener('click', cancel));

  dispatchMergeEvent('merge:open', { count: items.length });

  activeModal = { close };
  return activeModal;
}

export function openMergeModal(items, options = {}) {
  if (isLegacyOptions(items)) {
    return openLegacyMergeModal(items);
  }

  const normalized = normalizeItems(items);
  if (normalized.length < 2) {
    console.info('[merge-modal] at least two items required');
    return null;
  }
  return renderSelectionModal(normalized, options);
}
