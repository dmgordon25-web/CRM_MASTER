/* eslint-disable no-console */
import { toastSoftError, toastSuccess, toastWarn } from './toast_helpers.js';

const DEFAULT_COPY = {
  modalTitle: 'Quick Add',
  contactTab: 'Contact',
  partnerTab: 'Partner',
  cancel: 'Cancel',
  contactSubmit: 'Save Contact',
  partnerSubmit: 'Save Partner',
  contactFirstName: 'First Name',
  contactLastName: 'Last Name',
  contactEmail: 'Email',
  contactPhone: 'Phone',
  partnerCompany: 'Company',
  partnerName: 'Primary Contact',
  partnerEmail: 'Email',
  partnerPhone: 'Phone'
};

let quickAddCopy = null;

// Unified Quick Add modal with Contact/Partner tabs; idempotent wiring.
export function wireQuickAddUnified(options = {}) {
  const provided = options && typeof options === 'object' && options.copy && typeof options.copy === 'object'
    ? options.copy
    : null;
  if (provided) {
    quickAddCopy = { ...DEFAULT_COPY, ...provided };
  }
  if (window.__WIRED_QUICK_ADD_UNIFIED__) return;
  window.__WIRED_QUICK_ADD_UNIFIED__ = true;

  function html() {
    const copy = quickAddCopy || DEFAULT_COPY;
    const get = (key) => {
      const value = copy[key];
      return value == null ? DEFAULT_COPY[key] : String(value);
    };
    return `
<div class="qa-overlay" role="dialog" aria-modal="true" style="position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:9999;display:flex;align-items:center;justify-content:center;">
  <div class="qa-modal" style="background:#fff;min-width:560px;max-width:720px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.2);">
    <div class="qa-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #eee;">
      <div style="font-size:18px;font-weight:600;">${get('modalTitle')}</div>
      <button type="button" class="qa-close" aria-label="Close" style="border:none;background:transparent;font-size:20px;cursor:pointer;">×</button>
    </div>
    <div class="qa-tabs" style="display:flex;gap:8px;padding:10px 16px;border-bottom:1px solid #f2f2f2;">
      <button class="qa-tab qa-tab-contact" data-tab="contact" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#f9f9f9;cursor:pointer;">${get('contactTab')}</button>
      <button class="qa-tab qa-tab-partner" data-tab="partner" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer;">${get('partnerTab')}</button>
    </div>
    <div class="qa-body" style="padding:16px;">
      <form class="qa-form qa-form-contact" data-kind="contact" style="display:block;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <label>${get('contactFirstName')}<input name="firstName" type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
          <label>${get('contactLastName')}<input name="lastName" type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
          <label>${get('contactEmail')}<input name="email" type="email" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
          <label>${get('contactPhone')}<input name="phone" type="tel" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
          <button type="button" class="qa-cancel" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer;">${get('cancel')}</button>
          <button type="submit" class="qa-save" style="padding:8px 12px;border-radius:8px;border:1px solid #2b7;background:#2b7;color:#fff;cursor:pointer;">${get('contactSubmit')}</button>
        </div>
      </form>
      <form class="qa-form qa-form-partner" data-kind="partner" style="display:none;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <label>${get('partnerCompany')}<input name="company" type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
          <label>${get('partnerName')}<input name="name" type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
          <label>${get('partnerEmail')}<input name="email" type="email" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
          <label>${get('partnerPhone')}<input name="phone" type="tel" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
          <button type="button" class="qa-cancel" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer;">${get('cancel')}</button>
          <button type="submit" class="qa-save" style="padding:8px 12px;border-radius:8px;border:1px solid #2b7;background:#2b7;color:#fff;cursor:pointer;">${get('partnerSubmit')}</button>
        </div>
      </form>
    </div>
  </div>
</div>`;
  }

  function close() {
    const el = document.querySelector(".qa-overlay");
    if (el && el.parentElement) el.parentElement.removeChild(el);
    if (typeof document.removeEventListener === 'function') {
      document.removeEventListener("keydown", onKey);
    }
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  function open(initialTab) {
    close();
    const tpl = document.createElement("template");
    tpl.innerHTML = html().trim();
    let node = tpl.content && tpl.content.firstElementChild;
    if(!node){
      const fallbackWrap = document.createElement('div');
      fallbackWrap.innerHTML = tpl.innerHTML;
      node = fallbackWrap.firstElementChild;
    }
    if(!node) return;
    document.body.appendChild(node);
    if (typeof document.addEventListener === 'function') {
      document.addEventListener("keydown", onKey);
    }

    function selectTab(tab) {
      const isContact = tab === "contact";
      node.querySelector(".qa-form-contact").style.display = isContact ? "block" : "none";
      node.querySelector(".qa-form-partner").style.display = isContact ? "none" : "block";
      node.querySelector(".qa-tab-contact").style.background = isContact ? "#f9f9f9" : "#fff";
      node.querySelector(".qa-tab-partner").style.background = isContact ? "#fff" : "#f9f9f9";
    }

    node.querySelector(".qa-close").addEventListener("click", close);
    node.querySelectorAll(".qa-cancel").forEach(b => b.addEventListener("click", close));
    node.querySelector(".qa-tab-contact").addEventListener("click", () => selectTab("contact"));
    node.querySelector(".qa-tab-partner").addEventListener("click", () => selectTab("partner"));

    const contactForm = node.querySelector('.qa-form[data-kind="contact"]');
    const partnerForm = node.querySelector('.qa-form[data-kind="partner"]');

    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(contactForm);
      const rec = {
        firstName: String(fd.get("firstName") || "").trim(),
        lastName:  String(fd.get("lastName")  || "").trim(),
        email:     String(fd.get("email")     || "").trim(),
        phone:     String(fd.get("phone")     || "").trim(),
        createdAt: Date.now(),
        stage: "Long Shot",
        status: "Active",
      };
      let saved = false;
      let failureMessage = '';
      let failureToastShown = false;
      try {
        if (window.Contacts?.createQuick) {
          await window.Contacts.createQuick(rec);
          saved = true;
        } else if (typeof window.dbPut === "function") {
          await window.dbPut("contacts", rec);
          saved = true;
        } else {
          failureMessage = 'Contacts service unavailable. Contact not saved.';
          try { console.warn("[quickAdd] no Contacts.createQuick or dbPut; saved to memory only", rec); }
          catch (_) {}
        }
      } catch (err) {
        failureMessage = 'Unable to save contact. Please try again.';
        failureToastShown = toastSoftError('[soft] [quickAdd] contact save failed', err, failureMessage);
      } finally {
        try { window.dispatchAppDataChanged?.("quick-add:contact"); } catch (_) {}
        if (saved) {
          toastSuccess("Contact created");
        } else if (failureMessage && !failureToastShown) {
          failureToastShown = toastWarn(failureMessage);
        }
        close();
      }
    });

    partnerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(partnerForm);
      const rec = {
        company:   String(fd.get("company") || "").trim(),
        name:      String(fd.get("name")    || "").trim(),
        email:     String(fd.get("email")   || "").trim(),
        phone:     String(fd.get("phone")   || "").trim(),
        createdAt: Date.now(),
        tier: "Unassigned",
      };
      let saved = false;
      let failureMessage = '';
      let failureToastShown = false;
      try {
        if (window.Partners?.createQuick) {
          await window.Partners.createQuick(rec);
          saved = true;
        } else if (typeof window.dbPut === "function") {
          await window.dbPut("partners", rec);
          saved = true;
        } else {
          failureMessage = 'Partners service unavailable. Partner not saved.';
          try { console.warn("[quickAdd] no Partners.createQuick or dbPut; saved to memory only", rec); }
          catch (_) {}
        }
      } catch (err) {
        failureMessage = 'Unable to save partner. Please try again.';
        failureToastShown = toastSoftError('[soft] [quickAdd] partner save failed', err, failureMessage);
      } finally {
        try { window.dispatchAppDataChanged?.("quick-add:partner"); } catch (_) {}
        if (saved) {
          toastSuccess("Partner created");
        } else if (failureMessage && !failureToastShown) {
          failureToastShown = toastWarn(failureMessage);
        }
        close();
      }
    });

    selectTab(initialTab || "contact");
  }

  function bindTriggers() {
    const selectors = [
      '[data-action="quick-add-contact"]',
      '[data-action="quick-add-partner"]',
      "[data-quick-add]",
      "[data-quick-add-contact]",
      "[data-quick-add-partner]",
      ".quick-add-contact",
      ".quick-add-partner",
      "#btnQuickAddContact",
      "#btnQuickAddPartner",
      "#quick-add"
    ];
    const seen = new Set();
    const nodes = [];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(node => {
        if (!seen.has(node)) {
          seen.add(node);
          nodes.push(node);
        }
      });
    });
    nodes.forEach(node => {
      const dataset = node.dataset || {};
      const hints = [
        dataset.quickAdd,
        dataset.quickAddTarget,
        dataset.quickAddKind,
        dataset.quickAddType,
        dataset.action,
        node.getAttribute("data-quick-add"),
        node.getAttribute("data-quick-add-target"),
        node.getAttribute("data-quick-add-kind"),
        node.getAttribute("data-quick-add-type"),
        node.getAttribute("aria-label"),
        node.getAttribute("title"),
        node.getAttribute("data-target"),
        node.className,
        node.id,
        node.textContent
      ];
      if (Object.prototype.hasOwnProperty.call(dataset, "quickAddPartner") || node.hasAttribute("data-quick-add-partner")) {
        hints.push("partner");
      }
      if (Object.prototype.hasOwnProperty.call(dataset, "quickAddContact") || node.hasAttribute("data-quick-add-contact")) {
        hints.push("contact");
      }
      const hintText = hints.filter(Boolean).join(" ").toLowerCase();
      const isPartner = hintText.includes("partner");
      node.addEventListener("click", (e) => { e.preventDefault(); open(isPartner ? "partner" : "contact"); });
    });
  }

  const raf = window.requestAnimationFrame || (cb => setTimeout(cb, 16));
  raf(() => raf(bindTriggers));

  // Expose for debugging or programmatic open
  window.QuickAddUnified = { open };
}

