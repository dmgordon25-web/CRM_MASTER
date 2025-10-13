import { ensurePartnersMergeButton, setPartnersMergeState, onPartnersMerge } from './ui/action_bar.js';

const SCORE_FIELDS = [
  'name','company','email','phone','tier','partnerType','focus','priority','preferredContact','cadence','address','city','state','zip','referralVolume','lastTouch','nextTouch','relationshipOwner','collaborationFocus','notes'
];

function cloneDeep(value) {
  if (value === null || value === undefined) return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); }
    catch (_err) {}
  }
  return JSON.parse(JSON.stringify(value));
}

function canon(value) {
  return String(value ?? '').trim();
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function scorePartner(partner) {
  if (!partner) return 0;
  let score = 0;
  SCORE_FIELDS.forEach((field) => {
    if (hasValue(partner[field])) score += 1;
  });
  if (partner.extras && typeof partner.extras === 'object') {
    score += Object.keys(partner.extras).length;
  }
  return score;
}

function chooseKeep(a, b) {
  const scoreA = scorePartner(a);
  const scoreB = scorePartner(b);
  if (scoreA > scoreB) return { keep: a, drop: b };
  if (scoreB > scoreA) return { keep: b, drop: a };
  const createdA = Number(a && a.createdAt) || Number.MAX_SAFE_INTEGER;
  const createdB = Number(b && b.createdAt) || Number.MAX_SAFE_INTEGER;
  if (createdA <= createdB) return { keep: a, drop: b };
  return { keep: b, drop: a };
}

function combineNotes(base, incoming) {
  const a = canon(base);
  const b = canon(incoming);
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  return `${a}\n\n--- merged ${stamp} ---\n${b}`;
}

function mergePartnerRecord(existing, incoming) {
  const base = cloneDeep(existing) || {};
  const payload = cloneDeep(incoming) || {};
  const result = Object.assign({}, base);
  SCORE_FIELDS.forEach((field) => {
    if (hasValue(payload[field])) result[field] = payload[field];
  });
  if (payload.extras || base.extras) {
    result.extras = Object.assign({}, base.extras || {}, payload.extras || {});
  }
  if (hasValue(payload.notes)) {
    result.notes = combineNotes(base.notes, payload.notes);
  }
  result.updatedAt = Date.now();
  result.id = base.id || payload.id;
  result.partnerId = base.partnerId || payload.partnerId || result.id;
  return result;
}

function diffPartnerFields(before, after) {
  const changed = [];
  SCORE_FIELDS.forEach((field) => {
    const prev = before ? before[field] : undefined;
    const next = after ? after[field] : undefined;
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changed.push(field);
    }
  });
  if ((before && before.notes) !== (after && after.notes)) changed.push('notes');
  return changed;
}

function getSelectionStore() {
  return window.SelectionStore || null;
}

function currentPartnerSelection() {
  const store = getSelectionStore();
  if (!store) return [];
  const ids = store.get('partners');
  return Array.from(ids || []);
}

function setPartnerSelection(ids) {
  const store = getSelectionStore();
  if (!store) return;
  store.set(new Set(ids.map(String)), 'partners');
}

function ensureModal() {
  let dlg = document.getElementById('partner-merge-modal');
  if (dlg) return dlg;
  dlg = document.createElement('dialog');
  dlg.id = 'partner-merge-modal';
  dlg.setAttribute('data-ui', 'merge-modal');
  dlg.setAttribute('data-qa', 'merge-modal');
  dlg.innerHTML = `
    <form method="dialog" class="dlg merge-partners-shell" data-role="form">
      <header class="merge-partners-head">
        <h3 class="merge-title">Merge Partners</h3>
        <p class="muted" data-role="summary"></p>
      </header>
      <div class="merge-body" data-role="body">
        <section class="merge-picker" data-role="picker"></section>
        <section class="merge-preview" data-role="preview"></section>
      </div>
      <footer class="merge-actions">
        <span class="muted" data-role="warning"></span>
        <span class="grow"></span>
        <button class="btn" type="button" data-role="cancel">Cancel</button>
        <button class="btn brand" type="submit" data-role="confirm">Merge</button>
      </footer>
    </form>`;
  document.body.appendChild(dlg);
  return dlg;
}

