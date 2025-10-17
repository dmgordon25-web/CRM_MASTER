const FLAG_PARAM = 'partnerdebug';
const FLAG_VALUE = '1';
const CLICK_LOG_LIMIT = 50;
const HEADER_MATCHERS = [
  /YTD\s+Referrals/i,
  /YTD\s+Funded/i,
  /Delete\s+Partner/i,
  /Reassign/i,
  /Tier\s+/i,
  /Partner\s+Overview/i,
  /Partner\s+Profile/i,
  /Partner\s+Details/i
];

let cachedFlag = null;
let debugInstalled = false;
let clickLog = null;

function safeConsole(method, ...args){
  try{
    const fn = console && typeof console[method] === 'function' ? console[method] : null;
    if(fn){ fn.apply(console, args); }
  }catch(_err){}
}

export function isPartnerDebugEnabled(){
  if(typeof window === 'undefined') return false;
  if(cachedFlag != null) return cachedFlag;
  let enabled = false;
  try{
    const search = typeof window.location?.search === 'string' ? window.location.search : '';
    if(search){
      try{
        const params = new URLSearchParams(search);
        if(params.get(FLAG_PARAM) === FLAG_VALUE){
          enabled = true;
        }
      }catch(_err){}
    }
  }catch(_err){}
  if(!enabled){
    try{
      if(window.localStorage?.getItem(FLAG_PARAM) === FLAG_VALUE){
        enabled = true;
      }
    }catch(_err){}
  }
  cachedFlag = enabled;
  return enabled;
}

function ensureClickLog(){
  if(!clickLog){
    clickLog = [];
    if(typeof window !== 'undefined'){
      try{ window.__partnersClicks = clickLog; }
      catch(_err){
        try{ window.__partnersClicks = clickLog; }
        catch(__err){}
      }
    }
  }
  return clickLog;
}

function describeNode(node){
  if(!node) return '';
  if(typeof window !== 'undefined'){
    if(node === window) return 'window';
  }
  if(typeof document !== 'undefined' && node === document) return 'document';
  if(node.nodeType === 3) return `#text(${(node.textContent || '').trim().slice(0, 20)})`;
  if(typeof Element !== 'undefined' && node instanceof Element){
    const parts = [];
    let current = node;
    let depth = 0;
    while(current && depth < 4){
      if(current.nodeType !== 1) break;
      let descriptor = current.tagName ? current.tagName.toLowerCase() : '';
      if(current.id) descriptor += `#${current.id}`;
      if(current.classList && current.classList.length){
        descriptor += '.' + Array.from(current.classList).slice(0, 3).join('.');
      }
      if(current.getAttribute){
        const role = current.getAttribute('data-role');
        if(role) descriptor += `[data-role="${role}"]`;
      }
      parts.push(descriptor);
      current = current.parentElement;
      depth += 1;
    }
    return parts.join(' > ');
  }
  if(typeof node.toString === 'function'){
    return node.toString();
  }
  return Object.prototype.toString.call(node);
}

function isPartnersListTarget(target){
  if(!target || typeof document === 'undefined') return false;
  if(target === document) return !!document.getElementById('tbl-partners');
  if(typeof Element !== 'undefined' && target instanceof Element){
    if(typeof target.matches === 'function' && target.matches('a.partner-name, [data-role="partner-name"], [data-partner-id]')){
      return true;
    }
    if(typeof target.closest === 'function'){
      const partnerLink = target.closest('a.partner-name, [data-role="partner-name"], [data-partner-id]');
      if(partnerLink){
        return true;
      }
      const listRoot = target.closest('#tbl-partners, [data-route="partners"], [data-page="partners"], .partners-list');
      if(listRoot){
        return true;
      }
    }
  }
  return false;
}

function installClickListenerTrace(){
  if(typeof EventTarget === 'undefined') return;
  const proto = EventTarget.prototype;
  if(!proto || proto.addEventListener.__partnerDebugWrapped){
    return;
  }
  const original = proto.addEventListener;
  if(typeof original !== 'function') return;
  const log = ensureClickLog();

  const patched = function(type, listener, options){
    if(type === 'click' && listener && isPartnersListTarget(this)){
      try{
        const handlerRef = typeof listener === 'function'
          ? listener
          : (listener && typeof listener.handleEvent === 'function' ? listener.handleEvent : null);
        const entry = {
          type,
          at: Date.now(),
          target: describeNode(this),
          handlerName: handlerRef ? (handlerRef.name || 'anonymous') : String(listener),
          handlerRef: handlerRef || listener
        };
        log.push(entry);
        if(log.length > CLICK_LOG_LIMIT){
          log.splice(0, log.length - CLICK_LOG_LIMIT);
        }
      }catch(_err){}
    }
    return original.call(this, type, listener, options);
  };
  patched.__partnerDebugWrapped = true;
  patched.__partnerDebugOriginal = original;
  proto.addEventListener = patched;
}

