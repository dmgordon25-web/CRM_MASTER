const WORKBENCH_SPEC = (() => {
  try {
    return new URL('../workbench/index.js', import.meta.url).href;
  } catch (_) {
    return '../workbench/index.js';
  }
})();

async function loadWorkbench(){
  try{
    const mod = await import(WORKBENCH_SPEC);
    if(mod && typeof mod.mountWorkbench === 'function'){
      return mod;
    }
  }catch (err){
    console.warn('[soft] [workbench] module load failed', err);
  }
  return { mountWorkbench: () => {} };
}

export async function mountWorkbench(root, options = {}){
  const mod = await loadWorkbench();
  return mod.mountWorkbench(root, options);
}

export async function renderWorkbench(root, options = {}){
  return mountWorkbench(root, options);
}

export async function initWorkbench(root, options = {}){
  return mountWorkbench(root, options);
}

export async function ensureWorkbench(options = {}){
  const mod = await loadWorkbench();
  return mod.mountWorkbench(undefined, options);
}
