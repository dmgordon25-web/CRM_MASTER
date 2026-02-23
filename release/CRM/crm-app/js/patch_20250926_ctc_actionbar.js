// patch_20250926_ctc_actionbar.js — stage canonicalization + hardened action bar

console.log('[patch_20250926_ctc_actionbar] Loading...');

function setDisabled(btn, disabled) {
  if (!btn) return;
  btn.disabled = !!disabled;
  if (btn.classList) {
    if (disabled) btn.classList.add('disabled');
    else btn.classList.remove('disabled');
  }
}

let __wired = false;
function domReady() { if (['complete', 'interactive'].includes(document.readyState)) return Promise.resolve(); return new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true })); }
function ensureCRM() { window.CRM = window.CRM || {}; window.CRM.health = window.CRM.health || {}; window.CRM.modules = window.CRM.modules || {}; }

function runPatch() {
  if (!window.__WIRED_ACTIONBAR_MERGE_DELEGATE__) {
    window.__WIRED_ACTIONBAR_MERGE_DELEGATE__ = true;

    // Include data-act="merge" — this is the critical selector per current DOM
    const MERGE_SELECTORS = ['[data-act="merge"]', '[data-action="merge"]', '.action-merge', '#btnMerge'];

    function getSelectedIds() {
      try { if (window.Selection?.getSelectedIds) return window.Selection.getSelectedIds() || []; } catch (_) { }
      try { if (window.SelectionService?.getSelectedIds) return window.SelectionService.getSelectedIds() || []; } catch (_) { }
      try {
        return Array.from(document.querySelectorAll(
          '[data-selectable].selected,[data-row].is-selected,tr.selected,[data-selected="true"]'
        )).map(el => el.getAttribute('data-id') || el.id).filter(Boolean);
      } catch (_) { }
      return [];
    }

    function inferViewFromDOM() {
      // Priority 1: active tab
      const activeTab = document.querySelector('.tab.active[data-tab]');
      if (activeTab?.getAttribute('data-tab')) return activeTab.getAttribute('data-tab').toLowerCase();
      // Priority 2: explicit route flag
      if (window.__ROUTE__) return String(window.__ROUTE__).toLowerCase();
      // Priority 3: visible view roots
      if (document.querySelector('#contacts-view,[data-view="contacts"],.contacts-view')) return 'contacts';
      if (document.querySelector('#partners-view,[data-view="partners"],.partners-view')) return 'partners';
      // Priority 4: from selected rows’ container
      const row = document.querySelector('[data-selectable].selected, tr.selected, [data-row].is-selected');
      if (row) {
        const host = row.closest('[data-view], .contacts-view, .partners-view, #contacts-view, #partners-view');
        const tag = host?.getAttribute?.('data-view') || (host?.className || '') + ' ' + (host?.id || '');
        if (/partners/i.test(tag)) return 'partners';
        if (/contacts/i.test(tag)) return 'contacts';
      }
      return '';
    }

    document.addEventListener('click', async (e) => {
      const trigger = e.target?.closest?.(MERGE_SELECTORS.join(',')) || null;
      if (!trigger) return;

      const ids = getSelectedIds();
      if (ids.length !== 2) return; // enablement already handled; double-check anyway

      const view = inferViewFromDOM();
      try {
        if (view === 'contacts') {
          const m = await import('./contacts_merge_orchestrator.js');
          if (m && m.openContactsMergeByIds) m.openContactsMergeByIds(ids[0], ids[1]);
        } else if (view === 'partners') {
          const m = await import('./partners_merge_orchestrator.js');
          if (m && m.openPartnersMergeByIds) m.openPartnersMergeByIds(ids[0], ids[1]);
        } else {
          console.warn('[merge] Unable to infer active view; expected contacts or partners. ids=', ids);
        }
      } catch (err) {
        console.warn('[soft] [merge] handler failed', err);
      }
    }, false);
  }

  if (!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if (window.__INIT_FLAGS__.patch_20250926_ctc_actionbar) return;
  window.__INIT_FLAGS__.patch_20250926_ctc_actionbar = true;
  if (Array.isArray(window.__PATCHES_LOADED__) && !window.__PATCHES_LOADED__.includes('/js/patch_20250926_ctc_actionbar.js')) {
    window.__PATCHES_LOADED__.push('/js/patch_20250926_ctc_actionbar.js');
  }

  const STAGE_SYNONYMS = {
    'cleared-to-close': 'cleared-to-close',
    'clear-to-close': 'cleared-to-close',
    'cleared to close': 'cleared-to-close',
    'ctc': 'cleared-to-close',
    'pre-approved': 'preapproved',
    'pre approved': 'preapproved',
    'post close': 'post-close',
    'postclose': 'post-close',
    'closed': 'post-close',
    'client': 'post-close',
    'won': 'funded',
    'declined': 'denied',
    'denied': 'denied',
    'lost': 'lost'
  };
  const KNOWN_STAGE_LOOKUP = {
    'application': true,
    'preapproved': true,
    'processing': true,
    'underwriting': true,
    'approved': true,
    'cleared-to-close': true,
    'funded': true,
    'post-close': true,
    'nurture': true,
    'lost': true,
    'denied': true,
    'long-shot': true
  };
  const STAGE_LABELS = {
    application: 'Application',
    processing: 'Processing',
    underwriting: 'Underwriting',
    approved: 'Approved',
    'cleared-to-close': 'Cleared to Close',
    funded: 'Funded',
    'post-close': 'Post-Close',
    nurture: 'Nurture',
    lost: 'Lost',
    denied: 'Denied',
    'long-shot': 'Lead'
  };
  const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
  const warnedMissing = new Set();

  function canonicalizeStage(value) {
    const raw = String(value == null ? '' : value).trim().toLowerCase();
    if (!raw) return 'application';
    const normalized = raw.replace(/[\s_]+/g, '-');
    if (Object.prototype.hasOwnProperty.call(STAGE_SYNONYMS, normalized)) return STAGE_SYNONYMS[normalized];
    if (Object.prototype.hasOwnProperty.call(KNOWN_STAGE_LOOKUP, normalized)) return normalized;
    return 'application';
  }
  window.canonicalizeStage = canonicalizeStage;

  function canonicalizeContact(record) {
    if (!record || typeof record !== 'object') return record;
    const next = canonicalizeStage(record.stage);
    if (next === record.stage) return record;
    return Object.assign({}, record, { stage: next });
  }

  function patchStageFunction(name, stageIndex) {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function () {
      const args = Array.from(arguments);
      if (stageIndex != null && args.length > stageIndex) {
        args[stageIndex] = canonicalizeStage(args[stageIndex]);
      }
      if (name === 'upsertContact' && args[0] && typeof args[0] === 'object') {
        args[0] = canonicalizeContact(args[0]);
      }
      const result = original.apply(this, args);
      if (result && typeof result.then === 'function') {
        return result.then(res => {
          if (typeof res === 'string') return canonicalizeStage(res);
          if (res && typeof res === 'object' && 'stage' in res) {
            res.stage = canonicalizeStage(res.stage);
          }
          return res;
        });
      }
      if (typeof result === 'string') return canonicalizeStage(result);
      if (result && typeof result === 'object' && 'stage' in result) {
        result.stage = canonicalizeStage(result.stage);
      }
      return result;
    };
  }

  patchStageFunction('setContactStage', 1);
  patchStageFunction('moveCardToStage', 1);
  patchStageFunction('upsertContact', 0);

  function patchDbHelpers() {
    if (typeof window.dbPut === 'function') {
      const original = window.dbPut;
      window.dbPut = function (store, obj) {
        const next = (store === 'contacts' && obj) ? canonicalizeContact(obj) : obj;
        return original.call(this, store, next);
      };
    }
    if (typeof window.dbBulkPut === 'function') {
      const original = window.dbBulkPut;
      window.dbBulkPut = function (store, list) {
        const nextList = (store === 'contacts' && Array.isArray(list))
          ? list.map(item => canonicalizeContact(item))
          : list;
        return original.call(this, store, nextList);
      };
    }
    if (typeof window.dbRestoreAll === 'function') {
      const original = window.dbRestoreAll;
      window.dbRestoreAll = async function (snapshot, mode) {
        await original.apply(this, arguments);
        try {
          await normalizeStagesOnBoot(true);
        } catch (_err) { }
      };
    }
  }
  patchDbHelpers();

  (function () {
    const arrProto = Array.prototype;
    if (!arrProto.__stageSynonymPatched) {
      const originalIncludes = arrProto.includes;
      Object.defineProperty(arrProto, 'includes', {
        value: function (searchElement) {
          if (typeof searchElement === 'string') {
            const norm = canonicalizeStage(searchElement);
            if (norm === 'cleared-to-close') {
              const idx = arguments.length > 1 ? arguments[1] : undefined;
              if (originalIncludes.call(this, 'cleared-to-close', idx)) return true;
              if (originalIncludes.call(this, 'ctc', idx)) return true;
              if (originalIncludes.call(this, 'clear-to-close', idx)) return true;
            }
          }
          return originalIncludes.apply(this, arguments);
        },
        configurable: true,
        writable: true
      });
      Object.defineProperty(arrProto, '__stageSynonymPatched', { value: true });
    }
    const setProto = Set.prototype;
    if (!setProto.__stageSynonymPatched) {
      const originalHas = setProto.has;
      Object.defineProperty(setProto, 'has', {
        value: function (value) {
          if (typeof value === 'string') {
            const norm = canonicalizeStage(value);
            if (norm === 'cleared-to-close') {
              if (originalHas.call(this, 'cleared-to-close')) return true;
              if (originalHas.call(this, 'ctc')) return true;
              if (originalHas.call(this, 'clear-to-close')) return true;
            }
          }
          return originalHas.call(this, value);
        },
        configurable: true,
        writable: true
      });
      Object.defineProperty(setProto, '__stageSynonymPatched', { value: true });
    }
  })();

  function toast(msg) {
    try {
      if (typeof window.toast === 'function') { window.toast(msg); return; }
    } catch (_err) { }
    console.log('[toast]', msg);
  }

  function warnMissing(name) {
    if (warnedMissing.has(name)) return;
    warnedMissing.add(name);
    console.warn('[actionbar] missing handler:', name);
  }

  function assignActionLabel(btn, label, qa) {
    if (!btn) return;
    if (qa) btn.dataset.qa = qa;
    try { btn.setAttribute('aria-label', label); }
    catch (_err) { }
    btn.title = label;
    if (btn.dataset && btn.dataset.bulkLabelApplied === label) return;
    const labelNode = btn.querySelector('[data-role="label"], .btn-label');
    if (labelNode) {
      labelNode.textContent = label;
    } else {
      btn.textContent = label;
    }
    if (btn.dataset) btn.dataset.bulkLabelApplied = label;
  }

  function resolveRowId(node) {
    if (!node) return null;
    const attrs = ['data-contact-id', 'data-partner-id', 'data-id', 'data-row-id'];
    for (const attr of attrs) {
      const direct = node.getAttribute && node.getAttribute(attr);
      if (direct) return String(direct);
    }
    if (node.dataset) {
      if (node.dataset.id) return String(node.dataset.id);
      if (node.dataset.contactId) return String(node.dataset.contactId);
      if (node.dataset.partnerId) return String(node.dataset.partnerId);
      if (node.dataset.rowId) return String(node.dataset.rowId);
    }
    const row = node.closest ? node.closest('[data-id],[data-contact-id],[data-partner-id],[data-row-id],tr') : null;
    if (row) {
      for (const attr of attrs) {
        const val = row.getAttribute(attr);
        if (val) return String(val);
      }
      if (row.dataset) {
        if (row.dataset.id) return String(row.dataset.id);
        if (row.dataset.contactId) return String(row.dataset.contactId);
        if (row.dataset.partnerId) return String(row.dataset.partnerId);
        if (row.dataset.rowId) return String(row.dataset.rowId);
      }
    }
    if (node.closest && window.__NAME_ID_MAP__) {
      const cell = node.closest('[data-name]');
      if (cell && cell.dataset && cell.dataset.name) {
        const lookup = window.__NAME_ID_MAP__[cell.dataset.name];
        if (lookup) return String(lookup);
      }
    }
    return null;
  }

  function detectRowType(node) {
    const table = node.closest ? node.closest('table') : null;
    if (!table) return 'contacts';
    const hints = [
      table.getAttribute('data-entity'),
      table.getAttribute('data-type'),
      table.getAttribute('aria-label'),
      table.dataset ? (table.dataset.scope || table.dataset.type || table.dataset.selectionScope || table.dataset.selectionType) : null
    ].filter(Boolean).join(' ').toLowerCase();
    if (hints.includes('partner')) return 'partners';
    if (hints.includes('pipeline')) return 'pipeline';
    return 'contacts';
  }

  let SelectionService = window.SelectionService;

  function legacySelectionGetIds(obj) {
    if (!obj) return [];
    try {
      if (typeof obj.getSelectedIds === 'function') {
        const ids = obj.getSelectedIds();
        if (Array.isArray(ids)) return ids.map(String);
        if (ids instanceof Set) return Array.from(ids).map(String);
      }
      if (typeof obj.get === 'function') {
        const snap = obj.get();
        if (snap && Array.isArray(snap.ids)) return snap.ids.map(String);
      }
      if (Array.isArray(obj.ids)) return obj.ids.map(String);
      if (obj.ids instanceof Set) return Array.from(obj.ids).map(String);
      if (obj.ids && typeof obj.ids.size === 'number' && typeof obj.ids.values === 'function') {
        return Array.from(obj.ids.values()).map(String);
      }
    } catch (_err) { }
    return [];
  }

  function isLegacySelection(obj) {
    if (!obj || typeof obj !== 'object') return false;
    return typeof obj.add === 'function'
      || typeof obj.remove === 'function'
      || typeof obj.toggle === 'function'
      || typeof obj.clear === 'function'
      || typeof obj.get === 'function'
      || typeof obj.set === 'function';
  }

  function adaptLegacySelection(legacy) {
    if (!isLegacySelection(legacy)) return null;
    const adapter = {
      add(id, type) {
        if (typeof legacy.add === 'function') legacy.add(id, type);
        else if (typeof legacy.toggle === 'function') legacy.toggle(id, type);
      },
      remove(id) {
        if (typeof legacy.remove === 'function') legacy.remove(id);
        else if (typeof legacy.del === 'function') legacy.del(id);
        else if (typeof legacy.toggle === 'function') legacy.toggle(id);
      },
      clear(source) {
        if (typeof legacy.clear === 'function') legacy.clear(source);
      },
      count() {
        if (typeof legacy.count === 'function') return legacy.count();
        return legacySelectionGetIds(legacy).length;
      },
      getIds() {
        return legacySelectionGetIds(legacy);
      },
      idsOf(type) {
        if (typeof legacy.idsOf === 'function') return legacy.idsOf(type);
        const ids = legacySelectionGetIds(legacy);
        if (!type) return ids;
        return ids;
      },
      syncChecks() {
        if (typeof legacy.syncChecks === 'function') legacy.syncChecks();
        else if (typeof legacy.syncCheckboxes === 'function') legacy.syncCheckboxes();
      },
      set(ids, type, source) {
        if (typeof legacy.set === 'function') legacy.set(ids, type, source);
      },
      prune(ids, source) {
        if (typeof legacy.prune === 'function') return legacy.prune(ids, source);
        let changed = false;
        const list = Array.isArray(ids) ? ids : [];
        list.forEach(id => {
          const before = this.count();
          this.remove(id);
          if (this.count() !== before) changed = true;
        });
        return changed;
      },
      toggle(id, type) {
        if (typeof legacy.toggle === 'function') legacy.toggle(id, type);
        else if (typeof legacy.add === 'function') {
          const key = String(id);
          const ids = this.getIds();
          if (ids.includes(key)) this.remove(key);
          else this.add(key, type);
        }
      },
      snapshot() {
        if (typeof legacy.snapshot === 'function') return legacy.snapshot();
        const data = typeof legacy.get === 'function' ? legacy.get() : null;
        return {
          ids: legacySelectionGetIds(legacy),
          type: data && data.type ? data.type : (typeof legacy.type === 'string' ? legacy.type : 'contacts')
        };
      },
      restore(snap, source) {
        if (typeof legacy.restore === 'function') return legacy.restore(snap, source);
        if (typeof legacy.set === 'function') return legacy.set(snap && snap.ids ? snap.ids : [], snap && snap.type ? snap.type : undefined, source);
      },
      reemit(detail) {
        if (typeof legacy.reemit === 'function') return legacy.reemit(detail);
      }
    };
    Object.defineProperty(adapter, 'type', {
      get() {
        if (typeof legacy.type === 'string') return legacy.type;
        const data = typeof legacy.get === 'function' ? legacy.get() : null;
        return data && data.type ? data.type : 'contacts';
      },
      set(value) {
        if (legacy && typeof legacy.type !== 'undefined') legacy.type = value;
      }
    });
    Object.defineProperty(adapter, 'ids', {
      get() {
        if (legacy && legacy.ids instanceof Set) return legacy.ids;
        return new Set(legacySelectionGetIds(legacy));
      }
    });
    Object.defineProperty(adapter, 'items', {
      get() {
        if (legacy && legacy.items instanceof Map) return legacy.items;
        const type = adapter.type;
        return new Map(legacySelectionGetIds(legacy).map(id => [id, { type }]));
      }
    });
    return adapter;
  }

  function isSelectionService(obj) {
    if (!obj || typeof obj !== 'object') return false;
    return typeof obj.add === 'function'
      && typeof obj.remove === 'function'
      && typeof obj.clear === 'function'
      && typeof obj.count === 'function'
      && typeof obj.getIds === 'function';
  }

  function ensureSelectionService() {
    if (isSelectionService(SelectionService)) return true;
    if (isSelectionService(window.SelectionService)) {
      SelectionService = window.SelectionService;
      return true;
    }
    if (window.SelectionService && isLegacySelection(window.SelectionService)) {
      const adapted = adaptLegacySelection(window.SelectionService);
      if (adapted) {
        SelectionService = adapted;
        window.SelectionService = adapted;
        return true;
      }
    }
    if (isLegacySelection(window.Selection)) {
      const adapted = adaptLegacySelection(window.Selection);
      if (adapted) {
        SelectionService = adapted;
        window.SelectionService = adapted;
        return true;
      }
    }
    return false;
  }

  let syncScheduled = false;
  function scheduleSyncChecks() {
    if (!ensureSelectionService()) return;
    const svc = SelectionService;
    if (!svc || typeof svc.syncChecks !== 'function') return;
    if (syncScheduled) return;
    syncScheduled = true;
    raf(() => {
      syncScheduled = false;
      try { svc.syncChecks(); }
      catch (err) { console.warn('selection sync', err); }
    });
  }

  let selectionVersion = 0;
  let selectionTickScheduled = false;
  let selectionLockWait = false;
  const pendingActions = new Map();
  const actionState = { busy: false, current: null };
  let __ab_toast_lock = false;
  const showToast = (m) =>
    (window.Toast && typeof window.Toast.show === 'function' && window.Toast.show(m)) ||
    (typeof Toast !== 'undefined' && typeof Toast.show === 'function' && Toast.show(m));

  async function handleActionSuccess() {
    if (!__ab_toast_lock) {
      __ab_toast_lock = true;
      try { showToast('Action completed'); }
      finally { setTimeout(() => { __ab_toast_lock = false; }, 250); }
    }
  }

  function currentView() {
    if (typeof window.__ROUTE__ === 'string' && window.__ROUTE__) {
      return window.__ROUTE__;
    }
    try {
      const activeMain = document.querySelector('main[id^="view-"]:not(.hidden)');
      if (activeMain && typeof activeMain.id === 'string') {
        return activeMain.id.replace(/^view-/, '') || 'dashboard';
      }
    } catch (_err) { }
    try {
      const activeNav = document.querySelector('#main-nav button[data-nav].active');
      if (activeNav) {
        const navTarget = activeNav.getAttribute('data-nav');
        if (navTarget) return navTarget;
      }
    } catch (_err) { }
    try {
      const hash = typeof window.location?.hash === 'string' ? window.location.hash : (typeof location?.hash === 'string' ? location.hash : '');
      if (hash) {
        const cleaned = hash.replace(/^#/, '').replace(/^\//, '');
        if (cleaned) {
          const segment = cleaned.split('/')[0];
          if (segment) return segment;
        }
      }
    } catch (_err) { }
    return 'dashboard';
  }

  function queueSelectionTick() {
    if (selectionTickScheduled) return;
    selectionTickScheduled = true;
    raf(() => {
      selectionTickScheduled = false;
      if (window.__RENDER_LOCK__) {
        if (selectionLockWait) return;
        selectionLockWait = true;
        raf(() => {
          selectionLockWait = false;
          queueSelectionTick();
        });
        return;
      }
      selectionVersion++;
      scheduleDetailHydration();
    });
  }
  let lastHydratedVersion = 0;
  let hydrationPromise = null;
  let detailStore = { contacts: [], partners: [] };

  function actionbar() {
    if (typeof document === 'undefined') return null;
    return document.querySelector('[data-ui="action-bar"]') || document.getElementById('actionbar');
  }

  function applyActionBarCount(bar, count) {
    if (!bar) return;
    const numeric = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    const text = String(numeric);
    bar.dataset.count = text;
    bar.setAttribute('data-count', text);
  }

  function syncActionBarVisibility(selCount) {
    if (typeof document === 'undefined') return;
    const bar = actionbar();
    if (!bar) return;
    const numeric = typeof selCount === 'number' && Number.isFinite(selCount) ? selCount : 0;

    // COOPERATIVE FIX: Only toggle attributes, do NOT force display styles that might conflict with drag/drop or animations
    if (numeric > 0) {
      bar.setAttribute('data-visible', '1');
      bar.setAttribute('data-idle-visible', '1');
      if (bar.hasAttribute('data-minimized')) {
        bar.removeAttribute('data-minimized');
      }
      bar.setAttribute('aria-expanded', 'true');
      applyActionBarCount(bar, numeric);
      // RESTORE DRAG: Ensure it's draggable when visible
      bar.setAttribute('draggable', 'true');
    } else {
      // When 0, allow it to be minimized (pill state) or hidden by CSS
      bar.removeAttribute('data-visible');
      bar.removeAttribute('data-idle-visible');
      bar.setAttribute('data-minimized', '1');
      bar.setAttribute('aria-expanded', 'false');
      applyActionBarCount(bar, 0);
      // Optional: remove draggable if hidden, but keeping it doesn't hurt. 
      // We'll leave it to avoid flickering state.
    }

    if (typeof window !== 'undefined') {
      if (typeof window.applyActionBarGuards === 'function') {
        try { window.applyActionBarGuards(bar, numeric); }
        catch (_) { }
      }
    }
  }

  function deselectAllRows() {
    // 1. Reset DOM elements (visual state)
    if (typeof document !== 'undefined') {
      const rowChecks = document.querySelectorAll('[data-ui="row-check"]');
      for (let i = 0; i < rowChecks.length; i++) {
        const node = rowChecks[i];
        if (node) {
          if (node.removeAttribute) node.removeAttribute('aria-checked');
          if ('checked' in node) {
            try { node.checked = false; node.indeterminate = false; } catch (_) { }
          }
          const row = node.closest('[data-id],[data-row]');
          if (row) {
            if (row.removeAttribute) {
              row.removeAttribute('data-selected');
              row.removeAttribute('aria-selected');
            }
            if (row.classList) {
              row.classList.remove('selected');
              row.classList.remove('is-selected');
            }
          }
        }
      }

      // 2. Clear Select All headers
      const headers = document.querySelectorAll('[data-ui="row-check-all"], [data-role="select-all"]');
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        if (h && h instanceof HTMLInputElement) {
          h.checked = false;
          h.indeterminate = false;
          h.setAttribute('aria-checked', 'false');
        }
      }
    }

    // 3. Clear Service State (Single Source of Truth)
    if (ensureSelectionService()) {
      try {
        if (typeof SelectionService.clear === 'function') {
          // Pass a distinct source to avoid loops if the service echoes back
          SelectionService.clear('patch_20250926:hard_reset');
        }
      } catch (err) { console.warn('SelectionService.clear failed', err); }
    }

    // 4. Force-Clear known globals purely as backup
    if (typeof window !== 'undefined') {
      try { window.Selection?.clear?.('patch_20250926:hard_reset'); } catch (_) { }
      try { window.SelectionStore?.clear?.('partners'); } catch (_) { }
      try { window.SelectionStore?.clear?.('leads'); } catch (_) { }
      try { window.SelectionStore?.clear?.('partners:active'); } catch (_) { }
    }
  }

  function wireActionbarRules() {
    if (window.__WIRED_ACTIONBAR_RULES__) return window.__APPLY_ACTIONBAR_RULES__;
    window.__WIRED_ACTIONBAR_RULES__ = true;
    const noop = () => { };
    window.__APPLY_ACTIONBAR_RULES__ = noop;
    return noop;
  }

  function updatePrimaryButtons() { }

  wireActionbarRules();

  function ensureConvertButton() {
    const bar = actionbar();
    if (!bar) return null;
    const host = bar.querySelector('.actionbar-actions');
    if (!host) return null;
    let btn = host.querySelector('[data-act="convertPipeline"]');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.className = 'btn';
    btn.type = 'button';
    btn.dataset.act = 'convertPipeline';
    btn.textContent = 'Move to Pipeline';
    const clearBtn = host.querySelector('[data-act="clear"]');
    if (clearBtn && clearBtn.parentNode === host) {
      host.insertBefore(btn, clearBtn);
    } else {
      host.appendChild(btn);
    }
    btn.disabled = true;
    if (btn.classList && typeof btn.classList.add === 'function') btn.classList.add('disabled');
    return btn;
  }

  function isLongShotRecord(contact) {
    if (!contact) return false;
    const status = String(contact.status || '').toLowerCase();
    const stage = canonicalizeStage(contact.stage);
    if (status === 'longshot') return true;
    if (stage === 'long-shot') return true;
    return false;
  }

  function updateConvertButtonState(data) {
    const btn = ensureConvertButton();
    if (!btn) return;
    const eligible = data && Array.isArray(data.contacts) && data.contacts.length === 1 && isLongShotRecord(data.contacts[0]);
    btn.disabled = !eligible;
    if (btn.classList && typeof btn.classList.toggle === 'function') {
      btn.classList.toggle('disabled', !eligible);
    }
  }

  function labelForStage(stage) {
    const key = canonicalizeStage(stage);
    if (STAGE_LABELS[key]) return STAGE_LABELS[key];
    return key ? key.replace(/-/g, ' ') : 'Application';
  }


  function getSelectionStoreSnapshot() {
    const store = (typeof window !== 'undefined' && window.SelectionStore) ? window.SelectionStore : null;
    if (!store || typeof store.count !== 'function' || typeof store.get !== 'function') {
      return { scope: (SelectionService && SelectionService.type) || 'contacts', ids: [], count: 0 };
    }
    const scopes = ['contacts', 'partners', 'pipeline'];
    for (const scope of scopes) {
      const count = Number(store.count(scope)) || 0;
      if (count > 0) {
        const ids = Array.from(store.get(scope) || []).map(String);
        return { scope, ids, count: ids.length || count };
      }
    }
    return { scope: 'contacts', ids: [], count: 0 };
  }

  function updateActionbarBase() {
    const bar = actionbar();
    if (!bar) return;
    ensureConvertButton();
    assignActionLabel(bar.querySelector('[data-act="task"]'), 'Schedule Follow-Up for Selected', 'bulk-followup');
    assignActionLabel(bar.querySelector('[data-act="bulkLog"]'), 'Log Call for Selected', 'bulk-logcall');
    const storeSnapshot = getSelectionStoreSnapshot();
    let count = Number(storeSnapshot.count) || 0;
    if (!Number.isFinite(count)) count = 0;
    count = count > 0 ? Math.max(0, Math.floor(count)) : 0;
    syncActionBarVisibility(count);
    if (typeof window.applyActionBarGuards === 'function') {
      try { window.applyActionBarGuards(bar, count); }
      catch (err) { console.warn('applyActionBarGuards failed', err); }
    } else if (typeof window.computeActionBarGuards === 'function') {
      try {
        const guards = window.computeActionBarGuards(count);
        const acts = {
          edit: 'edit',
          merge: 'merge',
          emailTogether: 'emailTogether',
          emailMass: 'emailMass',
          addTask: 'task',
          bulkLog: 'bulkLog',
          convertToPipeline: 'convertPipeline',
          delete: 'delete',
          clear: 'clear'
        };
        Object.entries(acts).forEach(([key, act]) => {
          const btn = bar.querySelector(`[data-act="${act}"]`);
          if (!btn) return;
          const enabled = !!guards[key];
          btn.disabled = !enabled;
          if (btn.classList && typeof btn.classList.toggle === 'function') {
            btn.classList.toggle('disabled', !enabled);
          }
        });
      } catch (err) { console.warn('computeActionBarGuards failed', err); }
    }
    applyActionBarCount(bar, count);
    const countEl = bar.querySelector('[data-role="count"]');
    const breakdownEl = bar.querySelector('[data-role="breakdown"]');
    const amountEl = bar.querySelector('[data-role="amount"]');
    const namesEl = bar.querySelector('[data-role="names"]');
    const stagesEl = bar.querySelector('[data-role="stages"]');
    if (!count) {
      // CRITICAL: Don't set display:none - let syncActionBarVisibility handle visibility
      // This allows the minimized pill to show when count is 0
      bar.classList.remove('has-selection');
      bar.removeAttribute('data-selection-type');
      if (countEl) countEl.textContent = 'No records selected';
      if (breakdownEl) breakdownEl.textContent = 'Select rows to unlock pipeline actions.';
      if (amountEl) amountEl.textContent = '';
      if (namesEl) namesEl.textContent = 'No contacts or partners in focus yet.';
      if (stagesEl) stagesEl.innerHTML = '';
      detailStore = { contacts: [], partners: [] };
      lastHydratedVersion = selectionVersion;
      updateConvertButtonState(detailStore);
      syncActionBarVisibility(0);
      if (typeof window !== 'undefined' && typeof window.__UPDATE_ACTION_BAR_VISIBLE__ === 'function') {
        queueMicrotask(() => {
          try { window.__UPDATE_ACTION_BAR_VISIBLE__(); }
          catch (_) { }
        });
      }
      return;
    }
    bar.style.display = '';
    bar.classList.add('has-selection');
    bar.setAttribute('data-selection-type', storeSnapshot.scope);
    if (countEl) countEl.textContent = count === 1 ? '1 Selected' : `${count} Selected`;
    updatePrimaryButtons();
    syncActionBarVisibility(count);
    if (typeof window !== 'undefined' && typeof window.__UPDATE_ACTION_BAR_VISIBLE__ === 'function') {
      queueMicrotask(() => {
        try { window.__UPDATE_ACTION_BAR_VISIBLE__(); }
        catch (_) { }
      });
    }
  }

  async function fetchSelectionRecords() {
    if (!ensureSelectionService()) return { contacts: [], partners: [] };
    if (typeof window.openDB !== 'function') return { contacts: [], partners: [] };
    const storeSnapshot = getSelectionStoreSnapshot();
    const ids = storeSnapshot.ids;
    if (!ids.length) return { contacts: [], partners: [] };
    await window.openDB();
    const [contacts, partners] = await Promise.all([
      (typeof window.dbGetAll === 'function' ? window.dbGetAll('contacts') : Promise.resolve([])).catch(() => []),
      (typeof window.dbGetAll === 'function' ? window.dbGetAll('partners') : Promise.resolve([])).catch(() => [])
    ]);
    const contactMap = new Map((contacts || []).map(row => [String(row.id), row]));
    const partnerMap = new Map((partners || []).map(row => [String(row.id), row]));
    const data = { contacts: [], partners: [] };
    if (storeSnapshot.scope === 'partners') {
      SelectionService.getIds().forEach(id => {
        const row = partnerMap.get(String(id));
        if (row) data.partners.push(row);
      });
    } else {
      SelectionService.getIds().forEach(id => {
        const row = contactMap.get(String(id));
        if (row) data.contacts.push(row);
      });
    }
    return data;
  }

  function renderDetail(data) {
    if (!ensureSelectionService()) return;
    const bar = actionbar();
    if (!bar) return;
    const breakdownEl = bar.querySelector('[data-role="breakdown"]');
    const amountEl = bar.querySelector('[data-role="amount"]');
    const namesEl = bar.querySelector('[data-role="names"]');
    const stagesEl = bar.querySelector('[data-role="stages"]');
    const parts = [];
    if (data.contacts.length) parts.push(`${data.contacts.length} contact${data.contacts.length === 1 ? '' : 's'}`);
    if (data.partners.length) parts.push(`${data.partners.length} partner${data.partners.length === 1 ? '' : 's'}`);
    if (breakdownEl) {
      if (parts.length) {
        breakdownEl.textContent = parts.join(' • ');
      } else {
        breakdownEl.textContent = SelectionService.type === 'partners' ? 'Partners selected' : 'Contacts selected';
      }
    }
    if (amountEl) {
      if (data.contacts.length) {
        const total = data.contacts.reduce((sum, row) => sum + (Number(row.loanAmount) || 0), 0);
        amountEl.textContent = total ? `Pipeline Value: ${currencyFmt.format(total)}` : 'Pipeline Value: —';
      } else {
        amountEl.textContent = 'Pipeline Value: —';
      }
    }
    if (namesEl) {
      if (data.contacts.length) {
        const names = data.contacts.map(row => {
          const first = String(row.first || '').trim();
          const last = String(row.last || '').trim();
          if (first || last) return `${first} ${last}`.trim();
          return row.name || row.email || `Contact ${row.id}`;
        }).filter(Boolean);
        const preview = names.slice(0, 3);
        namesEl.textContent = preview.length ? preview.join(', ') + (names.length > 3 ? `, +${names.length - 3} more` : '') : 'Selected contacts ready for action.';
      } else if (data.partners.length) {
        const names = data.partners.map(row => row.name || row.company || `Partner ${row.id}`).filter(Boolean);
        const preview = names.slice(0, 3);
        namesEl.textContent = preview.length ? preview.join(', ') + (names.length > 3 ? `, +${names.length - 3} more` : '') : 'Selected partners ready for action.';
      } else {
        namesEl.textContent = 'Select rows to work with them together.';
      }
    }
    if (stagesEl) {
      if (data.contacts.length) {
        const counts = new Map();
        data.contacts.forEach(row => {
          const key = canonicalizeStage(row.stage);
          counts.set(key, (counts.get(key) || 0) + 1);
        });
        const chips = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([stage, total]) => `<span class="actionbar-stage-chip" data-stage="${stage}">${labelForStage(stage)} <strong>${total}</strong></span>`)
          .join('');
        stagesEl.innerHTML = chips;
      } else {
        stagesEl.innerHTML = '';
      }
    }
    updateConvertButtonState(data);
  }

  function scheduleDetailHydration() {
    if (!ensureSelectionService()) return;
    updateActionbarBase();
    if (!SelectionService.count()) {
      return;
    }
    const currentVersion = selectionVersion;
    hydrationPromise = (async () => {
      try {
        const data = await fetchSelectionRecords();
        if (currentVersion >= lastHydratedVersion) {
          lastHydratedVersion = currentVersion;
          detailStore = data;
          renderDetail(data);
        }
        return data;
      } catch (err) {
        console.warn('actionbar hydrate', err);
        return detailStore;
      }
    })();
  }

  async function ensureSelectionDetail() {
    if (!ensureSelectionService()) return { contacts: [], partners: [] };
    if (!SelectionService.count()) return { contacts: [], partners: [] };
    if (lastHydratedVersion === selectionVersion) return detailStore;
    if (hydrationPromise) {
      try { return await hydrationPromise; }
      catch (_err) { return detailStore; }
    }
    try {
      const data = await fetchSelectionRecords();
      detailStore = data;
      lastHydratedVersion = selectionVersion;
      return data;
    } catch (_err) {
      return detailStore;
    }
  }

  function logAction(meta) {
    if (!window.DEBUG) return;
    try {
      const action = meta && meta.action ? meta.action : 'unknown';
      const selected = meta && Array.isArray(meta.selected) ? `[${meta.selected.join(',')}]` : '[]';
      const result = meta && meta.result ? meta.result : 'unknown';
      console.info(`[ACTIONBAR] action=${action} selected=${selected} result=${result}`);
    } catch (_err) { }
  }

  const ACTION_BUSY_LABELS = new Map([
    ['edit', 'Opening editor'],
    ['merge', 'Preparing merge'],
    ['emailtogether', 'Preparing email'],
    ['emailmass', 'Building email list'],
    ['task', 'Creating tasks'],
    ['bulklog', 'Logging activity'],
    ['clear', 'Clearing selection'],
    ['delete', 'Deleting records']
  ]);
  const DEFAULT_BUSY_LABEL = 'Working';

  function labelForBusyAction(action) {
    if (!action) return DEFAULT_BUSY_LABEL;
    const key = String(action).trim().toLowerCase();
    if (!key) return DEFAULT_BUSY_LABEL;
    return ACTION_BUSY_LABELS.get(key) || DEFAULT_BUSY_LABEL;
  }

  function busyIndicator() {
    const bar = actionbar();
    if (!bar) return null;
    return bar.querySelector('[data-role="busy"]');
  }

  function updateBusyIndicator(action, label) {
    const indicator = busyIndicator();
    if (!indicator) return;
    const textEl = indicator.querySelector('[data-role="busy-label"]');
    if (action) {
      indicator.hidden = false;
      indicator.dataset.action = action;
      if (label) indicator.dataset.label = label;
      else indicator.removeAttribute('data-label');
      if (textEl) textEl.textContent = label || DEFAULT_BUSY_LABEL;
    } else {
      indicator.hidden = true;
      indicator.removeAttribute('data-action');
      indicator.removeAttribute('data-label');
      if (textEl) textEl.textContent = '';
    }
  }

  function setActionbarBusy(isBusy, action) {
    actionState.busy = !!isBusy;
    const bar = actionbar();
    if (!bar) return;
    bar.classList.toggle('is-busy', !!isBusy);
    if (isBusy) {
      const actionKey = action ? String(action) : '';
      const label = labelForBusyAction(actionKey);
      bar.setAttribute('data-busy-action', actionKey);
      bar.setAttribute('data-busy-label', label);
      bar.dataset.busy = 'true';
      updateBusyIndicator(actionKey, label);
    } else {
      bar.removeAttribute('data-busy-action');
      bar.removeAttribute('data-busy-label');
      delete bar.dataset.busy;
      updateBusyIndicator('', '');
    }
  }

  function emitSelectionAction(action, extra) {
    const payload = Object.assign({ source: `actionbar:${action}`, scope: 'selection', action }, extra && typeof extra === 'object' ? extra : {});
    if (typeof window.dispatchAppDataChanged === 'function') window.dispatchAppDataChanged(payload);
    else document.dispatchEvent(new CustomEvent('app:data:changed', { detail: payload }));
    return payload;
  }

  function finalizeAction(action, snapshot, result) {
    const status = result && result.status ? result.status : 'cancel';
    const detail = result && typeof result.detail === 'object' ? result.detail : null;
    const dispatchFlag = result && Object.prototype.hasOwnProperty.call(result, 'dispatch') ? result.dispatch : !!detail;
    const pruneIds = result && Array.isArray(result.prune) ? result.prune.map(String) : null;
    const shouldClear = !!(result && result.clear);
    const sourceBase = `action:${action}`;
    if (status === 'ok') {
      if (pruneIds && pruneIds.length && ensureSelectionService() && typeof SelectionService.prune === 'function') {
        SelectionService.prune(pruneIds, `${sourceBase}:prune`);
      }
      if (shouldClear) {
        if (ensureSelectionService() && typeof SelectionService.clear === 'function') {
          SelectionService.clear(`${sourceBase}:clear`);
        }
        // Also update all UI checkboxes when clearing
        deselectAllRows();
      } else if (ensureSelectionService() && typeof SelectionService.reemit === 'function') {
        SelectionService.reemit(`${sourceBase}:ok`);
      }
      if (dispatchFlag) {
        emitSelectionAction(action, Object.assign({ status: 'ok' }, detail || {}));
      }
    } else if (status === 'cancel') {
      if (snapshot && ensureSelectionService() && typeof SelectionService.restore === 'function') {
        SelectionService.restore(snapshot, `${sourceBase}:cancel`);
      } else if (ensureSelectionService() && typeof SelectionService.reemit === 'function') {
        SelectionService.reemit(`${sourceBase}:cancel`);
      }
    } else if (status === 'error') {
      if (snapshot && ensureSelectionService() && typeof SelectionService.restore === 'function') {
        SelectionService.restore(snapshot, `${sourceBase}:error`);
      } else if (ensureSelectionService() && typeof SelectionService.reemit === 'function') {
        SelectionService.reemit(`${sourceBase}:error`);
      }
    }
    setActionbarBusy(false, action);
    actionState.current = null;
    logAction({ action, selected: snapshot && Array.isArray(snapshot.ids) ? snapshot.ids : [], result: status });
    if (typeof window !== 'undefined') {
      const expected = window.__ACTION_BAR_LAST_DATA_ACTION__;
      if (expected) {
        if (expected === action && status === 'ok') {
          try { handleActionSuccess(); } catch (_) { }
        }
        if (expected === action || status !== 'pending') {
          window.__ACTION_BAR_LAST_DATA_ACTION__ = null;
        }
      }
    }
    return result;
  }

  function resolvePendingAction(event) {
    if (!pendingActions.size) return;
    if (event && event.type === 'app') {
      const detail = event.detail || {};
      const scope = String(detail.scope || detail.topic || '').toLowerCase();
      const sourceName = String(detail.source || '').toLowerCase();
      const contactId = detail.contactId || detail.id || detail.contactID;
      const partnerId = detail.partnerId || detail.id;
      for (const [token, entry] of pendingActions.entries()) {
        const monitor = entry && entry.monitor ? entry.monitor : null;
        if (!monitor || monitor.type !== 'edit') continue;
        if (monitor.entity === 'contacts') {
          if (sourceName === 'contact:modal' || scope === 'contacts') {
            if (!monitor.id || !contactId || String(contactId) === String(monitor.id)) {
              pendingActions.delete(token);
              finalizeAction(entry.action, entry.snapshot, { status: 'ok', clear: true, dispatch: false, detail });
              return;
            }
          }
        } else if (monitor.entity === 'partners') {
          if (sourceName === 'partner:modal' || scope === 'partners') {
            if (!monitor.id || !partnerId || String(partnerId) === String(monitor.id)) {
              pendingActions.delete(token);
              finalizeAction(entry.action, entry.snapshot, { status: 'ok', clear: true, dispatch: false, detail });
              return;
            }
          }
        }
      }
    } else if (event && event.type === 'close') {
      const target = event.target;
      if (!target || !target.id) return;
      const id = target.id;
      for (const [token, entry] of pendingActions.entries()) {
        const monitor = entry && entry.monitor ? entry.monitor : null;
        if (!monitor || monitor.type !== 'edit') continue;
        if ((id === 'contact-modal' && monitor.entity === 'contacts') || (id === 'partner-modal' && monitor.entity === 'partners')) {
          pendingActions.delete(token);
          finalizeAction(entry.action, entry.snapshot, { status: 'cancel', dispatch: false });
          return;
        }
      }
    }
  }

  async function handleAction(act, snapshot) {
    if (!ensureSelectionService()) return { status: 'cancel', dispatch: false };
    const snap = snapshot && Array.isArray(snapshot.ids)
      ? snapshot
      : (typeof SelectionService.snapshot === 'function'
        ? SelectionService.snapshot()
        : { ids: typeof SelectionService.getIds === 'function' ? SelectionService.getIds() : [], type: SelectionService.type });
    switch (act) {
      case 'edit': {
        if (!snap || snap.ids.length !== 1) { toast('Select exactly one record to edit'); return { status: 'cancel', dispatch: false }; }
        const id = snap.ids[0];
        if (snap.type === 'partners') {
          let opened = false;
          let lastError = null;
          try {
            const node = await openPartnerEditModal(id, {
              trigger: document.activeElement,
              sourceHint: 'actionbar:edit'
            });
            opened = !!node;
          } catch (err) {
            lastError = err;
            try { console && console.warn && console.warn('openPartnerEditModal failed', err); }
            catch (_warnErr) { }
          }
          if (opened) {
            return { status: 'pending', clear: true, dispatch: false, monitor: { type: 'edit', entity: 'partners', id } };
          }
          warnMissing('openPartnerEditModal');
          if (lastError) return { status: 'error', error: lastError, dispatch: false };
          return { status: 'error', error: 'partner edit unavailable', dispatch: false };
        }
        if (typeof window.renderContactModal === 'function') {
          window.renderContactModal(id);
          return { status: 'pending', clear: true, dispatch: false, monitor: { type: 'edit', entity: 'contacts', id } };
        }
        warnMissing('renderContactModal');
        return { status: 'error', error: 'renderContactModal missing', dispatch: false };
      }
      case 'merge': {
        if (!snap.ids || snap.ids.length !== 2) { toast('Select exactly two records to merge'); return { status: 'cancel', dispatch: false }; }
        const ids = snap.ids.slice(0, 2).map(id => String(id));
        const snapType = typeof snap.type === 'string' ? snap.type.toLowerCase() : '';
        const route = (currentView() || '').toLowerCase();
        const view = snapType || route;
        const isPartners = view === 'partners';
        try {
          if (isPartners) {
            const result = await openPartnersMergeByIds(ids[0], ids[1]);
            if (result && result.status === 'cancel') {
              return { status: 'cancel', dispatch: false };
            }
            if (result && result.status === 'error') {
              toast('Merge failed');
              return { status: 'error', error: result.error || new Error('merge failed'), dispatch: false };
            }
            return { status: 'ok', clear: true, dispatch: false, detail: { merged: ids, entity: 'partners' } };
          }
          const mergeFn = typeof window.mergeContactsWithIds === 'function'
            ? window.mergeContactsWithIds
            : async (pair) => openContactsMergeByIds(pair[0], pair[1]);
          const result = await mergeFn(ids);
          if (result && result.status === 'cancel') {
            return { status: 'cancel', dispatch: false };
          }
          if (result && result.status === 'error') {
            toast('Merge failed');
            return { status: 'error', error: result.error || new Error('merge failed'), dispatch: false };
          }
          return { status: 'ok', clear: true, dispatch: false, detail: { merged: ids, entity: 'contacts' } };
        } catch (err) {
          console.warn('[soft] [merge] orchestrator failed', err);
          toast('Merge failed');
          return { status: 'error', error: err, dispatch: false };
        }
      }
      case 'emailTogether': {
        const data = await ensureSelectionDetail();
        const records = snap.type === 'partners' ? data.partners : data.contacts;
        const emails = records.map(row => String(row.email || '').trim()).filter(Boolean);
        if (!emails.length) { toast('No email addresses on selected records'); return { status: 'cancel', dispatch: false }; }
        const href = 'mailto:?bcc=' + encodeURIComponent(emails.join(','));
        try { window.open(href, '_self'); }
        catch (_err) { window.location.href = href; }
        return { status: 'ok', clear: false, dispatch: false, detail: { emails: emails.length, mode: 'together' } };
      }
      case 'emailMass': {
        const data = await ensureSelectionDetail();
        const records = snap.type === 'partners' ? data.partners : data.contacts;
        const emails = records.map(row => String(row.email || '').trim()).filter(Boolean);
        if (!emails.length) { toast('No email addresses on selected records'); return { status: 'cancel', dispatch: false }; }
        const text = emails.join('\n');
        let copied = false;
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          try { await navigator.clipboard.writeText(text); copied = true; }
          catch (_err) { copied = false; }
        }
        if (!copied) {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'absolute';
          textarea.style.left = '-9999px';
          document.body.appendChild(textarea);
          textarea.select();
          try { document.execCommand('copy'); copied = true; }
          catch (_err) { copied = false; }
          textarea.remove();
        }
        toast(copied ? `Copied ${emails.length} email${emails.length === 1 ? '' : 's'}` : 'Copy failed');
        return { status: 'ok', clear: false, dispatch: false, detail: { emails: emails.length, mode: 'copy', copied } };
      }
      case 'convertPipeline': {
        if (snap.type !== 'contacts') { toast('Conversion applies to contacts only'); return { status: 'cancel', dispatch: false }; }
        if (snap.ids.length !== 1) { toast('Select a single lead to convert'); return { status: 'cancel', dispatch: false }; }
        const data = await ensureSelectionDetail();
        const contact = data.contacts[0];
        if (!contact || !isLongShotRecord(contact)) { toast('Selected contact is already in pipeline'); return { status: 'cancel', dispatch: false }; }
        if (typeof window.convertLongShotToPipeline !== 'function') { warnMissing('convertLongShotToPipeline'); return { status: 'error', error: 'convertLongShotToPipeline missing', dispatch: false }; }
        try {
          const result = await window.convertLongShotToPipeline(contact.id);
          toast('Moved to pipeline');
          return { status: 'ok', clear: true, dispatch: false, detail: { converted: contact.id, ok: result && result.ok !== false } };
        } catch (err) {
          console.warn('[soft] convertLongShotToPipeline', err);
          toast('Conversion failed');
          return { status: 'error', error: err, dispatch: false };
        }
      }
      case 'task': {
        if (snap.type !== 'contacts') { toast('Tasks apply to contact records'); return { status: 'cancel', dispatch: false }; }
        const data = await ensureSelectionDetail();
        if (!data.contacts.length) { toast('No contacts selected'); return { status: 'cancel', dispatch: false }; }
        const result = await openBulkTaskModal(data.contacts);
        if (!result || result.status === 'cancel') return { status: 'cancel', dispatch: false };
        if (result.status === 'error') return { status: 'error', error: result.error, dispatch: false };
        return { status: 'ok', clear: true, dispatch: true, detail: Object.assign({ count: result.count || data.contacts.length }, result.detail || {}) };
      }
      case 'bulkLog': {
        if (!snap.ids.length) { toast('Select records to log activity'); return { status: 'cancel', dispatch: false }; }
        if (typeof window.openBulkLogModal === 'function') {
          const result = await window.openBulkLogModal(snap.ids.slice());
          if (result && result.status === 'ok') {
            return { status: 'ok', clear: true, dispatch: true, detail: Object.assign({ count: result.count || snap.ids.length }, result.detail || {}) };
          }
          if (result && result.status === 'error') return { status: 'error', error: result.error, dispatch: false };
          return { status: 'cancel', dispatch: false };
        }
        if (typeof window.bulkAppendLog === 'function') {
          warnMissing('openBulkLogModal');
          return { status: 'error', error: 'openBulkLogModal missing', dispatch: false };
        }
        warnMissing('bulkLog');
        return { status: 'error', error: 'bulkLog missing', dispatch: false };
      }
      case 'clear': {
        return { status: 'ok', clear: true, dispatch: false, detail: { cleared: true } };
      }
      case 'delete': {
        const removed = await deleteSelection();
        if (removed === false) return { status: 'error', error: 'delete failed', dispatch: false };
        if (!removed || !removed.count) return { status: 'cancel', dispatch: false };
        return { status: 'ok', clear: true, dispatch: false, detail: { deleted: removed.count }, prune: removed.ids };
      }
      default:
        warnMissing(`action:${act}`);
        return { status: 'cancel', dispatch: false };
    }
  }

  async function executeAction(act) {
    if (!act) return;
    if (actionState.busy) return;
    if (!ensureSelectionService()) return;
    const snapshot = typeof SelectionService.snapshot === 'function'
      ? SelectionService.snapshot()
      : { ids: typeof SelectionService.getIds === 'function' ? SelectionService.getIds() : [], type: SelectionService.type };
    if (!snapshot || !Array.isArray(snapshot.ids) || !snapshot.ids.length) {
      toast('Select records first');
      if (typeof window !== 'undefined' && window.__ACTION_BAR_LAST_DATA_ACTION__ === act) {
        window.__ACTION_BAR_LAST_DATA_ACTION__ = null;
      }
      return;
    }
    setActionbarBusy(true, act);
    actionState.current = { action: act };
    let result;
    try {
      result = await handleAction(act, snapshot);
    } catch (err) {
      console.warn('[soft] handleAction failed', act, err);
      result = { status: 'error', error: err, dispatch: false };
    }
    if (!result) result = { status: 'cancel', dispatch: false };
    if (result.status === 'pending') {
      const token = Symbol(`pending:${act}`);
      pendingActions.set(token, {
        token,
        action: act,
        snapshot,
        monitor: result.monitor || null
      });
      actionState.current = { action: act, token };
      setActionbarBusy(false, act);
      logAction({ action: act, selected: snapshot.ids, result: 'pending' });
      return;
    }
    finalizeAction(act, snapshot, result);
  }

  function ensureTaskModal() {
    let wrap = document.getElementById('bulk-task-modal');
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = 'bulk-task-modal';
    wrap.className = 'modal';
    wrap.innerHTML = `
        <div class="dlg" style="max-width:560px">
          <div class="row" style="align-items:center">
            <strong>Schedule Follow-Up for Selected</strong>
            <span class="grow"></span>
            <button class="btn" data-close-task>Close</button>
          </div>
          <div class="muted" id="bt-count" style="margin-top:6px"></div>
          <div class="row" style="gap:12px;margin-top:12px">
            <label class="grow">Follow-Up Title<br><input id="bt-title" type="text" placeholder="Call borrower"/></label>
            <label>Due Date<br><input id="bt-due" type="date"/></label>
            <label>Time<br><input id="bt-time" type="time"/></label>
          </div>
          <div class="row" style="justify-content:flex-end;gap:8px;margin-top:12px">
            <button class="btn brand" id="bt-save" disabled>Schedule Follow-Up</button>
          </div>
        </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', evt => {
      if (evt.target === wrap || evt.target.hasAttribute('data-close-task')) {
        wrap.classList.add('hidden');
      }
    });
    const titleInput = wrap.querySelector('#bt-title');
    const saveBtn = wrap.querySelector('#bt-save');
    if (titleInput && saveBtn) {
      titleInput.addEventListener('input', () => {
        saveBtn.disabled = !titleInput.value.trim();
      });
    }
    const dueInput = wrap.querySelector('#bt-due');
    const timeInput = wrap.querySelector('#bt-time');
    if (dueInput && !dueInput.value) {
      try { dueInput.value = new Date().toISOString().slice(0, 10); }
      catch (_err) { }
    }
    if (timeInput && !timeInput.value) {
      try { timeInput.value = '09:00'; }
      catch (_err) { }
    }
    return wrap;
  }

  async function openBulkTaskModal(rows) {
    const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!list.length) { toast('Select contact rows'); return Promise.resolve({ status: 'cancel' }); }
    const wrap = ensureTaskModal();
    const titleInput = wrap.querySelector('#bt-title');
    const dueInput = wrap.querySelector('#bt-due');
    const timeInput = wrap.querySelector('#bt-time');
    const saveBtn = wrap.querySelector('#bt-save');
    const countEl = wrap.querySelector('#bt-count');
    if (countEl) countEl.textContent = `${list.length} contact${list.length === 1 ? '' : 's'} selected`;
    if (titleInput) titleInput.value = '';
    if (dueInput) {
      try { dueInput.value = new Date().toISOString().slice(0, 10); }
      catch (_err) { }
    }
    if (timeInput) {
      try { timeInput.value = '09:00'; }
      catch (_err) { }
    }
    if (saveBtn) { saveBtn.disabled = true; saveBtn.onclick = null; }
    wrap.classList.remove('hidden');
    if (titleInput) titleInput.focus();
    const existingHandlers = wrap.__taskHandlers;
    if (existingHandlers) {
      if (existingHandlers.cancel) wrap.removeEventListener('click', existingHandlers.cancel, true);
      if (existingHandlers.key) document.removeEventListener('keydown', existingHandlers.key, true);
      if (existingHandlers.save && saveBtn) saveBtn.removeEventListener('click', existingHandlers.save);
    }
    return new Promise(resolve => {
      let done = false;
      const cleanup = () => {
        if (titleInput) titleInput.value = '';
        if (timeInput) timeInput.value = '';
        if (saveBtn) saveBtn.disabled = true;
        wrap.__taskHandlers = null;
      };
      const finish = (result) => {
        if (done) return;
        done = true;
        wrap.classList.add('hidden');
        if (cancelHandler) wrap.removeEventListener('click', cancelHandler, true);
        if (keyHandler) document.removeEventListener('keydown', keyHandler, true);
        if (saveHandler && saveBtn) saveBtn.removeEventListener('click', saveHandler);
        cleanup();
        resolve(result);
      };
      const cancelHandler = (evt) => {
        if (evt.target === wrap || evt.target.hasAttribute('data-close-task')) {
          evt.preventDefault();
          evt.stopPropagation();
          evt.stopImmediatePropagation();
          finish({ status: 'cancel' });
        }
      };
      const keyHandler = (evt) => {
        if (evt.key === 'Escape') {
          evt.preventDefault();
          finish({ status: 'cancel' });
        }
      };
      const saveHandler = async (evt) => {
        evt.preventDefault();
        const title = titleInput ? titleInput.value.trim() : '';
        const due = dueInput ? dueInput.value : '';
        const time = timeInput ? timeInput.value : '';
        if (!title) { toast('Task title required'); return; }
        try {
          if (typeof window.openDB === 'function') await window.openDB();
          const now = Date.now();
          const tasks = list.map(row => ({
            id: String('task-' + row.id + '-' + now),
            contactId: row.id,
            title,
            due: due || '',
            dueTime: time || '',
            dueAt: due ? `${due}${time ? 'T' + time : ''}` : '',
            status: 'open',
            createdAt: now,
            updatedAt: now
          }));
          if (tasks.length && typeof window.dbBulkPut === 'function') {
            await window.dbBulkPut('tasks', tasks);
          }
          const whenLabel = due ? `${due}${time ? ' @ ' + time : ''}` : 'unscheduled';
          toast(`Scheduled follow-ups for ${tasks.length} contact${tasks.length === 1 ? '' : 's'} (${whenLabel})`);
          finish({ status: 'ok', count: tasks.length, detail: { scope: 'tasks', action: 'bulk-task', count: tasks.length, due, time } });
        } catch (err) {
          console.warn('bulk task error', err);
          toast('Failed to add tasks');
          finish({ status: 'error', error: err });
        }
      };
      wrap.addEventListener('click', cancelHandler, true);
      document.addEventListener('keydown', keyHandler, true);
      if (saveBtn) saveBtn.addEventListener('click', saveHandler);
      wrap.__taskHandlers = { cancel: cancelHandler, key: keyHandler, save: saveHandler };
    });
  }

  async function deleteSelection() {
    console.log('[actionbar] deleteSelection CALLED');
    if (!ensureSelectionService()) {
      console.log('[actionbar] deleteSelection: Service check failed');
      return false;
    }
    const ids = SelectionService.getIds();
    console.log('[actionbar] deleteSelection: IDs to delete:', ids);
    if (!ids.length) { toast('Select records to delete'); return false; }
    const prompt = `Delete ${ids.length} selected record${ids.length === 1 ? '' : 's'}?`;
    let confirmed = true;
    if (typeof window.confirmAction === 'function') {
      confirmed = await window.confirmAction({
        title: 'Delete records',
        message: prompt,
        confirmLabel: 'Delete',
        cancelLabel: 'Keep',
        destructive: true
      });
    } else if (typeof window.confirm === 'function') {
      confirmed = window.confirm(prompt);
    }
    console.log('[actionbar] deleteSelection: confirmed =', confirmed);
    if (!confirmed) return { count: 0, ids: [] };
    try {
      const targets = ids.map(id => {
        const meta = SelectionService.items.get(id);
        const store = meta && meta.type === 'partners' ? 'partners' : 'contacts';
        return { store, id };
      }).filter(item => item.store && item.id != null);
      if (!targets.length) { toast('Nothing deleted'); return { count: 0, ids: [] }; }
      const deletedCountsByStore = targets.reduce((acc, item) => {
        const key = item.store;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      console.log('[actionbar] deleteSelection: Targets:', targets);

      const describe = window.__SOFT_DELETE_SERVICE__ && typeof window.__SOFT_DELETE_SERVICE__.describeRecords === 'function'
        ? window.__SOFT_DELETE_SERVICE__.describeRecords
        : null;
      const label = describe ? describe(targets) : `${targets.length} record${targets.length === 1 ? '' : 's'}`;
      let removed = 0;
      if (typeof window.softDeleteMany === 'function') {
        console.log('[actionbar] calling window.softDeleteMany');
        const result = await window.softDeleteMany(targets, {
          source: 'actionbar:delete',
          message: `Deleted ${label}. Undo to restore.`
        });
        console.log('[actionbar] softDeleteMany result:', result);
        removed = result && typeof result.count === 'number' ? result.count : 0;
      } else if (typeof window.softDelete === 'function') {
        console.log('[actionbar] calling window.softDelete (fallback)');
        for (const target of targets) {
          try {
            const result = await window.softDelete(target.store, target.id, { source: 'actionbar:delete' });
            if (result && result.ok) removed += 1;
          } catch (err) { console.warn('softDelete fallback', err); }
        }
        if (removed && typeof window.toast === 'function') {
          window.toast({ message: `Deleted ${removed} record${removed === 1 ? '' : 's'}.` });
        }
      } else if (typeof window.dbDelete === 'function') {
        console.log('[actionbar] calling window.dbDelete (fallback)');
        for (const target of targets) {
          try { await window.dbDelete(target.store, target.id); removed += 1; }
          catch (err) { console.warn('delete failed', target.store, target.id, err); }
        }
        if (removed && typeof window.toast === 'function') {
          window.toast({ message: `Deleted ${removed} record${removed === 1 ? '' : 's'}.` });
        }
        if (removed) {
          const detail = { scope: 'selection', action: 'delete', source: 'actionbar:fallback', count: removed };
          if (typeof window.dispatchAppDataChanged === 'function') window.dispatchAppDataChanged(detail);
          else document.dispatchEvent(new CustomEvent('app:data:changed', { detail }));
        }
      }
      if (!removed) {
        toast('Nothing deleted');
        return { count: 0, ids: [] };
      }
      const deletedIds = ids.slice();
      if (typeof document !== 'undefined') {
        Object.keys(deletedCountsByStore).forEach((scope) => {
          const detail = {
            source: 'actionbar:delete',
            action: 'delete',
            scope,
            count: deletedCountsByStore[scope]
          };
          if (typeof window.dispatchAppDataChanged === 'function') window.dispatchAppDataChanged(detail);
          else document.dispatchEvent(new CustomEvent('app:data:changed', { detail }));
        });
        if (deletedIds.length) {
          deletedIds.forEach((id) => {
            if (id == null) return;
            const safeId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(String(id)) : String(id).replace(/"/g, '\\"');
            const rows = document.querySelectorAll(`tr[data-id="${safeId}"]`);
            rows.forEach((row) => {
              try { row.remove(); }
              catch (_) { }
            });
          });
        }
      }
      return { count: removed, ids: deletedIds };
    } catch (err) {
      console.warn('deleteSelection', err);
      toast('Delete failed');
      return false;
    }
  }

  function bindActionbar() {
    if (!ensureSelectionService()) return;
    const bar = actionbar();
    if (!bar || bar.__patched) return;
    bar.__patched = true;
    if (bar.style) {
      bar.style.boxShadow = '0 6px 16px rgba(0,0,0,.12)';
      bar.style.transform = 'translateY(-4px)';
    }
    bar.addEventListener('click', evt => {
      const btn = evt.target && evt.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (!act) return;
      if (act === 'merge') return;
      evt.preventDefault();
      evt.stopPropagation();
      evt.stopImmediatePropagation();
      if (btn.disabled) return;
      executeAction(act);
    }, true);
  }

  function bindCheckboxes() {
    document.addEventListener('change', evt => {
      const target = evt.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== 'checkbox') return;
      if (!target.closest('table')) return;
      const role = target.dataset ? target.dataset.role : '';
      const ui = target.dataset ? target.dataset.ui : '';
      if (role === 'select-all' || ui === 'row-check-all') return;
      const id = resolveRowId(target);
      if (!id) return;
      const type = detectRowType(target);
      if (ensureSelectionService() && SelectionService) {
        try {
          SelectionService.type = type;
        } catch (_) { }
      }
      if (typeof window !== 'undefined' && window.Selection && typeof window.Selection.type !== 'undefined') {
        try {
          window.Selection.type = type;
        } catch (_) { }
      }
      let applied = false;
      if (ensureSelectionService() && SelectionService) {
        try {
          if (target.checked && typeof SelectionService.add === 'function') {
            SelectionService.add(id, type);
            applied = true;
          } else if (!target.checked && typeof SelectionService.remove === 'function') {
            SelectionService.remove(id);
            applied = true;
          }
        } catch (err) {
          applied = false;
          try { console && console.warn && console.warn('[selection] service update failed', err); }
          catch (_warn) { }
        }
      }
      if (!applied && typeof window !== 'undefined') {
        const selection = window.Selection;
        try {
          if (selection && typeof selection.add === 'function' && typeof selection.remove === 'function') {
            if (target.checked) selection.add(id, type);
            else selection.remove(id);
            applied = true;
          } else if (selection && typeof selection.toggle === 'function') {
            selection.toggle(id, type);
            applied = true;
          }
        } catch (err) {
          applied = false;
          try { console && console.warn && console.warn('[selection] fallback update failed', err); }
          catch (_warn) { }
        }
      }
      if (!applied) {
        if (typeof SelectionService !== 'undefined' && SelectionService) {
          try {
            const next = SelectionService.get ? SelectionService.get() : null;
            const scopeType = (type === 'partners' || type === 'contacts' || type === 'pipeline') ? type : 'contacts';
            const ids = new Set(next && Array.isArray(next.ids) ? next.ids.map(String) : []);
            if (target.checked) ids.add(id); else ids.delete(id);
            if (typeof SelectionService.set === 'function') {
              SelectionService.set(Array.from(ids), scopeType);
              applied = true;
            }
          } catch (_) { }
        }
      }
      if (!applied && typeof window !== 'undefined' && window.SelectionStore && typeof window.SelectionStore.set === 'function') {
        try {
          const scopeKey = (type === 'partners' || type === 'contacts' || type === 'pipeline') ? type : 'contacts';
          const current = window.SelectionStore.get(scopeKey);
          const next = current instanceof Set ? new Set(current) : new Set();
          if (target.checked) next.add(id); else next.delete(id);
          window.SelectionStore.set(next, scopeKey);
          applied = true;
        } catch (_) { }
      }
      if (!applied && typeof document !== 'undefined') {
        try {
          const eventDetail = {
            type,
            ids: target.checked ? [id] : [],
            count: target.checked ? 1 : 0,
            source: 'actionbar:checkbox-fallback'
          };
          document.dispatchEvent(new CustomEvent('selection:changed', { detail: eventDetail }));
        } catch (_err) { }
      }
    }, true);
  }

  function bindNavReset() {
    document.addEventListener('click', evt => {
      const nav = evt.target && evt.target.closest('[data-nav]');
      if (!nav) return;
      if (!ensureSelectionService()) return;
      SelectionService.clear();
    }, true);
  }

  function installObservers() {
    if (window.__SELECTION_OBSERVER__) {
      try { window.__SELECTION_OBSERVER__.disconnect(); }
      catch (_err) { }
    }
    const host = document.querySelector('.table-wrap, #view-contacts, #view-partners') || document.body;
    if (!host) return;
    const observer = new MutationObserver(() => {
      scheduleSyncChecks();
    });
    try {
      observer.observe(host, { childList: true, subtree: true });
      window.__SELECTION_OBSERVER__ = observer;
      scheduleSyncChecks();
    } catch (err) {
      console.warn('observer attach failed', err);
    }
  }

  async function normalizeStagesOnBoot(isRestore) {
    if (normalizeStagesOnBoot.__ran && !isRestore) return;
    if (!isRestore) normalizeStagesOnBoot.__ran = true;
    if (typeof window.openDB !== 'function' || typeof window.dbGetAll !== 'function' || typeof window.dbBulkPut !== 'function') return;
    try {
      await window.openDB();
      const contacts = await window.dbGetAll('contacts');
      const changed = [];
      contacts.forEach(contact => {
        const next = canonicalizeStage(contact.stage);
        if (next !== contact.stage) {
          changed.push(Object.assign({}, contact, { stage: next }));
        }
      });
      if (!changed.length) return;
      await window.dbBulkPut('contacts', changed);
      console.info(`Normalized ${changed.length} contact stage(s) to canonical slug.`);
      const detail = { source: 'patch:stage-canonical', normalized: changed.length };
      if (typeof window.dispatchAppDataChanged === 'function') window.dispatchAppDataChanged(detail);
      else document.dispatchEvent(new CustomEvent('app:data:changed', { detail }));
      if (typeof window.renderAll === 'function') await window.renderAll();
    } catch (err) {
      console.warn('stage normalization failed', err);
    }
  }

  function bootstrap() {
    if (!ensureSelectionService()) {
      // ...
      console.warn('[soft] SelectionService unavailable during bootstrap');
      return;
    }
    deselectAllRows();
    bindActionbar();
    bindCheckboxes();
    bindNavReset();
    installObservers();
    updateActionbarBase();
    if (typeof window.registerRenderHook === 'function') {
      window.registerRenderHook(() => {
        scheduleSyncChecks();
        queueSelectionTick();
      });
    }
    const ACTIONBAR_EVENT_KEY = '__ACTIONBAR_EVENT_WIRED__';
    if (!document[ACTIONBAR_EVENT_KEY]) {
      document[ACTIONBAR_EVENT_KEY] = true;
      document.addEventListener('app:data:changed', evt => {
        resolvePendingAction({ type: 'app', detail: evt && evt.detail ? evt.detail : {} });
      });
      document.addEventListener('close', evt => {
        resolvePendingAction({ type: 'close', target: evt && evt.target ? evt.target : null });
      }, true);
      document.addEventListener('selection:changed', () => {
        updatePrimaryButtons();
        queueSelectionTick();
      });
    }
    window.updateActionbar = function () {
      queueSelectionTick();
    };
    normalizeStagesOnBoot(false);
    syncActionBarVisibility(0);
  }

  function onDomReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function initActionbar() {
    if (ensureSelectionService()) {
      onDomReady(bootstrap);
      return;
    }
    const bootDone = window.__BOOT_DONE__;
    if (bootDone && typeof bootDone.then === 'function') {
      Promise.resolve(bootDone)
        .then(() => {
          if (ensureSelectionService()) onDomReady(bootstrap);
          else console.warn('[soft] SelectionService unavailable after boot');
        })
        .catch(err => {
          console.warn('[soft] SelectionService bootstrap failed', err);
        });
      return;
    }
    console.warn('[soft] SelectionService unavailable');
  }

  initActionbar();
}

export async function init(ctx) {
  console.log('[patch_20250926_ctc_actionbar] init called');
  ensureCRM();
  const log = (ctx?.logger?.log) || console.log;
  const error = (ctx?.logger?.error) || ((...args) => console.warn('[soft]', ...args));

  if (__wired) {
    log('[patch_20250926_ctc_actionbar.init] already wired');
    window.CRM.health['patch_20250926_ctc_actionbar'] ??= 'ok';
    return;
  }
  __wired = true;

  try {
    await domReady();
    runPatch();
    window.CRM.health['patch_20250926_ctc_actionbar'] = 'ok';
    log('[patch_20250926_ctc_actionbar.init] complete');
  } catch (e) {
    window.CRM.health['patch_20250926_ctc_actionbar'] = 'error';
    error('[patch_20250926_ctc_actionbar.init] failed', e);
  }
}

ensureCRM();
window.CRM.modules['patch_20250926_ctc_actionbar'] = window.CRM.modules['patch_20250926_ctc_actionbar'] || {};
window.CRM.modules['patch_20250926_ctc_actionbar'].init = init;

if (typeof window !== 'undefined') {
  const autoInit = () => { try { init(); } catch (_) { } };
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }
}
