import { Templates } from './email/templates_store.js';
import { compile } from './email/merge_vars.js';

const PROFILE_STORAGE_KEY = 'profile:v1';
const SIGNATURE_STORAGE_KEY = 'signature:v1';

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
    return parsed && typeof parsed === 'object' ? parsed : {};
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
    phone: typeof profile?.phone === 'string' ? profile.phone.trim() : ''
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
    date: { today: new Date().toLocaleDateString() },
    first: contact.first || '',
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    loName: profile.name || '',
    loEmail: profile.email || '',
    loPhone: profile.phone || ''
  };
  if(signature) data.signature = signature;
  return data;
}

function selectTemplate(templates){
  const list = Array.isArray(templates) ? templates : [];
  if(!list.length) return null;
  const favorites = list.filter(item => item && item.fav);
  const useFavorites = favorites.length > 0;
  const choices = useFavorites ? favorites : list;
  if(choices.length === 1){
    const [single] = choices;
    if(!single) return null;
    if(useFavorites) return single;
    if(typeof window === 'undefined' || typeof window.prompt !== 'function'){
      return single;
    }
    let input = null;
    try{
      input = window.prompt(`Use the template "${single.name || 'Untitled template'}"? Enter 1 to use it or leave blank to skip.`, '1');
    }catch(_err){ input = null; }
    if(input == null) return null;
    const trimmedSingle = input.trim();
    if(!trimmedSingle || trimmedSingle === '0') return null;
    return Number.parseInt(trimmedSingle, 10) === 1 ? single : null;
  }
  if(typeof window === 'undefined' || typeof window.prompt !== 'function'){
    return choices[0];
  }
  const options = choices.map((item, index) => `${index + 1}. ${item.name || 'Untitled template'}`);
  let input = null;
  try{
    input = window.prompt(`Choose a template number or leave blank for the default message:\n${options.join('\n')}`, '1');
  }catch(_err){ input = null; }
  if(input == null) return null;
  const trimmed = input.trim();
  if(!trimmed || trimmed === '0') return null;
  const index = Number.parseInt(trimmed, 10);
  if(Number.isFinite(index) && index >= 1 && index <= choices.length){
    return choices[index - 1];
  }
  return choices[0];
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
  const email = sanitizeEmail(context?.email);
  if(!email){
    notify('info', 'No email address on file for this record');
    return false;
  }
  const profile = readProfile();
  const profileDetails = extractProfileDetails(profile);
  const signature = applySignatureTokens(readSignature(), profileDetails);
  let templateResult = null;
  try{
    if(Templates && typeof Templates.ready === 'function'){
      await Templates.ready();
    }
    const available = Templates && typeof Templates.list === 'function' ? Templates.list() : [];
    const chosen = selectTemplate(available);
    if(chosen){
      templateResult = buildEmailFromTemplate(chosen, context, profileDetails, signature);
    }
  }catch(err){
    try{ console && console.warn && console.warn('email template selection failed', err); }
    catch(_err){}
  }
  const subject = templateResult && typeof templateResult.subject === 'string' && templateResult.subject.trim()
    ? templateResult.subject.trim()
    : buildEmailSubject(context);
  const body = templateResult && typeof templateResult.body === 'string' && templateResult.body.trim()
    ? templateResult.body
    : buildEmailBody(context, profileDetails, signature);
  const link = buildMailto(email, subject, body);
  const success = openUrl(link);
  if(!success){
    notify('info', 'Unable to open the email application');
  }
  return success;
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
