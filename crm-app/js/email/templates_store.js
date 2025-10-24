const LS_KEY = 'emailtpl:v1';
const SETTINGS_RECORD_ID = 'automation:templates';
const SUBSCRIBERS = new Set();
let STATE = { items: [] };
let hydrated = false;
let hydrationPromise = null;
let persistScheduled = false;
let writeChain = Promise.resolve();

const schedule = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => Promise.resolve().then(fn);

function uid() {
  return `tpl_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeRecord(payload, fallbackName = 'Untitled') {
  const now = Date.now();
  const id = (payload && payload.id) ? String(payload.id) : uid();
  const name = (payload && typeof payload.name === 'string' && payload.name.trim().length)
    ? payload.name
    : fallbackName;
  const subject = (payload && typeof payload.subject === 'string') ? payload.subject : '';
  const body = (payload && typeof payload.body === 'string') ? payload.body : '';
  const fav = !!(payload && payload.fav);
  const updatedAt = (payload && typeof payload.updatedAt === 'number') ? payload.updatedAt : now;
  return { id, name, subject, body, fav, updatedAt };
}

function sortItems() {
  STATE.items.sort((a, b) => {
    const aTime = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
    const bTime = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
    return bTime - aTime;
  });
  if (STATE.items.length > 200) STATE.items.length = 200;
}

function snapshotItems() {
  return STATE.items.map((item) => ({
    id: item.id,
    name: item.name,
    subject: item.subject,
    body: item.body,
    fav: !!item.fav,
    updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
  }));
}

function notify({ persist = true } = {}) {
  SUBSCRIBERS.forEach((fn) => {
    try {
      fn(STATE);
    } catch (_) {}
  });
  if (persist) schedulePersist();
}

function schedulePersist() {
  if (persistScheduled) return;
  persistScheduled = true;
  schedule(() => {
    persistScheduled = false;
    writeChain = writeChain.then(async () => {
      try {
        if (typeof window !== 'undefined' && typeof window.openDB === 'function') {
          await window.openDB();
        }
        const write = (typeof window !== 'undefined' && typeof window.dbSettingsPut === 'function')
          ? window.dbSettingsPut
          : (typeof window !== 'undefined' && typeof window.dbPut === 'function' ? (rec) => window.dbPut('settings', rec) : null);
        if (write) {
          const payload = {
            id: SETTINGS_RECORD_ID,
            items: snapshotItems(),
            updatedAt: Date.now(),
          };
          await write(payload);
        }
      } catch (err) {
        try { console && console.warn && console.warn('email templates persist failed', err); }
        catch (_) {}
      }
    });
  });
}

function applyState(list, { notifySubscribers = true, persist = false } = {}) {
  const incoming = Array.isArray(list) ? list : [];
  const normalized = incoming.map((item) => normalizeRecord(item));
  STATE.items = normalized;
  sortItems();
  if (notifySubscribers) notify({ persist });
}

function loadLegacy() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
      return parsed.items;
    }
  } catch (_) {}
  return [];
}

async function hydrate() {
  if (hydrated) return STATE;
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    let items = [];
    let migrated = false;
    try {
      if (typeof window !== 'undefined' && typeof window.openDB === 'function') {
        await window.openDB();
      }
      const reader = (typeof window !== 'undefined' && typeof window.dbSettingsGet === 'function')
        ? window.dbSettingsGet
        : (typeof window !== 'undefined' && typeof window.dbGet === 'function' ? (key) => window.dbGet('settings', key) : null);
      if (reader) {
        const record = await reader(SETTINGS_RECORD_ID);
        if (record && Array.isArray(record.items)) {
          items = record.items;
        }
      }
    } catch (err) {
      try { console && console.warn && console.warn('email templates load failed', err); }
      catch (_) {}
    }
    if (!items.length) {
      const legacy = loadLegacy();
      if (legacy.length) {
        items = legacy;
        migrated = true;
      }
    }
    applyState(items, { notifySubscribers: false });
    hydrated = true;
    hydrationPromise = null;
    notify({ persist: migrated });
    return STATE;
  })();
  return hydrationPromise;
}

function ensureHydrated() {
  if (hydrated) return Promise.resolve(STATE);
  return hydrate();
}

export const Templates = {
  list() {
    ensureHydrated().catch(() => {});
    return STATE.items.slice();
  },
  get(id) {
    ensureHydrated().catch(() => {});
    return STATE.items.find((item) => item.id === id) || null;
  },
  async ready() {
    return ensureHydrated();
  },
  upsert(payload, { silent = false, skipSort = false } = {}) {
    ensureHydrated().catch(() => {});
    const { id: incomingId, name, subject, body, fav } = payload || {};
    let id = incomingId;
    const now = Date.now();
    if (!id) id = uid();
    const index = STATE.items.findIndex((item) => item.id === id);
    const stamp = (payload && typeof payload.updatedAt === 'number') ? payload.updatedAt : now;
    const previous = index >= 0 ? STATE.items[index] : null;
    const record = {
      id,
      name: (typeof name === 'string' && name.length) ? name : (previous ? previous.name : 'Untitled'),
      subject: (typeof subject === 'string') ? subject : (previous ? previous.subject : ''),
      body: (typeof body === 'string') ? body : (previous ? previous.body : ''),
      fav: (typeof fav === 'boolean') ? fav : (previous ? !!previous.fav : false),
      updatedAt: stamp,
    };
    let stored;
    if (index >= 0) {
      stored = Object.assign(STATE.items[index], record);
      STATE.items[index] = stored;
    } else {
      stored = record;
      STATE.items.push(stored);
    }
    if (!skipSort) sortItems();
    if (!silent) {
      notify({ persist: true });
    } else {
      schedulePersist();
    }
    return stored;
  },
  remove(id) {
    ensureHydrated().catch(() => {});
    const before = STATE.items.length;
    STATE.items = STATE.items.filter((item) => item.id !== id);
    if (STATE.items.length !== before) {
      notify({ persist: true });
    }
  },
  markFav(id, fav = true) {
    ensureHydrated().catch(() => {});
    const record = this.get(id);
    if (!record) return;
    record.fav = !!fav;
    record.updatedAt = Date.now();
    sortItems();
    notify({ persist: true });
  },
  subscribe(fn) {
    ensureHydrated().catch(() => {});
    SUBSCRIBERS.add(fn);
    try {
      fn(STATE);
    } catch (_) {}
    return () => SUBSCRIBERS.delete(fn);
  },
  exportJSON() {
    ensureHydrated().catch(() => {});
    return JSON.stringify(snapshotItems(), null, 2);
  },
  importJSON(json) {
    try {
      const arr = JSON.parse(json);
      if (!Array.isArray(arr)) return false;
      arr.forEach((entry) => {
        this.upsert(entry, { silent: true, skipSort: true });
      });
      sortItems();
      notify({ persist: true });
      return true;
    } catch (e) {
      return false;
    }
  },
};

ensureHydrated().catch(() => {});
