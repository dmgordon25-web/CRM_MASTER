import { ensureSingletonModal } from './ui/modal_singleton.js';
import { createFormFooter } from './ui/form_footer.js';
import { setReferredBy } from './contacts/form.js';
import { acquireRouteLifecycleToken } from './ui/route_lifecycle.js';
import { clearSelectionForSurface } from './services/selection_reset.js';
import { applyContactFieldVisibility, normalizeSimpleModeSettings, SIMPLE_MODE_DEFAULTS } from './editors/contact_fields.js';
import { getUiMode, onUiModeChanged } from './ui/ui_mode.js';
// import from contact_entry.js REMOVED
import { getTasksApi } from './app_services.js';
import {
  renderStageChip,
  canonicalStage,
  STAGES as CANONICAL_STAGE_META,
  toneForStage,
  toneForStatus,
  toneClassName,
  TONE_CLASSNAMES,
  PIPELINE_MILESTONES,
  normalizeStatusForStage,
  allowedStatusesForStage,
  normalizeMilestoneForStatus,
  allowedMilestonesForStatus,
  allowedStatusesForMilestone,
  normalizeStatusForMilestone,
  canonicalStatusKey,
  milestoneIndex
} from './pipeline/constants.js';
import { toastError, toastInfo, toastSuccess, toastWarn } from './ui/toast_helpers.js';
import { TOUCH_OPTIONS, createTouchLogEntry, formatTouchDate, touchSuccessMessage } from './util/touch_log.js';
import { ensureFavoriteState, renderFavoriteToggle } from './util/favorites.js';
import { openPartnerEditModal } from './ui/modals/partner_edit/index.js';
import { suggestFollowUpSchedule, describeFollowUpCadence } from './tasks/task_utils.js';

