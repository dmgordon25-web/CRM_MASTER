// dash_range.js — Dashboard timeframe toggle
import dashboardState from './state/dashboard_state.js';

(function(){
  if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if(window.__INIT_FLAGS__.dash_range) return;
  window.__INIT_FLAGS__.dash_range = true;

  const api = dashboardState || (window.dashboardState);
  if(!api) return;

  function $(s,r){ return (r||document).querySelector(s); }

  function sync(){
    const btn = $('#dash-range');
    if(!btn) return;
    const range = typeof api.getRange === 'function' ? api.getRange() : 'all';
    btn.textContent = range === 'tm' ? 'This Month ▾' : 'All Time ▾';
  }

  function cycle(){
    const current = typeof api.getRange === 'function' ? api.getRange() : 'all';
    const next = current === 'all' ? 'tm' : 'all';
    if(typeof api.setRange === 'function'){
      api.setRange(next, { reason: 'dash-range:toggle' });
    }
  }

  const btn = $('#dash-range');
  if(btn && !btn.__wired){
    btn.__wired = true;
    btn.addEventListener('click', cycle);
  }

  const unsubscribe = typeof api.subscribe === 'function'
    ? api.subscribe((state, changed) => {
        if(changed && changed.has('range')) sync();
      })
    : null;

  if(typeof window.addEventListener === 'function' && typeof unsubscribe === 'function'){
    window.addEventListener('beforeunload', unsubscribe, { once: true });
  }

  sync();
})();
