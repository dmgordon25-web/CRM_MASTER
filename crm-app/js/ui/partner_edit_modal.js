import { openPartnerEdit as legacyOpenPartnerEdit } from '../partners_modal.js';
import { ensureSingletonModal, closeSingletonModal, registerModalCleanup } from './modal_singleton.js';

const MODAL_KEY = 'partner-edit';
const MODAL_SELECTOR = '[data-ui="partner-edit-modal"], #partner-modal';
const CONTACT_MODAL_SELECTOR = '[data-ui="contact-modal"], #contact-modal';
const LEGACY_PARTNER_DIALOG_SELECTORS = [
  '[data-ui*="partner-overview"]',
  '[data-role*="partner-overview"]',
  '.partner-overview-modal',
  'dialog.partner-overview'
];
const LEGACY_PARTNER_DIALOG_TEXT_PATTERNS = [
  /partner\s+overview/i,
  /relationship\s+pulse/i,
  /tier\s+(?:top|core|developing|keep)/i,
  /ytd\s+(?:referrals|funded)/i,
  /reassign/i,
  /delete\s+partner/i
];
const FOCUSABLE_SELECTOR = 'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
const scheduleMicrotask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => Promise.resolve().then(fn);

let pendingOpen = null;
let lastInvoker = null;

function asArray(value){
  if(value == null) return [];
  if(Array.isArray(value)) return value;
  if(typeof value[Symbol.iterator] === 'function'){
    return Array.from(value);
  }
  return [value];
}

function isElement(node){
  return !!(node && node.nodeType === 1);
}

function isCanonicalPartnerModal(node){
  if(!isElement(node)) return false;
  if(node.dataset?.modalKey === MODAL_KEY) return true;
  const id = typeof node.id === 'string' ? node.id.toLowerCase() : '';
  if(id === 'partner-modal') return true;
  const dataUi = typeof node.getAttribute === 'function' ? (node.getAttribute('data-ui') || '') : '';
  if(dataUi && dataUi.toLowerCase().includes('partner-edit-modal')) return true;
  const className = typeof node.className === 'string' ? node.className.toLowerCase() : '';
  return className.includes('partner-edit-modal');
}

function legacyDialogSignature(node){
  if(!isElement(node)) return '';
  const id = typeof node.id === 'string' ? node.id : '';
  const cls = typeof node.className === 'string' ? node.className : '';
  return `${id} ${cls}`.trim().toLowerCase();
}

function legacyDialogText(node){
  if(!isElement(node)) return '';
  const text = typeof node.innerText === 'string' ? node.innerText : node.textContent;
  return String(text == null ? '' : text).slice(0, 2000);
}

function looksLikeLegacyPartnerDialog(node){
  if(!isElement(node) || isCanonicalPartnerModal(node)) return false;
  const signature = legacyDialogSignature(node);
  if(/partner[-_\s]*overview/i.test(signature)) return true;
  if(/partner[-_\s]*(?:summary|detail)/i.test(signature) && !signature.includes('edit')) return true;
  const text = legacyDialogText(node);
  if(!text) return false;
  return LEGACY_PARTNER_DIALOG_TEXT_PATTERNS.some(pattern => pattern.test(text));
}

function collectLegacyPartnerDialogs(){
  if(typeof document === 'undefined') return [];
  const nodes = new Set();
  LEGACY_PARTNER_DIALOG_SELECTORS.forEach(selector => {
    try{
      document.querySelectorAll(selector).forEach(node => {
        if(isElement(node)) nodes.add(node);
      });
    }catch(_err){}
  });
  try{
    document.querySelectorAll('dialog,[role="dialog"],.modal').forEach(node => {
      if(isElement(node)) nodes.add(node);
    });
  }catch(_err){}
  return Array.from(nodes);
}

function preserveAncestors(target, preserveSet){
  if(!target || !preserveSet) return;
  let current = target;
  let depth = 0;
  while(current && depth < 6){
    preserveSet.add(current);
    current = current.parentNode;
    depth += 1;
  }
}

function purgeLegacyPartnerDialogs(options = {}){
  if(typeof document === 'undefined') return;
  const preserveSet = new Set();
  const preserveList = asArray(options.preserve).filter(Boolean);
  preserveList.forEach(node => preserveAncestors(node, preserveSet));
  const trigger = options.trigger && isElement(options.trigger) ? options.trigger : null;
  if(trigger) preserveAncestors(trigger, preserveSet);

  collectLegacyPartnerDialogs().forEach(node => {
    if(!isElement(node)) return;
    if(preserveSet.has(node)) return;
    if(isCanonicalPartnerModal(node)) return;
    if(!looksLikeLegacyPartnerDialog(node)) return;
    try{
      if(typeof node.close === 'function'){
        node.close();
      }
    }catch(_err){}
    if(node.classList){
      node.classList.add('hidden');
    }
    node.setAttribute?.('aria-hidden', 'true');
    if(node.parentNode && !preserveSet.has(node.parentNode)){
      try{ node.parentNode.removeChild(node); }
      catch(_err){
        try{ node.remove(); }
        catch(__err){}
      }
    }else if(typeof node.remove === 'function'){
      try{ node.remove(); }
      catch(_err){}
    }
  });
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
      node.dataset.sourceHint = '';
    }
    node.setAttribute('aria-hidden', 'true');
    node.classList.add('hidden');
    node.style.display = 'none';
    if(node.hasAttribute('open')) node.removeAttribute('open');
    if(typeof node.removeAttribute === 'function'){
      try{ node.removeAttribute('data-source-hint'); }
      catch(_err){}
    }
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
  root.__partnerSourceHint = '';
  purgeLegacyPartnerDialogs({ preserve: root });
  if(typeof window !== 'undefined'){
    try{ window.__PARTNER_MODAL_SOURCE_HINT__ = ''; }
    catch(_err){ window.__PARTNER_MODAL_SOURCE_HINT__ = ''; }
  }
}

export async function openPartnerEditModal(id, options){
  const partnerId = id == null ? '' : String(id).trim();
  if(!partnerId) return null;

  const sourceHint = options && typeof options.sourceHint === 'string'
    ? options.sourceHint.trim()
    : '';

  if(typeof window !== 'undefined'){
    try{ window.__PARTNER_MODAL_SOURCE_HINT__ = sourceHint; }
    catch(_err){ window.__PARTNER_MODAL_SOURCE_HINT__ = sourceHint; }
  }

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
    purgeLegacyPartnerDialogs({ preserve: base, trigger: invoker });

    await legacyOpenPartnerEdit(partnerId);

    purgeLegacyPartnerDialogs({ preserve: base, trigger: invoker });

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
      root.dataset.sourceHint = sourceHint || '';
    }
    if(typeof root.setAttribute === 'function'){
      try{
        if(sourceHint){ root.setAttribute('data-source-hint', sourceHint); }
        else{ root.removeAttribute('data-source-hint'); }
      }catch(_err){}
    }
    root.__partnerInvoker = invoker || root.__partnerInvoker || null;
    root.__partnerSourceHint = sourceHint || '';

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

  pendingOpen = sequence.finally(() => {
    pendingOpen = null;
    if(typeof window !== 'undefined'){
      const existing = document.querySelector(`[data-modal-key="${MODAL_KEY}"]`);
      if(!existing || existing.dataset?.open !== '1'){
        try{ window.__PARTNER_MODAL_SOURCE_HINT__ = ''; }
        catch(_err){ window.__PARTNER_MODAL_SOURCE_HINT__ = ''; }
      }
    }
  });
  return sequence;
}

export default {
  openPartnerEditModal,
  closePartnerEditModal
};
