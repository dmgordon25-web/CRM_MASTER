import { mountWorkbench, workbenchExportCsv } from '../workbench/index.js';

export async function initWorkbench(target, options = {}){
  return mountWorkbench(target, options);
}

export async function renderWorkbench(target, options = {}){
  return mountWorkbench(target, options);
}

if(typeof window !== 'undefined'){
  window.workbenchExportCsv = workbenchExportCsv;
  window.renderWorkbench = function(options){
    const root = targetRoot();
    return mountWorkbench(root, options);
  };
}

function targetRoot(){
  if(typeof document === 'undefined') return null;
  return document.querySelector('#route-root')
    || document.getElementById('view-workbench')
    || document.body;
}

export { workbenchExportCsv };
