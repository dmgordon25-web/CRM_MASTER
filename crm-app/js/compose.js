import { Templates } from './email/templates_store.js';
import { compile } from './email/merge_vars.js';

const PROFILE_STORAGE_KEY = 'profile:v1';
const SIGNATURE_STORAGE_KEY = 'signature:v1';
const TEMPLATE_PLACEHOLDER_KEYS = [
  '{{FirstName}}',
  '{{LastName}}',
  '{{FullName}}',
  '{{PreferredName}}',
  '{{AgentName}}',
  '{{LoanOfficerName}}',
  '{{Company}}',
  '{{TodayDate}}',
  '{{CloseDate}}',
  '{{PreapprovalExpiryDate}}',
  '{{LoanAmount}}',
  '{{PropertyAddress}}',
];

const currencyFormatter = (typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function')
  ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  : null;

let composeModal = null;
let composeSession = { context: null, profileDetails: null, signature: '', contact: null, partner: null };
let templateCache = [];

try{
  if(Templates && typeof Templates.subscribe === 'function'){
    Templates.subscribe((state) => {
      templateCache = Array.isArray(state?.items) ? state.items.slice() : [];
    });
  }
  if(Templates && typeof Templates.ready === 'function'){
    Templates.ready().then(() => {
      try{
        const fresh = typeof Templates.list === 'function' ? Templates.list() : templateCache;
        templateCache = Array.isArray(fresh) ? fresh.slice() : templateCache;
      }catch(_err){}
    }).catch(() => {});
  }
}catch(_err){}

function isDocumentAvailable(){
  return typeof document !== 'undefined';
}

function readProfile(){
  if(typeof window === 'undefined') return {};
  const cached = window.__LO_PROFILE__;
  if(cached && typeof cached === 'object') return cached;
  try{
    const raw = window.localStorage && typeof window.localStorage.getItem === 'function'
      ? window.localStorage.getItem(PROFILE_STORAGE_KEY)
      : null;
    if(!raw) return {};
    const parsed = JSON.parse(raw);
    if(parsed && typeof parsed === 'object'){
      try{ window.__LO_PROFILE__ = parsed; }
      catch(_err){}
      return parsed;
    }
    return {};
  }catch(_err){
    return {};
  }
}

function readSignature(){
  if(typeof window === 'undefined') return '';
  const cached = window.__SIGNATURE_CACHE__;
  if(cached && typeof cached.text === 'string' && cached.text.trim()){
    return cached.text.trim();
  }
  try{
    const raw = window.localStorage && typeof window.localStorage.getItem === 'function'
      ? window.localStorage.getItem(SIGNATURE_STORAGE_KEY)
      : '';
    return typeof raw === 'string' ? raw.trim() : '';
  }catch(_err){
    return '';
  }
}

function pickFirstName(name){
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if(!trimmed) return '';
  const first = trimmed.split(/\s+/)[0];
  return first || trimmed;
}

function sanitizeEmail(email){
  const trimmed = typeof email === 'string' ? email.trim() : '';
  if(!trimmed) return '';
  return trimmed;
}

function sanitizePhone(phone){
  const raw = typeof phone === 'string' ? phone.trim() : '';
  if(!raw) return '';
  let cleaned = '';
  for(const ch of raw){
    if(ch === '+' && cleaned.length === 0){
      cleaned += '+';
    }else if(/[0-9]/.test(ch)){
      cleaned += ch;
    }
  }
  return cleaned;
}

function formatDateValue(value){
  if(!value) return '';
  let date = value;
  if(!(date instanceof Date)){
    date = new Date(value);
  }
  if(!(date instanceof Date) || Number.isNaN(date.getTime())){
    return String(value);
  }
  try{
    return date.toLocaleDateString();
  }catch(_err){
    return date.toISOString().slice(0, 10);
  }
}

function formatCurrencyValue(value){
  if(value == null || value === '') return '';
  let number = value;
  if(typeof number === 'string'){
    const cleaned = number.replace(/[^0-9.-]/g, '');
    number = Number(cleaned);
  }else{
    number = Number(number);
  }
  if(!Number.isFinite(number) || number === 0) return '';
  if(currencyFormatter){
    try{ return currencyFormatter.format(number); }
    catch(_err){}
  }
  return `$${Math.round(number)}`;
}

function combineAddress(contact){
  if(!contact || typeof contact !== 'object') return '';
  const parts = [];
  const primary = contact.propertyAddress || contact.property || contact.address;
  if(primary) parts.push(String(primary).trim());
  const city = contact.city ? String(contact.city).trim() : '';
  const state = contact.state ? String(contact.state).trim() : '';
  const zip = contact.zip ? String(contact.zip).trim() : '';
  const cityState = [city, state].filter(Boolean).join(', ');
  const line2 = [cityState, zip].filter(Boolean).join(' ').trim();
  if(line2) parts.push(line2);
  return parts.filter(Boolean).join(', ');
}

function escapeHtmlValue(value){
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function templateSnippet(template){
  const subject = typeof template?.subject === 'string' ? template.subject : '';
  const body = typeof template?.body === 'string' ? template.body : '';
  const raw = subject || body || '';
  const clean = raw.replace(/\s+/g, ' ').trim();
  if(!clean) return '';
  if(clean.length <= 80) return clean;
  return `${clean.slice(0, 77)}...`;
}

function buildAgentName(contact, partner){
  if(contact && typeof contact === 'object'){
    const fromContact = contact.buyerPartnerName
      || contact.listingPartnerName
      || contact.referralPartnerName
      || contact.agentName
      || contact.partnerName;
    if(fromContact && String(fromContact).trim()) return String(fromContact).trim();
  }
  if(partner && typeof partner === 'object'){
    const candidate = partner.name || partner.company;
    if(candidate && String(candidate).trim()) return String(candidate).trim();
  }
  return '';
}

function filterTemplateList(list, term){
  const query = String(term || '').trim().toLowerCase();
  if(!query) return list.slice();
  return list.filter((item) => {
    const haystack = `${item?.name || ''} ${item?.subject || ''} ${item?.body || ''}`.toLowerCase();
    return haystack.includes(query);
  });
}

async function ensureDatabase(){
  if(typeof window === 'undefined') return false;
  if(typeof window.openDB !== 'function') return false;
  try{
    await window.openDB();
    return true;
  }catch(err){
    try{ console && console.warn && console.warn('compose openDB failed', err); }
    catch(_warnErr){}
    return false;
  }
}

async function fetchStoreRecord(store, id){
  if(!id && id !== 0) return null;
  if(typeof window === 'undefined') return null;
  try{
    let getter = null;
    if(typeof window.dbGet === 'function'){
      getter = (key) => window.dbGet(store, key);
    }else if(window.db && typeof window.db.get === 'function'){
      getter = (key) => window.db.get(store, key);
    }else if(store === 'contacts' && typeof window.dbGetContact === 'function'){
      getter = window.dbGetContact;
    }else if(store === 'partners' && typeof window.dbGetPartner === 'function'){
      getter = window.dbGetPartner;
    }
    if(!getter) return null;
    const record = await getter(id);
    return record || null;
  }catch(err){
    try{ console && console.warn && console.warn('compose fetch record failed', err); }
    catch(_warnErr){}
    return null;
  }
}

async function resolveContextRecords(context){
  if(!context || typeof context !== 'object'){
    return { contact: null, partner: null };
  }
  let contact = (context.contact && typeof context.contact === 'object') ? context.contact : null;
  let partner = (context.partner && typeof context.partner === 'object') ? context.partner : null;
  const contactId = (!contact && (context.contactId || (context.entity === 'contact' ? context.id : null))) || null;
  const partnerCandidates = [];
  if(context.partnerId) partnerCandidates.push(context.partnerId);
  if(partner && partner.id) partnerCandidates.push(partner.id);
  if(contact){
    ['partnerId','buyerPartnerId','listingPartnerId','referralPartnerId'].forEach((key) => {
      if(contact[key]) partnerCandidates.push(contact[key]);
    });
  }
  const needsDb = (!contact && contactId) || (!partner && partnerCandidates.some((pid) => pid));
  if(needsDb){
    await ensureDatabase();
  }
  if(!contact && contactId){
    contact = await fetchStoreRecord('contacts', contactId);
  }
  if(!partner){
    for(const candidate of partnerCandidates){
      if(!candidate && candidate !== 0) continue;
      partner = await fetchStoreRecord('partners', candidate);
      if(partner) break;
    }
  }
  return { contact: contact || null, partner: partner || null };
}

function encodeQuery(params){
  const search = new URLSearchParams();
  for(const [key, value] of params){
    if(!value) continue;
    search.append(key, value);
  }
  const query = search.toString();
  return query ? `?${query.replace(/\+/g, '%20')}` : '';
}

function buildMailto(to, subject, body){
  const safeTo = encodeURIComponent(to).replace(/%40/g, '@');
  const query = encodeQuery([
    ['subject', subject],
    ['body', body]
  ]);
  return `mailto:${safeTo}${query}`;
}

function buildEmailSubject(context){
  const name = typeof context?.name === 'string' ? context.name.trim() : '';
  if(name){
    return `Follow up with ${name}`;
  }
  return 'Follow up from THE CRM Tool';
}

function extractProfileDetails(profile){
  return {
    name: typeof profile?.name === 'string' ? profile.name.trim() : '',
    email: typeof profile?.email === 'string' ? profile.email.trim() : '',
    phone: typeof profile?.phone === 'string' ? profile.phone.trim() : '',
    company: typeof profile?.company === 'string' ? profile.company.trim() : ''
  };
}

function applySignatureTokens(signature, profile){
  const text = typeof signature === 'string' ? signature : '';
  if(!text.trim()) return '';
  const name = typeof profile?.name === 'string' ? profile.name.trim() : '';
  const email = typeof profile?.email === 'string' ? profile.email.trim() : '';
  const phone = typeof profile?.phone === 'string' ? profile.phone.trim() : '';
  return text
    .replace(/\{loName\}/g, name)
    .replace(/\{loEmail\}/g, email)
    .replace(/\{loPhone\}/g, phone)
    .trim();
}

function appendSignatureBlock(lines, profileDetails, signature){
  const profileName = typeof profileDetails?.name === 'string' ? profileDetails.name.trim() : '';
  const profilePhone = typeof profileDetails?.phone === 'string' ? profileDetails.phone.trim() : '';
  const profileEmail = typeof profileDetails?.email === 'string' ? profileDetails.email.trim() : '';
  if(signature){
    if(lines.length) lines.push('');
    lines.push(signature);
  }else{
    const profileLines = [];
    if(profileName) profileLines.push(profileName);
    if(profilePhone) profileLines.push(profilePhone);
    if(profileEmail) profileLines.push(profileEmail);
    if(profileLines.length){
      if(lines.length) lines.push('');
      profileLines.length === 1
        ? lines.push(profileLines[0])
        : lines.push(profileLines.join('\n'));
    }
  }
  if(lines.length) lines.push('');
  lines.push('Sent from THE CRM Tool');
  return lines;
}

function buildEmailBody(context, profile, signatureOverride){
  const firstName = pickFirstName(context?.name) || 'there';
  const bodyLines = [`Hi ${firstName},`, '', 'Just checking in to see how things are going.'];
  const details = extractProfileDetails(profile);
  const signature = typeof signatureOverride === 'string'
    ? signatureOverride
    : applySignatureTokens(readSignature(), details);
  appendSignatureBlock(bodyLines, details, signature);
  return bodyLines.join('\n');
}

function buildSmsBody(context, profile){
  const firstName = pickFirstName(context?.name);
  const profileName = typeof profile?.name === 'string' ? profile.name.trim() : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const sender = profileName ? `- ${profileName}` : '- Your loan officer';
  return `${greeting} just checking in about your loan. Let me know if you need anything. ${sender}`;
}

function getSmsSeparator(){
  if(typeof navigator === 'undefined') return '?';
  const agent = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(agent) ? '&' : '?';
}

function buildSmsLink(phone, body){
  const trimmedBody = typeof body === 'string' ? body.trim() : '';
  if(!trimmedBody){
    return `sms:${phone}`;
  }
  const separator = getSmsSeparator();
  const encoded = encodeURIComponent(trimmedBody).replace(/%20/g, '+');
  return `sms:${phone}${separator}body=${encoded}`;
}

function openUrl(url){
  if(!url || typeof window === 'undefined') return false;
  try{
    if(isDocumentAvailable()){
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.rel = 'noopener noreferrer';
      anchor.style.display = 'none';
      (document.body || document.documentElement || document).appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    }
  }catch(err){
    try{ console && console.warn && console.warn('compose navigation failed', err); }
    catch(_err){}
  }
  try{
    window.location.href = url;
    return true;
  }catch(err){
    try{ console && console.warn && console.warn('compose location navigation failed', err); }
    catch(_err){}
  }
  return false;
}

function notify(kind, message){
  const text = typeof message === 'string' ? message.trim() : '';
  if(!text) return;
  try{
    const toastApi = window.Toast;
    if(toastApi){
      const handler = typeof toastApi[kind] === 'function' ? toastApi[kind]
        : (typeof toastApi.show === 'function' ? toastApi.show : null);
      if(handler){
        handler.call(toastApi, text);
        return;
      }
    }
  }catch(_err){ }
  try{
    if(typeof window.toast === 'function'){
      window.toast(text);
      return;
    }
  }catch(_err){ }
  try{
    console && console.info && console.info(text);
  }catch(_err){ }
}

function buildTemplateData(context, profileDetails, signature){
  const source = context && typeof context.contact === 'object' ? context.contact : {};
  const contact = Object.assign({}, source);
  const contextName = typeof context?.name === 'string' ? context.name.trim() : '';
  if(contextName) contact.name = contextName;
  if(typeof context?.first === 'string' && context.first.trim()){
    contact.first = context.first.trim();
  }
  if(typeof context?.last === 'string' && context.last.trim()){
    contact.last = context.last.trim();
  }
  if(typeof context?.email === 'string' && context.email.trim()){
    contact.email = context.email.trim();
  }
  if(typeof context?.phone === 'string' && context.phone.trim()){
    contact.phone = context.phone.trim();
  }
  if(!contact.first){
    const first = pickFirstName(contact.name);
    if(first) contact.first = first;
  }
  const partner = context && typeof context.partner === 'object' ? context.partner : {};
  const profile = extractProfileDetails(profileDetails);
  const data = {
    contact,
    partner,
    profile,
    lo: profile,
    loanOfficer: profile,
    date: { today: formatDateValue(new Date()) },
    first: contact.first || '',
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    loName: profile.name || '',
    loEmail: profile.email || '',
    loPhone: profile.phone || ''
  };
  const fullName = [contact.first, contact.last].filter(Boolean).join(' ').trim() || contact.name || contextName || '';
  const derivedFirst = contact.first || pickFirstName(contact.name || contextName) || '';
  const derivedLast = contact.last || '';
  const preferredName = contact.preferredName
    || contact.nickname
    || contact.alias
    || derivedFirst
    || fullName;
  const agentName = buildAgentName(contact, partner);
  const loanOfficerName = profile.name || '';
  const companyName = profile.company || contact.company || partner.company || '';
  const closeDate = formatDateValue(context?.closeDate || contact.fundedDate || contact.expectedClosing);
  const preapprovalDate = formatDateValue(context?.preApprovalExpires || contact.preApprovalExpires);
  const loanAmount = formatCurrencyValue(contact.loanAmount ?? context?.loanAmount);
  const propertyAddress = contact.propertyAddress || combineAddress(contact);
  data.FirstName = derivedFirst || '';
  data.LastName = derivedLast || '';
  data.FullName = fullName || preferredName || derivedFirst || data.name || '';
  data.PreferredName = preferredName || derivedFirst || data.FullName || '';
  data.AgentName = agentName || '';
  data.LoanOfficerName = loanOfficerName || '';
  data.Company = companyName || '';
  data.TodayDate = data.date.today || formatDateValue(new Date());
  data.CloseDate = closeDate || '';
  data.PreapprovalExpiryDate = preapprovalDate || '';
  data.LoanAmount = loanAmount || '';
  data.PropertyAddress = propertyAddress || '';
  if(signature) data.signature = signature;
  return data;
}

function selectTemplate(templates){
  const list = Array.isArray(templates) ? templates : [];
  if(!list.length) return null;
  const favorites = list.filter((item) => item && item.fav);
  if(favorites.length) return favorites[0];
  return list[0];
}

function getComposeModalElements(modal){
  if(!modal) return {};
  return {
    toField: modal.querySelector('[data-field="to"]'),
    subjectField: modal.querySelector('[data-field="subject"]'),
    bodyField: modal.querySelector('[data-field="body"]'),
    picker: modal.querySelector('[data-role="template-picker"]'),
    pickerList: modal.querySelector('[data-role="picker-list"]'),
    pickerSearch: modal.querySelector('[data-role="picker-search"]'),
  };
}

function updateMailtoDataset(modal){
  if(!modal) return '';
  const { toField, subjectField, bodyField } = getComposeModalElements(modal);
  const to = toField ? sanitizeEmail(toField.value) : '';
  if(toField) toField.value = to;
  const subject = subjectField ? subjectField.value : '';
  const body = bodyField ? bodyField.value : '';
  const href = to ? buildMailto(to, subject, body) : '';
  modal.dataset.mailto = href;
  return href;
}

function renderTemplatePickerList(modal, items){
  const { picker, pickerList } = getComposeModalElements(modal);
  if(!picker || !pickerList) return;
  picker.__visibleItems = Array.isArray(items) ? items : [];
  pickerList.innerHTML = '';
  if(!picker.__visibleItems.length){
    const empty = document.createElement('div');
    empty.textContent = 'No templates yet. Save a draft as a template to reuse it here.';
    empty.className = 'muted';
    empty.style.padding = '12px';
    pickerList.appendChild(empty);
    return;
  }
  picker.__visibleItems.forEach((item) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.dataset.role = 'picker-item';
    row.dataset.id = item.id;
    row.style.display = 'block';
    row.style.width = '100%';
    row.style.textAlign = 'left';
    row.style.border = '1px solid rgba(15,23,42,0.12)';
    row.style.borderRadius = '10px';
    row.style.background = '#fff';
    row.style.padding = '10px 12px';
    row.style.cursor = 'pointer';
    row.innerHTML = `
      <strong style="display:block;font-size:14px;">${escapeHtmlValue(item?.name || 'Untitled')}</strong>
      <span style="display:block;font-size:12px;color:#64748b;">${escapeHtmlValue(templateSnippet(item))}</span>
    `;
    pickerList.appendChild(row);
  });
}

function hideTemplatePicker(modal){
  const { picker, pickerSearch } = getComposeModalElements(modal);
  if(!picker) return;
  picker.hidden = true;
  picker.style.display = 'none';
  picker.dataset.open = '0';
  if(pickerSearch) pickerSearch.value = '';
}

async function openTemplatePicker(modal){
  const elements = getComposeModalElements(modal);
  const picker = elements.picker;
  if(!picker) return;
  picker.hidden = false;
  picker.style.display = 'flex';
  picker.dataset.open = '1';
  const list = elements.pickerList;
  if(list){
    list.innerHTML = '<div class="muted" style="padding:12px;">Loading templates…</div>';
  }
  const search = elements.pickerSearch;
  if(search){
    search.value = '';
    setTimeout(() => { try{ search.focus(); }catch(_err){} }, 0);
  }
  try{
    if(Templates && typeof Templates.ready === 'function'){
      await Templates.ready();
    }
  }catch(_err){}
  const baseItems = typeof Templates?.list === 'function' ? Templates.list() : templateCache.slice();
  picker.__items = Array.isArray(baseItems) ? baseItems.slice() : [];
  renderTemplatePickerList(modal, picker.__items);
}

function applyTemplateToModal(modal, template){
  if(!template) return;
  const { subjectField, bodyField } = getComposeModalElements(modal);
  if(!subjectField || !bodyField) return;
  const context = Object.assign({}, composeSession.context || {});
  if(composeSession.contact) context.contact = composeSession.contact;
  if(composeSession.partner) context.partner = composeSession.partner;
  const result = buildEmailFromTemplate(template, context, composeSession.profileDetails, composeSession.signature);
  if(!result) return;
  subjectField.value = result.subject || '';
  bodyField.value = result.body || '';
  modal.dataset.templateId = template.id || '';
  updateMailtoDataset(modal);
  if(bodyField && typeof bodyField.focus === 'function'){
    bodyField.focus();
  }
}

function handleComposeModalClick(evt){
  const modal = evt.currentTarget;
  if(!modal) return;
  const autopHandlers = modal.dataset?.composeHandlers === 'automation-legacy';
  const closeBtn = evt.target.closest('[data-close]');
  if(closeBtn){
    hideTemplatePicker(modal);
    if(autopHandlers) return;
    evt.preventDefault();
    try{ modal.close(); }
    catch(_err){ modal.removeAttribute('open'); modal.style.display = 'none'; }
    return;
  }
  const openMail = evt.target.closest('[data-open-mail]');
  if(openMail){
    if(autopHandlers) return;
    evt.preventDefault();
    const href = updateMailtoDataset(modal);
    if(!href){
      notify('info', 'Add an email address before sending');
      return;
    }
    const opened = openUrl(href);
    if(!opened){
      notify('info', 'Unable to open the email application');
    }
    return;
  }
  const copyBtn = evt.target.closest('[data-copy]');
  if(copyBtn){
    if(autopHandlers) return;
    evt.preventDefault();
    const { subjectField, bodyField } = getComposeModalElements(modal);
    const subject = subjectField ? subjectField.value : '';
    const body = bodyField ? bodyField.value : '';
    const text = `Subject: ${subject}\n\n${body}`;
    const finalize = (success) => {
      notify('info', success ? 'Copied to clipboard' : 'Copy failed — select text manually.');
    };
    if(typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
      navigator.clipboard.writeText(text).then(() => finalize(true)).catch(() => finalize(false));
    }else if(isDocumentAvailable()){
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try{ document.execCommand('copy'); finalize(true); }
      catch(_err){ finalize(false); }
      document.body.removeChild(textarea);
    }else{
      finalize(false);
    }
    return;
  }
  const insertBtn = evt.target.closest('[data-action="insert-template"]');
  if(insertBtn){
    evt.preventDefault();
    openTemplatePicker(modal);
  }
}

function ensureComposeModal(){
  if(!isDocumentAvailable()) return null;
  if(composeModal && composeModal.isConnected){
    return composeModal;
  }
  let modal = document.getElementById('email-compose-modal');
  if(!modal){
    modal = document.createElement('dialog');
    modal.id = 'email-compose-modal';
    modal.className = 'record-modal';
    const mount = document.body || document.documentElement;
    if(mount) mount.appendChild(modal);
  }
  modal.dataset.composeVariant = 'automation-templates-v1';
  modal.style.position = 'relative';
  const placeholderHint = escapeHtmlValue(TEMPLATE_PLACEHOLDER_KEYS.join(', '));
  modal.innerHTML = `
    <div class="dlg">
      <div class="modal-header"><strong>Email Compose</strong><span class="grow"></span><button type="button" class="btn" data-close>Close</button></div>
      <div class="dialog-scroll"><div class="modal-body" style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:flex-end;">
          <button type="button" data-action="insert-template" style="border:1px solid rgba(59,130,246,0.4);border-radius:999px;padding:6px 14px;background:#fff;cursor:pointer;">Insert Template…</button>
        </div>
        <label>To<input type="text" data-field="to" readonly style="width:100%;padding:8px 10px;border:1px solid rgba(15,23,42,0.16);border-radius:8px;font:inherit;" /></label>
        <label>Subject<input type="text" data-field="subject" style="width:100%;padding:8px 10px;border:1px solid rgba(15,23,42,0.16);border-radius:8px;font:inherit;" /></label>
        <label>Body<textarea data-field="body" style="width:100%;min-height:220px;padding:10px;border:1px solid rgba(15,23,42,0.16);border-radius:8px;font:inherit;resize:vertical;"></textarea></label>
      </div></div>
      <div class="modal-footer" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;align-items:center;">
        <small class="muted" style="font-size:12px;">Available placeholders: ${placeholderHint}</small>
        <div style="display:flex;gap:8px;">
          <button class="btn" type="button" data-copy>Copy</button>
          <button class="btn brand" type="button" data-open-mail>Open in email app</button>
        </div>
      </div>
    </div>
    <div data-role="template-picker" hidden style="position:absolute;inset:0;background:rgba(15,23,42,0.35);display:flex;align-items:center;justify-content:center;padding:16px;">
      <div role="dialog" aria-modal="true" style="background:#fff;width:min(420px,90%);max-height:80vh;overflow:hidden;border-radius:12px;box-shadow:0 20px 40px rgba(15,23,42,0.25);display:flex;flex-direction:column;">
        <header style="display:flex;gap:8px;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(15,23,42,0.1);">
          <input type="search" data-role="picker-search" placeholder="Search templates" style="flex:1;padding:8px 10px;border:1px solid rgba(15,23,42,0.2);border-radius:8px;font:inherit;" />
          <button type="button" data-role="picker-close" class="btn">Close</button>
        </header>
        <div data-role="picker-list" style="padding:12px 16px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:8px;"></div>
      </div>
    </div>
  `;
  const overlay = modal.querySelector('[data-role="template-picker"]');
  if(overlay){
    overlay.hidden = true;
    overlay.style.display = 'none';
  }
  const { subjectField, bodyField } = getComposeModalElements(modal);
  if(subjectField) subjectField.autocomplete = 'off';
  if(bodyField){
    bodyField.spellcheck = true;
  }
  if(!modal.__composeWired){
    modal.addEventListener('click', handleComposeModalClick);
    modal.addEventListener('close', () => {
      hideTemplatePicker(modal);
      modal.removeAttribute('open');
      modal.style.display = 'none';
    });
    modal.addEventListener('cancel', (evt) => {
      evt.preventDefault();
      hideTemplatePicker(modal);
      try{ modal.close(); }
      catch(_err){ modal.removeAttribute('open'); modal.style.display = 'none'; }
    });
    if(subjectField) subjectField.addEventListener('input', () => updateMailtoDataset(modal));
    if(bodyField) bodyField.addEventListener('input', () => updateMailtoDataset(modal));
    if(overlay){
      overlay.addEventListener('click', (evt) => {
        const closeBtn = evt.target.closest('[data-role="picker-close"]');
        if(closeBtn || evt.target === overlay){
          evt.preventDefault();
          hideTemplatePicker(modal);
          return;
        }
        const itemBtn = evt.target.closest('[data-role="picker-item"]');
        if(itemBtn){
          const items = Array.isArray(overlay.__visibleItems) ? overlay.__visibleItems : overlay.__items || [];
          const match = items.find((tpl) => String(tpl?.id) === String(itemBtn.dataset.id));
          if(match){
            applyTemplateToModal(modal, match);
            hideTemplatePicker(modal);
          }
        }
      });
      overlay.addEventListener('input', (evt) => {
        const search = evt.target.closest('[data-role="picker-search"]');
        if(!search) return;
        const base = Array.isArray(overlay.__items) ? overlay.__items : [];
        renderTemplatePickerList(modal, filterTemplateList(base, search.value || ''));
      });
      overlay.addEventListener('keydown', (evt) => {
        if(evt.key === 'Escape'){
          evt.preventDefault();
          hideTemplatePicker(modal);
        }
      });
    }
    modal.__composeWired = true;
  }
  composeModal = modal;
  return modal;
}

function showComposeModal(modal){
  if(!modal) return;
  hideTemplatePicker(modal);
  modal.style.display = 'block';
  try{
    if(typeof modal.showModal === 'function'){
      modal.showModal();
    }else{
      modal.setAttribute('open', '');
    }
  }catch(_err){
    modal.setAttribute('open', '');
  }
}

function buildEmailFromTemplate(template, context, profileDetails, signature){
  if(!template) return null;
  const data = buildTemplateData(context, profileDetails, signature);
  const subject = compile(template.subject || '', data).trim();
  const bodyRaw = compile(template.body || '', data).trim();
  if(!bodyRaw){
    return { subject, body: '' };
  }
  const lines = bodyRaw.split('\n');
  appendSignatureBlock(lines, extractProfileDetails(profileDetails), signature);
  return {
    subject,
    body: lines.join('\n')
  };
}

async function composeEmail(context){
  const profile = readProfile();
  const profileDetails = extractProfileDetails(profile);
  const signature = applySignatureTokens(readSignature(), profileDetails);
  let resolvedContext = context && typeof context === 'object' ? Object.assign({}, context) : {};
  let resolvedContact = resolvedContext.contact && typeof resolvedContext.contact === 'object' ? resolvedContext.contact : null;
  let resolvedPartner = resolvedContext.partner && typeof resolvedContext.partner === 'object' ? resolvedContext.partner : null;
  let email = sanitizeEmail(resolvedContext.email);
  if(!email && resolvedContact && typeof resolvedContact.email === 'string'){
    email = sanitizeEmail(resolvedContact.email);
  }
  try{
    const resolved = await resolveContextRecords(resolvedContext);
    if(!resolvedContact && resolved.contact) resolvedContact = resolved.contact;
    if(!resolvedPartner && resolved.partner) resolvedPartner = resolved.partner;
    if(!email && resolved.contact && typeof resolved.contact.email === 'string'){
      email = sanitizeEmail(resolved.contact.email);
    }
  }catch(err){
    try{ console && console.warn && console.warn('compose context resolve failed', err); }
    catch(_warnErr){}
  }
  if(!email){
    notify('info', 'No email address on file for this record');
    return false;
  }
  resolvedContext = Object.assign({}, resolvedContext, { email });
  if(resolvedContact) resolvedContext.contact = resolvedContact;
  if(resolvedPartner) resolvedContext.partner = resolvedPartner;
  composeSession = {
    context: resolvedContext,
    profileDetails,
    signature,
    contact: resolvedContact || null,
    partner: resolvedPartner || null,
  };
  let chosenTemplate = null;
  try{
    if(Templates && typeof Templates.ready === 'function'){
      await Templates.ready();
    }
    const available = typeof Templates?.list === 'function' ? Templates.list() : templateCache.slice();
    chosenTemplate = selectTemplate(available);
  }catch(err){
    try{ console && console.warn && console.warn('email template selection failed', err); }
    catch(_warnErr){}
  }
  const templateResult = chosenTemplate
    ? buildEmailFromTemplate(chosenTemplate, resolvedContext, profileDetails, signature)
    : null;
  const subject = templateResult && typeof templateResult.subject === 'string' && templateResult.subject.trim()
    ? templateResult.subject.trim()
    : buildEmailSubject(resolvedContext);
  const body = templateResult && typeof templateResult.body === 'string' && templateResult.body.trim()
    ? templateResult.body
    : buildEmailBody(resolvedContext, profileDetails, signature);
  const modal = ensureComposeModal();
  if(!modal){
    const href = buildMailto(email, subject, body);
    const success = openUrl(href);
    if(!success){
      notify('info', 'Unable to open the email application');
    }
    return success;
  }
  const { toField, subjectField, bodyField } = getComposeModalElements(modal);
  if(toField) toField.value = email;
  if(subjectField) subjectField.value = subject;
  if(bodyField) bodyField.value = body;
  modal.dataset.templateId = chosenTemplate?.id || '';
  updateMailtoDataset(modal);
  showComposeModal(modal);
  return true;
}

function composeSms(context){
  const phone = sanitizePhone(context?.phone);
  if(!phone){
    notify('info', 'No mobile number on file for this record');
    return false;
  }
  const profile = readProfile();
  const body = buildSmsBody(context, profile);
  const link = buildSmsLink(phone, body);
  const success = openUrl(link);
  if(!success){
    notify('info', 'Unable to open the SMS application');
  }
  return success;
}

if(typeof window !== 'undefined'){
  const crm = window.CRM = window.CRM || {};
  crm.actions = crm.actions || {};
  crm.channels = crm.channels || {};
  crm.actions.email = crm.actions.email || {};
  crm.actions.sms = crm.actions.sms || {};
  crm.channels.email = crm.channels.email || {};
  crm.channels.sms = crm.channels.sms || {};
  crm.actions.email.compose = composeEmail;
  crm.actions.sms.compose = composeSms;
  crm.channels.email.compose = composeEmail;
  crm.channels.sms.compose = composeSms;
  if(!window.composeEmail) window.composeEmail = composeEmail;
  if(!window.composeSms) window.composeSms = composeSms;
}

export { composeEmail, composeSms };
