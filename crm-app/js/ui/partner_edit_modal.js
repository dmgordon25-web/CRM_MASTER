import { openPartnerEdit as legacyOpenPartnerEdit } from '../partners_modal.js';
import { ensureSingletonModal, closeSingletonModal, registerModalCleanup } from './modal_singleton.js';

const MODAL_KEY = 'partner-edit';
const MODAL_SELECTOR = '[data-ui="partner-edit-modal"], #partner-modal';
const CONTACT_MODAL_SELECTOR = '[data-ui="contact-modal"], #contact-modal';
const PARTNER_PROFILE_SELECTOR = '#partner-profile-modal';
const FOCUSABLE_SELECTOR = 'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
const scheduleMicrotask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => Promise.resolve().then(fn);

let pendingOpen = null;
let lastInvoker = null;

function asArray(value){
  return Array.isArray(value) ? value : Array.from(value || []);
}

function isVisible(node){
  if(!node) return false;
  const style = node instanceof HTMLElement ? window.getComputedStyle(node) : null;
  if(style && (style.visibility === 'hidden' || style.display === 'none')) return false;
  if(node.hasAttribute('aria-hidden') && node.getAttribute('aria-hidden') === 'true') return false;
  if(typeof node.offsetParent === 'object' && node.offsetParent === null && style && style.position !== 'fixed'){
    return false;
  }
  return true;
}

function findPartnerModal(){
  if(typeof document === 'undefined') return null;
  const modal = document.querySelector(MODAL_SELECTOR);
  return modal || null;
}

function cleanupNodeHandles(node){
  if(!node) return;
  if(node.__partnerEscHandler){
    document.removeEventListener('keydown', node.__partnerEscHandler);
    node.__partnerEscHandler = null;
  }
  if(typeof node.__partnerFocusTrapCleanup === 'function'){
    try{ node.__partnerFocusTrapCleanup(); }
    catch(_err){}
    node.__partnerFocusTrapCleanup = null;
  }
}

function hideContactModals(){
  const nodes = asArray(document.querySelectorAll(CONTACT_MODAL_SELECTOR));
  nodes.forEach(node => {
    if(!node) return;
    cleanupNodeHandles(node);
    if(typeof node.close === 'function'){
      try{ node.close(); }
      catch(_err){}
    }
    node.classList?.add('hidden');
    node.style.display = 'none';
    node.setAttribute?.('aria-hidden', 'true');
    if(node.hasAttribute?.('open')){
      node.removeAttribute('open');
    }
  });
}

function hidePartnerProfileModal(){
  if(typeof document === 'undefined') return;
  const profile = document.querySelector(PARTNER_PROFILE_SELECTOR);
  if(!profile) return;
  try{
    if(typeof profile.close === 'function') profile.close();
  }catch(_err){
    try{ profile.removeAttribute && profile.removeAttribute('open'); }
    catch(__err){}
  }
  if(profile.style){ profile.style.display = 'none'; }
  if(profile.setAttribute){ profile.setAttribute('aria-hidden', 'true'); }
}

function ensureModalAttributes(root){
  if(!root) return;
  root.setAttribute('data-modal-key', MODAL_KEY);
  root.setAttribute('data-ui', 'partner-edit-modal');
  if(root.dataset){
    root.dataset.modalKey = MODAL_KEY;
    root.dataset.ui = 'partner-edit-modal';
    root.dataset.open = '1';
    root.dataset.opening = root.dataset.opening || '1';
  }
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-hidden', 'false');
  root.classList.remove('hidden');
  root.style.display = 'flex';
  root.style.alignItems = root.style.alignItems || 'center';
  root.style.justifyContent = root.style.justifyContent || 'center';
  const currentZ = Number.parseInt(root.style.zIndex || '', 10);
  if(Number.isNaN(currentZ) || currentZ < 1400){
    root.style.zIndex = '1400';
  }
  if(!root.id) root.id = 'partner-modal';
  const shell = root.querySelector('.dlg');
  if(shell){
    if(!shell.hasAttribute('tabindex')) shell.setAttribute('tabindex', '-1');
    shell.setAttribute('role', 'document');
  }
}

function installEscHandler(root){
  if(!root) return;
  if(root.__partnerEscHandler){
    document.removeEventListener('keydown', root.__partnerEscHandler);
    root.__partnerEscHandler = null;
  }
  const handler = (event)=>{
    if(event.key !== 'Escape') return;
    event.preventDefault();
    closePartnerEditModal();
  };
  document.addEventListener('keydown', handler);
  root.__partnerEscHandler = handler;
}

