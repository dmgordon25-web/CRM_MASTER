import { openPartnerEdit as legacyOpenPartnerEdit } from '../partners_modal.js';

const MODAL_SELECTOR = '[data-ui="partner-edit-modal"], #partner-modal';
const CONTACT_MODAL_SELECTOR = '[data-ui="contact-modal"], #contact-modal';
const FOCUSABLE_SELECTOR = 'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

let pendingOpen = null;

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

function removeExtraPartnerModals(keep){
  const nodes = asArray(document.querySelectorAll('[data-ui="partner-edit-modal"]'));
  nodes.forEach(node => {
    if(keep && node === keep) return;
    cleanupNodeHandles(node);
    if(node.parentNode){
      node.parentNode.removeChild(node);
    }
  });
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

function ensureModalAttributes(root){
  if(!root) return;
  root.setAttribute('data-ui', 'partner-edit-modal');
  if(root.dataset) root.dataset.ui = 'partner-edit-modal';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-hidden', 'false');
  root.dataset.open = '1';
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

function trackPendingOpen(promise, partnerId){
  const tracked = promise.finally(() => {
    if(pendingOpen && pendingOpen.promise === tracked){
      pendingOpen = null;
    }
  });
  return { promise: tracked, partnerId };
}

export function closePartnerEditModal(){
  const root = findPartnerModal();
  if(!root) return;
  cleanupNodeHandles(root);
  const wasOpen = root.dataset?.open === '1' || root.getAttribute('aria-hidden') === 'false' || root.hasAttribute('open');
  root.dataset.open = '0';
  root.setAttribute('aria-hidden', 'true');
  root.classList.add('hidden');
  root.style.display = 'none';
  if(root.hasAttribute('open')) root.removeAttribute('open');
  if(root.dataset) root.dataset.partnerId = '';
  if(wasOpen){
    try{ root.dispatchEvent(new Event('close', { bubbles: false, cancelable: false })); }
    catch(_err){}
  }
}

async function performOpen(partnerId){
  closePartnerEditModal();
  const keep = findPartnerModal();
  removeExtraPartnerModals(keep || null);
  hideContactModals();
  await legacyOpenPartnerEdit(partnerId);
  const root = findPartnerModal();
  if(!root) return null;
  ensureModalAttributes(root);
  wireCloseButtons(root);
  installEscHandler(root);
  focusFirstElement(root);
  return root;
}

export async function openPartnerEditModal(id){
  const partnerId = id == null ? '' : String(id).trim();
  if(!partnerId) return null;

  if(pendingOpen){
    if(pendingOpen.partnerId === partnerId){
      return pendingOpen.promise;
    }
    const sequence = pendingOpen.promise.then(
      () => performOpen(partnerId),
      () => performOpen(partnerId)
    );
    pendingOpen = trackPendingOpen(sequence, partnerId);
    return pendingOpen.promise;
  }

  const sequence = performOpen(partnerId);
  pendingOpen = trackPendingOpen(sequence, partnerId);
  return pendingOpen.promise;
}

export default {
  openPartnerEditModal,
  closePartnerEditModal
};
