const DEFAULT_SELECTOR = 'a.partner-name, [data-role="partner-name"], [data-partner-id]';
const scheduleMicrotask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => Promise.resolve().then(fn);

function isElement(node){
  return !!node && node.nodeType === 1;
}

function safeWarn(...args){
  try {
    if(typeof console !== 'undefined' && typeof console.warn === 'function'){
      console.warn(...args);
    }
  } catch (_err) {}
}

function findCanonicalModal(){
  if(typeof document === 'undefined') return null;
  return document.querySelector('[data-modal-key="partner-edit"]')
    || document.querySelector('[data-ui="partner-edit-modal"]')
    || document.getElementById('partner-modal')
    || null;
}

function canonicalDialog(node){
  if(!isElement(node)) return null;
  if(typeof node.closest !== 'function') return null;
  if(node.tagName && node.tagName.toLowerCase() === 'dialog') return node;
  return node.closest('dialog');
}

function dismissDialog(dialog){
  if(!isElement(dialog)) return false;
  const selectors = [
    '[data-ui="close"]',
    '[data-action="close"]',
    '[data-role="close"]',
    'button[aria-label*="close" i]',
    'button[name="close" i]',
    'button.close',
    '.close'
  ];
  for(const selector of selectors){
    const candidate = dialog.querySelector(selector);
    if(!(candidate instanceof HTMLElement)) continue;
    try {
      candidate.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } catch (_err) {}
    try {
      candidate.click();
    } catch (_err) {}
    return true;
  }
  if(typeof dialog.close === 'function'){
    try {
      dialog.close();
      return true;
    } catch (_err) {}
  }
  return false;
}

function hideDialog(dialog){
  if(!isElement(dialog)) return;
  dialog.classList?.add('is-hidden');
  dialog.setAttribute?.('aria-hidden', 'true');
  if(dialog.style){
    dialog.style.setProperty('display', 'none', 'important');
    dialog.style.visibility = 'hidden';
  }
}

function closeStrayPartnerDialogs(preserve){
  if(typeof document === 'undefined') return;
  const keep = new Set();
  const canonical = findCanonicalModal();
  if(isElement(canonical)) keep.add(canonical);
  const preservedDialog = canonicalDialog(preserve);
  if(preservedDialog) keep.add(preservedDialog);
  const dialogs = document.querySelectorAll('dialog[open]');
  dialogs.forEach(dialog => {
    if(!isElement(dialog)) return;
    if(keep.has(dialog)) return;
    const id = dialog.id || '';
    const cls = dialog.className || '';
    const dataUi = dialog.getAttribute?.('data-ui') || '';
    const lowerCls = cls.toLowerCase();
    const lowerUi = dataUi.toLowerCase();
    if(id === 'partner-modal' || lowerCls.includes('partner-edit-modal') || lowerUi.includes('partner-edit-modal')){
      keep.add(dialog);
      return;
    }
    const signature = `${id} ${cls} ${dataUi}`.toLowerCase();
    if(!signature.includes('partner')) return;
    const dismissed = dismissDialog(dialog);
    if(!dismissed){
      hideDialog(dialog);
    }
    safeWarn('[PARTNERS_CANONICALIZE] closed stray partner dialog', { id, cls });
  });
}

function defaultResolveId(trigger){
  if(!trigger) return '';
  const dataset = trigger.dataset || {};
  if(dataset.partnerId) return dataset.partnerId;
  if(dataset.id) return dataset.id;
  if(typeof trigger.getAttribute === 'function'){
    const attr = trigger.getAttribute('data-partner-id') || trigger.getAttribute('data-id');
    if(attr) return attr;
  }
  return '';
}

export function installPartnerNameClickGate(root, openEditFn, options = {}){
  if(!root || typeof root.addEventListener !== 'function') return null;
  if(typeof openEditFn !== 'function') return null;
  if(root.__partnerNameClickGate){
    return root.__partnerNameClickGate;
  }

  const selector = typeof options.selector === 'string' && options.selector.trim()
    ? options.selector
    : DEFAULT_SELECTOR;
  const resolveId = typeof options.resolveId === 'function' ? options.resolveId : defaultResolveId;
  const beforeOpen = typeof options.beforeOpen === 'function' ? options.beforeOpen : null;
  const afterOpen = typeof options.afterOpen === 'function' ? options.afterOpen : null;

  const handler = (event) => {
    if(!event || event.__partnerNameGateHandled) return;
    const rawTarget = event.target;
    const target = rawTarget instanceof Element
      ? rawTarget
      : (rawTarget && rawTarget.parentElement) || null;
    if(!target) return;
    const trigger = typeof target.closest === 'function' ? target.closest(selector) : null;
    if(!trigger || !root.contains(trigger)) return;

    if(beforeOpen){
      let shouldContinue = true;
      try {
        const outcome = beforeOpen({ event, trigger, root });
        if(outcome === false) shouldContinue = false;
      }
      catch (_err) {}
      if(!shouldContinue) return;
    }

    const partnerId = resolveId(trigger, event);
    if(!partnerId) return;

    event.__partnerNameGateHandled = true;
    if(typeof event.preventDefault === 'function') event.preventDefault();
    if(typeof event.stopPropagation === 'function') event.stopPropagation();
    if(typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

    let result = null;
    try {
      result = openEditFn(partnerId, { trigger, event });
    } catch (err) {
      safeWarn('openPartnerEdit failed', err);
    }

    const schedulePrune = (candidate) => {
      scheduleMicrotask(() => closeStrayPartnerDialogs(candidate));
    };

    schedulePrune(null);
    if(result && typeof result.then === 'function'){
      result.then(modal => closeStrayPartnerDialogs(modal)).catch(() => closeStrayPartnerDialogs(null));
    } else {
      schedulePrune(result);
    }

    if(afterOpen){
      try {
        const maybePromise = afterOpen({ event, trigger, root, result });
        if(maybePromise && typeof maybePromise.then === 'function'){
          maybePromise.catch(() => {});
        }
      } catch (_err) {}
    }
  };

  root.addEventListener('click', handler, true);
  const teardown = () => root.removeEventListener('click', handler, true);
  root.__partnerNameClickGate = { teardown };
  return root.__partnerNameClickGate;
}

export function prunePartnerOverlays(preserve){
  closeStrayPartnerDialogs(preserve);
}

export default { installPartnerNameClickGate, prunePartnerOverlays };
