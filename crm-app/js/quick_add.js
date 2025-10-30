import { text } from './ui/strings.js';
import { wireQuickAddUnified } from './ui/quick_add_unified.js';
import { openContactEditor, openPartnerEditor } from './ui/quick_create_menu.js';

const win = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
const doc = typeof document !== 'undefined' ? document : null;

function resolveText(key, fallback){
  try {
    const value = text(key);
    return value && value !== key ? value : fallback;
  } catch (_err) {
    return fallback;
  }
}

function buildCopy(){
  return {
    modalTitle: resolveText('modal.add-contact.title', 'Quick Add'),
    contactTab: resolveText('general.contact', 'Contact'),
    partnerTab: resolveText('general.partner', 'Partner'),
    cancel: resolveText('general.cancel', 'Cancel'),
    contactSubmit: resolveText('modal.add-contact.submit', 'Save Contact'),
    partnerSubmit: resolveText('modal.add-partner.submit', 'Save Partner'),
    contactFirstName: resolveText('field.first-name', 'First Name'),
    contactLastName: resolveText('field.last-name', 'Last Name'),
    contactEmail: resolveText('field.email', 'Email'),
    contactPhone: resolveText('field.phone', 'Phone'),
    partnerCompany: resolveText('field.company', 'Company'),
    partnerName: resolveText('field.primary-contact', 'Primary Contact'),
    partnerEmail: resolveText('field.email', 'Email'),
    partnerPhone: resolveText('field.phone', 'Phone')
  };
}

function closeQuickAddOverlay(node){
  const scope = node || (doc ? doc.querySelector('.qa-overlay') : null);
  if(!scope) return;
  const closeBtn = scope.querySelector('.qa-close');
  if(closeBtn){
    closeBtn.click();
    return;
  }
  if(scope.parentElement){
    scope.parentElement.removeChild(scope);
  }
}

function collectQuickAddContactPayload(form){
  if(!form || typeof form.querySelector !== 'function') return null;
  const now = Date.now();
  const read = (name) => {
    const input = form.querySelector(`[name="${name}"]`);
    if(!input) return '';
    const value = input.value;
    return typeof value === 'string' ? value.trim() : String(value || '').trim();
  };
  const firstName = read('firstName');
  const lastName = read('lastName');
  const email = read('email');
  const phone = read('phone');
  let idSource = '';
  const idInput = form.querySelector('input[name="id"], input[name="contactId"], input[name="contact-id"]');
  if(idInput){
    const raw = idInput.value;
    idSource = typeof raw === 'string' ? raw.trim() : String(raw || '').trim();
  }
  const name = `${firstName} ${lastName}`.trim();
  return {
    id: idSource || `tmp-${now}`,
    __isNew: true,
    name: name || '',
    firstName,
    lastName,
    email,
    phone,
    meta: {
      createdAt: now,
      updatedAt: now
    }
  };
}

function ensureQuickAddFullEditor(form, qa, opener, overlay){
  if(!form || !doc || !qa || typeof opener !== 'function') return;
  if(form.querySelector(`[data-qa="${qa}"]`)) return;
  const saveBtn = form.querySelector('.qa-save');
  const actions = saveBtn ? saveBtn.parentElement : null;
  if(!actions) return;
  const button = doc.createElement('button');
  button.type = 'button';
  button.dataset.qa = qa;
  button.textContent = 'Open full editor';
  button.style.border = 'none';
  button.style.background = 'transparent';
  button.style.color = '#1570ef';
  button.style.cursor = 'pointer';
  button.style.fontSize = '13px';
  button.style.padding = '0';
  button.style.marginRight = 'auto';
  button.addEventListener('click', (event) => {
    if(event && typeof event.preventDefault === 'function') event.preventDefault();
    let payloadSent = false;
    if(qa === 'open-full-contact-editor'){
      const payload = collectQuickAddContactPayload(form);
      closeQuickAddOverlay(overlay);
      payloadSent = true;
      try {
        opener(payload);
      } catch (err) {
        try { console && console.warn && console.warn('[quick-add] full editor open failed', err); }
        catch (_) {}
      }
      return;
    }
    closeQuickAddOverlay(overlay);
    if(!payloadSent){
      try { opener(); }
      catch (err) {
        try { console && console.warn && console.warn('[quick-add] full editor open failed', err); }
        catch (_) {}
      }
    }
  });
  actions.prepend(button);
}