// [PATCH] Fix ReferenceError causing crash on view transition
const closeContactEntry = () => {
  const m = document.querySelector('[data-ui="contact-edit-modal"]');
  if (m) { m.style.display = 'none'; m.removeAttribute('open'); }
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createTaskViaService(payload) {
  const api = await getTasksApi();
  const fn = api?.createMinimalTask || api?.createTask || api?.default;
  if (typeof fn !== 'function') {
    throw new Error('Task API unavailable');
  }
  return fn(payload);
}

function resolveContactName(model) {
  if (!model || typeof model !== 'object') return '';
  if (typeof model.name === 'string' && model.name.trim()) {
    return model.name.trim();
  }
  const first = typeof model.firstName === 'string' ? model.firstName.trim() : '';
  const last = typeof model.lastName === 'string' ? model.lastName.trim() : '';
  return [first, last].filter(Boolean).join(' ').trim();
}

export function validateContact(model) {
  const source = model && typeof model === 'object' ? model : {};
  const errors = {};

  const name = resolveContactName(source);
  if (!name) {
    errors.name = 'required';
  }

  const email = typeof source.email === 'string' ? source.email.trim() : '';
  const phone = typeof source.phone === 'string' ? source.phone.trim() : '';
  const hasPhone = Boolean(phone);
  const hasEmail = Boolean(email);

  if (hasEmail && !EMAIL_PATTERN.test(email)) {
    errors.email = 'invalid';
  }

  if (!hasEmail && !hasPhone) {
    errors.email = errors.email || 'required';
    errors.phone = 'required';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}


export const CONTACT_MODAL_KEY = 'contact-edit';
const CONTACT_MODAL_TEMPLATE_ID = 'contact-modal';
const CONTACT_MODAL_DATA_UI = 'contact-edit-modal';
const MODAL_ROOT_SELECTOR = '[data-ui="modal-root"]';

function resolveContactModalInvoker(source) {
  if (!source) return null;
  if (source instanceof HTMLElement) return source;
  if (typeof source === 'object') {
    if (source.trigger instanceof HTMLElement) return source.trigger;
    if (source.currentTarget instanceof HTMLElement) return source.currentTarget;
    if (source.target instanceof HTMLElement) return source.target;
  }
  return null;
}

export function normalizeNewContactPrefill(input = {}) {
  const now = Date.now();
  const first = typeof input.firstName === 'string' ? input.firstName.trim() : '';
  const last = typeof input.lastName === 'string' ? input.lastName.trim() : '';
  const name = (typeof input.name === 'string' ? input.name.trim() : '') || [first, last].filter(Boolean).join(' ');
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const id = (input.id != null && String(input.id).trim() !== '') ? String(input.id) : `tmp-${now}`;
  return {
    id,
    __isNew: input.__isNew === false ? false : true,
    name,
    firstName: first,
    lastName: last,
    email,
    phone,
    company: typeof input.company === 'string' ? input.company.trim() : (input.company?.name || ''),
    title: typeof input.title === 'string' ? input.title.trim() : '',
    meta: { createdAt: input.meta?.createdAt || now, updatedAt: now, ...input.meta },
    ...input,
  };
}

export function normalizeContactId(input) {
  const now = Date.now();
  let id = input;
  if (id && typeof id === 'object' && 'id' in id) id = id.id;
  id = (id == null) ? '' : String(id).trim();
  return id || `tmp-${now}`;
}

// contacts.js — modal guards + renderer (2025-09-17)
(function () {
  if (!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if (window.__INIT_FLAGS__.contacts_modal_guards) return;
  window.__INIT_FLAGS__.contacts_modal_guards = true;

  const $ = (s, r = document) => r.querySelector(s);
  const escape = (val) => String(val || '').replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const notify = (msg, kind = 'info') => {
    const text = String(msg ?? '').trim();
    if (!text) return;
    try {
      if (kind === 'warn') {
        toastWarn(text);
      } else if (kind === 'error') {
        toastError(text);
      } else {
        toastInfo(text);
      }
    } catch (_) {
      try { console && console.info && console.info('[contacts]', text); }
      catch (__err) { }
    }
  };

  const NONE_PARTNER_ID = '00000000-0000-none-partner-000000000000';
  const CONTACT_INVALID_TOAST = 'Please fix highlighted fields';

  function focusContactField(field) {
    if (!field || typeof field.focus !== 'function') return;
    try {
      field.focus({ preventScroll: true });
    } catch (_err) {
      try { field.focus(); }
      catch (__err) { }
    }
  }

  const CONTACT_VALIDATION_CONFIG = {
    name: {
      selectors: ['#c-first', '#c-last'],
      message: () => 'Name is required'
    },
    email: {
      selectors: ['#c-email'],
      message: (code) => code === 'invalid' ? 'Enter a valid email' : 'Email or phone required'
    },
    phone: {
      selectors: ['#c-phone'],
      message: () => 'Phone or email required'
    }
  };

  function clearContactValidation(container) {
    if (!container) return;
    container.querySelectorAll('[data-contact-error]').forEach(node => node.remove());
    container.querySelectorAll('[data-contact-invalid]').forEach(field => {
      field.classList.remove('field-error');
      field.removeAttribute('aria-invalid');
      delete field.dataset.contactInvalid;
    });
  }

  function applyContactValidation(container, errors) {
    clearContactValidation(container);
    if (!container) return { firstInvalid: null };
    let firstInvalid = null;
    const keys = Object.keys(CONTACT_VALIDATION_CONFIG);
    keys.forEach(key => {
      const config = CONTACT_VALIDATION_CONFIG[key] || {};
      const selectors = Array.isArray(config.selectors) ? config.selectors : [];
      const code = errors && Object.prototype.hasOwnProperty.call(errors, key) ? errors[key] : null;
      const message = code ? (typeof config.message === 'function' ? config.message(code, key) : config.message || '') : '';
      const primarySelector = selectors[0] || null;
      const primaryField = primarySelector ? container.querySelector(primarySelector) : null;
      const previous = container.querySelector(`[data-contact-error="${key}"]`);
      if (previous) {
        previous.remove();
      }
      selectors.forEach(selector => {
        const field = container.querySelector(selector);
        if (!field) return;
        if (message) {
          field.classList.add('field-error');
          field.setAttribute('aria-invalid', 'true');
          field.dataset.contactInvalid = '1';
          if (!firstInvalid) firstInvalid = field;
        } else if (field.dataset && field.dataset.contactInvalid) {
          field.classList.remove('field-error');
          field.removeAttribute('aria-invalid');
          delete field.dataset.contactInvalid;
        } else {
          field.classList.remove('field-error');
          field.removeAttribute('aria-invalid');
        }
      });
      if (message && primaryField) {
        const label = primaryField.closest('label');
        if (label) {
          const errorEl = document.createElement('div');
          errorEl.className = 'field-error';
          errorEl.dataset.contactError = key;
          errorEl.textContent = String(message);
          label.insertAdjacentElement('afterend', errorEl);
        }
      }
    });
    return { firstInvalid };
  }

  function disableBodyScroll() {
    if (typeof document === 'undefined') return () => { };
    const body = document.body;
    if (!body) return () => { };
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    let appliedPadding = false;
    try {
      const scrollBarGap = window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarGap > 0) {
        body.style.paddingRight = `${scrollBarGap}px`;
        appliedPadding = true;
      }
    } catch (_err) { }
    body.style.overflow = 'hidden';
    body.dataset.contactModalScroll = '1';
    return () => {
      if (!body.dataset || body.dataset.contactModalScroll !== '1') return;
      delete body.dataset.contactModalScroll;
      body.style.overflow = previousOverflow;
      if (appliedPadding) {
        body.style.paddingRight = previousPadding;
      }
    };
  }

  function generateContactId(seed) {
    return normalizeContactId(seed);
  }

  function createContactDraft(seed) {
    const id = generateContactId(seed);
    return {
      id,
      first: '',
      last: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      stage: 'application',
      stageEnteredAt: new Date().toISOString(),
      status: 'inprogress',
      loanAmount: '',
      rate: '',
      fundedDate: '',
      buyerPartnerId: null,
      listingPartnerId: null,
      referralPartnerId: '',
      referralPartnerName: '',
      lastContact: '',
      referredBy: '',
      notes: '',
      contactType: 'Borrower',
      priority: 'Warm',
      leadSource: '',
      communicationPreference: 'Phone',
      closingTimeline: 'Ready Now',
      loanPurpose: 'Purchase',
      loanProgram: 'Conventional',
      loanType: 'Conventional',
      propertyType: 'Single-Family',
      occupancy: 'Primary Residence',
      creditRange: 'Unknown',
      employmentType: 'W-2',
      docStage: 'application-started',
      pipelineMilestone: 'Intro Call',
      preApprovalExpires: '',
      nextFollowUp: '',
      secondaryEmail: '',
      secondaryPhone: '',
      missingDocs: ''
    };
  }
  function safeTrim(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim();
    try { return String(value).trim(); }
    catch (_err) { return ''; }
  }

  function ensureTimestamp(value, fallback) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
    return fallback;
  }

  function normalizeNewContactPrefill(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const now = Date.now();
    const base = Object.assign({}, raw);
    const normalizedId = normalizeContactId(base.id || base.contactId || base.tempId);
    base.id = normalizedId || `tmp-${now}`;
    const firstName = safeTrim(base.firstName ?? base.first);
    const lastName = safeTrim(base.lastName ?? base.last);
    const name = safeTrim(base.name || `${firstName} ${lastName}`.trim());
    const email = safeTrim(base.email ?? base.primaryEmail ?? base.workEmail);
    const phone = safeTrim(base.phone ?? base.primaryPhone ?? base.mobile);
    base.firstName = firstName;
    base.lastName = lastName;
    if (!base.first) base.first = firstName;
    if (!base.last) base.last = lastName;
    base.name = name;
    base.email = email;
    base.phone = phone;
    base.__isNew = true;
    const metaSource = base.meta && typeof base.meta === 'object' ? base.meta : {};
    const createdAt = ensureTimestamp(metaSource.createdAt, now);
    const updatedAt = ensureTimestamp(metaSource.updatedAt, createdAt);
    base.meta = { createdAt, updatedAt };
    return base;
  }

  function isRecoverableContactError(err) {
    if (!err) return false;
    const message = typeof err === 'object' && err && typeof err.message === 'string'
      ? err.message
      : String(err);
    if (!message) return false;
    return /missing property/i.test(message)
      || /Cannot read properties of undefined/i.test(message)
      || /Cannot read property/i.test(message);
  }

  const noop = () => { };
  let refreshFollowUpSuggestion = noop;

  const removeToneClasses = (node) => {
    if (!node || !node.classList) return;
    TONE_CLASSNAMES.forEach((cls) => node.classList.remove(cls));
  };

  const buildStageFallback = (label, source) => {
    const stageLabel = label || 'Stage';
    const toneKey = toneForStage(source || stageLabel);
    const toneClass = toneClassName(toneKey);
    const classSuffix = toneClass ? ` ${toneClass}` : '';
    const toneAttr = toneKey ? ` data-tone="${toneKey}"` : '';
    return `<span class="stage-chip stage-generic${classSuffix}" data-role="stage-chip" data-qa="stage-chip-generic"${toneAttr}>${escape(stageLabel)}</span>`;
  };

  const STAGES = [
    { value: 'long-shot', label: 'Lead' },
    { value: 'application', label: 'Application' },
    { value: 'preapproved', label: 'Pre-Approved' },
    { value: 'processing', label: 'Processing' },
    { value: 'underwriting', label: 'Underwriting' },
    { value: 'approved', label: 'Approved' },
    { value: 'cleared-to-close', label: 'Cleared to Close' },
    { value: 'funded', label: 'Funded' },
    { value: 'post-close', label: 'Post-Close' },
    { value: 'nurture', label: 'Nurture' },
    { value: 'lost', label: 'Lost' },
    { value: 'denied', label: 'Denied' }
  ];
  const STAGE_FLOW = ['long-shot', 'application', 'preapproved', 'processing', 'underwriting', 'approved', 'cleared-to-close', 'funded', 'post-close'];
  const STAGE_AUTOMATIONS = {
    'long-shot': 'Captures brand-new leads, tags referral sources, and schedules nurture cadences automatically.',
    application: 'Creates welcome tasks, kicks off the doc checklist, and schedules a first follow-up reminder.',
    preapproved: 'Confirms credit docs, arms borrowers with next steps, and keeps partners in the loop.',
    processing: 'Alerts processing teammates, syncs missing documents, and tightens the follow-up cadence.',
    underwriting: 'Logs underwriting review, sets condition tracking tasks, and updates partner status digests.',
    approved: 'Preps clear-to-close outreach, nudges partners with status updates, and confirms closing logistics.',
    'cleared-to-close': 'Queues closing packet reminders, notifies settlement partners, and schedules celebration touch points.',
    funded: 'Triggers post-closing nurture, partner thank-yous, and review requests for the borrower.',
    'post-close': 'Launches annual reviews, referrals, and gifting automations for happy clients.',
    nurture: 'Keeps long-term leads warm with periodic value touches and partner updates.',
    lost: 'Documents outcome, schedules re-engagement, and captures learnings for the team.',
    denied: 'Captures denial reasons, assigns compliance follow-ups, and plans credit repair touchpoints.'
  };
  const FOLLOW_UP_RULES = Object.freeze({
    'long-shot': { days: 2, note: 'Confirm intro call and set nurture cadence.' },
    application: { days: 2, note: 'Check application progress and document needs.' },
    preapproved: { days: 3, note: 'Review readiness and partner alignment.' },
    processing: { days: 2, note: 'Sync processing status and borrower expectations.' },
    underwriting: { days: 1, note: 'Track underwriting conditions and prep responses.' },
    approved: { days: 1, note: 'Coordinate closing logistics and next milestones.' },
    'cleared-to-close': { days: 1, note: 'Confirm closing details and celebration plan.' },
    funded: { days: 30, note: 'Launch post-close nurture touch.' },
    'post-close': { days: 45, note: 'Plan gifting and review outreach.' },
    nurture: { days: 14, note: 'Send value touch to stay top-of-mind.' },
    paused: { days: 14, note: 'Revisit paused file for status check.' },
    lost: { days: 60, note: 'Schedule re-engagement touchpoint.' },
    denied: { days: 45, note: 'Offer credit roadmap follow-up.' },
    default: { days: 3, note: 'Maintain steady follow-up cadence.' }
  });
  const STATUSES = [
    { value: 'inprogress', label: 'In Progress' },
    { value: 'active', label: 'Active' },
    { value: 'client', label: 'Client' },
    { value: 'paused', label: 'Paused' },
    { value: 'lost', label: 'Lost' },
    { value: 'nurture', label: 'Nurture' }
  ];
  const CONTACT_TYPES = [
    'Borrower', 'Co-Borrower', 'Past Client', 'Referral Partner', 'Agent / Partner', 'Builder', 'Financial Advisor', 'Other'
  ];
  const PRIORITIES = ['Hot', 'Warm', 'Nurture', 'Dormant'];
  const LEAD_SOURCES = ['Sphere of Influence', 'Realtor Partner', 'Online Lead', 'Past Client', 'Builder', 'Financial Advisor', 'Marketing Campaign', 'Walk-In', 'Other'];
  const COMM_PREFS = ['Phone', 'Text', 'Email', 'Video Call', 'In Person'];
  const TIMELINES = ['Ready Now', '30 Days', '60 Days', '90+ Days', 'TBD'];
  const LOAN_PURPOSES = ['Purchase', 'Cash-Out Refinance', 'Rate/Term Refinance', 'Construction', 'Investment', 'HELOC', 'Reverse Mortgage'];
  const LOAN_PROGRAMS = ['Conventional', 'FHA', 'VA', 'USDA', 'Jumbo', 'Non-QM', 'HELOC', 'Bridge', 'Other'];
  const PROPERTY_TYPES = ['Single-Family', 'Condo', 'Townhome', '2-4 Unit', 'Multi-Family (5+)', 'Manufactured', 'New Construction', 'Land'];
  const OCCUPANCY = ['Primary Residence', 'Second Home', 'Investment'];
  const CREDIT_BANDS = ['760+', '720-759', '680-719', '640-679', '600-639', '<600', 'Unknown'];
  const EMPLOYMENT = ['W-2', '1099', 'Self-Employed', 'Retired', 'Student', 'Other'];
  const DOC_STAGES = [
    { value: 'application-started', label: 'Application Started' },
    { value: 'needs-docs', label: 'Needs Docs' },
    { value: 'submitted-to-uw', label: 'Submitted to UW' },
    { value: 'conditional-approval', label: 'Conditional Approval' },
    { value: 'clear-to-close', label: 'Clear to Close' },
    { value: 'post-closing', label: 'Post-Closing' }
  ];
  const MILESTONE_ACTIONS = {
    'Intro Call': 'Send App Invite',
    'Application Sent': 'Confirm Application Receipt',
    'Application Submitted': 'Review Submission',
    'UW in Progress': 'Prep Conditions Checklist',
    'Conditions Out': 'Request Updated Docs',
    'Clear to Close': 'Schedule Closing Call',
    'Docs Out': 'Confirm Closing Package',
    'Funded / Post-Close': 'Request Review'
  };
  const slugifyMilestone = (label) => String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'milestone';
  const milestoneMeta = (value, status) => {
    const normalized = normalizeMilestoneForStatus(value, status || 'inprogress');
    let index = milestoneIndex(normalized);
    if (index < 0) index = 0;
    const label = PIPELINE_MILESTONES[index] || PIPELINE_MILESTONES[0];
    const action = MILESTONE_ACTIONS[label] || 'Log Next Step';
    const slug = slugifyMilestone(label);
    return { index, label, action, slug };
  };

  function avatarCharToken(ch) {
    if (!ch) return '';
    const upper = ch.toLocaleUpperCase();
    const lower = ch.toLocaleLowerCase();
    if (upper !== lower) return upper;
    return /[0-9]/.test(ch) ? ch : '';
  }
  function computeAvatarInitials(name) {
    const parts = Array.from(String(name || '').trim().split(/\s+/).filter(Boolean));
    if (!parts.length) return '';
    const tokens = parts.map(part => {
      const chars = Array.from(part);
      for (const ch of chars) {
        const token = avatarCharToken(ch);
        if (token) return token;
      }
      return '';
    }).filter(Boolean);
    if (!tokens.length) return '';
    let first = tokens[0] || '';
    let second = '';
    if (tokens.length > 1) {
      second = tokens[tokens.length - 1] || '';
    } else {
      const chars = Array.from(parts[0]).slice(1);
      for (const ch of chars) {
        const token = avatarCharToken(ch);
        if (token) {
          second = token;
          break;
        }
      }
    }
    const combined = (first + second).slice(0, 2);
    return combined || first || '';
  }
  function contactAvatarSource(contact) {
    if (!contact) return '';
    const first = String(contact.first || '').trim();
    const last = String(contact.last || '').trim();
    if (first || last) return `${first} ${last}`.trim();
    if (contact.name) return String(contact.name || '').trim();
    if (contact.email) return String(contact.email || '').trim();
    if (contact.company) return String(contact.company || '').trim();
    return '';
  }
  function renderAvatarSpan(name, role) {
    const initials = computeAvatarInitials(name);
    const classes = ['initials-avatar'];
    if (!initials) classes.push('is-empty');
    const roleAttr = role ? ` data-role="${escape(role)}"` : '';
    const value = initials || '?';
    return `<span class="${classes.join(' ')}"${roleAttr} aria-hidden="true" data-initials="${escape(value)}"></span>`;
  }
  function applyAvatar(el, name, fallback) {
    if (!el) return;
    const initials = computeAvatarInitials(name);
    if (initials) {
      el.dataset.initials = initials;
      el.classList.remove('is-empty');
      return;
    }
    const alt = computeAvatarInitials(fallback);
    if (alt) {
      el.dataset.initials = alt;
      el.classList.remove('is-empty');
      return;
    }
    el.dataset.initials = '?';
    el.classList.add('is-empty');
  }
  const STATES = [
    { value: '', label: 'Select state' },
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'DC', label: 'District of Columbia' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' }
  ];

  const optionList = (items, current) => {
    const seen = new Set();
    const opts = items.map(item => {
      const value = typeof item === 'string' ? item : item.value;
      const label = typeof item === 'string' ? item : (item.label || item.value || '');
      seen.add(String(value));
      const selected = String(current || '') === String(value) ? ' selected' : '';
      return `<option value="${escape(value)}"${selected}>${escape(label)}</option>`;
    });
    if (current && !seen.has(String(current))) {
      opts.unshift(`<option value="${escape(current)}" selected>${escape(current)}</option>`);
    }
    return opts.join('');
  };
  const findLabel = (list, value) => {
    const item = list.find(it => String(typeof it === 'string' ? it : it.value) === String(value || ''));
    if (!item) return '';
    return typeof item === 'string' ? item : (item.label || item.value || '');
  };
  const DETAIL_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDetailDate = (value, fallback = 'Not logged') => {
    if (!value) return fallback;
    try {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return fallback;
      return DETAIL_DATE_FORMATTER.format(date);
    } catch (_err) {
      return fallback;
    }
  };

  window.renderContactModal = async function (contactId, rawOptions) {
    console.log('[CONTACTS_DEBUG] renderContactModal called', contactId);
    const options = rawOptions && typeof rawOptions === 'object' ? rawOptions : {};
    const normalizedPrefetch = options.prefetchedRecord && typeof options.prefetchedRecord === 'object'
      ? normalizeNewContactPrefill(options.prefetchedRecord)
      : null;
    if (normalizedPrefetch) {
      options.prefetchedRecord = normalizedPrefetch;
    }
    let closeDialog = () => { };
    try {
      const requestedId = normalizeContactId(options.contactId || contactId || (normalizedPrefetch ? normalizedPrefetch.id : ''));
      const sourceHint = typeof options.sourceHint === 'string' ? options.sourceHint.trim() : '';
      const invoker = options.invoker instanceof HTMLElement
        ? options.invoker
        : resolveContactModalInvoker(options);

      let base = null;
      if (options.host instanceof HTMLElement) {
        base = tagContactModal(options.host);
      } else {
        base = ensureSingletonModal(CONTACT_MODAL_KEY, () => ensureContactModalShell());
        base = base instanceof Promise ? await base : base;
      }
      console.log('[CONTACTS_DEBUG] base modal resolved', base);
      if (!base) {
        try { console && console.warn && console.warn('[contact-editor]', 'host missing'); }
        catch (_warn) { }
        toastWarn('Contact editor host missing');
        return null;
      }

      const dlg = base;

      // FIX: DISARM FOCUS TRAP
      // We capture the invoker but set the dialog property to NULL temporarily.
      // This prevents the 'close' event handler from trying to restore focus
      // while we are simply resetting the modal for a new record.
      const nextInvoker = invoker || dlg.__contactInvoker || null;
      dlg.__contactInvoker = null;

      if (dlg.__contactScrollRestore && typeof dlg.__contactScrollRestore === 'function') {
        try { dlg.__contactScrollRestore(); } catch (_err) { }
      }
      dlg.__contactScrollRestore = disableBodyScroll();

      // if (dlg.hasAttribute('open')) {
      //   try { dlg.close(); } catch (_err) { }
      // }

      // Restore invoker for the actual session
      dlg.__contactInvoker = nextInvoker;

      // ... continue with dlg.style.display='block' ...
      dlg.style.display = 'block';
      console.log('[CONTACTS_DEBUG] showing modal', dlg);
      let opened = false;
      if (typeof dlg.showModal === 'function') {
        try { dlg.showModal(); opened = true; }
        catch (err) { console.log('[CONTACTS_DEBUG] showModal failed', err); }
      }
      if (!opened) {
        try { dlg.setAttribute('open', ''); }
        catch (_) { }
      }
      try { dlg.setAttribute('open', ''); }
      catch (_) { }

      if (dlg.dataset) {
        dlg.dataset.open = '0';
        dlg.dataset.opening = '1';
        dlg.dataset.sourceHint = sourceHint || '';
      }
      if (sourceHint) {
        dlg.setAttribute('data-source-hint', sourceHint);
      } else {
        try { dlg.removeAttribute('data-source-hint'); }
        catch (_err) { }
      }

      const ensureModalAddButton = () => {
        const bodyHost = dlg.querySelector('.modal-body');
        if (!bodyHost) return;
        let btn = bodyHost.querySelector('button[data-role="contact-modal-add-contact"]');
        if (!btn) {
          btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn brand';
          btn.dataset.role = 'contact-modal-add-contact';
          btn.setAttribute('aria-label', 'Add Contact');
          btn.setAttribute('title', 'Add Contact');
          btn.style.marginBottom = '12px';
          bodyHost.insertBefore(btn, bodyHost.firstChild || null);
        }
        if (btn) {
          const ensureContent = () => {
            const icon = btn.querySelector('.btn-icon');
            const label = btn.querySelector('.btn-label');
            if (icon && label) {
              label.textContent = 'Add Contact';
              return;
            }
            btn.innerHTML = '';
            const iconEl = document.createElement('span');
            iconEl.className = 'btn-icon';
            iconEl.setAttribute('aria-hidden', 'true');
            iconEl.textContent = '+';
            const labelEl = document.createElement('span');
            labelEl.className = 'btn-label';
            labelEl.textContent = 'Add Contact';
            btn.append(iconEl, labelEl);
          };
          ensureContent();
        }
        if (!btn.__wired) {
          btn.__wired = true;
          btn.addEventListener('click', (event) => {
            event.preventDefault();
            try { dlg.close(); }
            catch (_err) { }
            try { dlg.removeAttribute('open'); }
            catch (_err) { }
            try { dlg.style.display = 'none'; }
            catch (_err) { }
            Promise.resolve().then(() => {
              try {
                window.renderContactModal?.(null);
              } catch (err) {
                if (console && typeof console.warn === 'function') {
                  console.warn('contact modal add contact reopen failed', err);
                }
              }
            });
          });
        }
      };

      ensureModalAddButton();

      closeDialog = () => {
        try { dlg.close(); }
        catch (_) { }
        try { dlg.removeAttribute('open'); }
        catch (_) { }
        try { dlg.style.display = 'none'; }
        catch (_) { }
      };

      await openDB();
      let contactRecord = options.prefetchedRecord && typeof options.prefetchedRecord === 'object'
        ? options.prefetchedRecord
        : null;
      if (!contactRecord && requestedId) {
        try {
          contactRecord = await dbGet('contacts', requestedId);
        } catch (err) {
          try { console && console.warn && console.warn('contact load failed', err); }
          catch (_warn) { }
          contactRecord = null;
        }
      }
      if (requestedId && !contactRecord && !String(requestedId).startsWith('tmp-')) {
        toastWarn('Contact not found');
        closeDialog();
        return null;
      }
      let simpleModeSettings = SIMPLE_MODE_DEFAULTS;
      if (window.Settings && typeof window.Settings.get === 'function') {
        try {
          const settingsData = await window.Settings.get();
          simpleModeSettings = normalizeSimpleModeSettings(settingsData && settingsData.simpleMode);
        } catch (err) {
          try { console && console.warn && console.warn('[contact-editor] settings load failed', err); }
          catch (_warn) { }
        }
      }
      const [contacts, partners] = await Promise.all([dbGetAll('contacts'), dbGetAll('partners')]);
      const draft = createContactDraft(contactRecord?.id || requestedId);
      const c = Object.assign(draft, contactRecord || {});
      if (!c.stageEnteredAt) {
        c.stageEnteredAt = new Date().toISOString();
      }
      if (dlg.dataset) {
        dlg.dataset.contactId = String(c.id || '');
      }
      const partnerMap = new Map();
      const partnerIds = new Set();
      const partnerOptions = partners.map(p => {
        const rawId = String(p.id);
        const id = escape(rawId);
        const name = escape(p.name || '—');
        const company = p.company ? ` — ${escape(p.company)}` : '';
        partnerMap.set(rawId, p);
        partnerIds.add(rawId);
        return `<option value="${id}">${name}${company}</option>`;
      });
      const ensurePartnerOption = (rawId, label) => {
        const id = String(rawId || '').trim();
        if (!id || partnerIds.has(id) || id === NONE_PARTNER_ID) return;
        partnerOptions.push(`<option value="${escape(id)}">${escape(label || `Partner ${id}`)}</option>`);
        partnerIds.add(id);
      };
      const normalizedReferralPartnerId = c.referralPartnerId ? String(c.referralPartnerId).trim() : '';
      const referralPartnerId = normalizedReferralPartnerId && normalizedReferralPartnerId !== NONE_PARTNER_ID
        ? normalizedReferralPartnerId
        : '';
      const referralPartnerName = String(c.referralPartnerName || '').trim();
      if (referralPartnerId && !partnerIds.has(referralPartnerId)) {
        ensurePartnerOption(referralPartnerId, referralPartnerName || `Partner ${referralPartnerId}`);
      }
      const opts = partnerOptions.join('');
      const partnerLabelFor = (id) => {
        const key = String(id || '').trim();
        if (!key || key === NONE_PARTNER_ID) return '';
        const record = partnerMap.get(key);
        if (record) {
          const preferred = String(record.name || '').trim();
          if (preferred) return preferred;
          const company = String(record.company || '').trim();
          if (company) return company;
          const email = String(record.email || '').trim();
          if (email) return email;
          const phone = String(record.phone || '').trim();
          if (phone) return phone;
        }
        return '';
      };
      const referralPartnerLabel = partnerLabelFor(referralPartnerId) || referralPartnerName;
      const body = dlg.querySelector('#contact-modal-body');
      const stageLabel = findLabel(STAGES, c.stage) || 'Application';
      const stageCanonicalKey = canonicalStage(c.stage) || canonicalStage(stageLabel);
      const stageFallbackChip = buildStageFallback(stageLabel, c.stage);
      const stageChip = renderStageChip(c.stage) || renderStageChip(stageLabel) || stageFallbackChip;
      const stageCanonicalAttr = stageCanonicalKey ? ` data-stage-canonical="${escape(stageCanonicalKey)}"` : '';
      const statusLabel = findLabel(STATUSES, c.status) || 'In Progress';
      const statusToneKey = toneForStatus(c.status);
      const statusToneClass = toneClassName(statusToneKey);
      const statusToneAttr = statusToneKey ? ` data-tone="${statusToneKey}"` : '';
      const statusPillHtml = `<span class="status-pill${statusToneClass ? ` ${statusToneClass}` : ''}" data-status="${escape(c.status || 'inprogress')}"${statusToneAttr}>${escape(statusLabel)}</span>`;
      const fmtCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
      const loanMetric = Number(c.loanAmount || 0) > 0 ? fmtCurrency.format(Number(c.loanAmount || 0)) : 'TBD';
      const nextTouch = (c.nextFollowUp || '').slice(0, 10) || (c.closingTimeline || 'TBD');
      const lastTouchIso = String(c.lastContact || c.lastTouch || '').slice(0, 10);
      const detailLastTouch = lastTouchIso ? formatDetailDate(lastTouchIso, 'Not logged') : 'Not logged';
      const nextFollowUpIso = String(c.nextFollowUp || '').slice(0, 10);
      const detailNextFollowUp = nextFollowUpIso
        ? formatDetailDate(nextFollowUpIso, 'TBD')
        : (c.closingTimeline ? String(c.closingTimeline) : 'TBD');
      const detailReferralDisplay = referralPartnerLabel || 'Not linked';
      const stageSliderMarks = STAGE_FLOW.map((stage, idx) => `<span class="stage-slider-mark" data-index="${idx}" data-stage="${escape(stage)}">${idx + 1}</span>`).join('');
      const stageSliderLabels = STAGE_FLOW.map(stage => `<span>${escape(findLabel(STAGES, stage) || stage)}</span>`).join('');
      const firstName = String(c.first || '').trim();
      const lastName = String(c.last || '').trim();
      const summaryLabel = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : 'New Contact';
      const summaryAvatarMarkup = renderAvatarSpan(contactAvatarSource(c), 'summary-avatar');
      const favoriteState = ensureFavoriteState();
      const isFavoriteContact = favoriteState.contacts.has(String(c.id || ''));
      const favoriteToggleHtml = renderFavoriteToggle('contact', c.id, isFavoriteContact);
      const summaryClasses = ['summary-name'];
      if (isFavoriteContact) summaryClasses.push('is-favorite');
      const summaryFavoriteAttr = isFavoriteContact ? ' data-favorite="1"' : '';
      const summaryIdAttr = escape(c.id || '');
      const referralSummaryMarkup = `<button type="button" class="btn-link more" data-role="referral-partner-summary"${referralPartnerId ? ` data-partner-id="${escape(referralPartnerId)}"` : ''}>${escape(referralPartnerLabel || 'Assign Referral Partner')}</button>`;
      body.innerHTML = `
      <input type="hidden" id="c-id" value="${escape(c.id || '')}">
      <input type="hidden" id="c-lastname" value="${escape(c.last || '')}">
      <div class="modal-form-layout">
        <aside class="modal-summary">
          <div class="${summaryClasses.join(' ')}" data-role="favorite-host" data-favorite-type="contact" data-record-id="${summaryIdAttr}"${summaryFavoriteAttr}>
            ${summaryAvatarMarkup}
            <span class="summary-name-text" data-role="summary-name-text">${escape(summaryLabel)}</span>
            <span class="summary-actions" data-role="favorite-actions">${favoriteToggleHtml}</span>
          </div>
          <div class="summary-meta">
            <span data-role="stage-chip-wrapper" data-stage="${escape(c.stage || 'application')}"${stageCanonicalAttr}>${stageChip}</span>
            ${statusPillHtml}
          </div>
          <div class="summary-metrics">
            <div class="summary-metric">
              <span class="metric-label">Loan Program</span>
              <span class="metric-value" id="c-summary-program">${escape(c.loanType || c.loanProgram || 'Select')}</span>
            </div>
            <div class="summary-metric">
              <span class="metric-label">Loan Amount</span>
              <span class="metric-value" id="c-summary-amount">${escape(loanMetric)}</span>
            </div>
            <div class="summary-metric">
              <span class="metric-label">Next Touch</span>
              <span class="metric-value" id="c-summary-touch">${escape(nextTouch)}</span>
            </div>
            <div class="summary-metric">
              <span class="metric-label">Lead Source</span>
              <span class="metric-value" id="c-summary-source">${escape(c.leadSource || 'Set Source')}</span>
            </div>
            <div class="summary-metric">
              <span class="metric-label">Referral Partner</span>
              <span class="metric-value" id="c-summary-referral">${referralSummaryMarkup}</span>
            </div>
          </div>
          <div class="modal-note" id="c-summary-note">
            Keep momentum with timely follow-up, clear milestones, and aligned partner updates.
          </div>
        </aside>
        <div class="modal-main">
          <div class="modal-core">
            <section class="milestone-header" data-role="milestone-header">
              <div class="milestone-header-top">
                <div class="milestone-progress" role="progressbar" aria-label="Pipeline milestone progress" aria-valuemin="1" aria-valuemax="${PIPELINE_MILESTONES.length}" aria-valuenow="1" data-role="milestone-progress" data-qa="milestone-bar">
                  <div class="milestone-progress-fill" data-role="milestone-progress-fill"></div>
                </div>
                <button class="btn ghost compact" type="button" data-role="milestone-next" data-qa="milestone-next">Log Next Step</button>
              </div>
              <div class="milestone-badges" role="group" aria-label="Milestone badges">
                ${PIPELINE_MILESTONES.map((label, idx) => `<button type="button" class="milestone-badge" data-role="milestone-badge" data-index="${idx}" data-milestone="${escape(label)}" data-qa="milestone-badge">${escape(label)}</button>`).join('')}
              </div>
            </section>
            <div class="modal-content">
              <nav class="modal-tabs" id="contact-tabs">
                <button class="btn active" data-panel="profile" type="button">Profile</button>
                <button class="btn" data-panel="loan" type="button">Loan &amp; Property</button>
                <button class="btn" data-panel="relationships" type="button">Relationships</button>
                <button class="btn" data-panel="docs" type="button">Document Checklist</button>
              </nav>
              <div class="modal-panels">
                <section class="modal-section modal-panel active" data-panel="profile">
              <h4>Borrower Profile</h4>
              <div class="field-grid cols-2">
                <label data-required="true">First Name<input aria-required="true" id="c-first" value="${escape(c.first || '')}"></label>
                <label data-required="true">Last Name<input aria-required="true" id="c-last" value="${escape(c.last || '')}"></label>
                <label>Contact Role<select id="c-type">${optionList(CONTACT_TYPES, c.contactType || 'Borrower')}</select></label>
                <label>Priority<select id="c-priority">${optionList(PRIORITIES, c.priority || 'Warm')}</select></label>
                <label>Lead Source<select id="c-source"><option value="">Select source</option>${optionList(LEAD_SOURCES, c.leadSource || '')}</select></label>
                <label>Communication Preference<select id="c-pref">${optionList(COMM_PREFS, c.communicationPreference || 'Phone')}</select></label>
                <label data-required="true">Primary Email<input aria-required="true" id="c-email" type="email" value="${escape(c.email || '')}"></label>
                <label data-required="true">Mobile / Direct Line<input aria-required="true" id="c-phone" type="tel" value="${escape(c.phone || '')}"></label>
                <label data-advanced="contact">Secondary Email<input id="c-email2" type="email" value="${escape(c.secondaryEmail || '')}"></label>
                <label data-advanced="contact">Secondary Phone<input id="c-phone2" type="tel" value="${escape(c.secondaryPhone || '')}"></label>
              </div>
            </section>
            <section class="modal-section modal-panel" data-panel="loan">
              <h4>Pipeline Stage</h4>
              <div class="stage-slider" id="contact-stage-slider">
                <div class="stage-slider-track">
                  <div class="stage-slider-progress" id="contact-stage-progress"></div>
                  <div class="stage-slider-marks">${stageSliderMarks}</div>
                </div>
                <div class="stage-slider-labels">${stageSliderLabels}</div>
                <input type="range" min="0" max="${STAGE_FLOW.length - 1}" step="1" value="0" id="contact-stage-range" aria-label="Pipeline stage slider">
                <div class="stage-slider-help" id="contact-stage-help">
                  <strong id="contact-stage-help-title">Automations</strong>
                  <p id="contact-stage-helptext">Stage changes keep automations, partner notifications, and task lists in sync.</p>
                </div>
              </div>
              <div style="margin-top:18px">
                <h4>Property &amp; Loan Snapshot</h4>
                <div class="field-grid cols-3">
                  <label data-required="true">Stage<select aria-required="true" id="c-stage">${optionList(STAGES, c.stage || 'application')}</select></label>
                  <label data-required="true">Status<select aria-required="true" id="c-status">${optionList(STATUSES, c.status || 'inprogress')}</select></label>
                  <label data-advanced="loan">Closing Timeline<select id="c-timeline">${optionList(TIMELINES, c.closingTimeline || '')}</select></label>
                  <label data-advanced="loan">Loan Purpose<select id="c-purpose">${optionList(LOAN_PURPOSES, c.loanPurpose || 'Purchase')}</select></label>
                  <label data-advanced="loan">Loan Program<select id="c-loanType">${optionList(LOAN_PROGRAMS, c.loanType || c.loanProgram || 'Conventional')}</select></label>
                  <label data-advanced="loan">Property Type<select id="c-property">${optionList(PROPERTY_TYPES, c.propertyType || 'Single-Family')}</select></label>
                  <label data-advanced="loan">Occupancy<select id="c-occupancy">${optionList(OCCUPANCY, c.occupancy || 'Primary Residence')}</select></label>
                  <label data-advanced="loan">Employment Type<select id="c-employment">${optionList(EMPLOYMENT, c.employmentType || 'W-2')}</select></label>
                  <label data-advanced="loan">Credit Range<select id="c-credit">${optionList(CREDIT_BANDS, c.creditRange || 'Unknown')}</select></label>
                </div>
                <div class="field-grid cols-3" style="margin-top:12px">
                  <label data-advanced="loan">Loan Amount<input id="c-amount" type="number" value="${escape(c.loanAmount || '')}"></label>
                  <label data-advanced="loan">Rate<input id="c-rate" type="number" step="0.001" value="${escape(c.rate || '')}"></label>
                  <label data-advanced="loan">Funded / Expected Closing<input id="c-funded" type="date" value="${escape((c.fundedDate || '').slice(0, 10))}"></label>
                  <label data-advanced="loan">Pre-Approval Expires<input id="c-preexp" type="date" value="${escape((c.preApprovalExpires || '').slice(0, 10))}"></label>
                  <label data-advanced="loan">Documentation Stage<select id="c-docstage">${optionList(DOC_STAGES, c.docStage || 'application-started')}</select></label>
                  <label data-advanced="loan">Pipeline Milestone<select id="c-milestone">${optionList(PIPELINE_MILESTONES, c.pipelineMilestone || 'Intro Call')}</select></label>
                </div>
              </div>
              <div style="margin-top:18px">
                <h4>Property Address</h4>
                <div class="field-grid cols-2">
                  <label>Street Address<input id="c-address" value="${escape(c.address || '')}"></label>
                  <label>City<input id="c-city" value="${escape(c.city || '')}"></label>
                  <label>State<select id="c-state">${optionList(STATES, (c.state || '').toUpperCase())}</select></label>
                  <label>ZIP<input id="c-zip" value="${escape(c.zip || '')}"></label>
                </div>
              </div>
            </section>
            <section class="modal-section modal-panel" data-panel="relationships">
              <h4>Relationships &amp; Follow-Up</h4>
              <div class="field-grid cols-2">
                  <label data-advanced="relationships">Buyer Partner<select id="c-buyer"><option value="">Select partner</option>${opts}</select></label>
                  <label data-advanced="relationships">Listing Partner<select id="c-listing"><option value="">Select partner</option>${opts}</select></label>
                  <label data-advanced="relationships">Referral Partner<select id="c-referral-partner"><option value="">Select partner</option>${opts}</select></label>
                  <label data-advanced="relationships">Referred By<select id="c-ref"><option value="">Select source</option>${optionList(LEAD_SOURCES, c.referredBy || c.leadSource || '')}</select></label>
                  <label data-advanced="relationships">Last Contact<input id="c-lastcontact" type="date" value="${escape((c.lastContact || '').slice(0, 10))}"></label>
                  <label data-advanced="relationships">Next Follow-Up<input id="c-nexttouch" type="date" value="${escape((c.nextFollowUp || '').slice(0, 10))}"></label>
              </div>
              <label class="section-subhead" style="margin-top:14px">Conversation Notes</label>
              <textarea id="c-notes">${escape(c.notes || '')}</textarea>
            </section>
                <section class="modal-section modal-panel" data-panel="docs">
                  <h4>Document Checklist</h4>
                  <div class="doc-automation-grid">
                    <div class="doc-automation-summary">
                      <div class="muted" id="c-doc-summary">Select a loan program to generate the checklist.</div>
                      <div class="doc-missing" id="c-doc-missing"></div>
                      <ul class="doc-chip-list" id="c-doc-list"></ul>
                    </div>
                    <div class="doc-automation-actions">
                      <button class="btn" type="button" id="c-sync-docs">Sync Required Docs</button>
                      <button class="btn brand" type="button" id="c-email-docs">Email Document Request</button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
          <aside class="modal-aside" data-ui="contact-detail-pane">
            <section class="detail-card" data-role="contact-detail-overview">
              <h4>Contact Snapshot</h4>
              <dl class="detail-list">
                <div class="detail-list-row">
                  <dt>Stage</dt>
                  <dd id="c-detail-stage">${escape(stageLabel)}</dd>
                </div>
                <div class="detail-list-row">
                  <dt>Status</dt>
                  <dd id="c-detail-status">${escape(statusLabel)}</dd>
                </div>
                <div class="detail-list-row">
                  <dt>Last Touch</dt>
                  <dd id="c-detail-last">${escape(detailLastTouch)}</dd>
                </div>
                <div class="detail-list-row">
                  <dt>Next Follow-Up</dt>
                  <dd id="c-detail-next">${escape(detailNextFollowUp)}</dd>
                </div>
              </dl>
            </section>
            <section class="detail-card" data-role="contact-detail-highlights">
              <h4>Key Details</h4>
              <dl class="detail-list">
                <div class="detail-list-row">
                  <dt>Loan Program</dt>
                  <dd id="c-detail-program">${escape(c.loanType || c.loanProgram || 'Select')}</dd>
                </div>
                <div class="detail-list-row">
                  <dt>Loan Amount</dt>
                  <dd id="c-detail-amount">${escape(loanMetric)}</dd>
                </div>
                <div class="detail-list-row">
                  <dt>Lead Source</dt>
                  <dd id="c-detail-source">${escape(c.leadSource || 'Set Source')}</dd>
                </div>
                <div class="detail-list-row">
                  <dt>Referral Partner</dt>
                  <dd id="c-detail-referral">${escape(detailReferralDisplay)}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>`;
      const applyFieldVisibility = (mode) => applyContactFieldVisibility(body, mode, { simpleMode: simpleModeSettings });
      applyFieldVisibility(getUiMode());
      if (dlg) {
        if (dlg.__uiModeUnsub) {
          try { dlg.__uiModeUnsub(); }
          catch (_err) { }
          dlg.__uiModeUnsub = null;
        }
        dlg.__uiModeUnsub = onUiModeChanged((mode) => applyFieldVisibility(mode));
        if (!dlg.__uiModeCleanup) {
          const cleanupMode = () => {
            if (dlg.__uiModeUnsub) {
              try { dlg.__uiModeUnsub(); }
              catch (_err) { }
              dlg.__uiModeUnsub = null;
            }
          };
          dlg.addEventListener('close', cleanupMode);
          dlg.__uiModeCleanup = cleanupMode;
        }
      }
      const buyerSel = $('#c-buyer', body);
      const listingSel = $('#c-listing', body);
      const referralPartnerSel = $('#c-referral-partner', body);
      if (buyerSel) buyerSel.value = c.buyerPartnerId ? String(c.buyerPartnerId) : '';
      if (listingSel) listingSel.value = c.listingPartnerId ? String(c.listingPartnerId) : '';
      if (referralPartnerSel) referralPartnerSel.value = referralPartnerId || '';
      const referralSummaryBtn = body.querySelector('[data-role="referral-partner-summary"]');
      if (referralSummaryBtn && !referralSummaryBtn.__wired) {
        referralSummaryBtn.__wired = true;
        referralSummaryBtn.addEventListener('click', (event) => {
          event.preventDefault();
          const partnerId = referralSummaryBtn.dataset.partnerId ? referralSummaryBtn.dataset.partnerId.trim() : '';
          if (partnerId) {
            try {
              openPartnerEditModal(partnerId, { sourceHint: 'contact:referral-summary', trigger: referralSummaryBtn });
            } catch (err) {
              try { console && console.warn && console.warn('referral partner open failed', err); }
              catch (_warn) { }
            }
            return;
          }
          if (referralPartnerSel) {
            try { referralPartnerSel.focus({ preventScroll: true }); }
            catch (_err) { referralPartnerSel.focus?.(); }
          }
        });
      }

      const summaryNote = $('#c-summary-note', body);
      if (summaryNote && c.pipelineMilestone && /funded/i.test(String(c.pipelineMilestone))) {
        summaryNote.textContent = 'Celebrate this win, deliver post-close touches, and prompt for partner reviews.';
      }

      const milestoneSelect = $('#c-milestone', body);
      const milestoneBar = body.querySelector('[data-role="milestone-progress"]');
      const milestoneFill = body.querySelector('[data-role="milestone-progress-fill"]');
      const milestoneBadges = Array.from(body.querySelectorAll('[data-role="milestone-badge"]'));
      const milestoneActionBtn = body.querySelector('[data-role="milestone-next"]');
      let statusMilestoneHintEl = null;
      function allowedMilestoneIndex(statusVal, idx) {
        const allowedLabels = allowedMilestonesForStatus(statusVal || 'inprogress');
        if (!Array.isArray(allowedLabels) || !allowedLabels.length) return true;
        const allowedSet = new Set(allowedLabels
          .map((label) => milestoneIndex(label))
          .filter((value) => Number.isInteger(value) && value >= 0));
        if (!allowedSet.size) return true;
        return allowedSet.has(idx);
      }
      function ensureStatusMilestoneHint() {
        if (statusMilestoneHintEl && statusMilestoneHintEl.isConnected) return statusMilestoneHintEl;
        const host = (milestoneSelect && milestoneSelect.closest('label')) || (statusSelect && statusSelect.closest('label'));
        if (!host) return null;
        const note = document.createElement('p');
        note.className = 'muted status-milestone-hint';
        note.dataset.role = 'status-milestone-hint';
        note.hidden = true;
        note.style.margin = '4px 0 0';
        const parent = host.parentElement;
        if (parent) {
          parent.insertBefore(note, host.nextSibling);
          statusMilestoneHintEl = note;
        }
        return statusMilestoneHintEl;
      }
      function showStatusMilestoneHint(message) {
        const el = ensureStatusMilestoneHint();
        if (!el) return;
        const text = String(message || '').trim();
        if (!text) {
          el.textContent = '';
          el.hidden = true;
          return;
        }
        el.textContent = text;
        el.hidden = false;
      }
      function updateMilestoneUi(value, statusOverride) {
        const statusValue = statusOverride || (statusSelect ? statusSelect.value : 'inprogress');
        const meta = milestoneMeta(value || (milestoneSelect ? milestoneSelect.value : ''), statusValue);
        if (milestoneSelect && milestoneSelect.value !== meta.label) {
          milestoneSelect.value = meta.label;
        }
        if (milestoneSelect) {
          const allowedLabels = allowedMilestonesForStatus(statusValue);
          const allowedSet = new Set(allowedLabels
            .map((label) => milestoneIndex(label))
            .filter((idx) => Number.isInteger(idx) && idx >= 0));
          const guard = allowedSet.size ? allowedSet : null;
          Array.from(milestoneSelect.options).forEach((opt) => {
            const idx = milestoneIndex(opt.value);
            const permitted = guard ? guard.has(idx) : true;
            opt.disabled = !permitted;
            opt.classList.toggle('is-disabled', !permitted);
            opt.setAttribute('aria-disabled', permitted ? 'false' : 'true');
          });
        }
        if (milestoneBar && milestoneFill) {
          const max = PIPELINE_MILESTONES.length;
          const maxIndex = Math.max(max - 1, 1);
          const pct = maxIndex ? Math.max(0, Math.min(100, (meta.index / maxIndex) * 100)) : 100;
          milestoneFill.style.width = `${pct}%`;
          milestoneBar.setAttribute('aria-valuenow', String(meta.index + 1));
          milestoneBar.setAttribute('aria-valuetext', meta.label);
        }
        milestoneBadges.forEach((btn, idx) => {
          const allowed = allowedMilestoneIndex(statusValue, idx);
          btn.disabled = !allowed;
          btn.classList.toggle('is-disabled', !allowed);
          btn.setAttribute('aria-disabled', allowed ? 'false' : 'true');
          const active = idx === meta.index;
          btn.classList.toggle('is-active', active);
          btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        if (milestoneActionBtn) milestoneActionBtn.textContent = meta.action;
        return meta;
      }
      function syncStatusMilestone(source) {
        const stageVal = stageSelect ? stageSelect.value : 'application';
        let statusVal = statusSelect ? statusSelect.value : 'inprogress';
        let milestoneVal = milestoneSelect ? milestoneSelect.value : '';
        let statusChanged = false;
        let milestoneChanged = false;
        for (let guard = 0; guard < 5; guard += 1) {
          const normalizedStatus = normalizeStatusForStage(stageVal, statusVal);
          if (normalizedStatus !== statusVal) {
            statusVal = normalizedStatus;
            statusChanged = true;
            continue;
          }
          const normalizedMilestone = normalizeMilestoneForStatus(milestoneVal, statusVal);
          if (normalizedMilestone !== milestoneVal) {
            milestoneVal = normalizedMilestone;
            milestoneChanged = true;
            continue;
          }
          const statusForMilestone = normalizeStatusForMilestone(milestoneVal, statusVal, { stage: stageVal, preferredStatus: statusVal });
          if (statusForMilestone && statusForMilestone !== statusVal) {
            statusVal = statusForMilestone;
            statusChanged = true;
            continue;
          }
          break;
        }
        const finalMilestone = normalizeMilestoneForStatus(milestoneVal, statusVal);
        if (finalMilestone !== milestoneVal) {
          milestoneVal = finalMilestone;
          milestoneChanged = true;
        }
        const stageNormalized = normalizeStatusForStage(stageVal, statusVal);
        if (stageNormalized !== statusVal) {
          statusVal = stageNormalized;
          statusChanged = true;
          const finalCheckMilestone = normalizeMilestoneForStatus(milestoneVal, statusVal);
          if (finalCheckMilestone !== milestoneVal) {
            milestoneVal = finalCheckMilestone;
            milestoneChanged = true;
          }
        }
        if (statusSelect && statusSelect.value !== statusVal) {
          statusSelect.value = statusVal;
        }
        if (milestoneSelect && milestoneSelect.value !== milestoneVal) {
          milestoneSelect.value = milestoneVal;
        }
        return {
          changedStatus: statusChanged,
          changedMilestone: milestoneChanged,
          finalStatus: statusVal,
          finalMilestone: milestoneVal,
          source
        };
      }
      function handlePairingResult(result) {
        if (!result) return;
        if (result.source === 'stage' || result.source === 'init') {
          showStatusMilestoneHint('');
          return;
        }
        const statusLabel = findLabel(STATUSES, result.finalStatus) || result.finalStatus;
        if (result.source === 'status' && result.changedMilestone) {
          showStatusMilestoneHint(`Milestone adjusted to ${result.finalMilestone} for ${statusLabel} status.`);
          return;
        }
        if (result.source === 'milestone' && result.changedStatus) {
          showStatusMilestoneHint(`Status adjusted to ${statusLabel} to match ${result.finalMilestone} milestone.`);
          return;
        }
        if (result.changedMilestone) {
          showStatusMilestoneHint(`Milestone aligned to ${result.finalMilestone} for ${statusLabel} status.`);
          return;
        }
        showStatusMilestoneHint('');
      }
      function applyStatusGuard(stageVal) {
        const stageAllowed = new Set(allowedStatusesForStage(stageVal));
        const milestoneAllowed = new Set(allowedStatusesForMilestone(milestoneSelect ? milestoneSelect.value : ''));
        if (statusSelect) {
          Array.from(statusSelect.options).forEach(opt => {
            const key = canonicalStatusKey(opt.value);
            let permitted = stageAllowed.has(key);
            if (permitted && milestoneAllowed.size) permitted = milestoneAllowed.has(key);
            opt.disabled = !permitted;
            opt.classList.toggle('is-disabled', !permitted);
            opt.setAttribute('aria-disabled', permitted ? 'false' : 'true');
          });
        }
      }
      if (milestoneSelect) milestoneSelect.addEventListener('change', () => {
        const result = syncStatusMilestone('milestone');
        applyStatusGuard(stageSelect ? stageSelect.value : 'application');
        updateMilestoneUi(result.finalMilestone, result.finalStatus);
        refreshFollowUpSuggestion();
        handlePairingResult(result);
      });
      milestoneBadges.forEach((btn) => {
        if (btn.__wired) return;
        btn.__wired = true;
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          const targetLabel = btn.getAttribute('data-milestone') || '';
          if (milestoneSelect) {
            milestoneSelect.value = targetLabel;
            milestoneSelect.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            updateMilestoneUi(targetLabel);
          }
        });
      });
      if (milestoneActionBtn && !milestoneActionBtn.__wired) {
        milestoneActionBtn.__wired = true;
        milestoneActionBtn.addEventListener('click', async () => {
          const contactId = String($('#c-id', body)?.value || '').trim();
          if (!contactId) { notify('Save the contact before logging a milestone task.', 'warn'); return; }
          const meta = updateMilestoneUi(milestoneSelect ? milestoneSelect.value : '', statusSelect ? statusSelect.value : '');
          const note = `${meta.action} — ${meta.label}`;
          const tagValue = `milestone:${meta.slug}`;
          const payload = { linkedType: 'contact', linkedId: contactId, note, tags: [tagValue] };
          milestoneActionBtn.disabled = true;
          try {
            const result = await createTaskViaService(payload);
            if (result && result.status === 'error') {
              throw new Error('Task API returned error');
            }
            let taskId = '';
            if (result && typeof result === 'object') {
              if (result.task && result.task.id) taskId = String(result.task.id);
              else if (result.id) taskId = String(result.id);
            }
            if (taskId) {
              try {
                await openDB();
                const record = await dbGet('tasks', taskId);
                if (record) {
                  const nextTags = Array.isArray(record.tags) ? record.tags.slice(0) : [];
                  if (!nextTags.includes(tagValue)) nextTags.push(tagValue);
                  record.tags = nextTags;
                  if (!record.notes) record.notes = note;
                  if (!record.title) record.title = note;
                  record.updatedAt = Date.now();
                  await dbPut('tasks', record);
                }
              } catch (err) { console?.warn?.('milestone task tag update failed', err); }
            }
            try { window.dispatchEvent(new CustomEvent('tasks:changed')); }
            catch (_err) { }
          } catch (err) {
            console?.warn?.('milestone task create failed', err);
            notify('Unable to add milestone task.', 'error');
          } finally {
            milestoneActionBtn.disabled = false;
          }
        });
      }
      if (typeof document !== 'undefined' && typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log('MILESTONE_UI', {
          hasBar: !!document.querySelector('[data-qa="milestone-bar"]'),
          badges: document.querySelectorAll('[data-qa="milestone-badge"]').length,
          nextCta: !!document.querySelector('[data-qa="milestone-next"]')
        });
      }

      const mirrorLast = $('#c-lastname', body);
      const lastInput = $('#c-last', body);
      if (mirrorLast && lastInput) {
        lastInput.addEventListener('input', () => mirrorLast.value = lastInput.value);
      }

      const tabNav = $('#contact-tabs', body);
      if (tabNav) {
        tabNav.addEventListener('click', (evt) => {
          const btn = evt.target.closest('button[data-panel]');
          if (!btn) return;
          evt.preventDefault();
          const target = btn.getAttribute('data-panel');
          tabNav.querySelectorAll('button[data-panel]').forEach(b => b.classList.toggle('active', b === btn));
          body.querySelectorAll('.modal-panel').forEach(panel => {
            panel.classList.toggle('active', panel.getAttribute('data-panel') === target);
          });
        });
      }

      const stageSelect = $('#c-stage', body);
      const statusSelect = $('#c-status', body);
      const stageRange = $('#contact-stage-range', body);
      const stageProgress = $('#contact-stage-progress', body);
      const stageMarks = Array.from(body.querySelectorAll('.stage-slider-mark'));
      const stageHelpTitle = $('#contact-stage-help-title', body);
      const stageHelpText = $('#contact-stage-helptext', body);
      const stageIndexFor = (value) => {
        const norm = String(value || '').toLowerCase();
        const direct = STAGE_FLOW.indexOf(norm);
        if (direct >= 0) return direct;
        if (norm === 'preapproved') return 1;
        if (norm === 'ctc' || norm === 'clear-to-close' || norm === 'cleared to close') {
          const idx = STAGE_FLOW.indexOf('cleared-to-close');
          return idx >= 0 ? idx : 0;
        }
        if (norm === 'post-close' || norm === 'nurture' || norm === 'lost' || norm === 'denied') return STAGE_FLOW.length - 1;
        return 0;
      };
      const syncStageSlider = (stageVal) => {
        if (!stageRange || !stageProgress) return;
        const idx = stageIndexFor(stageVal);
        const maxIndex = Math.max(STAGE_FLOW.length - 1, 1);
        const pct = Math.min(100, Math.max(0, (idx / maxIndex) * 100));
        stageRange.value = String(idx);
        stageProgress.style.width = `${pct}%`;
        stageMarks.forEach((mark, i) => mark.classList.toggle('active', i <= idx));
        stageRange.setAttribute('aria-valuetext', findLabel(STAGES, STAGE_FLOW[idx] || STAGE_FLOW[0]) || '');
        const stageKey = STAGE_FLOW[idx] || String(stageVal || '').toLowerCase();
        const stageLabel = findLabel(STAGES, stageKey) || findLabel(STAGES, stageVal) || 'Pipeline Stage';
        const helpMsg = STAGE_AUTOMATIONS[stageKey] || 'Stage updates keep doc checklists, partner notifications, and task cadences aligned.';
        if (stageHelpTitle) stageHelpTitle.textContent = `${stageLabel} automations`;
        if (stageHelpText) stageHelpText.textContent = helpMsg;
      };
      if (stageRange) {
        const onStageDrag = () => {
          const idx = Math.max(0, Math.min(STAGE_FLOW.length - 1, Number(stageRange.value || 0)));
          const nextStage = STAGE_FLOW[idx] || STAGE_FLOW[0];
          if (stageSelect) {
            stageSelect.value = nextStage;
            stageSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
        };
        stageRange.addEventListener('input', onStageDrag);
        stageRange.addEventListener('change', onStageDrag);
      }
      if (statusSelect) {
        statusSelect.addEventListener('change', () => {
          const result = syncStatusMilestone('status');
          applyStatusGuard(stageSelect ? stageSelect.value : 'application');
          updateMilestoneUi(result.finalMilestone, result.finalStatus);
          refreshFollowUpSuggestion();
          handlePairingResult(result);
        });
      }
      if (stageSelect) {
        stageSelect.addEventListener('change', () => {
          const nextStage = stageSelect.value;
          syncStageSlider(nextStage);
          const result = syncStatusMilestone('stage');
          applyStatusGuard(nextStage);
          updateMilestoneUi(result.finalMilestone, result.finalStatus);
          refreshFollowUpSuggestion();
          handlePairingResult(result);
        });
      }

      const updateSummary = () => {
        const amountVal = Number($('#c-amount', body)?.value || 0);
        const program = $('#c-loanType', body)?.value || '';
        const source = $('#c-source', body)?.value || '';
        const referralVal = $('#c-ref', body)?.value || '';
        const referralPartnerSelect = $('#c-referral-partner', body);
        const referralSummaryHost = $('#c-summary-referral', body);
        const referralSummaryBtn = referralSummaryHost?.querySelector('[data-role="referral-partner-summary"]');
        const next = $('#c-nexttouch', body)?.value || $('#c-timeline', body)?.value || 'TBD';
        const amountEl = $('#c-summary-amount', body);
        const programEl = $('#c-summary-program', body);
        const sourceEl = $('#c-summary-source', body);
        const touchEl = $('#c-summary-touch', body);
        const detailStageEl = $('#c-detail-stage', body);
        const detailStatusEl = $('#c-detail-status', body);
        const detailLastEl = $('#c-detail-last', body);
        const detailNextEl = $('#c-detail-next', body);
        const detailProgramEl = $('#c-detail-program', body);
        const detailAmountEl = $('#c-detail-amount', body);
        const detailSourceEl = $('#c-detail-source', body);
        const detailReferralEl = $('#c-detail-referral', body);
        const summaryName = body.querySelector('.summary-name');
        const summaryNote = $('#c-summary-note', body);
        const stageWrap = body.querySelector('[data-role="stage-chip-wrapper"]');
        const statusEl = body.querySelector('.status-pill');
        const stageVal = $('#c-stage', body)?.value || 'application';
        const statusVal = $('#c-status', body)?.value || 'inprogress';
        const stageLabelText = findLabel(STAGES, stageVal) || stageVal || 'Application';
        const statusLabelText = findLabel(STATUSES, statusVal) || 'In Progress';
        const lastContactField = $('#c-lastcontact', body);
        const nextFollowUpField = $('#c-nexttouch', body);
        const timelineField = $('#c-timeline', body);
        const lastDetailValue = lastContactField && lastContactField.value ? String(lastContactField.value) : '';
        const nextDetailValue = nextFollowUpField && nextFollowUpField.value ? String(nextFollowUpField.value) : '';
        const timelineDetailValue = timelineField && timelineField.value ? String(timelineField.value) : '';
        const nextDetailLabel = nextDetailValue
          ? formatDetailDate(nextDetailValue, 'TBD')
          : (timelineDetailValue || 'TBD');
        const lastDetailLabel = lastDetailValue ? formatDetailDate(lastDetailValue, 'Not logged') : 'Not logged';
        const firstVal = $('#c-first', body)?.value?.trim() || '';
        const lastVal = $('#c-last', body)?.value?.trim() || '';
        if (amountEl) { amountEl.textContent = amountVal > 0 ? fmtCurrency.format(amountVal) : 'TBD'; }
        if (programEl) { programEl.textContent = program || 'Select'; }
        if (sourceEl) { sourceEl.textContent = source || 'Set Source'; }
        if (detailAmountEl) { detailAmountEl.textContent = amountVal > 0 ? fmtCurrency.format(amountVal) : 'TBD'; }
        if (detailProgramEl) { detailProgramEl.textContent = program || 'Select'; }
        if (detailSourceEl) { detailSourceEl.textContent = source || 'Set Source'; }
        if (referralSummaryBtn) {
          const selectedPartnerId = referralPartnerSelect ? String(referralPartnerSelect.value || '').trim() : '';
          let partnerText = partnerLabelFor(selectedPartnerId);
          if (!partnerText && selectedPartnerId && referralPartnerSelect && referralPartnerSelect.selectedOptions && referralPartnerSelect.selectedOptions[0]) {
            partnerText = referralPartnerSelect.selectedOptions[0].textContent?.trim() || '';
          }
          if (!partnerText && selectedPartnerId) {
            partnerText = referralPartnerName && selectedPartnerId === referralPartnerId ? referralPartnerName : '';
          }
          referralSummaryBtn.textContent = partnerText || 'Assign Referral Partner';
          if (selectedPartnerId) {
            referralSummaryBtn.dataset.partnerId = selectedPartnerId;
          } else {
            delete referralSummaryBtn.dataset.partnerId;
          }
          if (detailReferralEl) {
            detailReferralEl.textContent = partnerText || 'Not linked';
          }
        } else if (detailReferralEl) {
          detailReferralEl.textContent = detailReferralDisplay;
        }
        if (touchEl) { touchEl.textContent = next || 'TBD'; }
        if (detailNextEl) { detailNextEl.textContent = nextDetailLabel || 'TBD'; }
        if (detailLastEl) { detailLastEl.textContent = lastDetailLabel; }
        if (summaryName) {
          const summaryText = summaryName.querySelector('[data-role="summary-name-text"]');
          const avatarEl = summaryName.querySelector('[data-role="summary-avatar"]');
          const idInput = $('#c-id', body);
          const recordIdVal = idInput ? String(idInput.value || '') : '';
          summaryName.dataset.favoriteType = 'contact';
          summaryName.dataset.recordId = recordIdVal;
          summaryName.setAttribute('data-role', 'favorite-host');
          summaryName.setAttribute('data-favorite-type', 'contact');
          summaryName.setAttribute('data-record-id', recordIdVal);
          const label = (firstVal || lastVal) ? `${firstVal} ${lastVal}`.trim() : 'New Contact';
          if (summaryText) { summaryText.textContent = label; }
          else { summaryName.textContent = label; }
          const avatarName = (firstVal || lastVal) ? label : '';
          applyAvatar(avatarEl, avatarName, contactAvatarSource(c));
        }
        if (stageWrap) {
          const canonicalKey = canonicalStage(stageVal) || canonicalStage(stageLabelText);
          if (canonicalKey) { stageWrap.dataset.stageCanonical = canonicalKey; } else { delete stageWrap.dataset.stageCanonical; }
          stageWrap.dataset.stage = stageVal;
          const canonicalLabel = canonicalKey ? (CANONICAL_STAGE_META[canonicalKey]?.label || stageLabelText) : stageLabelText;
          const chip = renderStageChip(stageVal) || renderStageChip(stageLabelText) || buildStageFallback(canonicalLabel || stageLabelText, stageVal);
          stageWrap.innerHTML = chip;
        }
        if (detailStageEl) { detailStageEl.textContent = stageLabelText; }
        if (statusEl) {
          statusEl.dataset.status = statusVal;
          const toneKey = toneForStatus(statusVal);
          const toneClass = toneClassName(toneKey);
          removeToneClasses(statusEl);
          if (toneClass) { statusEl.classList.add(toneClass); }
          if (toneKey) { statusEl.setAttribute('data-tone', toneKey); }
          else { statusEl.removeAttribute('data-tone'); }
          statusEl.textContent = statusLabelText;
        }
        if (detailStatusEl) { detailStatusEl.textContent = statusLabelText; }
        if (summaryNote) {
          if (stageVal === 'post-close') { summaryNote.textContent = 'Keep clients engaged with annual reviews, gifting, and partner introductions.'; }
          else if (stageVal === 'long-shot') { summaryNote.textContent = 'Prioritize quick outreach, log lead intel, and enroll leads in nurture campaigns.'; }
          else if (stageVal === 'funded') { summaryNote.textContent = 'Celebrate this win, deliver post-close touches, and prompt for partner reviews.'; }
          else if (stageVal === 'nurture') { summaryNote.textContent = 'Set light-touch cadences, send value content, and track partner intel.'; }
          else if (stageVal === 'lost' || stageVal === 'denied') { summaryNote.textContent = 'Capture the outcome, log lessons learned, and schedule a re-engagement plan.'; }
          else if (stageVal === 'underwriting' || stageVal === 'processing') { summaryNote.textContent = 'Tighten doc flow, confirm conditions, and communicate expectations to all parties.'; }
          else if (stageVal === 'approved' || stageVal === 'cleared-to-close') { summaryNote.textContent = 'Coordinate closing logistics, lock in insurance, and prep gifting / testimonials.'; }
          else { summaryNote.textContent = 'Keep momentum with timely follow-up, clear milestones, and aligned partner updates.'; }
        }
      };
      body.querySelectorAll('input,select').forEach(el => {
        if (el.id === 'contact-stage-range') return;
        el.addEventListener('change', updateSummary);
        el.addEventListener('input', updateSummary);
      });
      const initialStage = c.stage || 'application';
      syncStageSlider(initialStage);
      const initialPairing = syncStatusMilestone('init');
      applyStatusGuard(initialStage);
      updateMilestoneUi(initialPairing.finalMilestone, initialPairing.finalStatus);
      refreshFollowUpSuggestion();
      handlePairingResult(initialPairing);
      updateSummary();

      const ensureReferredByButton = () => {
        const select = body.querySelector('#c-ref');
        if (!select) return;
        const host = select.closest('label') || select.parentElement || body;
        if (!host) return;
        const affordance = host.querySelector('[data-qa="referred-by-quick-add"], [data-role="referred-by-quick-add"], .referred-by-quick-add');
        if (affordance && affordance.tagName !== 'BUTTON') {
          affordance.remove();
        }
        const button = host.querySelector('button[data-qa="referred-by-quick-add"], button[data-role="referred-by-quick-add"], button.referred-by-quick-add');
        if (!button) return;
        button.dataset.qa = 'referred-by-quick-add';
        button.dataset.role = 'referred-by-quick-add';
        button.classList.add('btn', 'ghost', 'compact', 'btn-add-contact');
        button.type = 'button';
        button.setAttribute('aria-label', 'Add Contact');
        button.title = 'Add Contact';
        let icon = button.querySelector('.btn-icon');
        if (!icon) {
          icon = document.createElement('span');
          icon.className = 'btn-icon';
          icon.setAttribute('aria-hidden', 'true');
          button.insertBefore(icon, button.firstChild || null);
        }
        icon.textContent = '+';
        const spanLabel = button.querySelector('span:last-child');
        if (spanLabel) {
          spanLabel.textContent = 'Add Contact';
        }
      };

      ensureReferredByButton();

      const docListEl = $('#c-doc-list', body);
      const docSummaryEl = $('#c-doc-summary', body);
      const docMissingEl = $('#c-doc-missing', body);
      const docEmailBtn = $('#c-email-docs', body);
      const docSyncBtn = $('#c-sync-docs', body);

      const getLoanLabel = () => {
        const loanSel = $('#c-loanType', body);
        const opt = loanSel && loanSel.selectedOptions && loanSel.selectedOptions[0];
        return (opt && opt.textContent && opt.textContent.trim()) || (loanSel && loanSel.value) || 'loan';
      };

      async function renderDocChecklist() {
        if (!docListEl) return;
        const contactId = $('#c-id', body)?.value;
        const loanSel = $('#c-loanType', body);
        const loanType = loanSel ? loanSel.value : '';
        const loanLabel = getLoanLabel();
        let required = [];
        try {
          required = typeof window.requiredDocsFor === 'function' ? await window.requiredDocsFor(loanType) : [];
        } catch (err) { console.warn('requiredDocsFor', err); }
        let persisted = null;
        let docs = [];
        let missing = '';
        if (contactId) {
          try {
            await openDB();
            persisted = await dbGet('contacts', contactId);
            if (persisted) {
              const allDocs = await dbGetAll('documents');
              docs = (allDocs || []).filter(d => String(d.contactId) === String(contactId));
              missing = persisted.missingDocs || '';
            }
          } catch (err) { console.warn('doc checklist load', err); }
        }

        if (!required.length) {
          docListEl.innerHTML = '<li class="doc-chip muted">No automation rules configured.</li>';
          if (docSummaryEl) {
            docSummaryEl.textContent = loanType ? `No required docs configured for ${loanLabel}.` : 'Select a loan program to view required docs.';
          }
          if (docMissingEl) { docMissingEl.textContent = ''; docMissingEl.classList.remove('warn'); }
          if (docEmailBtn) { docEmailBtn.disabled = true; docEmailBtn.dataset.docs = '[]'; }
          return;
        }

        const chips = [];
        let receivedCount = 0;
        required.forEach(name => {
          const key = String(name || '').toLowerCase();
          const existing = docs.find(d => String(d.name || '').toLowerCase() === key);
          const statusRaw = existing ? (existing.status || 'Requested') : (persisted ? 'Requested' : 'Pending');
          const status = String(statusRaw).toLowerCase();
          if (/^received|waived$/.test(status)) receivedCount++;
          chips.push(`<li class="doc-chip" data-status="${escape(status)}"><span class="doc-chip-name">${escape(name)}</span><span class="doc-chip-status">${escape(statusRaw)}</span></li>`);
        });
        docListEl.innerHTML = chips.join('');
        if (docSummaryEl) {
          if (persisted) {
            const outstanding = Math.max(required.length - receivedCount, 0);
            docSummaryEl.textContent = `${required.length} required • ${receivedCount} received • ${outstanding} outstanding`;
          } else {
            docSummaryEl.textContent = `${required.length} documents will be requested once this contact is saved.`;
          }
        }
        if (docMissingEl) {
          if (persisted && missing) {
            docMissingEl.textContent = `Still Needed: ${missing}`;
            docMissingEl.classList.add('warn');
          } else if (persisted) {
            docMissingEl.textContent = 'All required documents accounted for.';
            docMissingEl.classList.remove('warn');
          } else {
            docMissingEl.textContent = '';
            docMissingEl.classList.remove('warn');
          }
        }
        if (docEmailBtn) {
          docEmailBtn.disabled = false;
          docEmailBtn.dataset.docs = JSON.stringify(required);
          docEmailBtn.dataset.loan = loanLabel;
        }
      }

      async function syncDocs(opts) {
        const options = Object.assign({ silent: false }, opts || {});
        const contactId = $('#c-id', body)?.value;
        const loanSel = $('#c-loanType', body);
        const loanType = loanSel ? loanSel.value : '';
        if (!contactId) {
          if (!options.silent) notify('Save this contact to generate the document checklist.');
          await renderDocChecklist();
          return;
        }
        try {
          await openDB();
          const record = await dbGet('contacts', contactId);
          if (record) {
            record.loanType = loanType;
            record.loanProgram = loanType || record.loanProgram;
            record.updatedAt = Date.now();
            await dbPut('contacts', record);
            if (typeof ensureRequiredDocs === 'function') await ensureRequiredDocs(record);
            if (typeof computeMissingDocsForAll === 'function') await computeMissingDocsForAll();
            if (!options.silent) toastSuccess('Required document checklist synced.');
          } else if (!options.silent) {
            notify('Save this contact to generate the document checklist.');
          }
        } catch (err) { console.warn('sync docs', err); }
        await renderDocChecklist();
      }

      if (docSyncBtn) {
        docSyncBtn.addEventListener('click', () => { syncDocs({ silent: false }); });
      }
      const loanSelect = $('#c-loanType', body);
      if (loanSelect) {
        loanSelect.addEventListener('change', () => { syncDocs({ silent: true }); });
      }
      if (docEmailBtn) {
        docEmailBtn.addEventListener('click', () => {
          try {
            const docs = JSON.parse(docEmailBtn.dataset.docs || '[]');
            if (!docs.length) { notify('No required documents to email yet.'); return; }
            const email = $('#c-email', body)?.value?.trim();
            if (!email) { notify('Add a primary email before sending a request.', 'warn'); return; }
            const first = $('#c-first', body)?.value?.trim();
            const greeting = first ? `Hi ${first},` : 'Hi there,';
            const loanLabel = docEmailBtn.dataset.loan || getLoanLabel();
            const bullets = docs.map(name => `• ${name}`).join('\n');
            const bodyText = `${greeting}\n\nTo keep your ${loanLabel} moving, please send the following documents:\n\n${bullets}\n\nYou can upload them to the secure portal or email them back to me.\n\nThank you!`;
            const subject = `Document Request for your ${loanLabel}`;
            const href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
            try { window.open(href, '_self'); } catch (_) { window.location.href = href; }
          } catch (err) { console.warn('email docs', err); notify('Unable to build document request email.', 'error'); }
        });
      }

      await renderDocChecklist();

      const formShell = dlg.querySelector('form.modal-form-shell');
      let footerHandle = dlg.__contactFooter;
      if (formShell) {
        const footerHost = formShell.querySelector('.modal-footer');
        if (footerHost) {
          if (!footerHandle) {
            footerHandle = createFormFooter({
              host: footerHost,
              form: formShell,
              saveLabel: 'Save Contact',
              cancelLabel: 'Cancel',
              saveId: 'btn-save-contact',
              saveValue: 'default',
              onCancel: event => {
                if (event) event.preventDefault();
                closeDialog();
              }
            });
            footerHandle.cancelButton.setAttribute('data-close', '');
            dlg.__contactFooter = footerHandle;
          }
          footerHandle.saveButton.textContent = 'Save Contact';
          footerHandle.saveButton.value = 'default';
          footerHandle.cancelButton.textContent = 'Cancel';
        }
      }

      const saveBtn = dlg.querySelector('#btn-save-contact');
      const setBusy = (active) => {
        if (active) {
          try { dlg.setAttribute('data-loading', '1'); }
          catch (_err) { }
          if (saveBtn) {
            saveBtn.dataset.loading = '1';
            saveBtn.setAttribute('aria-busy', 'true');
            saveBtn.disabled = true;
          }
        } else {
          try { dlg.removeAttribute('data-loading'); }
          catch (_err) { }
          if (saveBtn) {
            delete saveBtn.dataset.loading;
            saveBtn.removeAttribute('aria-busy');
            saveBtn.disabled = false;
          }
        }
      };
      const handleSave = async (options) => {
        const opts = options && typeof options === 'object' ? options : {};
        const existed = Array.isArray(contacts) && contacts.some(x => String(x && x.id) === String(c.id));
        const prevStage = c.stage;
        const prevStatusKey = canonicalStatusKey(c.status || '');
        const prevMilestoneNormalized = normalizeMilestoneForStatus(c.pipelineMilestone, prevStatusKey || c.status || 'inprogress');
        const firstNameValue = $('#c-first', body)?.value?.trim() || '';
        const lastNameValue = $('#c-last', body)?.value?.trim() || '';
        const emailValue = $('#c-email', body)?.value?.trim() || '';
        const phoneValue = $('#c-phone', body)?.value?.trim() || '';
        const validationResult = validateContact({
          firstName: firstNameValue,
          lastName: lastNameValue,
          email: emailValue,
          phone: phoneValue,
          name: `${firstNameValue} ${lastNameValue}`.trim()
        }) || { ok: true, errors: {} };
        const validationOutcome = applyContactValidation(body, validationResult.errors || {});
        if (!validationResult.ok) {
          if (validationOutcome.firstInvalid) {
            focusContactField(validationOutcome.firstInvalid);
          }
          toastWarn(CONTACT_INVALID_TOAST);
          return null;
        }
        setBusy(true);
        try {
          const referralPartnerSelectSave = $('#c-referral-partner', body);
          const rawReferralPartnerIdSave = referralPartnerSelectSave ? String(referralPartnerSelectSave.value || '').trim() : '';
          const cleanReferralPartnerId = rawReferralPartnerIdSave && rawReferralPartnerIdSave !== NONE_PARTNER_ID ? rawReferralPartnerIdSave : '';
          const referralPartnerOption = referralPartnerSelectSave && referralPartnerSelectSave.selectedOptions && referralPartnerSelectSave.selectedOptions[0]
            ? referralPartnerSelectSave.selectedOptions[0]
            : null;
          const computedReferralPartnerName = cleanReferralPartnerId
            ? (partnerLabelFor(cleanReferralPartnerId)
              || (referralPartnerOption && referralPartnerOption.textContent ? referralPartnerOption.textContent.trim() : '')
              || (cleanReferralPartnerId === referralPartnerId ? referralPartnerName : ''))
            : '';
          const u = Object.assign({}, c, {
            first: firstNameValue,
            last: lastNameValue,
            email: emailValue,
            phone: phoneValue,
            address: $('#c-address', body).value.trim(), city: $('#c-city', body).value.trim(),
            state: ($('#c-state', body).value || '').toUpperCase(), zip: $('#c-zip', body).value.trim(),
            stage: $('#c-stage', body).value, status: $('#c-status', body).value,
            loanAmount: Number($('#c-amount', body).value || 0), rate: Number($('#c-rate', body).value || 0),
            fundedDate: $('#c-funded', body).value || '', buyerPartnerId: $('#c-buyer', body).value || null,
            listingPartnerId: $('#c-listing', body).value || null, lastContact: $('#c-lastcontact', body).value || '',
            referralPartnerId: cleanReferralPartnerId || null,
            referralPartnerName: cleanReferralPartnerId ? computedReferralPartnerName : '',
            referredBy: $('#c-ref', body).value || '', notes: $('#c-notes', body).value || '', updatedAt: Date.now(),
            contactType: $('#c-type', body).value,
            priority: $('#c-priority', body).value,
            leadSource: $('#c-source', body).value,
            communicationPreference: $('#c-pref', body).value,
            closingTimeline: $('#c-timeline', body).value,
            loanPurpose: $('#c-purpose', body).value,
            loanProgram: $('#c-loanType', body).value,
            loanType: $('#c-loanType', body).value,
            propertyType: $('#c-property', body).value,
            occupancy: $('#c-occupancy', body).value,
            employmentType: $('#c-employment', body).value,
            creditRange: $('#c-credit', body).value,
            docStage: $('#c-docstage', body).value,
            pipelineMilestone: $('#c-milestone', body).value,
            preApprovalExpires: $('#c-preexp', body).value || '',
            nextFollowUp: $('#c-nexttouch', body).value || '',
            secondaryEmail: $('#c-email2', body).value.trim(),
            secondaryPhone: $('#c-phone2', body).value.trim()
          });
          u.status = normalizeStatusForStage(u.stage, u.status);
          u.pipelineMilestone = normalizeMilestoneForStatus(u.pipelineMilestone, u.status);
          const nextStatusKey = canonicalStatusKey(u.status || '');
          const statusChanged = prevStatusKey !== nextStatusKey;
          const milestoneChanged = prevMilestoneNormalized !== u.pipelineMilestone;
          const prevCanon = canonicalStage(prevStage);
          if (typeof window.updateContactStage === 'function') {
            const maybeResult = window.updateContactStage(u, u.stage, prevStage);
            if (maybeResult && typeof maybeResult.then === 'function') {
              await maybeResult;
            }
          } else {
            const canonFn = typeof window.canonicalizeStage === 'function'
              ? window.canonicalizeStage
              : (val) => String(val || '').toLowerCase();
            const prevFallback = canonFn(prevStage);
            const nextCanon = canonFn(u.stage);
            u.stage = nextCanon;
            if (!u.stageEnteredAt || prevFallback !== nextCanon) {
              u.stageEnteredAt = new Date().toISOString();
            }
          }
          if (!u.stageEnteredAt) {
            u.stageEnteredAt = c.stageEnteredAt || new Date().toISOString();
          }
          const nextCanon = canonicalStage(u.stage);
          if (nextCanon !== prevCanon) {
            try {
              console && console.info && console.info('[contacts] stage transition persisted', {
                id: u.id,
                from: prevCanon || null,
                to: nextCanon || null,
                status: u.status,
                milestone: u.pipelineMilestone
              });
            } catch (_err) { }
          }
          await openDB();
          await dbPut('contacts', u);
          if (Array.isArray(contacts)) {
            const idx = contacts.findIndex(item => item && String(item.id) === String(u.id));
            if (idx >= 0) {
              contacts[idx] = Object.assign({}, contacts[idx], u);
            } else {
              contacts.push(Object.assign({}, u));
            }
          }
          Object.assign(c, u);
          if ((statusChanged || milestoneChanged) && u.id != null) {
            const statusDetail = {
              scope: 'contacts',
              source: 'contact:modal',
              action: 'status',
              contactId: String(u.id || ''),
              id: String(u.id || ''),
              status: nextStatusKey,
              to: nextStatusKey,
              milestone: u.pipelineMilestone
            };
            if (prevStatusKey) {
              statusDetail.statusBefore = prevStatusKey;
              if (statusChanged) statusDetail.from = prevStatusKey;
            }
            statusDetail.partial = { scope: 'contacts', ids: [String(u.id || '')], reason: 'status-change' };
            if (typeof window.dispatchAppDataChanged === 'function') {
              window.dispatchAppDataChanged(statusDetail);
            } else {
              document.dispatchEvent(new CustomEvent('app:data:changed', { detail: statusDetail }));
            }
          }
          try {
            if (typeof ensureRequiredDocs === 'function') await ensureRequiredDocs(u);
            if (typeof computeMissingDocsForAll === 'function') await computeMissingDocsForAll();
          } catch (err) { console.warn('post-save doc sync', err); }
          const detail = {
            scope: 'contacts',
            contactId: String(u.id || ''),
            action: existed ? 'update' : 'create',
            source: 'contact:modal',
            partial: { scope: 'contacts', ids: [String(u.id || '')], reason: 'modal-save' }
          };
          if (typeof window.dispatchAppDataChanged === 'function') {
            window.dispatchAppDataChanged(detail);
          } else if (console && typeof console.warn === 'function') {
            console.warn('[soft] dispatchAppDataChanged missing; unable to broadcast contact change.', detail);
          }
          const successMessage = opts.successMessage || (existed ? 'Contact updated' : 'Contact created');
          if (successMessage) {
            toastSuccess(successMessage);
          }
          if (!opts.keepOpen) {
            closeDialog();
          }
          return u;
        } catch (err) {
          if (console && typeof console.warn === 'function') {
            console.warn('[contacts] save failed', err);
          }
          toastError('Contact save failed');
          return null;
        } finally {
          setBusy(false);
        }
      };
      const installFollowUpScheduler = () => {
        const footer = dlg.querySelector('[data-component="form-footer"]') || dlg.querySelector('.modal-footer');
        if (!footer) return;
        const start = footer.querySelector('.form-footer__start') || footer.querySelector('.modal-footer__start') || footer;
        if (!start) return;

        if (dlg.__contactFollowUpAbort && typeof dlg.__contactFollowUpAbort.abort === 'function' && !dlg.__contactFollowUpAbort.signal?.aborted) {
          dlg.__contactFollowUpAbort.abort();
        }

        const controller = new AbortController();
        const { signal } = controller;
        dlg.__contactFollowUpAbort = controller;

        const host = document.createElement('div');
        host.dataset.role = 'contact-followup-host';
        host.className = 'followup-scheduler';
        host.style.display = 'flex';
        host.style.flexDirection = 'column';
        host.style.gap = '6px';
        host.style.maxWidth = '240px';

        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'btn ghost';
        actionBtn.textContent = 'Schedule Follow-up';
        actionBtn.setAttribute('aria-haspopup', 'true');
        actionBtn.setAttribute('aria-expanded', 'false');

        const suggestWrap = document.createElement('div');
        suggestWrap.className = 'followup-suggestion';
        suggestWrap.style.display = 'flex';
        suggestWrap.style.flexDirection = 'column';
        suggestWrap.style.gap = '4px';
        const suggestMeta = document.createElement('div');
        suggestMeta.dataset.role = 'followup-suggestion-meta';
        suggestMeta.className = 'muted';
        suggestMeta.style.fontSize = '12px';
        suggestMeta.style.lineHeight = '1.4';
        const suggestBtn = document.createElement('button');
        suggestBtn.type = 'button';
        suggestBtn.className = 'btn brand';
        suggestBtn.textContent = 'Schedule Next Follow-up';
        suggestWrap.appendChild(suggestMeta);
        suggestWrap.appendChild(suggestBtn);

        const prompt = document.createElement('div');
        prompt.dataset.role = 'contact-followup-prompt';
        prompt.hidden = true;
        prompt.style.display = 'none';
        prompt.style.flexDirection = 'column';
        prompt.style.gap = '6px';
        prompt.style.padding = '8px';
        prompt.style.border = '1px solid var(--border-subtle, #d0d7de)';
        prompt.style.borderRadius = '6px';
        prompt.style.background = 'var(--surface-subtle, #f6f8fa)';

        const dateLabel = document.createElement('label');
        dateLabel.textContent = 'Follow-up date';
        dateLabel.style.display = 'flex';
        dateLabel.style.flexDirection = 'column';
        dateLabel.style.gap = '4px';

        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.required = true;
        dateInput.dataset.role = 'followup-date';

        dateLabel.appendChild(dateInput);

        const noteLabel = document.createElement('label');
        noteLabel.textContent = 'Note (optional)';
        noteLabel.style.display = 'flex';
        noteLabel.style.flexDirection = 'column';
        noteLabel.style.gap = '4px';

        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.placeholder = 'Reminder note';
        noteInput.dataset.role = 'followup-note';

        noteLabel.appendChild(noteInput);

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '6px';

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'btn brand';
        confirmBtn.textContent = 'Create';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn ghost';
        cancelBtn.textContent = 'Cancel';

        actions.append(confirmBtn, cancelBtn);

        prompt.append(dateLabel, noteLabel, actions);

        const status = document.createElement('div');
        status.dataset.role = 'followup-status';
        status.setAttribute('aria-live', 'polite');
        status.style.fontSize = '12px';
        status.style.minHeight = '16px';

        const setStatus = (message, tone) => {
          status.textContent = message || '';
          status.dataset.state = tone || '';
          if (tone === 'error') {
            status.style.color = 'var(--danger-text, #b42318)';
          } else if (tone === 'success') {
            status.style.color = 'var(--success-text, #067647)';
          } else {
            status.style.color = 'inherit';
          }
        };

        let currentSuggestion = null;
        let lastAppliedSuggestionDue = '';
        function computeFollowUpSuggestion() {
          const stageVal = stageSelect ? stageSelect.value : (c.stage || 'application');
          const statusVal = statusSelect ? statusSelect.value : (c.status || 'inprogress');
          const rule = FOLLOW_UP_RULES[stageVal] || FOLLOW_UP_RULES[statusVal] || FOLLOW_UP_RULES.default;
          const fallbackDays = Number.isFinite(rule?.days) ? rule.days : FOLLOW_UP_RULES.default.days;
          const stageLabel = findLabel(STAGES, stageVal) || stageVal;
          const lastField = $('#c-lastcontact', body);
          const nextField = $('#c-nexttouch', body);
          const rawLast = String(lastField?.value || c.lastContact || c.updatedAt || c.createdAt || '').trim();
          const rawNext = String(nextField?.value || '').trim();
          const suggestion = suggestFollowUpSchedule({
            stage: stageVal,
            lastActivity: rawLast,
            existingDue: rawNext,
            fallbackDays
          });
          if (!suggestion || !suggestion.isoDue) {
            return null;
          }
          const cadenceSummary = describeFollowUpCadence({ stageLabel, suggestion });
          const summary = cadenceSummary
            ? `${cadenceSummary} → ${suggestion.isoDue}`
            : `${stageLabel} → ${suggestion.isoDue}`;
          const noteDetail = rule?.note || `${stageLabel} follow-up`;
          const taskNote = `${stageLabel} follow-up — ${noteDetail}`;
          return {
            due: suggestion.isoDue,
            summary,
            description: noteDetail,
            note: taskNote,
            stage: stageVal,
            status: statusVal,
            offsetDays: suggestion.offsetDays,
            daysSince: suggestion.daysSinceLastActivity
          };
        }
        function applySuggestedDate(force = false) {
          if (!dateInput || !currentSuggestion || !currentSuggestion.due) return;
          const desired = currentSuggestion.due;
          if (force) {
            dateInput.value = desired;
            lastAppliedSuggestionDue = desired;
            return;
          }
          const currentValue = String(dateInput.value || '').trim();
          if (!currentValue || currentValue === lastAppliedSuggestionDue) {
            dateInput.value = desired;
            lastAppliedSuggestionDue = desired;
          }
        }
        function refreshSuggestion() {
          currentSuggestion = computeFollowUpSuggestion();
          if (suggestBtn) {
            const ready = !!(currentSuggestion && currentSuggestion.due);
            suggestBtn.disabled = !ready;
          }
          if (currentSuggestion && currentSuggestion.due) {
            applySuggestedDate();
          } else {
            lastAppliedSuggestionDue = '';
          }
          if (!suggestMeta) return;
          if (currentSuggestion && currentSuggestion.due) {
            const message = currentSuggestion.description
              ? `${currentSuggestion.summary} (${currentSuggestion.description})`
              : currentSuggestion.summary;
            suggestMeta.textContent = message;
          } else {
            suggestMeta.textContent = 'Set stage and touchpoints to generate the next follow-up.';
          }
        }

        refreshFollowUpSuggestion = refreshSuggestion;

        const closePrompt = () => {
          prompt.hidden = true;
          prompt.style.display = 'none';
          actionBtn.setAttribute('aria-expanded', 'false');
        };
        const openPrompt = () => {
          prompt.hidden = false;
          prompt.style.display = 'flex';
          actionBtn.setAttribute('aria-expanded', 'true');
          applySuggestedDate(true);
          try { dateInput.focus({ preventScroll: true }); }
          catch (_err) { dateInput.focus?.(); }
        };

        let submitting = false;
        const handleSubmit = () => {
          if (submitting) return;
          const linkedId = String($('#c-id', body)?.value || c.id || '').trim();
          if (!linkedId) {
            setStatus('Save the contact before scheduling a follow-up.', 'error');
            return;
          }
          const due = String(dateInput.value || '').trim();
          if (!due) {
            setStatus('Choose a follow-up date.', 'error');
            try { dateInput.focus({ preventScroll: true }); }
            catch (_err) { dateInput.focus?.(); }
            return;
          }
          submitting = true;
          confirmBtn.disabled = true;
          cancelBtn.disabled = true;
          actionBtn.disabled = true;
          setStatus('Scheduling follow-up…');
          const note = String(noteInput.value || '').trim();
          Promise.resolve().then(async () => {
            const payload = { linkedType: 'contact', linkedId, due, note };
            if (!note) { delete payload.note; }
            await createTaskViaService(payload);
          }).then(() => {
            setTimeout(() => {
              try {
                window.dispatchEvent(new CustomEvent('tasks:changed'));
              } catch (_err) { }
            }, 0);
            const nextField = $('#c-nexttouch', body);
            if (nextField) {
              nextField.value = due;
              nextField.dispatchEvent(new Event('change', { bubbles: true }));
            }
            refreshSuggestion();
            setStatus('Follow-up scheduled.', 'success');
            noteInput.value = '';
            submitting = false;
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
            actionBtn.disabled = false;
            closePrompt();
          }).catch(err => {
            console.warn?.('[followup]', err);
            submitting = false;
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
            actionBtn.disabled = false;
            setStatus('Unable to schedule follow-up. Try again.', 'error');
          });
        };

        const handleQuickSchedule = () => {
          if (submitting) return;
          const linkedId = String($('#c-id', body)?.value || c.id || '').trim();
          if (!linkedId) { setStatus('Save the contact before scheduling a follow-up.', 'error'); return; }
          if (!currentSuggestion || !currentSuggestion.due) { setStatus('Unable to compute next follow-up suggestion.', 'error'); return; }
          submitting = true;
          confirmBtn.disabled = true;
          cancelBtn.disabled = true;
          actionBtn.disabled = true;
          suggestBtn.disabled = true;
          setStatus('Scheduling next follow-up…');
          const payload = { linkedType: 'contact', linkedId, due: currentSuggestion.due, note: currentSuggestion.note };
          Promise.resolve().then(async () => {
            await createTaskViaService(payload);
          }).then(() => {
            const nextField = $('#c-nexttouch', body);
            if (nextField) {
              nextField.value = currentSuggestion.due;
              nextField.dispatchEvent(new Event('change', { bubbles: true }));
            }
            setStatus(`Scheduled for ${currentSuggestion.due}.`, 'success');
            submitting = false;
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
            actionBtn.disabled = false;
            suggestBtn.disabled = false;
            refreshSuggestion();
            setTimeout(() => {
              try { window.dispatchEvent(new CustomEvent('tasks:changed')); }
              catch (_err) { }
            }, 0);
          }).catch(err => {
            console.warn?.('[followup]', err);
            submitting = false;
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
            actionBtn.disabled = false;
            suggestBtn.disabled = false;
            setStatus('Unable to schedule follow-up. Try again.', 'error');
          });
        };

        actionBtn.addEventListener('click', (event) => {
          event.preventDefault();
          setStatus('');
          if (prompt.hidden) { openPrompt(); }
          else { closePrompt(); }
        }, { signal });
        suggestBtn.addEventListener('click', (event) => {
          event.preventDefault();
          setStatus('');
          handleQuickSchedule();
        }, { signal });

        confirmBtn.addEventListener('click', (event) => {
          event.preventDefault();
          handleSubmit();
        }, { signal });

        cancelBtn.addEventListener('click', (event) => {
          event.preventDefault();
          closePrompt();
        }, { signal });

        prompt.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closePrompt();
            actionBtn.focus?.({ preventScroll: true });
          }
        }, { signal });

        const lastTouchField = $('#c-lastcontact', body);
        const nextTouchField = $('#c-nexttouch', body);
        [lastTouchField, nextTouchField].forEach(field => {
          if (!field || typeof field.addEventListener !== 'function') return;
          const update = () => refreshSuggestion();
          field.addEventListener('input', update, { signal });
          field.addEventListener('change', update, { signal });
        });

        signal.addEventListener('abort', () => {
          if (host.parentElement) { host.remove(); }
          if (dlg.__contactFollowUpAbort === controller) {
            dlg.__contactFollowUpAbort = null;
          }
          if (refreshFollowUpSuggestion === refreshSuggestion) {
            refreshFollowUpSuggestion = noop;
          }
        });

        try { dlg.addEventListener('close', () => controller.abort(), { once: true }); }
        catch (_err) { dlg.addEventListener('close', () => controller.abort(), { once: true }); }

        host.append(suggestWrap, actionBtn, prompt, status);
        if (start.firstChild) {
          start.insertBefore(host, start.firstChild);
        } else {
          start.appendChild(host);
        }
        refreshSuggestion();
      };

      const installTouchLogging = () => {
        if (typeof createTouchLogEntry !== 'function' || typeof touchSuccessMessage !== 'function') {
          toastWarn('Touch logging unavailable');
          return null;
        }
        const footer = dlg.querySelector('[data-component="form-footer"]');
        if (!footer) return null;
        const start = footer.querySelector('.form-footer__start');
        if (!start) return null;

        let controls = dlg.__contactTouchControls || null;
        if (!controls) {
          const logButton = document.createElement('button');
          logButton.type = 'button';
          logButton.className = 'btn';
          logButton.dataset.role = 'log-touch';
          logButton.textContent = 'Log a Touch';
          logButton.setAttribute('aria-haspopup', 'true');
          logButton.setAttribute('aria-expanded', 'false');

          const menu = document.createElement('div');
          menu.dataset.role = 'touch-menu';
          menu.setAttribute('role', 'menu');
          menu.hidden = true;
          menu.style.display = 'none';
          menu.style.marginLeft = '8px';
          menu.style.gap = '4px';
          menu.style.flexWrap = 'wrap';

          start.appendChild(logButton);
          start.appendChild(menu);
          controls = { button: logButton, menu };
          dlg.__contactTouchControls = controls;
        } else {
          controls.button.textContent = 'Log a Touch';
        }

        const { button: logButton, menu } = controls;
        if (!logButton || !menu) return null;

        TOUCH_OPTIONS.forEach(option => {
          let optBtn = menu.querySelector(`button[data-touch-key="${option.key}"]`);
          if (!optBtn) {
            optBtn = document.createElement('button');
            optBtn.type = 'button';
            optBtn.className = 'btn ghost';
            optBtn.dataset.touchKey = option.key;
            optBtn.textContent = option.label;
            optBtn.setAttribute('role', 'menuitem');
            menu.appendChild(optBtn);
          } else {
            optBtn.textContent = option.label;
          }
        });
        Array.from(menu.querySelectorAll('button[data-touch-key]')).forEach(btn => {
          if (!TOUCH_OPTIONS.some(option => option.key === btn.dataset.touchKey)) {
            btn.remove();
          }
        });

        const hideMenu = () => {
          if (menu.hidden) return;
          menu.hidden = true;
          menu.style.display = 'none';
          logButton.setAttribute('aria-expanded', 'false');
        };
        const showMenu = () => {
          if (!menu.hidden) return;
          menu.hidden = false;
          menu.style.display = 'flex';
          logButton.setAttribute('aria-expanded', 'true');
          const first = menu.querySelector('button[data-touch-key]');
          if (first && typeof first.focus === 'function') {
            first.focus({ preventScroll: true });
          }
        };

        let logging = false;
        const logTouch = async (key) => {
          if (logging) return null;
          logging = true;
          try {
            const notesField = $('#c-notes', body);
            const lastInput = $('#c-lastcontact', body);
            if (!notesField || !lastInput) {
              return null;
            }
            const entry = createTouchLogEntry(key);
            const existing = notesField.value || '';
            const remainderRaw = existing.replace(/^\s+/, '');
            const remainder = remainderRaw ? `\n${remainderRaw}` : '';
            const nextValue = `${entry}${remainder}`;
            notesField.value = nextValue;
            notesField.dispatchEvent(new Event('input', { bubbles: true }));
            if (typeof notesField.focus === 'function') {
              notesField.focus({ preventScroll: true });
            }
            if (typeof notesField.setSelectionRange === 'function') {
              const caretIndex = entry.length;
              try { notesField.setSelectionRange(caretIndex, caretIndex); }
              catch (_err) { }
            }
            const today = formatTouchDate(new Date());
            if (today) {
              lastInput.value = today;
              lastInput.dispatchEvent(new Event('input', { bubbles: true }));
              lastInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const result = await handleSave({ keepOpen: true, successMessage: touchSuccessMessage(key) });
            return result;
          } catch (err) {
            try { console && console.warn && console.warn('[contacts] touch log failed', err); }
            catch (_err) { }
            return null;
          } finally {
            logging = false;
          }
        };

        dlg.__contactTouchHandler = logTouch;

        if (!logButton.__touchToggle) {
          logButton.__touchToggle = true;
          logButton.addEventListener('click', (event) => {
            event.preventDefault();
            if (menu.hidden) { showMenu(); }
            else { hideMenu(); }
          });
          logButton.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !menu.hidden) {
              event.preventDefault();
              hideMenu();
              logButton.blur?.();
              return;
            }
            if ((event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') && menu.hidden) {
              event.preventDefault();
              showMenu();
            }
          });
        }

        if (!menu.__touchHandlers) {
          menu.__touchHandlers = true;
          menu.addEventListener('click', (event) => {
            const target = event.target && event.target.closest('button[data-touch-key]');
            if (!target) return;
            event.preventDefault();
            hideMenu();
            logTouch(target.dataset.touchKey);
          });
          menu.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              hideMenu();
              if (typeof logButton.focus === 'function') {
                logButton.focus({ preventScroll: true });
              }
            }
          });
        }

        if (!dlg.__touchMenuOutsideHandler) {
          const outsideHandler = (event) => {
            if (menu.hidden) return;
            if (event && (event.target === logButton || logButton.contains(event.target))) return;
            if (event && menu.contains(event.target)) return;
            hideMenu();
          };
          dlg.addEventListener('click', outsideHandler);
          dlg.__touchMenuOutsideHandler = outsideHandler;
        }

        if (!menu.__touchCloseHook) {
          const closeHandler = () => hideMenu();
          try { dlg.addEventListener('close', closeHandler); }
          catch (_err) { dlg.addEventListener('close', closeHandler); }
          menu.__touchCloseHook = closeHandler;
        }
        return logTouch;
      };

      installFollowUpScheduler();
      const logTouchHandler = installTouchLogging();
      const installHeaderLogButtons = (handler) => {
        const host = dlg.querySelector('[data-role="contact-header-actions"]');
        if (!host) return;
        host.__logHandler = handler;
        if (host.__wired) return;
        host.__wired = true;
        const buttons = [
          { key: 'call', label: 'Log a Call', ui: 'log-call' },
          { key: 'text', label: 'Log a Text', ui: 'log-text' },
          { key: 'email', label: 'Log an Email', ui: 'log-email' }
        ];
        buttons.forEach((meta) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn ghost';
          btn.textContent = meta.label;
          btn.dataset.ui = meta.ui;
          btn.addEventListener('click', (event) => {
            event.preventDefault();
            const handlerFn = host.__logHandler;
            if (typeof handlerFn === 'function') {
              handlerFn(meta.key);
            } else {
              toastWarn('Touch logging unavailable');
            }
          });
          host.appendChild(btn);
        });
      };
      installHeaderLogButtons(logTouchHandler);

      if (saveBtn) {
        if (typeof window.saveForm === 'function') {
          window.saveForm(saveBtn, handleSave, { successMessage: null });
        } else {
          saveBtn.onclick = async (e) => {
            e.preventDefault();
            const result = await handleSave();
            if (result) {
              try { closeDialog(); } catch (_) { }
            }
          };
        }
      }
      document.dispatchEvent(new CustomEvent('contact:modal:ready', { detail: { dialog: dlg, body } }));
      if (dlg.dataset) {
        dlg.dataset.open = '1';
        dlg.dataset.opening = '0';
      }
      try { dlg.showModal(); }
      catch (_) { dlg.setAttribute('open', ''); }
      return dlg;
    } catch (err) {
      if (isRecoverableContactError(err)) {
        notify('Unable to open contact editor. Please try again.', 'error');
        try { closeDialog(); }
        catch (_cleanupErr) { }
        return null;
      }
      throw err;
    }
  };

  if (typeof window !== 'undefined' && typeof window.renderContactModal === 'function') {
    try {
      Object.defineProperty(window.renderContactModal, '__crmReady', { value: true, configurable: true });
    } catch (_err) {
      try { window.renderContactModal.__crmReady = true; }
      catch (__err) { }
    }
    const ready = Promise.resolve(true);
    try {
      Object.defineProperty(window, '__CONTACT_MODAL_READY__', { value: ready, configurable: true });
    } catch (_err) {
      window.__CONTACT_MODAL_READY__ = ready;
    }
  }

})();

