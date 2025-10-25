import { text } from './ui/strings.js';
import { wireQuickAddUnified } from './ui/quick_add_unified.js';

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

function openQuickAdd(kind = 'contact'){
  const target = kind === 'partner' ? 'partner' : 'contact';
  wireQuickAddUnified({ copy: buildCopy() });
  const api = win && win.QuickAddUnified;
  if(api && typeof api.open === 'function'){
    api.open(target);
    return true;
  }
  if(win && typeof win.requestAnimationFrame === 'function'){
    win.requestAnimationFrame(() => {
      const next = win && win.QuickAddUnified;
      if(next && typeof next.open === 'function'){
        next.open(target);
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

function ensureTrigger(){
  if(!doc || typeof doc.querySelector !== 'function') return;
  const trigger = doc.querySelector('[data-quick-add]');
  if(!trigger || trigger.__quickAddUnified) return;
  trigger.__quickAddUnified = true;
  trigger.addEventListener('click', (event) => {
    if(event && typeof event.preventDefault === 'function') event.preventDefault();
    if(event && typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    openQuickAdd('contact');
  });
}

if(doc && win){
  wireQuickAddUnified({ copy: buildCopy() });
  ensureTrigger();
  if(typeof doc.addEventListener === 'function'){
    doc.addEventListener('DOMContentLoaded', () => {
      wireQuickAddUnified({ copy: buildCopy() });
      ensureTrigger();
    }, { once: true });
  }
}
