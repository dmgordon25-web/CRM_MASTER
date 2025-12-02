const CONTACTS_MODULE_PATH = '../contacts.js';
let editorModule = null;
let editorModulePromise = null;

function loadEditorModule() {
  if (editorModule) return Promise.resolve(editorModule);
  if (!editorModulePromise) {
    editorModulePromise = import(CONTACTS_MODULE_PATH)
      .then((mod) => {
        editorModule = mod || null;
        return editorModule;
      })
      .catch((err) => {
        editorModulePromise = null;
        throw err;
      });
  }
  return editorModulePromise;
}

function resolveApi(mod) {
  if (!mod || typeof mod !== 'object') return {};
  return {
    open: typeof mod.openContactEditor === 'function' ? mod.openContactEditor : null,
    close: typeof mod.closeContactEditor === 'function' ? mod.closeContactEditor : null,
    reset: typeof mod.resetContactEditorForRouteLeave === 'function' ? mod.resetContactEditorForRouteLeave : null
  };
}

export async function getContactEditorApi() {
  const mod = editorModule || await loadEditorModule().catch(() => null);
  return resolveApi(mod);
}

export function openContactEditor(target, options) {
  if (editorModule && typeof editorModule.openContactEditor === 'function') {
    return editorModule.openContactEditor(target, options);
  }
  return loadEditorModule()
    .then((mod) => {
      const api = resolveApi(mod);
      if (typeof api.open === 'function') {
        return api.open(target, options);
      }
      console.warn?.('[contact-editor-api] openContactEditor unavailable');
      return null;
    })
    .catch((err) => {
      console.warn?.('[contact-editor-api] openContactEditor failed to load', err);
      return null;
    });
}

export function closeContactEditor(reason) {
  if (editorModule && typeof editorModule.closeContactEditor === 'function') {
    return editorModule.closeContactEditor(reason);
  }
  return loadEditorModule()
    .then((mod) => {
      const api = resolveApi(mod);
      if (typeof api.close === 'function') {
        return api.close(reason);
      }
      console.warn?.('[contact-editor-api] closeContactEditor unavailable');
      return null;
    })
    .catch((err) => {
      console.warn?.('[contact-editor-api] closeContactEditor failed to load', err);
      return null;
    });
}

export function resetContactEditorForRouteLeave() {
  if (editorModule && typeof editorModule.resetContactEditorForRouteLeave === 'function') {
    return editorModule.resetContactEditorForRouteLeave();
  }
  return loadEditorModule()
    .then((mod) => {
      const api = resolveApi(mod);
      if (typeof api.reset === 'function') {
        return api.reset();
      }
      return null;
    })
    .catch((err) => {
      console.warn?.('[contact-editor-api] resetContactEditorForRouteLeave failed to load', err);
      return null;
    });
}
