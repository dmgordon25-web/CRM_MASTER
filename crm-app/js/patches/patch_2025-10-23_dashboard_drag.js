import initDashboardLayout from '../ui/dashboard_layout.js';

const FLAG_KEY = 'patch:2025-10-23:dashboard-drag';

if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
if(!window.__PATCHES_LOADED__) window.__PATCHES_LOADED__ = [];

(function run(){
  if(window.__INIT_FLAGS__[FLAG_KEY]) return;
  window.__INIT_FLAGS__[FLAG_KEY] = true;
  const spec = '/js/patches/patch_2025-10-23_dashboard_drag.js';
  if(!window.__PATCHES_LOADED__.includes(spec)){
    window.__PATCHES_LOADED__.push(spec);
  }
  const start = () => {
    const exec = () => {
      try {
        initDashboardLayout();
        console.info('[VIS] dashboard drag ready');
      } catch (err) {
        console.warn('[VIS] dashboard drag failed', err);
      }
    };
    if(typeof requestAnimationFrame === 'function')
      requestAnimationFrame(exec);
    else
      exec();
  };
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }else{
    start();
  }
})();