function renderPreview(body, keep, drop, merged, changedFields) {
  const keepName = canon(keep.name) || 'Primary';
  const dropName = canon(drop.name) || 'Duplicate';
  const rows = changedFields.map((field) => {
    const before = drop && drop[field];
    const after = merged && merged[field];
    const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    return `<div class="merge-row">
      <div class="merge-label">${label}</div>
      <div class="merge-before">${canon(before) || '<span class="muted">—</span>'}</div>
      <div class="merge-after">${canon(after) || '<span class="muted">—</span>'}</div>
    </div>`;
  }).join('');
  body.innerHTML = `
    <div class="merge-preview">
      <div><strong>Keeping</strong><div>${keepName}</div></div>
      <div><strong>Merging</strong><div>${dropName}</div></div>
    </div>
    <div class="merge-grid">${rows || '<div class="muted">No changes detected.</div>'}</div>`;
}

function normalizeSelectionIds(ids) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const normalized = [];
  ids.forEach((value) => {
    const id = String(value ?? '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    normalized.push(id);
  });
  return normalized;
}

function candidatesAreCompatible(primary, secondary) {
  if (!primary || !secondary) return false;
  const aId = String(primary.id ?? '').trim();
  const bId = String(secondary.id ?? '').trim();
  if (!aId || !bId) return false;
  if (aId === bId) return false;
  return true;
}