function focusFirstElement(root){
  const shell = root?.querySelector?.('.dlg') || root;
  if(!shell) return;
  const focusables = asArray(shell.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(el => el instanceof HTMLElement && !el.hasAttribute('disabled') && isVisible(el));
  if(!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  const trap = (event)=>{
    if(event.key !== 'Tab') return;
    if(focusables.length === 1){
      event.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
    if(event.shiftKey){
      if(document.activeElement === first || !shell.contains(document.activeElement)){
        event.preventDefault();
        last.focus({ preventScroll: true });
      }
      return;
    }
    if(document.activeElement === last){
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  if(root.__partnerFocusTrapCleanup){
    try{ root.__partnerFocusTrapCleanup(); }
    catch(_err){}
  }
  const listenerTarget = shell;
  listenerTarget.addEventListener('keydown', trap);
  root.__partnerFocusTrapCleanup = ()=> listenerTarget.removeEventListener('keydown', trap);

  if(typeof requestAnimationFrame === 'function'){
    requestAnimationFrame(()=>{
      try{ first.focus({ preventScroll: true }); }
      catch(_err){}
    });
  }else{
    try{ first.focus(); }
    catch(_err){}
  }
}

function wireCloseButtons(root){
  if(!root) return;
  const buttons = asArray(root.querySelectorAll('[data-ui="close"], [data-close-partner], [data-close]'));
  buttons.forEach(btn => {
    if(!btn) return;
    if(!btn.getAttribute('data-ui')){
      btn.setAttribute('data-ui', 'close');
      if(btn.dataset) btn.dataset.ui = btn.dataset.ui || 'close';
    }
    if(btn.__partnerCloseHandler) return;
    btn.__partnerCloseHandler = true;
    btn.addEventListener('click', (event)=>{
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closePartnerEditModal();
    }, { capture: true });
  });
}

function ensurePartnerShell(){
  const existing = findPartnerModal();
  if(existing) return existing;
  const template = typeof document !== 'undefined' ? document.getElementById('partner-modal') : null;
  if(template) return template;
  if(typeof document === 'undefined') return null;
  const host = document.querySelector('[data-ui="modal-root"]')
    || document.body
    || document.documentElement
    || null;
  if(!host) return null;
  const wrapper = document.createElement('div');
  wrapper.id = 'partner-modal';
  wrapper.className = 'modal partner-edit-modal';
  wrapper.innerHTML = '<div class="dlg" tabindex="-1"></div>';
  wrapper.setAttribute('data-ui', 'partner-edit-modal');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.display = 'none';
  if(wrapper.dataset){
    wrapper.dataset.ui = 'partner-edit-modal';
    wrapper.dataset.qa = 'partner-edit-modal';
  }
  host.appendChild(wrapper);
  return wrapper;
}

function resolveInvoker(source){
  if(!source) return null;
  if(source instanceof HTMLElement) return source;
  if(typeof source === 'object'){
    if(source.trigger instanceof HTMLElement) return source.trigger;
    if(source.currentTarget instanceof HTMLElement) return source.currentTarget;
    if(source.target instanceof HTMLElement) return source.target;
  }
  return null;
}

export function closePartnerEditModal(){
  const root = document.querySelector(`[data-modal-key="${MODAL_KEY}"]`) || findPartnerModal();
  if(!root) return;
  const wasOpen = root.dataset?.open === '1'
    || root.getAttribute('aria-hidden') === 'false'
    || root.hasAttribute('open');
  cleanupNodeHandles(root);
  if(root.dataset){
    root.dataset.opening = '0';
  }
  const beforeRemove = (node)=>{
    if(node.dataset){
      node.dataset.open = '0';
      node.dataset.opening = '0';
      node.dataset.partnerId = '';
    }
    node.setAttribute('aria-hidden', 'true');
    node.classList.add('hidden');
    node.style.display = 'none';
    if(node.hasAttribute('open')) node.removeAttribute('open');
    if(wasOpen){
      try{ node.dispatchEvent(new Event('close', { bubbles: false, cancelable: false })); }
      catch(_err){}
    }
  };
  closeSingletonModal(root, { beforeRemove, remove: false });
  const invoker = root.__partnerInvoker || lastInvoker;
  if(invoker && typeof invoker.focus === 'function'){
    try{ invoker.focus({ preventScroll: true }); }
    catch(_err){
      try{ invoker.focus(); }
      catch(__err){}
    }
  }
  root.__partnerInvoker = null;
  lastInvoker = null;
}

export async function openPartnerEditModal(id, options){
  const partnerId = id == null ? '' : String(id).trim();
  if(!partnerId) return null;

  const invoker = resolveInvoker(options);
  if(invoker) lastInvoker = invoker;

  const existing = document.querySelector(`[data-modal-key="${MODAL_KEY}"]`);
  if(existing && existing.dataset?.open === '1' && existing.dataset.partnerId === partnerId){
    focusFirstElement(existing);
    return existing;
  }

  if(pendingOpen){
    return pendingOpen;
  }

  const sequence = (async () => {
    let base = ensureSingletonModal(MODAL_KEY, () => ensurePartnerShell());
    base = base instanceof Promise ? await base : base;
    if(!base) return null;

    if(base.dataset?.opening === '1'){
      return base;
    }

    if(base.dataset){
      base.dataset.opening = '1';
    }
    base.__partnerInvoker = invoker || base.__partnerInvoker || null;

    hideContactModals();
    hidePartnerProfileModal();

    await legacyOpenPartnerEdit(partnerId);

    let root = findPartnerModal();
    if(root !== base && root){
      let ensured = ensureSingletonModal(MODAL_KEY, () => root);
      root = ensured instanceof Promise ? await ensured : ensured;
    }else{
      root = base;
    }
    if(!root) return null;

    if(root.dataset){
      root.dataset.opening = '1';
      root.dataset.partnerId = partnerId;
    }
    root.__partnerInvoker = invoker || root.__partnerInvoker || null;

    cleanupNodeHandles(root);
    registerModalCleanup(root, cleanupNodeHandles);
    ensureModalAttributes(root);
    wireCloseButtons(root);
    installEscHandler(root);
    focusFirstElement(root);

    const clearOpening = () => {
      if(root.dataset) root.dataset.opening = '0';
    };
    root.addEventListener('shown', clearOpening, { once: true });

    scheduleMicrotask(() => {
      try{ root.dispatchEvent(new Event('shown', { bubbles: false, cancelable: false })); }
      catch(_err){}
    });

    return root;
  })();

  pendingOpen = sequence.finally(() => { pendingOpen = null; });
  return sequence;
}

export default {
  openPartnerEditModal,
  closePartnerEditModal
};