function ensureQuickAddFullEditors(){
  if(!doc) return;
  const overlay = doc.querySelector('.qa-overlay');
  if(!overlay) return;
  const contactForm = overlay.querySelector('.qa-form-contact');
  const partnerForm = overlay.querySelector('.qa-form-partner');
  ensureQuickAddFullEditor(contactForm, 'open-full-contact-editor', openContactEditor, overlay);
  ensureQuickAddFullEditor(partnerForm, 'open-full-partner-editor', openPartnerEditor, overlay);
}

function openQuickAdd(kind = 'contact'){
  const target = kind === 'partner' ? 'partner' : 'contact';
  wireQuickAddUnified({ copy: buildCopy() });
  const api = win && win.QuickAddUnified;
  if(api && typeof api.open === 'function'){
    api.open(target);
    ensureQuickAddFullEditors();
    return true;
  }
  if(win && typeof win.requestAnimationFrame === 'function'){
    win.requestAnimationFrame(() => {
      const next = win && win.QuickAddUnified;
      if(next && typeof next.open === 'function'){
        next.open(target);
        ensureQuickAddFullEditors();
      }
    });
  }
  return false;
}

const quickCreateMenuOptions = {
  openContact: () => openQuickAdd('contact'),
  openPartner: () => openQuickAdd('partner')
};

export function getQuickAddMenuOptions(){
  return quickCreateMenuOptions;
}

const headerQuickAddState = {
  cleanup: null,
  button: null,
  logged: false
};

function resetHeaderQuickAddState(){
  const { cleanup } = headerQuickAddState;
  if (typeof cleanup === 'function') {
    try { cleanup(); }
    catch (_) {}
  }
  headerQuickAddState.cleanup = null;
  headerQuickAddState.button = null;
}

export function bindHeaderQuickAddOnce(root, bus){
  void bus;
  if(!doc || !win) return null;
  const scope = root && typeof root.querySelector === 'function' ? root : doc;
  const trigger = scope ? scope.querySelector('[data-quick-add]') : null;
  if(!trigger){
    resetHeaderQuickAddState();
    return null;
  }
  if(headerQuickAddState.button === trigger && headerQuickAddState.button.isConnected !== false){
    return trigger;
  }

  resetHeaderQuickAddState();
  wireQuickAddUnified({ copy: buildCopy() });

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const signal = controller ? controller.signal : null;
  const handler = (event) => {
    if(event && typeof event.preventDefault === 'function') event.preventDefault();
    if(event && typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    openQuickAdd('contact');
  };

  let usedSignal = false;
  if(signal && typeof trigger.addEventListener === 'function'){
    try {
      trigger.addEventListener('click', handler, { signal });
      usedSignal = true;
    } catch (_err) {
      usedSignal = false;
    }
  }

  if(!usedSignal){
    trigger.addEventListener('click', handler, false);
  }

  headerQuickAddState.cleanup = () => {
    if(usedSignal){
      if(controller && !controller.signal.aborted){
        try { controller.abort(); }
        catch (_) {}
      }
    } else {
      try { trigger.removeEventListener('click', handler, false); }
      catch (_) {}
    }
  };
  headerQuickAddState.button = trigger;

  if(trigger && typeof trigger.setAttribute === 'function'){
    trigger.setAttribute('data-bound', '1');
  }
  if(!headerQuickAddState.logged && typeof console !== 'undefined' && typeof console.info === 'function'){
    console.info('[quick-add] bound-once');
    headerQuickAddState.logged = true;
  } else {
    headerQuickAddState.logged = true;
  }

  if(usedSignal && signal && typeof signal.addEventListener === 'function'){
    try {
      signal.addEventListener('abort', () => {
        if(headerQuickAddState.button === trigger){
          headerQuickAddState.button = null;
          headerQuickAddState.cleanup = null;
        }
      }, { once: true });
    } catch (_err) {}
  }

  return trigger;
}
