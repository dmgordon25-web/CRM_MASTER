let renderer = null;
let tasksApiPromise = null;

function ensureAppNamespace(){
  if(typeof window === 'undefined') return null;
  const appNs = window.App || {};
  window.App = appNs;
  return appNs;
}

export function getRenderer(){
  if(typeof renderer === 'function') return renderer;
  if(typeof window !== 'undefined' && typeof window.renderAll === 'function'){
    renderer = window.renderAll;
  }
  return renderer;
}

export function registerRenderer(fn){
  if(typeof fn !== 'function') return;
  renderer = fn;
  const appNs = ensureAppNamespace();
  if(appNs){
    appNs.renderAll = fn;
    appNs.getRenderer = getRenderer;
  }
  if(typeof window !== 'undefined' && typeof window.renderAll !== 'function'){
    window.renderAll = fn;
  }
}

function exposeTasksApi(mod){
  const appNs = ensureAppNamespace();
  if(!appNs) return;
  appNs.tasks = Object.assign({}, appNs.tasks, {
    createMinimal: mod?.createMinimalTask,
    createTask: mod?.createTask,
    createDashboardTask: mod?.createDashboardTask,
    updateTaskStatus: mod?.updateTaskStatus
  });
  appNs.getTasksApi = getTasksApi;
}

export async function getTasksApi(){
  if(tasksApiPromise) return tasksApiPromise;
  tasksApiPromise = import('./tasks/api.js')
    .then((mod) => {
      exposeTasksApi(mod);
      return mod;
    })
    .catch((err) => {
      tasksApiPromise = null;
      throw err;
    });
  return tasksApiPromise;
}

(function attachAppGetters(){
  const appNs = ensureAppNamespace();
  if(!appNs) return;
  appNs.getRenderer = getRenderer;
  appNs.getTasksApi = getTasksApi;
})();
