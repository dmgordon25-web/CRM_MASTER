import { openContactModal } from '../contacts.js';
import { openPartnerEditor } from '../editors/partner_entry.js';

const doc = typeof document === 'undefined' ? null : document;
const win = typeof window === 'undefined' ? null : window;

const DASHBOARD_DRILLDOWN_SELECTOR = '[data-id],[data-contact-id],[data-partner-id],[data-dashboard-route],[data-dash-route],[data-dashboard-href],[data-dash-href]';
const DASHBOARD_HANDLED_CLICK_KEY = '__crmDashHandledClickAt';

const drilldownTestHooks = { openContact: null, openPartner: null };

function safeOpenContact(contactId) {
  if (!contactId) return false;
  const hook = drilldownTestHooks.openContact;
  if (typeof hook === 'function') {
    hook(String(contactId));
    return true;
  }
  if (typeof openContactModal === 'function') {
    openContactModal(String(contactId));
    return true;
  }
  return false;
}

function safeOpenPartner(partnerId) {
  if (!partnerId) return false;
  const hook = drilldownTestHooks.openPartner;
  if (typeof hook === 'function') {
    hook(String(partnerId));
    return true;
  }
  if (typeof openPartnerEditor === 'function') {
    openPartnerEditor(String(partnerId));
    return true;
  }
  return false;
}

function resolveDashboardRouteTarget(node) {
  if (!node || typeof node.getAttribute !== 'function') return '';
  const route = node.getAttribute('data-dashboard-route')
    || node.getAttribute('data-dash-route')
    || node.getAttribute('data-dashboard-href')
    || node.getAttribute('data-dash-href')
    || '';
  if (!route) return '';
  return String(route).trim();
}

function navigateDashboardRoute(route) {
  if (!route || !win) return false;
  const nextHash = String(route).startsWith('#') ? String(route) : `#${route}`;
  try {
    if (win.Router && typeof win.Router.goto === 'function') {
      win.Router.goto(nextHash);
      return true;
    }
    if (win.location) {
      win.location.hash = nextHash;
      return true;
    }
  } catch (_) { }
  return false;
}

function getContactIdFromNode(node) {
  if (!node) return '';
  const dataset = node.dataset || {};
  return dataset.contactId
    || (typeof node.getAttribute === 'function' ? node.getAttribute('data-contact-id') : '')
    || '';
}

function getPartnerIdFromNode(node) {
  if (!node) return '';
  const dataset = node.dataset || {};
  return dataset.partnerId
    || (typeof node.getAttribute === 'function' ? node.getAttribute('data-partner-id') : '')
    || '';
}

function markHandled(node) {
  if (!node) return;
  try { node[DASHBOARD_HANDLED_CLICK_KEY] = Date.now(); }
  catch (_) { }
}

function handleDashboardClick(evt) {
  const target = evt && evt.target;
  if (!target || typeof target.closest !== 'function') return false;

  const actionable = target.closest(DASHBOARD_DRILLDOWN_SELECTOR);
  if (!actionable) return false;

  const contactId = getContactIdFromNode(actionable) || (typeof actionable.getAttribute === 'function' ? actionable.getAttribute('data-id') : '');
  if (contactId) {
    if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
    if (evt && typeof evt.stopPropagation === 'function') evt.stopPropagation();
    markHandled(actionable);
    return safeOpenContact(contactId);
  }

  const partnerId = getPartnerIdFromNode(actionable);
  if (partnerId) {
    if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
    if (evt && typeof evt.stopPropagation === 'function') evt.stopPropagation();
    markHandled(actionable);
    return safeOpenPartner(partnerId);
  }

  const route = resolveDashboardRouteTarget(actionable);
  if (route) {
    if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
    if (evt && typeof evt.stopPropagation === 'function') evt.stopPropagation();
    markHandled(actionable);
    return navigateDashboardRoute(route);
  }

  return false;
}

function handleDashboardTap(evt, explicitTarget) {
  if (!evt && !explicitTarget) return false;
  const target = explicitTarget || evt.target;
  if (!target || typeof target.closest !== 'function') return false;
  return handleDashboardClick({ ...evt, target });
}

function isSafeMode() {
  if (!win || !win.location) return false;
  const search = typeof win.location.search === 'string' ? win.location.search : '';
  return /[?&]safe=1(?:&|$)/.test(search);
}

export async function initDashboard(options = {}) {
  const root = options.root
    || (doc && typeof doc.getElementById === 'function' ? doc.getElementById('view-dashboard') : null);
  if (!root) return;
  if (isSafeMode()) return;
  const mod = await import('../labs/dashboard.js');
  const initLabs = mod && typeof mod.initLabsCRMDashboard === 'function'
    ? mod.initLabsCRMDashboard
    : mod && typeof mod.default === 'function'
      ? mod.default
      : null;
  if (typeof initLabs === 'function') {
    await initLabs(root);
  }
}

export function __setDashboardDrilldownTestHooks(hooks = {}) {
  drilldownTestHooks.openContact = typeof hooks.openContact === 'function' ? hooks.openContact : null;
  drilldownTestHooks.openPartner = typeof hooks.openPartner === 'function' ? hooks.openPartner : null;
}

export function __getHandleDashboardClickForTest() {
  return evt => handleDashboardClick(evt);
}

export function __getHandleDashboardTapForTest() {
  return (evt, target) => handleDashboardTap(evt, target);
}
