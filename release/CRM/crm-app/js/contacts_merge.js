import { openContactsMergeByIds } from './contacts_merge_orchestrator.js';

// === Phase 1.5 Migration: contacts_merge ===
// Make this module safe to import and initialize repeatedly.
let __wired = false;

const INIT_FLAG = "contacts_merge";

function domReady() {
  if (typeof document === "undefined") return Promise.resolve();
  if (document.readyState === "complete" || document.readyState === "interactive") {
    return Promise.resolve();
  }
  return new Promise((res) => {
    document.addEventListener("DOMContentLoaded", () => res(), { once: true });
  });
}

function ensureCRM() {
  if (typeof window === "undefined") return null;
  window.CRM = window.CRM || {};
  window.CRM.health = window.CRM.health || {};
  window.CRM.modules = window.CRM.modules || {};
  return window.CRM;
}

export async function mergeContactsWithIds(ids) {
  const list = Array.isArray(ids) ? ids.slice(0, 2).map((id) => String(id)).filter(Boolean) : [];
  if (list.length !== 2) {
    if (typeof window !== "undefined" && typeof window.toast === "function") window.toast("Select exactly two contacts to merge.");
    console.warn("[merge] expected exactly two contact ids", ids);
    return { status: "cancel" };
  }
  if (list[0] === list[1]) {
    if (typeof window !== "undefined" && typeof window.toast === "function") window.toast("Select two different contacts to merge.");
    console.warn("[merge] identical ids not allowed", list);
    return { status: "cancel" };
  }

  try {
    const result = await openContactsMergeByIds(list[0], list[1]);
    if (result && result.status === "error" && typeof window !== "undefined" && typeof window.toast === "function") {
      window.toast("Merge failed.");
    }
    return result;
  } catch (err) {
    console.warn("[soft] [merge] orchestration failed", err);
    if (typeof window !== "undefined" && typeof window.toast === "function") window.toast("Merge failed.");
    throw err;
  }
}

mergeContactsWithIds.__fieldChooser = true;

export async function init(ctx) {
  const crm = ensureCRM();
  const log = ctx?.logger?.log ? ctx.logger.log.bind(ctx.logger) : console.log.bind(console);
  const fallbackError = (...args) => console.warn('[soft]', ...args);
  const error = ctx?.logger?.error ? ctx.logger.error.bind(ctx.logger) : fallbackError;

  if (crm) {
    crm.modules.contactsMerge = crm.modules.contactsMerge || { initCalled: false };
  }

  if (__wired) {
    log("[contacts_merge.init] already wired; skipping");
    if (crm) {
      crm.health.contactsMerge = crm.health.contactsMerge || "ok";
      crm.modules.contactsMerge.initCalled = true;
    }
    return;
  }
  __wired = true;

  try {
    if (typeof window === "undefined") {
      log("[contacts_merge.init] window unavailable; skipping browser wiring");
      __wired = false;
      return;
    }

    await domReady();

    window.__INIT_FLAGS__ = window.__INIT_FLAGS__ || {};
    window.__INIT_FLAGS__[INIT_FLAG] = true;

    window.mergeContactsWithIds = mergeContactsWithIds;

    const updatedCRM = ensureCRM();
    if (updatedCRM) {
      updatedCRM.health.contactsMerge = "ok";
      updatedCRM.modules.contactsMerge = updatedCRM.modules.contactsMerge || {};
      updatedCRM.modules.contactsMerge.initCalled = true;
    }
    log("[contacts_merge.init] complete");
  } catch (e) {
    __wired = false;
    ensureCRM();
    if (typeof window !== "undefined" && window.CRM) {
      window.CRM.health.contactsMerge = "error";
    }
    error("[contacts_merge.init] failed", e);
  }
}

// Back-compat: if some legacy code expects a global, maintain it:
const crm = ensureCRM();
if (crm) {
  crm.modules.contactsMerge = crm.modules.contactsMerge || { initCalled: false };
  const _oldInit = typeof crm.modules.contactsMerge.init === "function" ? crm.modules.contactsMerge.init : null;
  crm.modules.contactsMerge.init = async function legacyInit(ctx) {
    crm.modules.contactsMerge.initCalled = true;
    if (_oldInit) {
      try {
        await _oldInit(ctx);
      } catch (err) {
        (ctx?.logger?.error || ((...args) => console.warn('[soft]', ...args))).call(ctx?.logger || console, "[contacts_merge.legacyInit] old init failed", err);
      }
    }
    return init(ctx);
  };
}
