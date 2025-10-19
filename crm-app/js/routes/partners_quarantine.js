const HIDDEN_CLASS = 'is-hidden';
const ALLOWLIST = new Set(['merge-modal', 'merge-confirm', 'toast']);
const TEXT_MATCHERS = [
  'ytd referrals',
  'ytd funded volume',
  'reassign all',
  'delete partner',
  'tier preferred'
];
const ID_CLASS_MATCHERS = ['overview', 'profile', 'quick-view'];

let styleInjected = false;
let editorOpen = false;
let origShow = null;
let origShowModal = null;
let activeObserver = null;
let observerTimer = null;

function safeWarn(...args){
  try{
    if(typeof console !== 'undefined' && typeof console.warn === 'function'){
      console.warn(...args);
    }
  }catch(_err){}
}

function ensureStyle(){
  if(styleInjected) return;
  if(typeof document === 'undefined') return;
  const host = document.head || document.documentElement;
  if(!host) return;
  const style = document.createElement('style');
  style.type = 'text/css';
  style.textContent = `.${HIDDEN_CLASS}{display:none!important;}`;
  host.appendChild(style);
  styleInjected = true;
}

function getDataUi(node){
  if(!node) return '';
  const ui = typeof node.getAttribute === 'function' ? node.getAttribute('data-ui') : null;
  if(ui) return String(ui).trim();
  if(node.dataset && node.dataset.ui) return String(node.dataset.ui).trim();
  return '';
}

function labelFor(node){
  if(!node) return '';
  const ui = getDataUi(node);
  if(ui) return ui;
  if(typeof node.id === 'string' && node.id) return node.id;
  if(typeof node.className === 'string' && node.className) return node.className;
  return node.tagName ? node.tagName.toLowerCase() : '';
}

function shouldApply(){
  if(typeof document === 'undefined') return false;
  const body = document.body || document.documentElement;
  if(!body) return false;
  const route = (body.dataset && body.dataset.route) ? body.dataset.route : body.getAttribute('data-route');
  if(route && String(route).toLowerCase().includes('partner')) return true;
  if(typeof window !== 'undefined'){
    const hash = typeof window.location?.hash === 'string' ? window.location.hash.toLowerCase() : '';
    if(hash.includes('partner')) return true;
    const path = typeof window.location?.pathname === 'string' ? window.location.pathname.toLowerCase() : '';
    if(path.includes('partner')) return true;
  }
  return false;
}

function killDialogs(){
  if(typeof document === 'undefined') return;
  let dialogs = [];
  try{
    dialogs = Array.from(document.querySelectorAll('dialog'));
  }catch(_err){
    dialogs = [];
  }
  dialogs.forEach(dialog => {
    if(!dialog || typeof dialog !== 'object') return;
    const ui = getDataUi(dialog);
    const isAllowlisted = ALLOWLIST.has(ui);
    const isOpen = dialog.hasAttribute?.('open') || dialog.open === true;
    if(!isOpen && !editorOpen) return;
    if(isAllowlisted) return;
    let closed = false;
    if(typeof dialog.close === 'function'){
      try{
        dialog.close();
        closed = true;
      }catch(_err){}
    }
    if(dialog.hasAttribute && dialog.hasAttribute('open')){
      try{ dialog.removeAttribute('open'); }catch(_err){}
    }
    dialog.classList?.add(HIDDEN_CLASS);
    safeWarn('[PARTNERS] Closed stray dialog:', labelFor(dialog), new Error().stack);
    return closed;
  });
}

function nodeLooksLikeOverlay(node){
  if(!node || typeof node !== 'object') return false;
  if(node.closest && node.closest('#partner-modal')) return false;
  const id = typeof node.id === 'string' ? node.id.toLowerCase() : '';
  const cls = typeof node.className === 'string' ? String(node.className).toLowerCase() : '';
  if(ID_CLASS_MATCHERS.some(token => id.includes(token) || cls.includes(token))){
    return true;
  }
  const text = typeof node.textContent === 'string' ? node.textContent.toLowerCase() : '';
  if(TEXT_MATCHERS.some(token => text.includes(token))){
    return true;
  }
  return false;
}