function resolveContactModalHost(candidate) {
  if (candidate instanceof HTMLElement) return candidate;
  if (typeof document === 'undefined') return null;
  const root = document.querySelector(MODAL_ROOT_SELECTOR)
    || document.body
    || document.documentElement
    || null;
  return root instanceof HTMLElement ? root : null;
}

function tagContactModal(node) {
  if (!(node instanceof HTMLElement)) return node;
  try { node.setAttribute('data-modal-key', CONTACT_MODAL_KEY); }
  catch (_err) { }
  if (node.dataset) {
    node.dataset.modalKey = CONTACT_MODAL_KEY;
    if (!node.dataset.ui) {
      node.dataset.ui = CONTACT_MODAL_DATA_UI;
    }
  }
  if (!node.getAttribute('data-ui')) {
    try { node.setAttribute('data-ui', CONTACT_MODAL_DATA_UI); }
    catch (_err) { }
  }
  return node;
}

export function ensureContactModalShell(options = {}) {
  if (typeof document === 'undefined') return null;
  closeQuickAddOverlayIfOpen();

  const existing = document.querySelector(`[data-modal-key="${CONTACT_MODAL_KEY}"]`);
  if (existing) {
    return tagContactModal(existing);
  }

  const host = resolveContactModalHost(options.host);
  let dlg = document.getElementById(CONTACT_MODAL_TEMPLATE_ID);

  if (!dlg) {
    if (!host) return null;
    dlg = document.createElement('dialog');
    dlg.id = CONTACT_MODAL_TEMPLATE_ID;
    dlg.classList.add('record-modal');
    dlg.innerHTML = '<div class="dlg"><form class="modal-form-shell" method="dialog"><div class="modal-header"><h3 class="grow modal-title">Add / Edit Contact</h3><div class="modal-header-actions" data-role="contact-header-actions"></div><button type="button" class="btn ghost" data-close>Close</button></div><div class="dialog-scroll"><div class="modal-body" data-ui="modal-body" id="contact-modal-body"></div></div><div class="modal-footer" data-form-footer="contact"><button class="btn" data-close type="button">Cancel</button><button class="btn brand" id="btn-save-contact" type="button" value="default">Save Contact</button></div></form></div>';
    tagContactModal(dlg);
    host.appendChild(dlg);
  } else {
    tagContactModal(dlg);
    if (host && !dlg.parentNode) {
      host.appendChild(dlg);
    }
  }

  // DEBUG: Trace close calls
  if (dlg && !dlg.__debugClose) {
    dlg.__debugClose = true;
    const originalClose = dlg.close;
    dlg.close = function () {
      console.log('[CONTACTS_DEBUG] dlg.close() called programmatically');
      console.log('[CONTACTS_DEBUG] close call stack', new Error().stack);
      return originalClose.apply(this, arguments);
    };
  }

  if (dlg && !dlg.__wired) {
    dlg.__wired = true;
    const markClosed = () => {
      // FIX: Function body removed to prevent focus deadlocks
      // The 'close' event listener now handles cleanup directly
    };
    dlg.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && target.matches('[data-close]')) {
        event.preventDefault();
        try { dlg.close(); }
        catch (_err) { }
        markClosed();
      }
    });
    // Handle Escape Key (Do NOT prevent default)
    dlg.addEventListener('cancel', () => {
      // Let the browser close it.
      // The 'close' handler will handle state cleanup.
    });
    // FIX: Do NOT automatically restore focus on close. It causes deadlocks.
    dlg.addEventListener('close', (e) => {
      console.log('[CONTACTS_DEBUG] modal close event triggered');
      console.log('[CONTACTS_DEBUG] close event stack', new Error().stack);
      try {
        const el = document.activeElement;
        console.log('[CONTACTS_DEBUG] activeElement:', el ? el.tagName : 'null', el ? el.className : '', el ? el.id : '');
      } catch (_) { }
      console.log('[CONTACTS_DEBUG] event.isTrusted:', e.isTrusted);
      // Only clean up state, never touch focus
      try { dlg.removeAttribute('open'); } catch (_) { }
      try { dlg.style.display = 'none'; } catch (_) { }
      if (dlg.dataset) { dlg.dataset.open = '0'; dlg.dataset.opening = '0'; }
      dlg.__contactInvoker = null;
    });
  }

  return dlg;
}

