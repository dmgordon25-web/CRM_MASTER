(function calendarContactTaskVerifier(){
  if(typeof document === 'undefined') return;

  const FLAG_KEY = 'patch:2025-10-23:calendar-contact-task';
  const SPEC = '/js/patches/patch_2025-10-23_calendar_contact_and_task.js';

  if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if(window.__INIT_FLAGS__[FLAG_KEY]) return;
  window.__INIT_FLAGS__[FLAG_KEY] = true;

  if(!Array.isArray(window.__PATCHES_LOADED__)) window.__PATCHES_LOADED__ = [];
  if(!window.__PATCHES_LOADED__.includes(SPEC)) window.__PATCHES_LOADED__.push(SPEC);

  function postLog(eventName){
    const payload = JSON.stringify({ event: eventName });
    let delivered = false;
    if(typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'){
      try{
        const blob = new Blob([payload], { type:'application/json' });
        delivered = navigator.sendBeacon('/__log', blob) === true;
      }catch (_err){}
    }
    if(delivered || typeof fetch !== 'function') return;
    try{
      fetch('/__log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(()=>{});
    }catch (_err){}
  }

  let logged = false;
  function logReady(){
    if(logged) return;
    logged = true;
    try{ console && typeof console.info === 'function' && console.info('[VIS] calendar contact/task wiring ready'); }
    catch (_err){}
    postLog('calendar-contact-task-ready');
  }

  function hasEnhancedNode(){
    const root = document.getElementById('calendar-root') || document.getElementById('calendar');
    if(!root) return false;
    const node = root.querySelector('[data-calendar-enhanced]');
    if(!node) return false;
    const menu = node.querySelector('button[aria-label="Event quick actions"]');
    if(!menu) return false;
    if(typeof window.renderContactModal !== 'function') return false;
    return true;
  }

  function ensure(){
    if(hasEnhancedNode()){
      logReady();
      disconnect();
    }
  }

  let observer = null;
  function disconnect(){
    if(observer){
      try{ observer.disconnect(); }
      catch (_err){}
      observer = null;
    }
  }

  function observe(){
    if(typeof MutationObserver !== 'function'){
      ensure();
      return;
    }
    observer = new MutationObserver(()=> ensure());
    const target = document.body || document.documentElement;
    if(!target){
      ensure();
      return;
    }
    observer.observe(target, { childList:true, subtree:true });
    ensure();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', observe, { once:true });
  }else{
    observe();
  }
})();
