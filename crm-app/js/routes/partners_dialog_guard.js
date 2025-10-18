const ALLOWED_DIALOG_SELECTOR = '[data-ui="merge-modal"], [data-ui="merge-confirm"], [data-ui="toast"]';

function isElement(node){
  return !!node && typeof node === 'object' && node.nodeType === 1;
}

function isDialog(node){
  return isElement(node) && typeof node.tagName === 'string' && node.tagName.toLowerCase() === 'dialog';
}

function matchesAllowed(node){
  if(!isDialog(node)) return true;
  if(typeof node.matches !== 'function') return false;
  return node.matches(ALLOWED_DIALOG_SELECTOR);
}

function safeWarn(...args){
  try{
    if(typeof console !== 'undefined' && typeof console.warn === 'function'){
      console.warn(...args);
    }
  }catch(_err){}
}

function closeOrHideDialog(node){
  if(!isDialog(node)) return;

  if(typeof node.close === 'function'){
    try{
      node.close();
    }catch(_err){}
  }

  if(node.open){
    try{ node.open = false; }
    catch(_err){}
  }

  if(typeof node.removeAttribute === 'function'){
    try{ node.removeAttribute('open'); }
    catch(_err){}
  }

  if(node.classList && typeof node.classList.add === 'function'){
    node.classList.add('is-hidden');
  }

  if(node.setAttribute){
    try{ node.setAttribute('aria-hidden', 'true'); }
    catch(_err){}
  }

  if(node.style){
    try{
      node.style.setProperty('display', 'none', 'important');
      node.style.visibility = 'hidden';
    }catch(_err){}
  }

  const id = typeof node.id === 'string' ? node.id : '';
  const cls = typeof node.className === 'string' ? node.className : '';
  safeWarn('[PARTNERS_DIALOG_GUARD] closed stray dialog', { id, cls });
}

function inspectNode(node){
  if(!isElement(node)) return;

  const dialogs = [];
  if(isDialog(node)){
    dialogs.push(node);
  }
  if(typeof node.querySelectorAll === 'function'){
    try{
      dialogs.push(...node.querySelectorAll('dialog[open]'));
    }catch(_err){}
  }

  dialogs.forEach(dialog => {
    if(!isDialog(dialog)) return;
    if(!dialog.hasAttribute('open') && !dialog.open) return;
    if(matchesAllowed(dialog)) return;
    closeOrHideDialog(dialog);
  });
}

function sweepDialogs(){
  if(typeof document === 'undefined') return;
  let dialogs;
  try{
    dialogs = document.querySelectorAll('dialog[open]');
  }catch(_err){
    dialogs = [];
  }
  dialogs.forEach(dialog => {
    if(!isDialog(dialog)) return;
    if(matchesAllowed(dialog)) return;
    closeOrHideDialog(dialog);
  });
}

let activeGuard = null;

export function installPartnersDialogGuard(){
  if(typeof document === 'undefined'){
    return {
      dispose(){},
      sweep(){},
      isActive: false
    };
  }

  if(activeGuard) return activeGuard;

  const body = document.body || document.documentElement;
  if(!body || typeof MutationObserver !== 'function'){
    sweepDialogs();
    activeGuard = {
      dispose(){},
      sweep: sweepDialogs,
      isActive: false
    };
    return activeGuard;
  }

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if(!mutation) return;
      if(mutation.type === 'childList'){
        mutation.addedNodes.forEach(node => inspectNode(node));
      }
      if(mutation.type === 'attributes' && mutation.target){
        inspectNode(mutation.target);
      }
    });
  });

  try{
    observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
  }catch(_err){
    sweepDialogs();
    activeGuard = {
      dispose(){},
      sweep: sweepDialogs,
      isActive: false
    };
    return activeGuard;
  }

  sweepDialogs();

  activeGuard = {
    dispose(){
      try{ observer.disconnect(); }
      catch(_err){}
      activeGuard = null;
    },
    sweep: sweepDialogs,
    isActive: true
  };

  return activeGuard;
}

export default {
  installPartnersDialogGuard
};