let pendingContactOpen = null;
const queueContactMicrotask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => {
    try {
      if (typeof Promise === 'function') { Promise.resolve().then(fn).catch(() => { }); return; }
    } catch (_err) { }
    try { fn(); }
    catch (_) { }
  };
let __lastOpen = { id: null, t: 0 };

function teardownContactModalShell() {
  if (typeof document === 'undefined') return;
  const modal = document.querySelector(`[data-modal-key="${CONTACT_MODAL_KEY}"]`);
  if (!modal) return;
  if (typeof modal.close === 'function') {
    try { modal.close(); }
    catch (_err) { }
  }
  try { modal.removeAttribute('open'); }
  catch (_err) { }
  if (modal.dataset) {
    try { modal.dataset.open = '0'; }
    catch (_err) { }
  }
}

function closeQuickAddOverlayIfOpen() {
  if (typeof document === 'undefined') return;
  const overlay = document.querySelector('.qa-overlay');
  if (overlay) {
    const closeBtn = overlay.querySelector('.qa-close');
    if (closeBtn && typeof closeBtn.click === 'function') {
      try { closeBtn.click(); }
      catch (_err) { }
    }
    if (overlay.isConnected) {
      try { overlay.remove(); }
      catch (_err) {
        if (overlay.parentElement) {
          try { overlay.parentElement.removeChild(overlay); }
          catch (__err) { }
        }
      }
    }
  }
  const backdrops = Array.from(document.querySelectorAll('.modal-backdrop'));
  backdrops.forEach(node => {
    if (!node) return;
    try { node.remove(); }
    catch (_err) {
      if (node.parentElement) {
        try { node.parentElement.removeChild(node); }
        catch (__err) { }
      }
    }
  });
  const body = document.body;
  if (body && body.style) {
    try { body.style.pointerEvents = ''; }
    catch (_err) { }
    const preserveScrollLock = body.dataset && body.dataset.contactModalScroll === '1';
    if (!preserveScrollLock) {
      try { body.style.overflow = ''; }
      catch (_err) { }
    }
  }
  const host = document.querySelector(`[data-modal-key="${CONTACT_MODAL_KEY}"]`) || document.getElementById('contact-modal');
  if (host) {
    let cursor = host;
    while (cursor && cursor !== document.body) {
      if (typeof cursor.getAttribute === 'function' && cursor.getAttribute('aria-hidden') === 'true') {
        try { cursor.removeAttribute('aria-hidden'); }
        catch (_err) { }
      }
      cursor = cursor.parentElement;
    }
  }
}

