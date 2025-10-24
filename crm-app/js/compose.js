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

function buildEmailBody(context, profile){
  const firstName = pickFirstName(context?.name) || 'there';
  const bodyLines = [`Hi ${firstName},`, '', 'Just checking in to see how things are going.'];
  const profileName = typeof profile?.name === 'string' ? profile.name.trim() : '';
  const profilePhone = typeof profile?.phone === 'string' ? profile.phone.trim() : '';
  const profileEmail = typeof profile?.email === 'string' ? profile.email.trim() : '';
  const signature = applySignatureTokens(readSignature(), { name: profileName, email: profileEmail, phone: profilePhone });
  if(signature){
    bodyLines.push('', signature);
  }else{
    const profileLines = [];
    if(profileName) profileLines.push(profileName);
    if(profilePhone) profileLines.push(profilePhone);
    if(profileEmail) profileLines.push(profileEmail);
    if(profileLines.length){
      bodyLines.push('', profileLines.join('\n'));
    }
  }
  bodyLines.push('', 'Sent from THE CRM Tool');
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

function composeEmail(context){
  const email = sanitizeEmail(context?.email);
  if(!email){
    notify('info', 'No email address on file for this record');
    return false;
  }
  const profile = readProfile();
  const subject = buildEmailSubject(context);
  const body = buildEmailBody(context, profile);
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