async function openMergeModal({ selectionIds = [], picker = false } = {}) {
  const dlg = ensureModal();
  const form = dlg.querySelector('form');
  const summary = dlg.querySelector('[data-role="summary"]');
  const warning = dlg.querySelector('[data-role="warning"]');
  const pickerSection = dlg.querySelector('[data-role="picker"]');
  const previewSection = dlg.querySelector('[data-role="preview"]');
  const cancelBtn = dlg.querySelector('[data-role="cancel"]');
  const confirmBtn = dlg.querySelector('[data-role="confirm"]');

  const state = {
    picker: !!picker,
    selectionIds: normalizeSelectionIds(selectionIds),
    records: new Map(),
    primaryId: '',
    secondaryId: '',
    submitting: false,
    isValidMerge: false,
    statusNode: null
  };

  const listeners = [];
  const dynamicListeners = [];

  const register = (node, event, handler) => {
    if (!node) return;
    node.addEventListener(event, handler);
    listeners.push(() => node.removeEventListener(event, handler));
  };
  const registerDynamic = (node, event, handler) => {
    if (!node) return;
    node.addEventListener(event, handler);
    dynamicListeners.push(() => node.removeEventListener(event, handler));
  };
  const clearDynamic = () => {
    while (dynamicListeners.length) {
      const stop = dynamicListeners.pop();
      try { stop(); }
      catch (_) {}
    }
  };

  const ensureDb = async () => {
    if (typeof openDB !== 'function') return;
    try {
      await openDB();
    } catch (err) {
      console.warn('[partners_merge] openDB failed', err);
    }
  };

  const loadPartner = async (id) => {
    if (!id || typeof dbGet !== 'function') return null;
    try {
      const record = await dbGet('partners', id);
      return record || null;
    } catch (err) {
      console.warn('[partners_merge] partner lookup failed', id, err);
      return null;
    }
  };

  await ensureDb();

  await Promise.all(state.selectionIds.map(async (id) => {
    if (state.records.has(id)) return;
    const record = await loadPartner(id);
    if (record) state.records.set(id, record);
  }));

  const selectionSnapshot = () => state.selectionIds.filter((id) => state.records.has(id));

  const ensureSelectionCoherence = () => {
    const ids = selectionSnapshot();
    if (!ids.length) {
      state.primaryId = '';
      state.secondaryId = '';
      return;
    }
    if (ids.length >= 2) {
      if (!state.primaryId || !ids.includes(state.primaryId)) {
        const [first, second] = ids;
        const firstRec = state.records.get(first);
        const secondRec = state.records.get(second);
        if (firstRec && secondRec) {
          const { keep, drop } = chooseKeep(firstRec, secondRec);
          state.primaryId = String(keep.id ?? first);
          state.secondaryId = String(drop.id ?? second);
        } else {
          state.primaryId = first;
          state.secondaryId = second;
        }
      }
      if (!state.secondaryId || state.secondaryId === state.primaryId || !ids.includes(state.secondaryId)) {
        const fallback = ids.find((id) => id !== state.primaryId);
        state.secondaryId = fallback || '';
      }
      return;
    }
    const sole = ids[0];
    state.primaryId = state.primaryId && ids.includes(state.primaryId) ? state.primaryId : sole;
    state.secondaryId = '';
  };

  const computeState = () => {
    const primary = state.primaryId ? state.records.get(state.primaryId) : null;
    const secondary = state.secondaryId ? state.records.get(state.secondaryId) : null;
    const count = (primary ? 1 : 0) + (secondary ? 1 : 0);
    const valid = count >= 2 && candidatesAreCompatible(primary, secondary);
    state.isValidMerge = valid;
    return { primary, secondary, valid };
  };

  const renderPreviewSection = (primary, secondary, valid) => {
    if (!previewSection) return 0;
    if (!valid || !primary || !secondary) {
      previewSection.innerHTML = '<div class="muted">Select two partners to preview the merge.</div>';
      return 0;
    }
    const merged = mergePartnerRecord(primary, secondary);
    const changed = diffPartnerFields(primary, merged);
    renderPreview(previewSection, primary, secondary, merged, changed);
    return changed.length;
  };

  const updateSummary = (primary, secondary, valid, changed) => {
    if (!summary || !warning) return;
    if (valid && primary && secondary) {
      summary.textContent = `Merge "${canon(secondary.name)||'Unnamed'}" into "${canon(primary.name)||'Primary'}"`;
      warning.textContent = changed ? '' : 'Records already match.';
      return;
    }
    const total = selectionSnapshot().length;
    if (!total) {
      summary.textContent = 'Add partners to start a merge.';
      warning.textContent = 'Add at least two partners to continue.';
      return;
    }
    summary.textContent = 'Select two partners to merge.';
    if (total === 1) {
      warning.textContent = 'Add one more partner to continue.';
    } else {
      warning.textContent = 'Choose the primary and secondary partner.';
    }
  };

  const updateConfirmState = () => {
    const disabled = state.submitting || !state.isValidMerge;
    if (!confirmBtn) return;
    confirmBtn.disabled = disabled;
    confirmBtn.classList.toggle('disabled', disabled);
    confirmBtn.style.opacity = disabled ? '0.6' : '';
    confirmBtn.style.cursor = disabled ? 'not-allowed' : '';
    confirmBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  };

  const removePartner = (id) => {
    state.records.delete(id);
    state.selectionIds = state.selectionIds.filter((value) => value !== id);
    if (state.primaryId === id) state.primaryId = '';
    if (state.secondaryId === id) state.secondaryId = '';
    updateAll();
  };

  const addPartner = async (rawId) => {
    const id = String(rawId || '').trim();
    if (!id) {
      if (state.statusNode) state.statusNode.textContent = 'Enter a partner ID to add.';
      return;
    }
    if (state.selectionIds.includes(id)) {
      if (state.statusNode) state.statusNode.textContent = 'Partner already selected.';
      return;
    }
    await ensureDb();
    const record = await loadPartner(id);
    if (!record) {
      if (state.statusNode) state.statusNode.textContent = 'Partner not found.';
      return;
    }
    state.selectionIds.push(id);
    state.records.set(id, record);
    state.picker = false;
    updateAll();
    if (state.statusNode) {
      state.statusNode.textContent = `Added "${canon(record.name) || id}".`;
    }
  };

  const renderPicker = () => {
    if (!pickerSection) return;
    clearDynamic();
    pickerSection.innerHTML = '';

    const intro = document.createElement('p');
    intro.className = 'muted';
    intro.textContent = state.picker ? 'Pick at least two partners to enable merging.' : 'Choose which partner to keep and which to merge.';
    pickerSection.appendChild(intro);

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '8px';
    controls.style.marginBottom = '8px';

    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = 'Enter partner ID';
    addInput.className = 'merge-picker-input';
    addInput.style.flex = '1';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn';
    addBtn.textContent = 'Add';

    registerDynamic(addBtn, 'click', async (event) => {
      event.preventDefault();
      const value = addInput.value;
      addInput.value = '';
      await addPartner(value);
    });
    registerDynamic(addInput, 'keydown', async (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const value = addInput.value;
      addInput.value = '';
      await addPartner(value);
    });

    controls.appendChild(addInput);
    controls.appendChild(addBtn);
    pickerSection.appendChild(controls);

    const status = document.createElement('div');
    status.className = 'merge-picker-status muted';
    status.style.minHeight = '18px';
    status.style.marginBottom = '8px';
    pickerSection.appendChild(status);
    state.statusNode = status;

    const ids = selectionSnapshot();
    if (!ids.length) {
      status.textContent = 'No partners selected yet.';
      return;
    }

    const list = document.createElement('div');
    list.className = 'merge-picker-list';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';

    ids.forEach((id) => {
      const record = state.records.get(id);
      if (!record) return;
      const row = document.createElement('div');
      row.className = 'merge-picker-row';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = 'auto 1fr auto auto';
      row.style.alignItems = 'center';
      row.style.gap = '12px';
      row.style.padding = '8px 10px';
      row.style.border = '1px solid #e2e8f0';
      row.style.borderRadius = '8px';
      row.style.background = '#f8fafc';

      const primaryRadio = document.createElement('input');
      primaryRadio.type = 'radio';
      primaryRadio.name = 'merge-primary';
      primaryRadio.value = id;
      primaryRadio.checked = state.primaryId === id;
      registerDynamic(primaryRadio, 'change', () => {
        if (state.primaryId === id) return;
        state.primaryId = id;
        if (state.secondaryId === id) state.secondaryId = '';
        updateAll();
      });

      const details = document.createElement('div');
      details.style.display = 'flex';
      details.style.flexDirection = 'column';
      details.style.gap = '2px';

      const title = document.createElement('div');
      title.style.fontWeight = '600';
      title.textContent = canon(record.name) || record.company || record.email || `Partner ${id}`;
      details.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'muted';
      meta.style.fontSize = '12px';
      const metaParts = [];
      if (record.company) metaParts.push(record.company);
      if (record.city) metaParts.push(record.city);
      if (!metaParts.length && record.email) metaParts.push(record.email);
      meta.textContent = metaParts.length ? metaParts.join(' • ') : `ID: ${id}`;
      details.appendChild(meta);

      const secondaryRadio = document.createElement('input');
      secondaryRadio.type = 'radio';
      secondaryRadio.name = 'merge-secondary';
      secondaryRadio.value = id;
      secondaryRadio.checked = state.secondaryId === id;
      secondaryRadio.disabled = id === state.primaryId;
      registerDynamic(secondaryRadio, 'change', () => {
        if (id === state.primaryId) return;
        state.secondaryId = id;
        updateAll();
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn link';
      removeBtn.textContent = 'Remove';
      registerDynamic(removeBtn, 'click', (event) => {
        event.preventDefault();
        removePartner(id);
      });

      row.appendChild(primaryRadio);
      row.appendChild(details);
      row.appendChild(secondaryRadio);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });

    pickerSection.appendChild(list);
  };

  const updateAll = () => {
    state.picker = selectionSnapshot().length < 2;
    ensureSelectionCoherence();
    renderPicker();
    const { primary, secondary, valid } = computeState();
    const changed = renderPreviewSection(primary, secondary, valid);
    updateSummary(primary, secondary, valid, changed);
    updateConfirmState();
  };

  updateAll();

  return new Promise((resolve) => {
    const cleanup = (result) => {
      clearDynamic();
      while (listeners.length) {
        const stop = listeners.pop();
        try { stop(); }
        catch (_) {}
      }
      try { dlg.close(); }
      catch (_) { dlg.removeAttribute('open'); }
      resolve(result);
    };

    const onConfirm = (event) => {
      event && event.preventDefault();
      if (state.submitting || !state.isValidMerge) return;
      state.submitting = true;
      updateConfirmState();
      cleanup({ confirmed: true, primaryId: state.primaryId, secondaryId: state.secondaryId });
    };
    const onCancel = (event) => {
      event && event.preventDefault();
      cleanup({ confirmed: false });
    };
    const onSubmit = (event) => {
      event && event.preventDefault();
      onConfirm(event);
    };

    register(confirmBtn, 'click', onConfirm);
    register(cancelBtn, 'click', onCancel);
    register(form, 'submit', onSubmit);

    try {
      dlg.showModal();
    } catch (_) {
      dlg.setAttribute('open', '');
    }
  });
}

async function executeMerge(primaryId, secondaryId) {
  const winnerId = String(primaryId || '').trim();
  const loserId = String(secondaryId || '').trim();
  if (!winnerId || !loserId || winnerId === loserId) {
    console.warn('[partners_merge] invalid merge selection', { winnerId, loserId });
    return null;
  }
  await (async () => {
    if (typeof openDB !== 'function') return;
    try { await openDB(); }
    catch (err) { console.warn('[partners_merge] openDB failed', err); }
  })();

  const [keep, drop] = await Promise.all([
    typeof dbGet === 'function' ? dbGet('partners', winnerId).catch(() => null) : Promise.resolve(null),
    typeof dbGet === 'function' ? dbGet('partners', loserId).catch(() => null) : Promise.resolve(null)
  ]);

  if (!keep || !drop) {
    if (window.toast) {
      window.toast('Unable to load selected partners.');
    } else {
      console.info('Unable to load selected partners.');
    }
    return null;
  }

  if (typeof window.mergePartners !== 'function') {
    console.warn('mergePartners API missing');
    return null;
  }

  const result = await window.mergePartners(keep.id, drop.id, { preview: false });
  setPartnerSelection([keep.id]);
  if (window.toast) {
    window.toast(`Merged "${canon(drop.name) || drop.id}" into "${canon(keep.name) || keep.id}"`);
  }
  return result;
}

async function performMerge(initialIds) {
  const ids = normalizeSelectionIds(initialIds);
  const outcome = await openMergeModal({ selectionIds: ids, picker: ids.length < 2 });
  if (!outcome || !outcome.confirmed) return null;
  const pair = normalizeSelectionIds([outcome.primaryId, outcome.secondaryId]);
  if (pair.length !== 2) return null;
  return executeMerge(pair[0], pair[1]);
}

function initActionBarBridge() {
  ensurePartnersMergeButton();
  onPartnersMerge(() => {
    const ids = currentPartnerSelection();
    performMerge(ids);
  });
}

function updateButton() {
  const ids = currentPartnerSelection();
  const count = ids.length;
  setPartnersMergeState({ visible: count > 0, enabled: count > 0 });
}

function subscribeSelection() {
  const store = getSelectionStore();
  if (!store || subscribeSelection.__wired) return;
  subscribeSelection.__wired = true;
  store.subscribe((snapshot) => {
    if (!snapshot || snapshot.scope !== 'partners') return;
    updateButton();
  });
}

initActionBarBridge();
subscribeSelection();
updateButton();
document.addEventListener('app:data:changed', (evt) => {
  if (!evt || !evt.detail) return;
  if (evt.detail.scope === 'partners' || evt.detail.scope === 'import') {
    updateButton();
  }
});