const CALENDAR_INVALID_CONTACT_ID_TOKENS = new Set(['', 'null', 'undefined']);
const INVALID_PARTNER_ID_TOKENS = new Set(['', 'null', 'undefined']);

function normalizeCalendarContactId(value) {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const token = raw.toLowerCase();
  return CALENDAR_INVALID_CONTACT_ID_TOKENS.has(token) ? '' : raw;
}

function normalizePartnerId(value) {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const token = raw.toLowerCase();
  return INVALID_PARTNER_ID_TOKENS.has(token) ? '' : raw;
}

function detectSafeMode(override) {
  if (typeof override === 'boolean') return override;
  if (typeof window === 'undefined') return false;
  try {
    if (window.__SAFE_MODE__ === true || window.__SAFE_MODE__ === 1 || window.__SAFE_MODE__ === '1') return true;
  } catch (_err) { }
  try {
    const search = window.location && typeof window.location.search === 'string'
      ? window.location.search
      : '';
    if (search && /(?:^|[?&])safe=1(?:&|$)/.test(search)) return true;
  } catch (_err) { }
  return false;
}

function resolveCalendarInvoker(options) {
  if (!options) return null;
  if (options instanceof HTMLElement) return options;
  if (options.trigger instanceof HTMLElement) return options.trigger;
  if (options.currentTarget instanceof HTMLElement) return options.currentTarget;
  if (options.target instanceof HTMLElement) return options.target;
  return null;
}