function looksLikeDialog(node){
  if(!node || node.nodeType !== 1) return false;
  if(typeof Element !== 'undefined' && !(node instanceof Element)) return false;
  const el = node;
  const tag = el.tagName ? el.tagName.toLowerCase() : '';
  if(tag === 'dialog') return true;
  const role = typeof el.getAttribute === 'function' ? el.getAttribute('role') : '';
  if(role && /dialog/i.test(role)) return true;
  const className = typeof el.className === 'string' ? el.className : '';
  if(className && /modal/i.test(className)) return true;
  if(className && /partner/i.test(className)) return true;
  if(typeof el.querySelector === 'function'){
    const header = el.querySelector('h1, h2, h3, .header, .modal-title');
    if(header){
      const text = (header.textContent || '').trim();
      if(text){
        if(HEADER_MATCHERS.some(pattern => pattern.test(text))){
          return true;
        }
      }
    }
  }
  return false;
}

function summarizeNode(node){
  if(!node || node.nodeType !== 1) return { tag: '', id: '', cls: '', textHead: '' };
  const el = node;
  let headerText = '';
  if(typeof el.querySelector === 'function'){
    const header = el.querySelector('h1, h2, h3, .header, .modal-title');
    if(header){
      headerText = (header.textContent || '').trim().slice(0, 80);
    }
  }
  return {
    tag: el.tagName || '',
    id: el.id || '',
    cls: typeof el.className === 'string' ? el.className : '',
    textHead: headerText
  };
}

function collectElements(node){
  if(!node) return [];
  if(node.nodeType === 1) return [node];
  if(node.nodeType === 11){
    const list = [];
    node.childNodes?.forEach?.(child => {
      if(child.nodeType === 1){
        list.push(child);
      }
    });
    return list;
  }
  return [];
}

function logInsert(node){
  const summary = summarizeNode(node);
  safeConsole('info', '[DOM_MODAL_INSERT]', summary);
  try{
    const stack = new Error('dom-insert');
    safeConsole('info', '[DOM_STACK]', stack.stack);
  }catch(_err){}
}

function logRemove(node){
  const summary = summarizeNode(node);
  safeConsole('info', '[DOM_MODAL_REMOVE]', summary);
}

function installDomMutationTrace(){
  if(typeof Node === 'undefined') return;
  const proto = Node.prototype;
  if(!proto) return;

  const originalAppend = proto.appendChild;
  if(typeof originalAppend === 'function' && !originalAppend.__partnerDebugWrapped){
    const wrappedAppend = function appendChildPatched(child){
      const result = originalAppend.call(this, child);
      try{
        collectElements(child).filter(looksLikeDialog).forEach(logInsert);
      }catch(_err){}
      return result;
    };
    wrappedAppend.__partnerDebugWrapped = true;
    wrappedAppend.__partnerDebugOriginal = originalAppend;
    proto.appendChild = wrappedAppend;
  }

  const originalInsertBefore = proto.insertBefore;
  if(typeof originalInsertBefore === 'function' && !originalInsertBefore.__partnerDebugWrapped){
    const wrappedInsertBefore = function insertBeforePatched(newChild, refChild){
      const result = originalInsertBefore.call(this, newChild, refChild);
      try{
        collectElements(newChild).filter(looksLikeDialog).forEach(logInsert);
      }catch(_err){}
      return result;
    };
    wrappedInsertBefore.__partnerDebugWrapped = true;
    wrappedInsertBefore.__partnerDebugOriginal = originalInsertBefore;
    proto.insertBefore = wrappedInsertBefore;
  }

  const originalRemove = proto.removeChild;
  if(typeof originalRemove === 'function' && !originalRemove.__partnerDebugWrapped){
    const wrappedRemove = function removeChildPatched(oldChild){
      const result = originalRemove.call(this, oldChild);
      try{
        collectElements(oldChild).filter(looksLikeDialog).forEach(logRemove);
      }catch(_err){}
      return result;
    };
    wrappedRemove.__partnerDebugWrapped = true;
    wrappedRemove.__partnerDebugOriginal = originalRemove;
    proto.removeChild = wrappedRemove;
  }
}

function markPreserve(set, node){
  let current = node;
  let steps = 0;
  while(current && steps < 6){
    set.add(current);
    current = current.parentNode;
    steps += 1;
  }
}

function findHeaderText(node){
  if(!node || typeof node.querySelector !== 'function') return '';
  const header = node.querySelector('h1, h2, h3, .header, .modal-title');
  return header ? (header.textContent || '').trim() : '';
}

