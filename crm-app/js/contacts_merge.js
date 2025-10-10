import { openContactsMergeByIds } from "/js/contacts_merge_orchestrator.js";

const INIT_FLAG = "contacts_merge";

export async function mergeContactsWithIds(ids) {
  const list = Array.isArray(ids) ? ids.slice(0, 2).map((id) => String(id)).filter(Boolean) : [];
  if (list.length !== 2) {
    if (typeof window.toast === "function") window.toast("Select exactly two contacts to merge.");
    console.warn("[merge] expected exactly two contact ids", ids);
    return { status: "cancel" };
  }
  if (list[0] === list[1]) {
    if (typeof window.toast === "function") window.toast("Select two different contacts to merge.");
    console.warn("[merge] identical ids not allowed", list);
    return { status: "cancel" };
  }

  try {
    const result = await openContactsMergeByIds(list[0], list[1]);
    if (result && result.status === "error" && typeof window.toast === "function") {
      window.toast("Merge failed.");
    }
    return result;
  } catch (err) {
    console.error("[merge] orchestration failed", err);
    if (typeof window.toast === "function") window.toast("Merge failed.");
    throw err;
  }
}

mergeContactsWithIds.__fieldChooser = true;

export function init() {
  if (typeof window === "undefined") return;

  if (!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if (window.__INIT_FLAGS__[INIT_FLAG]) return;
  window.__INIT_FLAGS__[INIT_FLAG] = true;

  window.mergeContactsWithIds = mergeContactsWithIds;
}

if (typeof window !== "undefined") {
  init();

  const hasCRM = Boolean(window.CRM);
  const hasContactsMerge = Boolean(window.contactsMerge);
  const crm = window.CRM || (window.CRM = {});
  crm.health = crm.health || {};
  crm.health.contactsMerge = hasCRM && hasContactsMerge ? "ok" : "warn: missing CRM or contactsMerge";
}