export async function openContactModal(contactId, options) {
  const opener = window.renderContactModal;
  if (!opener) return null;

  // 1. FORCE CLOSE any existing modal first
  const existing = document.querySelector(`[data-modal-key="${CONTACT_MODAL_KEY}"]`);
  if (existing) {
    try { existing.close(); } catch (e) { }
    existing.removeAttribute('open');
    existing.style.display = 'none';
  }

  // 2. Normalize Options
  const opts = options || {};
  let model = null;
  if (opts.prefetchedRecord) model = normalizeNewContactPrefill(opts.prefetchedRecord);

  const rawId = model ? model.id : (contactId || '');
  const normalizedId = normalizeContactId(rawId);

  // 3. Open Fresh
  try {
    const result = await opener(normalizedId, { ...opts, prefetchedRecord: model });
    return result;
  } catch (err) {
    console.warn('Open failed', err);
    return null;
  }
}

export async function openContactEditor(target, options) {
  console.log('[CONTACTS_DEBUG] openContactEditor called', target);
  try {
    // FIX: Ensure modal code is loaded before attempting to open
    try { await import('./modals/contact_editor_modal.js'); } catch (e) { console.warn('Preload failed', e); }

    const opts = options && typeof options === 'object' ? { ...options } : {};
    const allowAutoOpen = opts.allowAutoOpen !== false;
    const trigger = opts.trigger;
    const suppressErrorToast = opts.suppressErrorToast === true;
    const sourceHint = typeof opts.sourceHint === 'string' ? opts.sourceHint.trim() : '';

    const prefillCandidate = opts.prefill && typeof opts.prefill === 'object'
      ? opts.prefill
      : (target && typeof target === 'object' && !Array.isArray(target) ? target : null);

    const rawId = opts.contactId ?? (prefillCandidate ? prefillCandidate.id : (!prefillCandidate ? target : null));
    const hasExplicitId = rawId != null && String(rawId).trim() !== '';
    const explicitId = hasExplicitId ? normalizeContactId(rawId) : '';
    const treatAsExisting = (prefillCandidate && prefillCandidate.__isNew === false) || (!prefillCandidate && hasExplicitId);

    closeQuickAddOverlayIfOpen();

    const modalOptions = {
      allowAutoOpen,
      trigger,
      suppressErrorToast,
    };

    if (treatAsExisting && explicitId) {
      modalOptions.sourceHint = sourceHint || 'contact:editor';
      try {
        const result = await openContactModal(explicitId, modalOptions);
        return result || null;
      } catch (err) {
        if (!suppressErrorToast) {
          try { console && console.warn && console.warn('[contact-editor:init]', err); }
          catch (_warn) { }
          toastWarn('Unable to open contact');
        }
        teardownContactModalShell();
        return null;
      }
    }

    const model = normalizeNewContactPrefill(prefillCandidate || {});
    model.id = explicitId || normalizeContactId(model);
    if (prefillCandidate && prefillCandidate.__isNew === false) model.__isNew = false;

    modalOptions.sourceHint = sourceHint || 'quick-create:menu';
    modalOptions.prefetchedRecord = model;
    modalOptions.suppressErrorToast = true;

    try {
      const result = await openContactModal(model, modalOptions);
      return result || null;
    } catch (err) {
      try { console && console.warn && console.warn('[contact-editor:init]', err); }
      catch (_warn) { }
      toastWarn('Couldn\u2019t open the full editor. Please try again.');
      teardownContactModalShell();
      return null;
    }
  } catch (criticalErr) {
    console.error('[CRITICAL] openContactEditor crashed', criticalErr);
    toastWarn('Editor unavailable');
    return null;
  }
}

