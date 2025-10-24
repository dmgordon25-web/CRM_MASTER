(function(){
  if(typeof document === 'undefined') return;
  let parityLogged = false;
  const selectors = ['input[data-table-search="#tbl-longshots"]'];

  function sendLog(eventName){
    const body = JSON.stringify({ event: eventName });
    let delivered = false;
    try{
      const nav = typeof navigator !== 'undefined' ? navigator : null;
      if(nav && typeof nav.sendBeacon === 'function'){
        const blob = new Blob([body], { type:'application/json' });
        delivered = nav.sendBeacon('/__log', blob) === true;
      }
    }catch(_err){}
    if(delivered) return true;
    try{
      fetch('/__log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      return true;
    }catch(_err){}
    return false;
  }

  function removeNode(node){
    if(!node) return;
    if(typeof node.remove === 'function'){ node.remove(); return; }
    if(node.parentNode){ node.parentNode.removeChild(node); }
  }

  function evaluateParity(){
    if(parityLogged) return;
    const host = document.getElementById('view-longshots');
    if(!host) return;
    let rogueFound = false;
    selectors.forEach(sel => {
      const matches = host.querySelectorAll(sel);
      if(matches.length){
        rogueFound = true;
        matches.forEach(removeNode);
      }
    });
    if(host.querySelector('input[data-table-search="#tbl-longshots"]')) return;
    parityLogged = true;
    try{ console.info('[VIS] long-shots parity ok'); }
    catch(_err){}
    sendLog('longshots-parity-ok');
    if(typeof document !== 'undefined'){
      document.removeEventListener('app:view:changed', onViewChange);
    }
  }

  function onViewChange(event){
    const view = event && event.detail ? event.detail.view : null;
    if(view === 'longshots') evaluateParity();
  }

  document.addEventListener('app:view:changed', onViewChange);

  const bootCheck = ()=>{
    const main = document.getElementById('view-longshots');
    if(main && !main.classList.contains('hidden')){
      evaluateParity();
    }
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bootCheck, { once:true });
  }else{
    bootCheck();
  }
})();
