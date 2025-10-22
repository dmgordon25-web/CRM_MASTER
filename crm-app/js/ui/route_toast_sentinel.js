// Minimal route-change toast; idempotent; dev-visible only; no throws
(function(){
  try{
    if (window.__ROUTE_TOAST_WIRED__) return; window.__ROUTE_TOAST_WIRED__=true;
    const show = (msg)=>{
      try{
        let t = document.getElementById('dev-route-toast');
        if (!t) {
          t = document.createElement('div'); t.id='dev-route-toast'; t.setAttribute('data-ui','route-toast');
          t.style.cssText='position:fixed;right:12px;bottom:12px;padding:8px 12px;background:#111;color:#fff;border-radius:6px;box-shadow:0 4px 10px rgba(0,0,0,.2);z-index:100000;font:12px/1.2 system-ui';
          document.body.appendChild(t);
        }
        t.textContent = msg; t.style.opacity='1';
        clearTimeout(t.__to); t.__to=setTimeout(()=>{t.style.opacity='0.0';},1500);
      }catch(e){ console.info('[A_BEACON] route toast err', e && (e.message||e)); }
    };
    const onHash = ()=> show('Switched to: ' + (location.hash||'#/'));
    window.addEventListener('hashchange', onHash, false);
    // fire once on initial load
    requestAnimationFrame(onHash);
    console.info('[A_BEACON] route toast wired');
  }catch(e){ console.info('[A_BEACON] route toast wire fail', e && (e.message||e)); }
}());
