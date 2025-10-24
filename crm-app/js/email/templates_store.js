const LS_KEY = 'emailtpl:v1';
const SETTINGS_RECORD_ID = 'automation:templates';
const SUBSCRIBERS = new Set();
let STATE = { items: [] };
let hydrated = false;
let hydrationPromise = null;
let persistScheduled = false;
let pendingPersist = false;
let writeChain = Promise.resolve();
const pendingMutations = [];

const DEFAULT_TEMPLATE_SEED = [
  {
    id: 'default:birthday',
    name: 'Birthday Celebration',
    subject: 'Happy Birthday, {{PreferredName}}!',
    body: 'Hi {{PreferredName}},\n\nWishing you a fantastic birthday from everyone at {{Company}}. If anything about your home plans has changed, let me know how I can help.\n\nWarmly,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:home-anniversary',
    name: 'Home Anniversary',
    subject: 'Celebrating your home anniversary!',
    body: 'Hi {{PreferredName}},\n\nHappy home anniversary! It has been a pleasure supporting you since {{CloseDate}}. If you would like a quick check-in, market update, or refinance review, I am here for you.\n\nAll my best,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:touch-weekly',
    name: 'Outreach Touch · Weekly',
    subject: 'Quick weekly check-in',
    body: 'Hi {{PreferredName}},\n\nJust dropping a quick note to see how everything is going this week. Anything I can handle for you or your clients?\n\nThanks,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:touch-biweekly',
    name: 'Outreach Touch · Biweekly',
    subject: 'Biweekly market pulse',
    body: 'Hi {{PreferredName}},\n\nHere is your biweekly market pulse. Let me know if you would like deeper insights for {{PropertyAddress}} or your pipeline. I am glad to help.\n\nCheers,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:touch-monthly',
    name: 'Outreach Touch · Monthly',
    subject: 'Monthly homeowner tips',
    body: 'Hi {{PreferredName}},\n\nSharing this month’s homeowner tips and loan updates. If you have questions about financing, planning, or referrals, I am one reply away.\n\nTake care,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:referral-post-close',
    name: 'Referral Request · Post-Close',
    subject: 'Thank you — and a quick request',
    body: 'Hi {{PreferredName}},\n\nCongratulations again on your closing! If you know anyone looking for guidance, I would be grateful for an introduction. I will take great care of them just as I did for you.\n\nThank you,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:preapproval-expiring',
    name: 'Milestone Nudge · Pre-Approval Expiring',
    subject: 'Your pre-approval expires on {{PreapprovalExpiryDate}}',
    body: 'Hi {{PreferredName}},\n\nA quick reminder that your pre-approval is set to expire on {{PreapprovalExpiryDate}}. Let’s refresh paperwork so you stay offer-ready. I can help gather what we need.\n\nTalk soon,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:clear-to-close',
    name: 'Milestone Nudge · Clear to Close',
    subject: 'You are clear to close! 🎉',
    body: 'Hi {{PreferredName}},\n\nGreat news — we are clear to close! I will coordinate the final details so we stay on schedule for {{CloseDate}}. Reach out with any last-minute questions.\n\nExcited for you,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:post-close-7',
    name: 'Post-Close Check-In · Day 7',
    subject: 'Checking in after your closing',
    body: 'Hi {{PreferredName}},\n\nJust checking in one week after closing to make sure everything is settling in nicely. Need vendor recs or paperwork? I am here to help.\n\nBest,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:post-close-30',
    name: 'Post-Close Check-In · Day 30',
    subject: '30-day homeowner check-in',
    body: 'Hi {{PreferredName}},\n\nIt has been about a month since closing — how are things going? If you have questions about your loan, escrow, or anything else, let me know.\n\nSincerely,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:post-close-90',
    name: 'Post-Close Check-In · Day 90',
    subject: 'Quarterly check-in from {{LoanOfficerName}}',
    body: 'Hi {{PreferredName}},\n\nChecking in a few months after closing to see how homeownership is treating you. When you are ready for a review or need advice, I am one message away.\n\nWarm regards,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:dormant-reactivation',
    name: 'Dormant Lead Reactivation',
    subject: 'Let’s reconnect on your goals',
    body: 'Hi {{PreferredName}},\n\nIt has been a little while since we connected, and I wanted to see how your plans are progressing. If anything has changed or you would like fresh options, let’s schedule a quick catch-up.\n\nLooking forward to hearing from you,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:document-request',
    name: 'Document Request',
    subject: 'Quick document request for your file',
    body: 'Hi {{PreferredName}},\n\nTo keep everything moving smoothly, could you send over the remaining documents we discussed? Once I have them, we can button up the file for {{PropertyAddress}}.\n\nThank you,\n{{LoanOfficerName}}',
  },
  {
    id: 'default:import-welcome',
    name: 'Welcome & Onboarding',
    subject: 'Welcome to {{Company}} — next steps inside',
    body: 'Hi {{PreferredName}},\n\nWelcome aboard! I am {{LoanOfficerName}}, and I will guide you through every step. Let’s schedule time to review goals, paperwork, and timelines so we start strong.\n\nTalk soon,\n{{LoanOfficerName}}',
  },
];

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

function requestPersist() {
  if (hydrated) {
    schedulePersist();
  } else {
    pendingPersist = true;
  }
}

function notify({ persist = true } = {}) {
  SUBSCRIBERS.forEach((fn) => {
    try {
      fn(STATE);
    } catch (_) {}
  });
  if (persist) requestPersist();
}

function schedulePersist() {
  if (!hydrated) {
    pendingPersist = true;
    return;
  }
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

function internalUpsert(payload, { silent = false, skipSort = false, persist = true } = {}) {
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
    notify({ persist });
  } else if (persist) {
    requestPersist();
  }
  return stored;
}

function internalRemove(id, { persist = true, silent = false } = {}) {
  const before = STATE.items.length;
  STATE.items = STATE.items.filter((item) => item.id !== id);
  if (STATE.items.length !== before) {
    if (!silent) {
      notify({ persist });
    } else if (persist) {
      requestPersist();
    }
    notify({ persist: true });
    return true;
  }
  return false;
}

function internalMarkFav(id, fav = true, { persist = true, silent = false } = {}) {
  const record = STATE.items.find((item) => item.id === id);
  if (!record) return false;
  record.fav = !!fav;
  record.updatedAt = Date.now();
  sortItems();
  notify({ persist: true });
  return true;
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
    let seeded = false;
    if (!items.length && DEFAULT_TEMPLATE_SEED.length) {
      items = DEFAULT_TEMPLATE_SEED.slice();
      seeded = true;
    }
    applyState(items, { notifySubscribers: false });
    hydrated = true;
    hydrationPromise = null;
    notify({ persist: migrated || seeded });
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
    const persistNow = hydrated;
    const stored = internalUpsert(payload, { silent, skipSort, persist: persistNow });
    if (!persistNow) {
      pendingPersist = true;
      const replayPayload = Object.assign({}, stored);
      enqueueMutation(() => internalUpsert(replayPayload, { silent: true, skipSort, persist: false }));
    }
    return stored;
  },
  remove(id) {
    ensureHydrated().catch(() => {});
    const shouldQueue = !hydrated;
    if (shouldQueue) {
      queueMutation(() => performRemove(id));
    }
    performRemove(id);
  },
  markFav(id, fav = true) {
    ensureHydrated().catch(() => {});
    const shouldQueue = !hydrated;
    if (shouldQueue) {
      queueMutation(() => performMarkFav(id, fav));
    }
    performMarkFav(id, fav);
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
