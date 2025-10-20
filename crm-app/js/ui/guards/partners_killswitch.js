const ELEMENT_NODE = 1;
const FRAGMENT_NODE = 11;
const ROGUE_CLASS_PATTERN = /partner-overview/i;
const CANONICAL_PATTERN = /(partner-modal|partner-edit)/i;
const ROGUE_TEXT_PATTERNS = [
  /ytd referrals/i,
  /ytd funded/i,
  /delete partner/i,
  /reassign all/i,
  /\btier\s+(?:[0-9]+|[a-d])/i
];

let observer = null;
let cleanupReady = null;
let activeCleanup = null;

function safeWarn(...args){
  try{
    if(typeof console !== 'undefined' && typeof console.warn === 'function'){
      console.warn(...args);
    }
  }catch(_err){}
}

function logSuppression(node){
  const id = typeof node?.id === 'string' ? node.id : '';
  const cls = typeof node?.className === 'string' ? node.className : '';
  safeWarn('[PARTNER_KILLSWITCH] suppressed overview', { id, cls });
}

function isElement(node){
  return !!node && node.nodeType === ELEMENT_NODE;
}

function getSignature(node){
  if(!node) return '';
  const id = typeof node.id === 'string' ? node.id : '';
  const cls = typeof node.className === 'string' ? node.className : '';
  return `${id} ${cls}`.trim();
}

function nodeText(node){
  if(!node) return '';
  const text = typeof node.innerText === 'string' ? node.innerText : node.textContent;
  if(!text) return '';
  return String(text).slice(0, 3000);
}

function matchesCanonical(node){
  if(!isElement(node)) return false;
  if(node.dataset?.modalKey === 'partner-edit') return true;
  const signature = getSignature(node).toLowerCase();
  if(CANONICAL_PATTERN.test(signature)) return true;
  const text = nodeText(node).toLowerCase();
  return text.includes('save partner');
}

function matchesRogue(node){
  if(!isElement(node)) return false;
  if(matchesCanonical(node)) return false;
  const signature = getSignature(node).toLowerCase();
  if(ROGUE_CLASS_PATTERN.test(signature)) return true;
  const role = (node.getAttribute?.('role') || '').toLowerCase();
  const ariaModal = (node.getAttribute?.('aria-modal') || '').toLowerCase();
  const qualifies = role === 'dialog'
    || ariaModal === 'true'
    || (typeof node.matches === 'function' && node.matches('dialog,.modal'));
  if(!qualifies) return false;
  const text = nodeText(node).toLowerCase();
  return ROGUE_TEXT_PATTERNS.some(pattern => pattern.test(text));
}

function tryCloseNode(node){
  if(!isElement(node)) return false;
  const candidates = Array.from(node.querySelectorAll('[data-ui="close"], button, [role="button"], a'));
  for(const candidate of candidates){
    if(!(candidate instanceof HTMLElement)) continue;
    const label = (candidate.getAttribute('aria-label') || candidate.textContent || '').trim().toLowerCase();
    if(!label) continue;
    if(label === 'close' || label.includes('close')){
      candidate.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      if(typeof candidate.click === 'function'){
        candidate.click();
      }
      return true;
    }
  }
  if(typeof node.close === 'function'){
    try{
      node.close();
      return true;
    }catch(_err){}
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

function suppressNode(node){
  if(!isElement(node) || node.__partnerKillSwitchSuppressed) return;
  node.__partnerKillSwitchSuppressed = true;
  logSuppression(node);
  if(tryCloseNode(node)) return;
  forceHide(node);
}

function handleCanonical(node){
  if(!isElement(node)) return;
  if(node.__partnerKillSwitchCanonical) return;
  node.__partnerKillSwitchCanonical = true;
  stopObserver();
  const resume = ()=>{
    node.removeEventListener('close', resume);
    node.__partnerKillSwitchCanonical = false;
    startObserver();
    scanExisting();
  };
  node.addEventListener('close', resume, { once: true });
}

function evaluateNode(node){
  if(!isElement(node)) return;
  if(matchesCanonical(node)){
    handleCanonical(node);
    return;
  }
  if(matchesRogue(node)){
    suppressNode(node);
    return;
  }
  if(typeof node.querySelectorAll === 'function'){
    const nested = node.querySelectorAll('dialog,[role="dialog"],[aria-modal="true"],.modal');
    nested.forEach(child => {
      if(child === node) return;
      evaluateNode(child);
    });
  }
}

function scanExisting(){
  if(typeof document === 'undefined') return;
  const nodes = document.querySelectorAll('dialog,[role="dialog"],[aria-modal="true"],.modal');
  nodes.forEach(node => evaluateNode(node));
}

function handleMutations(mutations){
  if(!mutations) return;
  mutations.forEach(mutation => {
    mutation.addedNodes?.forEach(node => scanTree(node));
  });
}

function scanTree(node){
  if(!node) return;
  const type = node.nodeType;
  if(type === FRAGMENT_NODE){
    node.childNodes?.forEach(child => scanTree(child));
    return;
  }
  if(type === ELEMENT_NODE){
    evaluateNode(node);
  }
}

function startObserver(){
  if(typeof document === 'undefined') return;
  if(observer) return;
  const body = document.body || document.documentElement;
  if(!body) return;
  observer = new MutationObserver(handleMutations);
  observer.observe(body, { childList: true, subtree: true });
}

function stopObserver(){
  if(observer){
    observer.disconnect();
    observer = null;
  }
}

function ready(fn){
  if(typeof document === 'undefined') return;
  if(document.readyState === 'loading'){
    const handler = ()=>{
      document.removeEventListener('DOMContentLoaded', handler);
      fn();
    };
    document.addEventListener('DOMContentLoaded', handler);
    cleanupReady = ()=>{
      document.removeEventListener('DOMContentLoaded', handler);
      cleanupReady = null;
    };
  }else{
    fn();
  }
}

export function ensurePartnersKillSwitch(){
  if(activeCleanup) return activeCleanup;
  if(typeof document === 'undefined'){
    activeCleanup = () => {};
    return activeCleanup;
  }
  const init = ()=>{
    startObserver();
    scanExisting();
  };
  ready(init);
  activeCleanup = ()=>{
    stopObserver();
    if(typeof cleanupReady === 'function'){
      cleanupReady();
      cleanupReady = null;
    }
    activeCleanup = null;
  };
  return activeCleanup;
}

export default { ensurePartnersKillSwitch };
