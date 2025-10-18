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

function collectOverlayNodes(){
  if(typeof document === 'undefined') return [];
  const selectors = [
    'dialog',
    '[role="dialog"]',
    '[aria-modal="true"]',
    '.modal',
    '.modal-container',
    '.modal-overlay'
  ];
  const joined = selectors.join(',');
  return Array.from(document.querySelectorAll(joined));
}

function tryCloseNode(node){
  if(!isElement(node)) return false;
  const candidates = Array.from(
    node.querySelectorAll('[data-ui="close"], [data-action="close"], button, [role="button"], a')
  );
  for(const candidate of candidates){
    if(!(candidate instanceof HTMLElement)) continue;
    const label = (candidate.getAttribute('aria-label') || candidate.textContent || '').trim().toLowerCase();
    if(!label) continue;
    if(label === 'close' || label.includes('close') || label.includes('dismiss')){
      try {
        candidate.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      } catch (_err) {}
      try {
        if(typeof candidate.click === 'function') candidate.click();
      } catch (_err) {}
      return true;
    }
  }
  if(typeof node.close === 'function'){
    try {
      node.close();
      return true;
    } catch (_err) {}
  }
  return false;
}

function forceHide(node){
  if(!isElement(node)) return;
  node.classList?.add('is-hidden');
  node.setAttribute?.('aria-hidden', 'true');
  if(node.style){
    node.style.setProperty('display', 'none', 'important');
    node.style.visibility = 'hidden';
  }
}

const PARTNER_SIGNATURE_PATTERN = /(partner|profile|overview)/i;
const ROGUE_HINT_PATTERN = /(partner-profile|partner-overview|profile-shell|partner\s*summary)/i;
const ROGUE_TEXT_PATTERNS = [
  /ytd referrals/i,
  /ytd funded/i,
  /delete partner/i,
  /reassign all/i,
  /partner overview/i
];

function looksCanonical(node, canonical){
  if(!isElement(node)) return false;
  if(node === canonical) return true;
  if(node.dataset?.modalKey === 'partner-edit') return true;
  if(typeof node.matches === 'function' && node.matches('[data-ui="partner-edit-modal"], #partner-modal')) return true;
  const text = (node.innerText || node.textContent || '').toLowerCase();
  if(text.includes('save partner')) return true;
  return false;
}

function looksPartnerish(node){
  if(!isElement(node)) return false;
  const signature = `${node.id || ''} ${node.className || ''}`;
  if(PARTNER_SIGNATURE_PATTERN.test(signature)) return true;
  const text = (node.innerText || node.textContent || '').toLowerCase();
  if(text.includes('partner')) return true;
  return false;
}

function shouldPrune(node, canonical){
  if(!isElement(node)) return false;
  if(looksCanonical(node, canonical)) return false;
  if(canonical && (node.contains(canonical) || canonical.contains?.(node))) return false;
  const signature = `${node.id || ''} ${node.className || ''}`;
  if(ROGUE_HINT_PATTERN.test(signature)) return true;
  if(!looksPartnerish(node)) return false;
  const text = (node.innerText || node.textContent || '').toLowerCase();
  return ROGUE_TEXT_PATTERNS.some(pattern => pattern.test(text));
}

function pruneNode(node){
  if(!isElement(node) || node.__partnerNameGatePruned) return;
  node.__partnerNameGatePruned = true;
  if(!tryCloseNode(node)){
    forceHide(node);
  }
  const id = typeof node.id === 'string' ? node.id : '';
  const cls = typeof node.className === 'string' ? node.className : '';
  safeWarn('[PARTNER_NAME_CLICK_GATE] pruned stray overlay', { id, cls });
}

function pruneStrayOverlays(preserve){
  if(typeof document === 'undefined') return;
  const canonical = isElement(preserve) ? preserve : findCanonicalModal();
  const overlays = collectOverlayNodes();
  overlays.forEach(node => {
    if(node === canonical) return;
    if(!isElement(node)) return;
    if(node.dataset?.ui === 'merge-modal') return;
    if(!shouldPrune(node, canonical)) return;
    pruneNode(node);
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
      scheduleMicrotask(() => pruneStrayOverlays(candidate));
    };

    schedulePrune(null);
    if(result && typeof result.then === 'function'){
      result.then(modal => pruneStrayOverlays(modal)).catch(() => pruneStrayOverlays(null));
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
  pruneStrayOverlays(preserve);
}

export default { installPartnerNameClickGate, prunePartnerOverlays };