function tryCloseNode(node){
  if(!node || node.nodeType !== 1) return false;
  let closed = false;
  if(typeof node.close === 'function'){
    try{ node.close(); closed = true; }
    catch(_err){}
  }
  if(!closed){
    const button = node.querySelector?.('[data-action="close"], [data-ui="modal-close"], [data-role="close"], .modal-close, .close, button[aria-label="Close"], button[data-dismiss="modal"]');
    if(button){
      try{ button.click(); closed = true; }
      catch(_err){
        try{
          const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
          button.dispatchEvent(evt);
          closed = true;
        }catch(__err){}
      }
    }
  }
  if(!closed && node.classList){
    node.classList.add('hidden');
    if(node.setAttribute){
      try{ node.setAttribute('aria-hidden', 'true'); }
      catch(_err){}
    }
    if(node.style){
      node.style.display = 'none';
    }
    closed = true;
  }
  if(closed && node.removeAttribute){
    try{ node.removeAttribute('open'); }
    catch(_err){}
  }
  return closed;
}

function collectCandidateDialogs(){
  if(typeof document === 'undefined') return [];
  const nodes = new Set();
  const selectors = [
    'dialog',
    '[role="dialog"]',
    '[class*="modal"]',
    '.modal',
    '.dialog'
  ];
  selectors.forEach(selector => {
    try{
      document.querySelectorAll(selector).forEach(node => {
        if(node instanceof Element) nodes.add(node);
      });
    }catch(_err){}
  });
  return Array.from(nodes);
}

export function softKillPartnerDialogs(options = {}){
  if(!isPartnerDebugEnabled()) return [];
  if(typeof document === 'undefined') return [];
  const { preserve, trigger } = options;
  const preserved = new Set();
  const preserveList = [];
  if(Array.isArray(preserve)){
    preserveList.push(...preserve);
  }else if(preserve){
    preserveList.push(preserve);
  }
  preserveList.forEach(node => markPreserve(preserved, node));
  const canonical = document.querySelector?.('[data-modal-key="partner-edit"], [data-ui="partner-edit-modal"], #partner-modal');
  if(canonical) markPreserve(preserved, canonical);
  if(trigger && trigger instanceof Element) markPreserve(preserved, trigger);

  const affected = [];
  collectCandidateDialogs().forEach(node => {
    if(!node || preserved.has(node)) return;
    let current = node.parentNode;
    while(current){
      if(preserved.has(current)) return;
      current = current.parentNode;
    }
    if(!looksLikeDialog(node)) return;
    const headerText = findHeaderText(node);
    const summary = {
      id: node.id || '',
      cls: typeof node.className === 'string' ? node.className : '',
      header: headerText.slice(0, 80),
      preserved: false
    };
    const closed = tryCloseNode(node);
    if(closed){
      affected.push(summary);
      safeConsole('warn', '[SOFT_KILL modal]', summary);
    }
  });
  return affected;
}

export function ensurePartnerDomDebug(){
  if(debugInstalled || !isPartnerDebugEnabled()){
    if(!debugInstalled && isPartnerDebugEnabled() && typeof window !== 'undefined'){
      try{ window.__PARTNER_DEBUG__ = window.__PARTNER_DEBUG__ || {}; }
      catch(_err){}
      if(window.__PARTNER_DEBUG__){
        window.__PARTNER_DEBUG__.softKillPartnerDialogs = softKillPartnerDialogs;
        window.__PARTNER_DEBUG__.ensurePartnerDomDebug = ensurePartnerDomDebug;
        window.__PARTNER_DEBUG__.isPartnerDebugEnabled = isPartnerDebugEnabled;
      }
    }
    return;
  }
  debugInstalled = true;
  installClickListenerTrace();
  installDomMutationTrace();
  if(typeof window !== 'undefined'){
    try{
      window.__PARTNER_DEBUG__ = window.__PARTNER_DEBUG__ || {};
      window.__PARTNER_DEBUG__.softKillPartnerDialogs = softKillPartnerDialogs;
      window.__PARTNER_DEBUG__.ensurePartnerDomDebug = ensurePartnerDomDebug;
      window.__PARTNER_DEBUG__.isPartnerDebugEnabled = isPartnerDebugEnabled;
    }catch(_err){
      try{
        window.__PARTNER_DEBUG__ = {
          softKillPartnerDialogs,
          ensurePartnerDomDebug,
          isPartnerDebugEnabled
        };
      }catch(__err){}
    }
  }
}

if(isPartnerDebugEnabled()){
  ensurePartnerDomDebug();
}

export default {
  ensurePartnerDomDebug,
  softKillPartnerDialogs,
  isPartnerDebugEnabled
};