function hideDivOverlays(){
  if(typeof document === 'undefined') return;
  let nodes = [];
  try{
    nodes = Array.from(document.querySelectorAll('[id*="partner"], [class*="partner"], [id*="Partner"], [class*="Partner"]'));
  }catch(_err){
    nodes = [];
  }
  nodes.forEach(node => {
    if(!nodeLooksLikeOverlay(node)) return;
    if(node.classList && node.classList.contains(HIDDEN_CLASS)) return;
    node.classList?.add(HIDDEN_CLASS);
    if(typeof node.setAttribute === 'function'){
      try{ node.setAttribute('aria-hidden', 'true'); }
      catch(_err){}
    }
    safeWarn('[PARTNERS] Hid stray DIV overlay:', labelFor(node), new Error().stack);
  });
}

function installGuards(){
  if(origShow || origShowModal) return;
  if(typeof HTMLDialogElement === 'undefined') return;
  const proto = HTMLDialogElement.prototype;
  if(!proto) return;
  origShow = proto.show;
  origShowModal = proto.showModal;
  if(typeof origShow === 'function'){
    proto.show = function guardedShow(){
      if(editorOpen && shouldApply()){
        const ui = getDataUi(this);
        if(!ALLOWLIST.has(ui)){
          this.classList?.add(HIDDEN_CLASS);
          safeWarn('[PARTNERS] Blocked dialog.show:', labelFor(this), new Error().stack);
          return undefined;
        }
      }
      return origShow.apply(this, arguments);
    };
  }
  if(typeof origShowModal === 'function'){
    proto.showModal = function guardedShowModal(){
      if(editorOpen && shouldApply()){
        const ui = getDataUi(this);
        if(!ALLOWLIST.has(ui)){
          this.classList?.add(HIDDEN_CLASS);
          safeWarn('[PARTNERS] Blocked dialog.showModal:', labelFor(this), new Error().stack);
          return undefined;
        }
      }
      return origShowModal.apply(this, arguments);
    };
  }
}

function restoreGuards(){
  if(typeof HTMLDialogElement === 'undefined') return;
  const proto = HTMLDialogElement.prototype;
  if(!proto) return;
  if(origShow){
    try{ proto.show = origShow; }
    catch(_err){}
    origShow = null;
  }
  if(origShowModal){
    try{ proto.showModal = origShowModal; }
    catch(_err){}
    origShowModal = null;
  }
}

function scheduleShortObserver(){
  if(typeof MutationObserver !== 'function') return;
  if(typeof document === 'undefined') return;
  const target = document.body || document.documentElement;
  if(!target) return;
  if(activeObserver){
    try{ activeObserver.disconnect(); }
    catch(_err){}
    activeObserver = null;
  }
  if(observerTimer){
    try{ clearTimeout(observerTimer); }
    catch(_err){}
    observerTimer = null;
  }
  const observer = new MutationObserver(() => quarantineStrays.onMutation());
  try{
    observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'class', 'style', 'data-ui'] });
    activeObserver = observer;
    observerTimer = setTimeout(() => {
      try{ observer.disconnect(); }
      catch(_err){}
      if(activeObserver === observer) activeObserver = null;
      observerTimer = null;
    }, 300);
  }catch(_err){
    try{ observer.disconnect(); }
    catch(__err){}
  }
}

const quarantineStrays = {
  runNow(){
    if(!shouldApply()) return;
    ensureStyle();
    killDialogs();
    hideDivOverlays();
  },
  onMutation(){
    if(!shouldApply()) return;
    killDialogs();
    hideDivOverlays();
  },
  enableWhileEditorOpen(){
    if(!shouldApply()) return;
    ensureStyle();
    editorOpen = true;
    installGuards();
    quarantineStrays.runNow();
    if(typeof requestAnimationFrame === 'function'){
      requestAnimationFrame(() => quarantineStrays.runNow());
    }
    setTimeout(() => quarantineStrays.runNow(), 0);
    scheduleShortObserver();
  },
  disable(){
    editorOpen = false;
    if(activeObserver){
      try{ activeObserver.disconnect(); }
      catch(_err){}
      activeObserver = null;
    }
    if(observerTimer){
      try{ clearTimeout(observerTimer); }
      catch(_err){}
      observerTimer = null;
    }
    restoreGuards();
  },
  scheduleMutationSweep(){
    scheduleShortObserver();
  }
};

export { quarantineStrays };
export default quarantineStrays;
