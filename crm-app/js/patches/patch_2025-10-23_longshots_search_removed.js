const FLAG = 'patch:2025-10-23:longshots-search-removed';
const SPEC = '/js/patches/patch_2025-10-23_longshots_search_removed.js';

if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
if(!window.__PATCHES_LOADED__) window.__PATCHES_LOADED__ = [];

(function run(){
  if(window.__INIT_FLAGS__[FLAG]) return;
  window.__INIT_FLAGS__[FLAG] = true;
  if(!window.__PATCHES_LOADED__.includes(SPEC)){
    window.__PATCHES_LOADED__.push(SPEC);
  }

  function sendLog(eventName){
    if(!eventName) return false;
    const payload = JSON.stringify({ event: eventName });
    let delivered = false;
    try{
      if(typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'){
        delivered = navigator.sendBeacon('/__log', payload) === true;
      }
    }catch(_err){ delivered = false; }
    if(delivered) return true;
    try{
      if(typeof fetch === 'function'){
        fetch('/__log', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(()=>{});
        return true;
      }
    }catch(_err){}
    return false;
  }

  function checkParity(){
    const host = document.getElementById('view-longshots');
    if(!host) return;
    const residual = host.querySelector('input[data-table-search="#tbl-longshots"]');
    if(residual){
      try{ console.warn('[VIS] long-shots parity mismatch: local search still present'); }
      catch(_err){}
      return;
    }
    try{ console.info('[VIS] long-shots parity ok'); }
    catch(_err){}
    sendLog('longshots-parity-ok');
  }

  const start = () => { checkParity(); };
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }else{
    start();
  }
})();