export async function openCalendarEntityEditor(eventLike, options) {
  const base = eventLike && typeof eventLike === 'object' ? eventLike : {};
  const opts = options && typeof options === 'object' ? options : {};
  const safeMode = detectSafeMode(opts.safeMode ?? base.safeMode);
  if (safeMode) {
    toastInfo('Calendar editing is disabled in Safe Mode.');
    return { opened: false, reason: 'safe-mode' };
  }

  const sourceHint = typeof opts.sourceHint === 'string' && opts.sourceHint.trim()
    ? opts.sourceHint.trim()
    : 'calendar:event';
  const contactId = normalizeCalendarContactId(
    opts.contactId ?? base.contactId ?? (base.contact && base.contact.id) ?? ''
  );
  const partnerId = normalizePartnerId(
    opts.partnerId ?? base.partnerId ?? (base.partner && base.partner.id) ?? ''
  );
  const allowAutoOpen = opts.allowAutoOpen === true;
  const trigger = resolveCalendarInvoker(opts) || resolveCalendarInvoker(base);

  if (contactId) {
    try {
      const result = await openContactModal(contactId, { sourceHint, trigger, allowAutoOpen });
      if (result) {
        return { opened: true, kind: 'contact', contactId, result };
      }
      return { opened: false, kind: 'contact', contactId, reason: 'no-result' };
    } catch (err) {
      try { console && console.warn && console.warn('calendar contact open failed', err); }
      catch (_warn) { }
      toastWarn('Unable to open contact');
      return { opened: false, reason: 'contact-error', error: err };
    }
  }

  if (partnerId) {
    const partnerOptions = { sourceHint, trigger };
    let partnerOpener = null;
    if (typeof openPartnerEditModal === 'function') {
      partnerOpener = openPartnerEditModal;
    } else if (typeof window !== 'undefined' && typeof window.openPartnerEditModal === 'function') {
      partnerOpener = window.openPartnerEditModal;
    }
    if (!partnerOpener) {
      try { console && console.warn && console.warn('partner editor unavailable for calendar event', { partnerId }); }
      catch (_warn) { }
      toastWarn('Partner editor unavailable');
      return { opened: false, reason: 'partner-missing' };
    }
    try {
      const result = await Promise.resolve(partnerOpener(partnerId, partnerOptions));
      return { opened: true, kind: 'partner', partnerId, result };
    } catch (err) {
      try { console && console.warn && console.warn('calendar partner open failed', err); }
      catch (_warn) { }
      toastWarn('Unable to open partner');
      return { opened: false, reason: 'partner-error', error: err };
    }
  }

  toastWarn('No linked record to open');
  return { opened: false, reason: 'no-entity' };
}

