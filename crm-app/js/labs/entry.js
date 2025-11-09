let widgetsModulePromise = null;

function loadWidgets(){
  if(!widgetsModulePromise){
    widgetsModulePromise = import('./widgets.js');
  }
  return widgetsModulePromise;
}

export async function initLabs(root){
  if(!root) return;
  const module = await loadWidgets();
  const render = typeof module?.initLabsView === 'function'
    ? module.initLabsView
    : typeof module?.renderLabsView === 'function'
      ? module.renderLabsView
      : typeof module?.default === 'function'
        ? module.default
        : null;
  if(!render){
    throw new Error('Labs widgets missing initLabsView export');
  }
  await render(root);
  try { console.info('[labs] view rendered'); }
  catch (_) {}
}

export default initLabs;