const CONTACT_ROW_TARGETS = [
  { key: 'contacts:list', tableId: 'tbl-longshots', surface: 'contacts', sourceHint: 'contacts:list-row', selectionReason: 'contacts:row-open' },
  { key: 'pipeline:table', tableId: 'tbl-pipeline', surface: 'pipeline', sourceHint: 'pipeline:list-row', selectionReason: 'pipeline:row-open' },
  { key: 'pipeline:clients', tableId: 'tbl-clients', surface: 'pipeline', sourceHint: 'pipeline:clients-row', selectionReason: 'pipeline:row-open' }
];

const ROW_BIND_ONCE = (typeof window !== 'undefined'
  ? (window.__ROW_BIND_ONCE__ = window.__ROW_BIND_ONCE__ || {})
  : {});

function getContactRowState() {
  const state = ROW_BIND_ONCE.contacts || (ROW_BIND_ONCE.contacts = {});
  if (!state.watchers) state.watchers = [];
  if (!state.bindings) state.bindings = new Map();
  if (!state.activeSurfaces) state.activeSurfaces = new Set();
  if (!state.surface) state.surface = 'contacts';
  return state;
}

const scheduleContactTask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => {
    try {
      if (typeof Promise === 'function') { Promise.resolve().then(() => fn()).catch(() => { }); return; }
    } catch (_) { }
    try { fn(); }
    catch (_) { }
  };

function clearSurfaceSelection(surface, table, reason) {
  const scope = surface || 'contacts';
  const detail = typeof reason === 'string' && reason ? reason : `${scope}:row-open`;
  clearSelectionForSurface(scope, { reason: detail });
  if (!table || typeof table.querySelectorAll !== 'function') return;
  table.querySelectorAll('[data-ui="row-check"]').forEach((node) => {
    try {
      if (node.checked) node.checked = false;
    } catch (_err) { }
  });
  table.querySelectorAll('[data-selected="1"]').forEach((row) => {
    try { row.removeAttribute('data-selected'); }
    catch (_err) { }
  });
}

function detachBinding(binding) {
  if (binding && binding.root && binding.handler) {
    try { binding.root.removeEventListener('click', binding.handler); }
    catch (_err) { }
  }
  if (binding) {
    binding.root = null;
    binding.handler = null;
    binding.bound = false;
  }
}

function bindContactTables() {
  if (typeof document === 'undefined') return;
  const state = getContactRowState();
  CONTACT_ROW_TARGETS.forEach((def) => {
    let binding = state.bindings.get(def.key);
    if (!binding) {
      binding = { key: def.key, def, root: null, handler: null, bound: false };
      state.bindings.set(def.key, binding);
    }
    if (!state.activeSurfaces.has(def.surface)) {
      detachBinding(binding);
      return;
    }
    const table = document.getElementById(def.tableId);
    if (!table) {
      detachBinding(binding);
      return;
    }
    if (binding.root === table && binding.bound) return;
    detachBinding(binding);
    const handler = (event) => {
      if (!event || event.__crmRowEditorHandled) return;
      const skip = event.target?.closest?.('[data-ui="row-check"],[data-role="favorite-toggle"],[data-role="contact-menu"]');
      if (skip) return;
      const control = event.target?.closest?.('button,[role="button"],input,select,textarea,label');
      if (control) return;
      const anchor = event.target?.closest?.('a');
      if (anchor && !anchor.closest('[data-role="contact-name"],.contact-name')) return;
      const row = event.target?.closest?.('tr[data-contact-id],tr[data-id]');
      if (!row || !table.contains(row)) return;
      const id = row.getAttribute('data-contact-id') || row.getAttribute('data-id') || '';
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      event.__crmRowEditorHandled = true;
      event.__contactEditHandled = true;
      clearSurfaceSelection(def.surface, table, def.selectionReason);
      try {
        const result = openContactEditor({ id, __isNew: false }, {
          allowAutoOpen: true,
          sourceHint: def.sourceHint,
          trigger: row,
          suppressErrorToast: true
        });
        if (result && typeof result.catch === 'function') {
          result.catch(err => {
            try { console && console.warn && console.warn('[contact-gateway] open failed', { id, surface: def.surface }, err); }
            catch (_warn) { }
          });
        }
      } catch (err) {
        try { console && console.warn && console.warn('[contact-gateway] open failed', { id, surface: def.surface }, err); }
        catch (_warn) { }
      }
    };
    table.addEventListener('click', handler);
    binding.root = table;
    binding.handler = handler;
    binding.bound = true;
    state.surface = def.surface;
  });
}

function detachAllBindings(state) {
  if (!state.bindings) return;
  for (const binding of state.bindings.values()) {
    detachBinding(binding);
  }
}

function scheduleContactBind() {
  const state = getContactRowState();
  if (!state.activeSurfaces || state.activeSurfaces.size === 0) return;
  if (state.pendingBind) return;
  state.pendingBind = true;
  scheduleContactTask(() => {
    state.pendingBind = false;
    if (!state.activeSurfaces || state.activeSurfaces.size === 0) {
      detachAllBindings(state);
      return;
    }
    bindContactTables();
  });
}

function ensureContactDomReady(state) {
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    if (state.domReadyListener) return;
    const onReady = () => {
      state.domReadyListener = null;
      if (state.activeSurfaces && state.activeSurfaces.size) scheduleContactBind();
    };
    try {
      document.addEventListener('DOMContentLoaded', onReady, { once: true });
    } catch (_) {
      document.addEventListener('DOMContentLoaded', onReady);
    }
    state.domReadyListener = onReady;
  }
}

function attachContactWatchers(state) {
  if (state.watchersAttached) return;
  const doc = typeof document !== 'undefined' ? document : null;
  const win = typeof window !== 'undefined' ? window : null;
  const listeners = [];
  const rebinder = state.rebinder || (state.rebinder = () => scheduleContactBind());
  const defs = [
    { target: doc, type: 'app:data:changed' },
    { target: doc, type: 'contacts:list:refresh' },
    { target: win, type: 'app:view:changed' },
    { target: win, type: 'pipeline:applyFilter' }
  ];
  for (const def of defs) {
    const { target, type } = def;
    if (target && typeof target.addEventListener === 'function') {
      try {
        target.addEventListener(type, rebinder);
        listeners.push({ target, type, listener: rebinder });
      } catch (_err) { }
    }
  }
  state.watchers = listeners;
  state.watchersAttached = true;
}

function detachContactWatchers(state) {
  if (!state.watchersAttached) return;
  for (const entry of state.watchers || []) {
    try { entry.target.removeEventListener(entry.type, entry.listener); }
    catch (_err) { }
  }
  state.watchers = [];
  state.watchersAttached = false;
}

function mountContactRowGateway(surface) {
  const state = getContactRowState();
  state.activeSurfaces.add(surface || 'contacts');
  state.active = true;
  state.surface = surface || 'contacts';
  attachContactWatchers(state);
  ensureContactDomReady(state);
  scheduleContactBind();
}

function unmountContactRowGateway(surface) {
  const state = getContactRowState();
  try {
    const editorState = getContactEditorState ? getContactEditorState() : null;
    const status = editorState && editorState.status;
    const shouldClose = status === 'open' || status === 'opening' || status === 'closing';
    if (shouldClose) {
      closeContactEntry('route-leave');
    }
    const afterState = getContactEditorState ? getContactEditorState() : null;
    if (afterState && (afterState.status !== 'idle' || afterState.pendingRequest || afterState.activePromise)) {
      resetContactEditorForRouteLeave();
    }
  }
  catch (_err) { }
  if (surface) {
    state.activeSurfaces.delete(surface);
  } else {
    state.activeSurfaces.clear();
  }
  if (state.activeSurfaces.size > 0) {
    scheduleContactBind();
    return;
  }
  state.active = false;
  if (state.domReadyListener && typeof document !== 'undefined') {
    try { document.removeEventListener('DOMContentLoaded', state.domReadyListener); }
    catch (_err) { }
  }
  state.domReadyListener = null;
  detachContactWatchers(state);
  detachAllBindings(state);
  state.pendingBind = false;
}

if (typeof window !== 'undefined' || typeof document !== 'undefined') {
  const state = getContactRowState();
  state.routeToken = acquireRouteLifecycleToken('contacts', {
    mount: () => mountContactRowGateway('contacts'),
    unmount: () => unmountContactRowGateway('contacts')
  });
  state.pipelineRouteToken = acquireRouteLifecycleToken('pipeline', {
    mount: () => mountContactRowGateway('pipeline'),
    unmount: () => unmountContactRowGateway('pipeline')
  });
}

let modalReadyPromise = null;
export function ensureContactModalReady() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (typeof window.renderContactModal === 'function' && window.renderContactModal.__crmReady === true) {
    return Promise.resolve(true);
  }
  const ready = window.__CONTACT_MODAL_READY__;
  if (ready && typeof ready.then === 'function') {
    return ready.then(() => {
      return typeof window.renderContactModal === 'function' && window.renderContactModal.__crmReady === true;
    }).catch(err => {
      if (console && typeof console.warn === 'function') {
        console.warn('contact modal ready wait failed', err);
      }
      return false;
    });
  }
  if (!modalReadyPromise) {
    modalReadyPromise = Promise.resolve(
      typeof window.renderContactModal === 'function' && window.renderContactModal.__crmReady === true
    ).then(value => {
      modalReadyPromise = null;
      return value;
    }).catch(err => {
      modalReadyPromise = null;
      if (console && typeof console.warn === 'function') {
        console.warn('contact modal ensure failed', err);
      }
      return false;
    });
  }
  return modalReadyPromise;
}

function ensureFullContactButton() {
  if (typeof document === 'undefined') return;
  const header = document.querySelector('#view-longshots .card > .row');
  if (!header) return;
  if (header.querySelector('[data-qa="new-contact-full"]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn brand';
  button.dataset.qa = 'new-contact-full';
  button.textContent = 'Open Full Contact Editor';
  button.addEventListener('click', (event) => {
    if (event) event.preventDefault();
    const result = openContactEditor({}, { sourceHint: 'contacts:full-editor', allowAutoOpen: true, suppressErrorToast: true });
    if (result && typeof result.catch === 'function') {
      result.catch(err => {
        try { console && console.warn && console.warn('[contacts] full editor button failed', err); }
        catch (_warn) { }
      });
    }
  });
  const filters = header.querySelector('#btn-filters-longshots');
  if (filters && filters.parentNode === header) {
    header.insertBefore(button, filters);
  } else {
    const grow = header.querySelector('.grow');
    if (grow && grow.parentNode === header) {
      header.insertBefore(button, grow.nextSibling);
    } else {
      header.appendChild(button);
    }
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureFullContactButton, { once: true });
  } else {
    ensureFullContactButton();
  }
}

if (typeof window !== 'undefined') {
  if (!window.__test_openContactEditor) {
    let search = '';
    try {
      search = typeof window.location?.search === 'string' ? window.location.search : '';
    } catch (_err) {
      search = '';
    }
    if (search && /(?:^|[?&])debug_editor=1(?:&|$)/.test(search)) {
      window.__test_openContactEditor = async function debugOpenContactEditor(n = 20) {
        const total = Number(n);
        const iterations = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
        for (let i = 0; i < iterations; i += 1) {
          const model = normalizeNewContactPrefill({ name: `Debug ${i}` });
          try {
            await openContactEditor(model, {
              allowAutoOpen: true,
              sourceHint: 'debug:contact-editor',
              suppressErrorToast: true
            });
          } catch (err) {
            const message = `Debug contact editor open failed (iteration ${i + 1} of ${iterations})`;
            try { console && console.warn && console.warn('[contacts:debug]', message, err); }
            catch (_warn) { }
            try { toastError(message); }
            catch (_toast) { }
            throw err;
          }
        }
        return iterations > 0;
      };
    }
  }
}

// --- RESTORED LOCAL STATE ---
const _localEditorState = { status: 'idle', activeId: null };
export function getContactEditorState() { return { ..._localEditorState }; }
export function resetContactEditorForRouteLeave() { closeContactEditor('nav'); }
export function closeContactEditor(reason) {
  const m = document.querySelector('[data-ui="contact-edit-modal"]');
  if (m) { m.style.display = 'none'; m.removeAttribute('open'); }
  _localEditorState.status = 'idle';
}

// --- Quick Add Support ---
export async function createQuick(record) {
  if (!record) throw new Error('Record required');
  const contact = {
    id: record.id || (typeof window.uuid === 'function' ? window.uuid() : `contact-${Date.now()}`),
    first: record.first || '',
    last: record.last || '',
    email: record.email || '',
    phone: record.phone || '',
    notes: record.notes || '',
    stage: record.stage || 'application',
    status: record.status || 'inprogress',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  if (typeof window.dbPut === 'function') {
    await window.dbPut('contacts', contact);
  }

  // Dispatch event to update UI
  const event = new CustomEvent('app:data:changed', {
    detail: { scope: 'contacts', action: 'create', id: contact.id }
  });
  document.dispatchEvent(event);

  if (typeof window.dispatchAppDataChanged === 'function') {
    window.dispatchAppDataChanged('contacts');
  }

  return contact;
}

// --- Editor Export ---
// Duplicate openContactEditor removed


// --- Window Export ---
if (typeof window !== 'undefined') {
  window.Contacts = {
    open: openContactEditor,
    createQuick: createQuick,
    get: typeof window.dbGet === 'function' ? (id) => window.dbGet('contacts', id) : null
  };
}

